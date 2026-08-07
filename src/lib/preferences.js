// Prefs and consumption log — Supabase-backed with a localStorage cache.
//
// localStorage is the synchronous read layer (so components can call
// isPinned()/getDiet()/getConsumptionLog() during render, same as always);
// Supabase is the source of truth so pins, favorites, diet, and the
// consumption log survive new devices and are shared where they should be
// (the log is per-pantry — housemates see the same streak and activity feed).
//
// Sync model:
//   - syncUserPreferences()      pull on login; first run pushes existing
//                                local data up (one-time migration).
//   - syncConsumptionLog(pantry) push any unsynced local events (client_id
//                                dedupes retries), then pull the household log.
//   - writes                     update the cache synchronously, then push in
//                                the background (debounced for prefs).
//
// If the Supabase tables don't exist yet (migration not applied), every sync
// degrades to localStorage-only with a console warning — nothing breaks.

import { supabase } from './supabase';

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

// "relation does not exist" / "function does not exist" — migration not applied.
function isMissingSchema(error) {
  return error?.code === '42P01' || error?.code === 'PGRST202' || error?.code === 'PGRST205';
}

let warnedMissingSchema = false;
function warnMissingSchema() {
  if (warnedMissingSchema) return;
  warnedMissingSchema = true;
  console.warn('Supabase prefs tables missing — apply supabase/migrations to enable cross-device sync. Running localStorage-only.');
}

async function currentUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

// Components that render cached prefs can listen for this to re-read after a
// background sync lands (fired by syncUserPreferences / syncConsumptionLog).
export const PREFS_SYNCED_EVENT = 'pantry-prefs-synced';
function announceSync() {
  try {
    window.dispatchEvent(new CustomEvent(PREFS_SYNCED_EVENT));
  } catch {
    // non-browser context — ignore
  }
}

// ---------- Consumption / waste log (per pantry) ----------

const LOG_KEY = (pantryId) => `pantry_consumption_log_${pantryId}`;
const LOG_MAX = 500;

// reason: 'used' | 'wasted' | 'donated' | 'other'
export function logConsumptionEvent(pantryId, event) {
  if (!pantryId) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    synced: false,
    ...event,
  };
  const arr = safeGet(LOG_KEY(pantryId), []);
  arr.unshift(entry);
  if (arr.length > LOG_MAX) arr.length = LOG_MAX;
  safeSet(LOG_KEY(pantryId), arr);

  // Background push — sync callers (ConsumeModal etc.) don't wait on this.
  // If it fails (offline, migration missing), the event stays synced:false and
  // the next syncConsumptionLog() retries it; client_id dedupes double-sends.
  pushEvents(pantryId, [entry]).catch(() => {});
}

function eventToRow(pantryId, userId, e) {
  const { id, timestamp, synced, itemName, category, qty, unit, reason, ...meta } = e;
  return {
    pantry_id: pantryId,
    user_id: userId,
    client_id: id,
    item_name: itemName || meta.name || 'item',
    category: category || null,
    qty: qty || 1,
    unit: unit || null,
    reason: ['used', 'wasted', 'donated', 'other'].includes(reason) ? reason : 'other',
    meta,
    created_at: new Date(timestamp).toISOString(),
  };
}

function rowToEvent(row) {
  return {
    id: row.client_id || row.id,
    timestamp: Date.parse(row.created_at),
    synced: true,
    userId: row.user_id,
    itemName: row.item_name,
    category: row.category || undefined,
    qty: row.qty,
    unit: row.unit || undefined,
    reason: row.reason,
    ...(row.meta || {}),
  };
}

async function pushEvents(pantryId, events) {
  if (!events.length) return;
  const userId = await currentUserId();
  if (!userId) return;

  const rows = events.map((e) => eventToRow(pantryId, userId, e));
  // upsert on the (pantry_id, client_id) unique index → retries are no-ops.
  const { error } = await supabase
    .from('consumption_events')
    .upsert(rows, { onConflict: 'pantry_id,client_id', ignoreDuplicates: true });
  if (error) {
    if (isMissingSchema(error)) warnMissingSchema();
    else console.error('Failed to sync consumption events:', error);
    return;
  }

  const pushed = new Set(events.map((e) => e.id));
  const arr = safeGet(LOG_KEY(pantryId), []);
  arr.forEach((e) => {
    if (pushed.has(e.id)) e.synced = true;
  });
  safeSet(LOG_KEY(pantryId), arr);
}

