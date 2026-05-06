// Client-side persistence helpers for prefs and event logs.
// Backed by localStorage — single-device only. A future Supabase schema would
// move these to per-user/per-pantry tables, but the localStorage shape is
// designed so that migration is mechanical (each entry already has a stable id
// and timestamp).

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('localStorage write failed:', key, err);
  }
}

// ---------- Consumption / waste log (per pantry) ----------

const LOG_KEY = (pantryId) => `pantry_consumption_log_${pantryId}`;
const LOG_MAX = 500;

// reason: 'used' | 'wasted' | 'donated' | 'other'
export function logConsumptionEvent(pantryId, event) {
  if (!pantryId) return;
  const arr = safeGet(LOG_KEY(pantryId), []);
  arr.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...event,
  });
  if (arr.length > LOG_MAX) arr.length = LOG_MAX;
  safeSet(LOG_KEY(pantryId), arr);
}

export function getConsumptionLog(pantryId, sinceTs = null) {
  if (!pantryId) return [];
  const arr = safeGet(LOG_KEY(pantryId), []);
  if (sinceTs == null) return arr;
  return arr.filter((e) => e.timestamp >= sinceTs);
}

export function consumptionStatsLastNDays(pantryId, days = 30) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const events = getConsumptionLog(pantryId, since);
  let used = 0;
  let wasted = 0;
  let donated = 0;
  for (const e of events) {
    if (e.reason === 'used') used += e.qty || 1;
    else if (e.reason === 'wasted') wasted += e.qty || 1;
    else if (e.reason === 'donated') donated += e.qty || 1;
  }
  return { used, wasted, donated, total: used + wasted + donated, events };
}

// ---------- Pinned pantry items (per pantry) ----------

const PIN_KEY = (pantryId) => `pantry_pinned_${pantryId}`;

export function getPinnedIds(pantryId) {
  if (!pantryId) return [];
  return safeGet(PIN_KEY(pantryId), []);
}

export function isPinned(pantryId, itemId) {
  return getPinnedIds(pantryId).includes(itemId);
}

export function togglePin(pantryId, itemId) {
  const ids = getPinnedIds(pantryId);
  const idx = ids.indexOf(itemId);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(itemId);
  safeSet(PIN_KEY(pantryId), ids);
  return idx < 0;
}

// Strip pinned IDs that no longer exist in the live items list. Cheap GC.
export function reconcilePins(pantryId, liveItemIds) {
  const ids = getPinnedIds(pantryId);
  const live = new Set(liveItemIds);
  const filtered = ids.filter((id) => live.has(id));
  if (filtered.length !== ids.length) safeSet(PIN_KEY(pantryId), filtered);
  return filtered;
}

// ---------- Recipe favorites (global, not per pantry) ----------

const FAV_KEY = 'pantry_recipe_favorites';

export function getFavoriteRecipeIds() {
  return safeGet(FAV_KEY, []);
}

export function isFavoriteRecipe(recipeId) {
  return getFavoriteRecipeIds().includes(recipeId);
}

export function toggleFavoriteRecipe(recipeId) {
  const ids = getFavoriteRecipeIds();
  const idx = ids.indexOf(recipeId);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(recipeId);
  safeSet(FAV_KEY, ids);
  return idx < 0;
}

// ---------- Diet preference (global) ----------

const DIET_KEY = 'pantry_diet';
export const DIETS = [
  { id: 'all', label: 'All' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'glutenfree', label: 'Gluten-free' },
  { id: 'dairyfree', label: 'Dairy-free' },
];

export function getDiet() {
  try {
    return localStorage.getItem(DIET_KEY) || 'all';
  } catch {
    return 'all';
  }
}

export function setDiet(diet) {
  try {
    localStorage.setItem(DIET_KEY, diet);
  } catch {
    // ignore
  }
}
