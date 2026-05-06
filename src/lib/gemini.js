// Direct Gemini API client. Used because the Supabase edge functions
// `process-receipt` and `suggest-recipes` aren't versioned in this repo and
// were producing failures end-to-end.
//
// Key resolution order (later wins):
//   1. import.meta.env.VITE_GEMINI_API_KEY   (build-time, .env)
//   2. localStorage 'pantry_gemini_key'     (per-device user override, set in Settings)
//
// Security note: the key is exposed in the client bundle / devtools. That's
// acceptable for a personal-use tier (Google AI Studio free tier is rate-
// limited server-side) but not for a public production build with paid keys.
// When this app moves to a real edge function, set VITE_USE_EDGE_AI=true and
// the calls below can be re-routed.

const DEFAULT_MODEL = 'gemini-2.0-flash';

function getModel() {
  return import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL;
}

const STORAGE_KEY = 'pantry_gemini_key';

export function getApiKey() {
  try {
    const userKey = localStorage.getItem(STORAGE_KEY);
    if (userKey && userKey.trim()) return userKey.trim();
  } catch {
    // localStorage unavailable
  }
  return import.meta.env.VITE_GEMINI_API_KEY || null;
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
  return !!getApiKey();
}

export function getKeySource() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return 'user';
  } catch {
    // ignore
  }
  if (import.meta.env.VITE_GEMINI_API_KEY) return 'env';
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

async function callGemini(parts, generationConfig = {}) {
  const key = getApiKey();
  if (!key) {
    throw new GeminiError('Gemini API key not configured', 'NO_API_KEY');
  }

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
    throw new GeminiError('Gemini server-side rate limit hit', 'GEMINI_RATE_LIMIT');
  }
  if (res.status === 401 || res.status === 403) {
    throw new GeminiError('Gemini rejected the API key', 'GEMINI_BAD_KEY', { status: res.status });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GeminiError(`Gemini API error ${res.status}`, 'GEMINI_HTTP_ERROR', { status: res.status, body });
  }

  const data = await res.json();

  // Gemini may also block content with safetyRatings. Surface a useful error.
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

// ---------------- Public API ----------------

/**
 * Suggest recipes from a list of pantry items.
 * @param items Array of { name, quantity, unit, daysLeft? }
 * @param options { prioritizeExpiring?: boolean, diet?: 'vegetarian'|'vegan'|'glutenfree'|'dairyfree' }
 */
export async function generateRecipesGemini(items, options = {}) {
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

  const text = await callGemini([{ text: prompt }], { temperature: 0.7 });
  const recipes = parseJsonStrict(text);
  if (!Array.isArray(recipes)) {
    throw new GeminiError('Gemini did not return a recipe array', 'GEMINI_BAD_FORMAT', { raw: text });
  }
  return recipes.map((r) => ({ ...r, isAI: true }));
}

/**
 * Parse a grocery receipt image and return extracted items.
 * @param imageBase64 base64-encoded image (no data: prefix)
 * @param mimeType one of image/jpeg, image/png, etc.
 */
export async function parseReceiptGemini(imageBase64, mimeType = 'image/jpeg') {
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

  const text = await callGemini(
    [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ],
    { temperature: 0.2 }
  );
  const items = parseJsonStrict(text);
  if (!Array.isArray(items)) {
    throw new GeminiError('Gemini did not return an item array', 'GEMINI_BAD_FORMAT', { raw: text });
  }
  return items;
}
