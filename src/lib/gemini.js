// Direct Gemini API client. Used because the Supabase edge functions
// `process-receipt` and `suggest-recipes` aren't versioned in this repo and
// were producing failures end-to-end.
//
// Two key tiers, in order of preference:
//   1. user key  — localStorage 'pantry_gemini_key', set in Settings → AI
//   2. project key — import.meta.env.VITE_GEMINI_API_KEY (build-time .env)
//
// callGeminiWithFallback() tries the user key first. On GEMINI_BAD_KEY (401/403)
// or GEMINI_RATE_LIMIT (429), it transparently retries against the project key
// and returns { text, tier, fellBack: true } so the caller can surface a notice.
//
// Security note: the key is exposed in the client bundle / devtools. That's
// acceptable for a personal-use tier (Google AI Studio free tier is rate-
// limited server-side) but not for a public production build with paid keys.
// When this app moves to a real edge function, point the calls below at it.

// gemini-2.5-flash is the current GA flash model. We do NOT use *-pro because
// flash is fast enough for short prompts (recipes / receipts) and pro burns
// quota much faster on the free tier. `gemini-flash-latest` would auto-track
// the newest flash, but it's been less reliable (frequent 503s), so we pin.
const DEFAULT_MODEL = 'gemini-2.5-flash';

function getModel() {
  return import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL;
}

const STORAGE_KEY = 'pantry_gemini_key';

// ---------------- Key accessors ----------------

export function getUserKey() {
  try {
    const k = localStorage.getItem(STORAGE_KEY);
    return k && k.trim() ? k.trim() : null;
  } catch {
    return null;
  }
}

export function getProjectKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || null;
}

export function getApiKey() {
  return getUserKey() || getProjectKey();
}

export function setUserApiKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to persist user Gemini key:', err);
  }
}

export function hasApiKey() {
  return !!(getUserKey() || getProjectKey());
}

export function hasUserKey() {
  return !!getUserKey();
}

export function hasProjectKey() {
  return !!getProjectKey();
}

export function getKeySource() {
  if (getUserKey()) return 'user';
  if (getProjectKey()) return 'project';
  return null;
}

// ---------------- Internal helpers ----------------

function endpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent`;
}

class GeminiError extends Error {
  constructor(message, code, extras = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extras);
  }
}

function parseJsonStrict(text) {
  // Models sometimes wrap the JSON in ```json fences. Strip them. Also tolerate
  // a leading/trailing `[` mismatch by searching for the first JSON token.
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // If the model added prose before the JSON, find the first { or [.
  const firstObj = cleaned.indexOf('{');
  const firstArr = cleaned.indexOf('[');
  const start = (firstArr === -1 || (firstObj !== -1 && firstObj < firstArr)) ? firstObj : firstArr;
  if (start > 0) cleaned = cleaned.slice(start);
  const lastClose = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastClose > 0 && lastClose < cleaned.length - 1) cleaned = cleaned.slice(0, lastClose + 1);
  return JSON.parse(cleaned);
}