/**
 * Push unsynced local events, then pull the household log into the cache.
 * Returns the merged log (newest first). Call on Dashboard load / realtime tick.
 */
export async function syncConsumptionLog(pantryId) {
  if (!pantryId) return [];
  const local = safeGet(LOG_KEY(pantryId), []);

  await pushEvents(pantryId, local.filter((e) => !e.synced));

  const { data, error } = await supabase
    .from('consumption_events')
    .select('*')
    .eq('pantry_id', pantryId)
    .order('created_at', { ascending: false })
    .limit(LOG_MAX);

  if (error) {
    if (isMissingSchema(error)) warnMissingSchema();
    else console.error('Failed to fetch consumption log:', error);
    return local;
  }

  const server = (data || []).map(rowToEvent);
  // Keep local events the server doesn't know about yet (offline writes).
  const serverIds = new Set(server.map((e) => e.id));
  const merged = [...local.filter((e) => !e.synced && !serverIds.has(e.id)), ...server]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, LOG_MAX);

  safeSet(LOG_KEY(pantryId), merged);
  announceSync();
  return merged;
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

// ---------- User preferences (pins / favorites / diet) ----------

const PIN_KEY = (pantryId) => `pantry_pinned_${pantryId}`;
const FAV_KEY = 'pantry_recipe_favorites';
const DIET_KEY = 'pantry_diet';
const PREFS_MIGRATED_KEY = 'pantry_prefs_migrated';

// Collect every local pin list into the server shape { pantryId: [itemIds] }.
function collectLocalPins() {
  const pins = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pantry_pinned_')) {
        const pantryId = key.slice('pantry_pinned_'.length);
        const ids = safeGet(key, []);
        if (Array.isArray(ids) && ids.length) pins[pantryId] = ids;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return pins;
}

let pushPrefsTimer = null;

// --- CCPA/CPRA Do-Not-Sell-or-Share opt-out --------------------------------
const DNS_KEY = 'pantry_do_not_sell';

// Backs the "will finish syncing when you're back online" promise: any pref
// push that failed offline (the Do-Not-Sell toggle's especially) retries the
// moment connectivity returns. The upsert is idempotent, so a no-op push when
// nothing changed is harmless.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => schedulePushPrefs());
}

export function isGpcActive() {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
}

export function getDoNotSell() {
  return safeGet(DNS_KEY, false) === true;
}

/** Stored flag OR the browser's Global Privacy Control signal. */
export function isDoNotSellEffective() {
  return getDoNotSell() || isGpcActive();
}

export function setDoNotSell(value) {
  safeSet(DNS_KEY, value === true);
  schedulePushPrefs();
}

// Debounced whole-row upsert — pins toggle in quick bursts.
function schedulePushPrefs() {
  if (pushPrefsTimer) clearTimeout(pushPrefsTimer);
  pushPrefsTimer = setTimeout(() => {
    pushPrefsTimer = null;
    pushUserPreferences().catch(() => {});
  }, 800);
}

