// Server-side Gemini proxy — the shared-tier AI path.
//
// Why this exists: the old "project key" tier inlined VITE_GEMINI_API_KEY into
// the client bundle, which meant either shipping a secret to every visitor or
// (as happened in prod) shipping nothing and silently killing AI for new users.
// This function keeps the key in Netlify env, verifies the caller's Supabase
// session, and enforces per-user quotas server-side where they can't be reset
// from devtools.
//
// Env (Netlify dashboard → Site configuration → Environment variables):
//   GEMINI_API_KEY        — required. The ONLY new var; never prefix with VITE_.
//   VITE_SUPABASE_URL     — already set for the build; reused here.
//   VITE_SUPABASE_ANON_KEY — already set for the build; reused here.
//   GEMINI_MODEL          — optional model override.
//
// Request:  POST { feature: 'receipts'|'recipes', parts: [...], generationConfig?: {...} }
//           with Authorization: Bearer <supabase access token>
// Response: 200 { text }  or  { code, message, retryDelaySeconds? } with an error status.
// Error codes mirror src/lib/gemini.js so the client banner logic needs no new cases.

export const config = { path: '/api/gemini' };

const DEFAULT_MODEL = 'gemini-2.5-flash';

// Per-user hourly caps for the shared tier. Mirror BUCKETS in src/lib/rateLimit.js —
// the client copy is the courtesy UX, this is the boundary.
const QUOTAS = {
  receipts: { capacity: 5, windowSeconds: 3600 },
  recipes: { capacity: 15, windowSeconds: 3600 },
};

const MAX_TEXT_CHARS = 20000;
// Netlify's function request body caps at 6MB. base64 inflates ~33%, and the
// JSON wrapper adds a bit, so keep the encoded image under ~5.2MB of chars.
// The client downscales to ~2000px (well under this); this is the backstop.
const MAX_IMAGE_BASE64_CHARS = 5200000;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function env(name) {
  return process.env[name] || null;
}

// Validate the Supabase JWT by asking Supabase who it belongs to.
// Plain REST — no SDK dependency needed for one endpoint.
async function getUserFromToken(token, supabaseUrl, anonKey) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

// Atomic server-side token bucket via the consume_ai_quota RPC (see
// supabase/migrations). Runs under the USER's JWT so auth.uid() scopes the row.
//
// This is the ONLY spend boundary on the shared Gemini key — the client-side
// rateLimit.js is courtesy UX and resettable from devtools. So it fails
// CLOSED: any Supabase 5xx, pool timeout or auth hiccup used to answer
// "allowed", which meant one client could burn the key for every user during
// an outage. The missing-migration escape hatch is now opt-in via env, so
// production can never silently run without a boundary.
const ALLOW_QUOTA_FAIL_OPEN = process.env.AI_QUOTA_FAIL_OPEN === 'true';

async function consumeQuota(feature, token, supabaseUrl, anonKey) {
  const quota = QUOTAS[feature];
  let res;
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_bucket: `${feature}_project`,
        p_capacity: quota.capacity,
        p_window_seconds: quota.windowSeconds,
      }),
    });
  } catch (err) {
    // Network failure reaching Supabase — no boundary, no call.
    console.error('consume_ai_quota unreachable:', err?.message);
    return { allowed: false, unavailable: true };
  }

  if (res.status === 404 && ALLOW_QUOTA_FAIL_OPEN) {
    console.warn('consume_ai_quota RPC missing — AI_QUOTA_FAIL_OPEN is set, allowing through (local/bootstrap only).');
    return { allowed: true };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`consume_ai_quota failed (${res.status}): ${body.slice(0, 200)} — failing closed.`);
    return { allowed: false, unavailable: true };
  }
  return res.json();
}

// Accept only the request shapes the app actually sends. Anything else is
// someone using the proxy as a general Gemini gateway. Returns
// { parts } on success or { error: { code, message } } on rejection.
function validateParts(parts) {
  const reject = (code, message) => ({ error: { code, message } });
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > 2) {
    return reject('BAD_REQUEST', 'Unsupported request shape');
  }
  const clean = [];
  for (const part of parts) {
    if (typeof part?.text === 'string') {
      if (part.text.length > MAX_TEXT_CHARS) return reject('BAD_REQUEST', 'Text too long');
      clean.push({ text: part.text });
    } else if (part?.inline_data) {
      const { mime_type: mimeType, data } = part.inline_data;
      if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
        return reject('BAD_REQUEST', 'Unsupported image type');
      }
      if (typeof data !== 'string') return reject('BAD_REQUEST', 'Malformed image data');
      if (data.length > MAX_IMAGE_BASE64_CHARS) {
        return reject('IMAGE_TOO_LARGE', 'That photo is too large to process — try a smaller or clearer shot.');
      }
      clean.push({ inline_data: { mime_type: mimeType, data } });
    } else {
      return reject('BAD_REQUEST', 'Unsupported request shape');
    }
  }
  return { parts: clean };
}