// Single attempt against an explicit key. Throws coded GeminiError on failure.
async function callGeminiOnce(parts, generationConfig, key) {
  let res;
  try {
    res = await fetch(`${endpoint()}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.7, ...generationConfig },
      }),
    });
  } catch (err) {
    throw new GeminiError('Network error calling Gemini', 'GEMINI_NETWORK', { cause: err });
  }

  if (res.status === 429) {
    // Google returns retry hints in the body — parse them so the banner can
    // show a real countdown instead of a vague "try later".
    const body = await res.text().catch(() => '');
    let retryDelaySeconds = null;
    try {
      const parsed = JSON.parse(body);
      const details = parsed?.error?.details || [];
      const retryInfo = details.find((d) => d['@type']?.includes('RetryInfo'));
      if (retryInfo?.retryDelay) {
        // Format is e.g. "34.6s" or "34s".
        const m = String(retryInfo.retryDelay).match(/^([\d.]+)s$/);
        if (m) retryDelaySeconds = Math.ceil(parseFloat(m[1]));
      }
    } catch {
      // ignore — body wasn't JSON
    }
    throw new GeminiError('Gemini server-side rate limit hit', 'GEMINI_RATE_LIMIT', {
      retryDelaySeconds,
      body,
    });
  }
  if (res.status === 401 || res.status === 403) {
    throw new GeminiError('Gemini rejected the API key', 'GEMINI_BAD_KEY', { status: res.status });
  }
  if (res.status === 400) {
    // 400 can also mean "API key not valid" — surface that as BAD_KEY for fallback.
    const body = await res.text().catch(() => '');
    if (/api key not valid|api_key_invalid/i.test(body)) {
      throw new GeminiError('Gemini rejected the API key', 'GEMINI_BAD_KEY', { status: 400, body });
    }
    throw new GeminiError(`Gemini API error 400`, 'GEMINI_HTTP_ERROR', { status: 400, body });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GeminiError(`Gemini API error ${res.status}`, 'GEMINI_HTTP_ERROR', { status: res.status, body });
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new GeminiError('Gemini returned no candidates', 'GEMINI_EMPTY', { data });
  }
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new GeminiError(`Gemini stopped early: ${candidate.finishReason}`, 'GEMINI_BLOCKED', { finishReason: candidate.finishReason });
  }

  const text = candidate.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
  if (!text) {
    throw new GeminiError('Gemini returned empty text', 'GEMINI_EMPTY', { data });
  }
  return text;
}

// Errors that indicate the key itself is the problem — safe to retry against
// the project key. Network errors and 5xx don't fall back; 5xx affects both
// tiers equally and a network error means the user has no internet.
const FALLBACKABLE_CODES = new Set(['GEMINI_BAD_KEY', 'GEMINI_RATE_LIMIT']);

/**
 * Try the user key first; fall back to the project key on key/quota errors.
 *
 * @param {Array} parts  Gemini request parts
 * @param {object} generationConfig
 * @param {object} opts  { skipUser?: boolean }  // caller can force project tier
 * @returns {Promise<{ text: string, tier: 'user'|'project', fellBack: boolean }>}
 */
export async function callGeminiWithFallback(parts, generationConfig = {}, opts = {}) {
  const { skipUser = false } = opts;
  const userKey = skipUser ? null : getUserKey();
  const projectKey = getProjectKey();

  if (!userKey && !projectKey) {
    throw new GeminiError('Gemini API key not configured', 'NO_API_KEY');
  }

  // Try user key first if present.
  if (userKey) {
    try {
      const text = await callGeminiOnce(parts, generationConfig, userKey);
      return { text, tier: 'user', fellBack: false };
    } catch (err) {
      if (!projectKey || !FALLBACKABLE_CODES.has(err.code)) throw err;
      // Fall through to project key — caller will see fellBack: true.
      console.warn(`User Gemini key failed (${err.code}), falling back to project key`);
    }
  }

  if (!projectKey) {
    throw new GeminiError('Gemini API key not configured', 'NO_API_KEY');
  }

  const text = await callGeminiOnce(parts, generationConfig, projectKey);
  return { text, tier: 'project', fellBack: !!userKey && !skipUser };
}

// ---------------- Public API ----------------

/**
 * Suggest recipes from a list of pantry items.
 *
 * @param items   Array of { name, quantity, unit, daysLeft? }
 * @param options { prioritizeExpiring?, diet? }
 * @param tierOpts { skipUser?: boolean }  // recipes.js sets this when user tier is rate-limited
 * @returns { recipes, tier, fellBack }
 */
export async function generateRecipesGemini(items, options = {}, tierOpts = {}) {
  const { prioritizeExpiring, diet } = options;

  const itemList = items
    .map((i) => {
      const exp = i.daysLeft != null ? ` (${i.daysLeft}d left)` : '';
      const qty = i.quantity ? `${i.quantity}${i.unit ? ' ' + i.unit : ''} ` : '';
      return `- ${qty}${i.name}${exp}`;
    })
    .join('\n');

  const dietLine =
    diet && diet !== 'all'
      ? `\nDietary requirement: must be ${diet}. Strictly avoid disallowed ingredients.`
      : '';
  const expiryLine = prioritizeExpiring
    ? '\nPrioritize recipes that use items expiring within the next few days.'
    : '';

  const prompt = `You are a recipe assistant for students with limited pantries. Suggest 4 recipes they could make with the items below.${dietLine}${expiryLine}

Pantry:
${itemList}

Return ONLY a JSON array (no commentary, no markdown fence) using this exact shape:
[
  {
    "id": "kebab-case-slug",
    "title": "Recipe Name",
    "time": "20 min",
    "difficulty": "Easy",
    "servings": 2,
    "ingredients": ["lowercase ingredient", "..."],
    "matched": ["ingredients that the pantry has"],
    "missing": ["ingredients that the pantry doesn't have"],
    "matchRatio": 0.75,
    "instructions": ["step 1", "step 2", "..."],
    "isAI": true
  }
]

Rules:
- ingredients must be lowercase common names ("ground beef", not "1 lb 80/20 ground beef")
- matched and missing must be subsets of ingredients
- matchRatio = matched.length / ingredients.length, rounded to 2 decimals
- 4-7 instruction steps, concise imperative ("Heat oil...")
- difficulty must be one of: Easy, Medium, Hard
- skip recipes that need fewer than 2 of the user's items
- prefer recipes that maximize matchRatio`;

  const result = await callGeminiWithFallback([{ text: prompt }], { temperature: 0.7 }, tierOpts);
  const recipes = parseJsonStrict(result.text);
  if (!Array.isArray(recipes)) {
    throw new GeminiError('Gemini did not return a recipe array', 'GEMINI_BAD_FORMAT', { raw: result.text });
  }
  return {
    recipes: recipes.map((r) => ({ ...r, isAI: true })),
    tier: result.tier,
    fellBack: result.fellBack,
  };
}

/**
 * Parse a grocery receipt image and return extracted items.
 *
 * @param imageBase64 base64-encoded image (no data: prefix)
 * @param mimeType    one of image/jpeg, image/png, etc.
 * @param tierOpts    { skipUser?: boolean }
 * @returns { items, tier, fellBack }
 */
export async function parseReceiptGemini(imageBase64, mimeType = 'image/jpeg', tierOpts = {}) {
  const prompt = `Parse this grocery receipt image. Extract every grocery item with its quantity, unit, category, and a sensible default shelf life in days.

Return ONLY a JSON array (no commentary, no markdown fence):
[
  {
    "name": "lowercase item (no brand prefix unless distinctive)",
    "quantity": 1,
    "unit": "pcs|lbs|oz|kg|g|L|mL|cups|bags|boxes|cans|bottles",
    "category": "produce|dairy|meat|grains|frozen|beverages|snacks|condiments|other",
    "shelfLifeDays": 7
  }
]

Rules:
- skip non-grocery lines (tax, total, subtotal, store info, payment method)
- if unit is unclear, use "pcs"
- if quantity is unclear, use 1
- shelfLifeDays should reflect the item's typical fridge / pantry life
- round quantities to nearest 0.5 if not whole`;

  const result = await callGeminiWithFallback(
    [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ],
    { temperature: 0.2 },
    tierOpts
  );
  const items = parseJsonStrict(result.text);
  if (!Array.isArray(items)) {
    throw new GeminiError('Gemini did not return an item array', 'GEMINI_BAD_FORMAT', { raw: result.text });
  }
  return {
    items,
    tier: result.tier,
    fellBack: result.fellBack,
  };
}