async function pushUserPreferences() {
  const userId = await currentUserId();
  if (!userId) return false;

  const { error } = await supabase.from('user_preferences').upsert({
    user_id: userId,
    diet: getDiet(),
    favorite_recipes: getFavoriteRecipeIds(),
    pinned_items: collectLocalPins(),
    do_not_sell: getDoNotSell() || isGpcActive(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (isMissingSchema(error)) warnMissingSchema();
    else console.error('Failed to push preferences:', error);
    return false;
  }
  return true;
}

/**
 * Push prefs to the server NOW (skipping the debounce) and report whether the
 * write landed — for flows that must not claim success before it has
 * (the Do-Not-Sell toggle's confirmation toast).
 */
export async function flushPrefs() {
  if (pushPrefsTimer) {
    clearTimeout(pushPrefsTimer);
    pushPrefsTimer = null;
  }
  try {
    return (await pushUserPreferences()) === true;
  } catch (err) {
    console.error('flushPrefs failed:', err);
    return false;
  }
}

/**
 * Pull server prefs into the local cache. First sync for a user with no server
 * row pushes the local state up instead (one-time device → cloud migration).
 * Call once after login (AuthContext does this).
 */
export async function syncUserPreferences() {
  const userId = await currentUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) warnMissingSchema();
    else console.error('Failed to fetch preferences:', error);
    return;
  }

  if (!data) {
    // No cloud row yet — this device's state becomes the starting point.
    await pushUserPreferences();
    safeSet(PREFS_MIGRATED_KEY, true);
    return;
  }

  const serverDiet = data.diet || 'all';
  const serverFavs = Array.isArray(data.favorite_recipes) ? data.favorite_recipes : [];
  const serverPins = data.pinned_items && typeof data.pinned_items === 'object' ? data.pinned_items : {};

  // Do-Not-Sell merges sticky toward privacy: true from either side wins.
  // Turning it OFF only happens through an explicit setDoNotSell(false) push.
  safeSet(DNS_KEY, data.do_not_sell === true || getDoNotSell());
  // Local opt-out that never reached the server (e.g. toggled while offline)
  // gets pushed up now — the server flag is what actually stops data use.
  if (getDoNotSell() && data.do_not_sell !== true) schedulePushPrefs();

  // First sync on THIS device merges the local state up instead of discarding
  // it — otherwise a user with favorites/pins on two devices loses whichever
  // device syncs second. After that, the server is canonical (server-wins),
  // since realtime edits elsewhere should replace, not re-merge, stale locals.
  const alreadyMigrated = safeGet(PREFS_MIGRATED_KEY, false) === true;

  if (!alreadyMigrated) {
    const mergedFavs = [...new Set([...serverFavs, ...getFavoriteRecipeIds()])];
    // Prefer a non-default diet; server wins when both are set.
    const mergedDiet = serverDiet !== 'all' ? serverDiet : getDiet();

    const localPins = collectLocalPins();
    const mergedPins = { ...serverPins };
    for (const [pantryId, ids] of Object.entries(localPins)) {
      mergedPins[pantryId] = [...new Set([...(mergedPins[pantryId] || []), ...ids])];
    }

    writeLocalPrefs(mergedDiet, mergedFavs, mergedPins);
    safeSet(PREFS_MIGRATED_KEY, true);
    await pushUserPreferences(); // push the merged result back up
    announceSync();
    return;
  }

  writeLocalPrefs(serverDiet, serverFavs, serverPins);
  safeSet(PREFS_MIGRATED_KEY, true);
  announceSync();
}

// Overwrite the local cache with a resolved pref set. Only touches pantry pin
// keys the payload mentions — pins for pantries not in the object are left
// alone (they'll upload on the next toggle).
function writeLocalPrefs(diet, favorites, pins) {
  try {
    localStorage.setItem(DIET_KEY, diet || 'all');
  } catch {
    // ignore
  }
  safeSet(FAV_KEY, Array.isArray(favorites) ? favorites : []);
  for (const [pantryId, ids] of Object.entries(pins || {})) {
    if (Array.isArray(ids)) safeSet(PIN_KEY(pantryId), ids);
  }
}

// ---------- Pinned pantry items (per pantry) ----------

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
  schedulePushPrefs();
  return idx < 0;
}

// Strip pinned IDs that no longer exist in the live items list. Cheap GC.
export function reconcilePins(pantryId, liveItemIds) {
  const ids = getPinnedIds(pantryId);
  const live = new Set(liveItemIds);
  const filtered = ids.filter((id) => live.has(id));
  if (filtered.length !== ids.length) {
    safeSet(PIN_KEY(pantryId), filtered);
    schedulePushPrefs();
  }
  return filtered;
}

// ---------- Recipe favorites (global, not per pantry) ----------

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
  schedulePushPrefs();
  return idx < 0;
}

// ---------- Diet preference (global) ----------

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
  schedulePushPrefs();
}