function validateGenerationConfig(cfg) {
  const clean = {};
  if (typeof cfg?.temperature === 'number' && cfg.temperature >= 0 && cfg.temperature <= 2) {
    clean.temperature = cfg.temperature;
  }
  if (cfg?.responseMimeType === 'application/json' || cfg?.responseMimeType === 'text/plain') {
    clean.responseMimeType = cfg.responseMimeType;
  }
  return clean;
}

// Google's 429 body carries RetryInfo — surface it so the client banner can
// show a real countdown. Same parse as the client's direct path.
function parseRetryDelay(body) {
  try {
    const parsed = JSON.parse(body);
    const details = parsed?.error?.details || [];
    const retryInfo = details.find((d) => d['@type']?.includes('RetryInfo'));
    if (retryInfo?.retryDelay) {
      const m = String(retryInfo.retryDelay).match(/^([\d.]+)s$/);
      if (m) return Math.ceil(parseFloat(m[1]));
    }
  } catch {
    // body wasn't JSON — no hint available
  }
  return null;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return json(405, { code: 'METHOD_NOT_ALLOWED', message: 'POST only' });
  }

  const geminiKey = env('GEMINI_API_KEY');
  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
  if (!geminiKey || !supabaseUrl || !anonKey) {
    return json(503, {
      code: 'PROXY_UNCONFIGURED',
      message: 'The AI service isn\'t configured yet — add your own key in Settings, or try again later.',
    });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json(401, { code: 'PROXY_AUTH', message: 'Sign in to use AI features.' });
  }
  const user = await getUserFromToken(token, supabaseUrl, anonKey);
  if (!user) {
    return json(401, { code: 'PROXY_AUTH', message: 'Your session expired — sign in again to use AI features.' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { code: 'BAD_REQUEST', message: 'Body must be JSON' });
  }

  const feature = body?.feature;
  if (!QUOTAS[feature]) {
    return json(400, { code: 'BAD_REQUEST', message: 'feature must be "receipts" or "recipes"' });
  }
  const partsResult = validateParts(body?.parts);
  if (partsResult.error) {
    const status = partsResult.error.code === 'IMAGE_TOO_LARGE' ? 413 : 400;
    return json(status, partsResult.error);
  }
  const parts = partsResult.parts;
  const generationConfig = validateGenerationConfig(body?.generationConfig);

  const quota = await consumeQuota(feature, token, supabaseUrl, anonKey);
  if (quota?.unavailable) {
    // Distinct from "you hit your limit": the boundary itself is down, so
    // saying "limit reached" would be a lie the user can't act on.
    return json(503, {
      code: 'QUOTA_UNAVAILABLE',
      message: 'AI is briefly unavailable — please try again in a minute.',
      retryDelaySeconds: 60,
    });
  }
  if (!quota?.allowed) {
    return json(429, {
      code: 'GEMINI_RATE_LIMIT',
      message: 'Shared free-tier limit reached for this hour. Add your own key in Settings for more headroom.',
      retryDelaySeconds: quota?.retry_after_seconds ?? null,
    });
  }

  const model = env('GEMINI_MODEL') || env('VITE_GEMINI_MODEL') || DEFAULT_MODEL;
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.7, ...generationConfig },
        }),
      }
    );
  } catch (err) {
    console.error('Gemini fetch failed:', err);
    return json(502, { code: 'GEMINI_NETWORK', message: 'Couldn\'t reach the AI service — try again.' });
  }

  if (res.status === 429) {
    const errBody = await res.text().catch(() => '');
    return json(429, {
      code: 'GEMINI_RATE_LIMIT',
      message: 'The AI service is briefly overloaded — try again shortly.',
      retryDelaySeconds: parseRetryDelay(errBody),
    });
  }
  if (res.status === 401 || res.status === 403) {
    // OUR key is bad — misconfiguration, not something the user can fix.
    console.error(`Gemini rejected the server key (${res.status})`);
    return json(503, { code: 'PROXY_UNCONFIGURED', message: 'The AI service is misconfigured — try again later or add your own key in Settings.' });
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (/api key not valid|api_key_invalid/i.test(errBody)) {
      console.error('Gemini rejected the server key (400 invalid key)');
      return json(503, { code: 'PROXY_UNCONFIGURED', message: 'The AI service is misconfigured — try again later or add your own key in Settings.' });
    }
    console.error(`Gemini error ${res.status}: ${errBody.slice(0, 300)}`);
    return json(502, { code: 'GEMINI_HTTP_ERROR', message: 'The AI service returned an error — try again.' });
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    return json(502, { code: 'GEMINI_EMPTY', message: 'The AI service returned nothing — try again.' });
  }
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    return json(502, { code: 'GEMINI_BLOCKED', message: `The AI response was blocked (${candidate.finishReason}) — try a different photo.` });
  }
  const text = candidate.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
  if (!text) {
    return json(502, { code: 'GEMINI_EMPTY', message: 'The AI service returned empty text — try again.' });
  }

  return json(200, { text });
};
