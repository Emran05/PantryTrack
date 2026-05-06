// Token-bucket rate limiter, localStorage-backed and per-bucket.
//
// Why this exists: AI calls hit Google's free tier directly, which has its own
// daily/per-minute caps. We're not the security boundary — Google is. This is
// a courtesy limiter that:
//   - prevents auto-firing AI calls (e.g. recipe regen on every realtime tick)
//     from blowing through the user's free tier in seconds
//   - gives the UI predictable numbers to display ("8 / 30 left this hour")
//   - backs off gracefully with linear refill so the user isn't blocked for the
//     full window after a single overshoot
//
// Each bucket gets a configured capacity and a refill window. Refill is
// continuous — after exhausting, one token comes back every (window / capacity)
// seconds.

// Two tiers per AI feature:
//   *_user    — when the user provided their own Gemini key. Generous since
//               quota comes from their own free-tier account.
//   *_project — when falling through to the project (shared) key. Stricter so
//               one user can't burn down the project's daily allowance.
export const BUCKETS = {
  recipes_user:     { capacity: 30, refillSeconds: 3600, label: 'recipe suggestions (your key)' },
  recipes_project:  { capacity: 15, refillSeconds: 3600, label: 'recipe suggestions (free tier)' },
  receipts_user:    { capacity: 10, refillSeconds: 3600, label: 'receipt scans (your key)' },
  receipts_project: { capacity: 5,  refillSeconds: 3600, label: 'receipt scans (free tier)' },
};

// Convenience: { feature, tier } → bucket name.
export function bucketName(feature, tier) {
  return `${feature}_${tier}`;
}

const KEY = (bucket) => `pantry_ratelimit_${bucket}`;

function readState(bucket) {
  try {
    const raw = localStorage.getItem(KEY(bucket));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.tokens !== 'number' || typeof parsed?.lastRefill !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeState(bucket, state) {
  try {
    localStorage.setItem(KEY(bucket), JSON.stringify(state));
  } catch {
    // localStorage unavailable — fall back to in-memory by ignoring; the
    // limiter will reset every page load, which is conservative.
  }
}

function fresh(bucket) {
  return { tokens: BUCKETS[bucket].capacity, lastRefill: Date.now() };
}

// Refill linearly: capacity tokens per refillSeconds.
// Cap at capacity so unused time doesn't accumulate beyond the budget.
function refill(bucket, state) {
  const cfg = BUCKETS[bucket];
  if (!cfg) return state;
  const now = Date.now();
  const elapsedSec = (now - state.lastRefill) / 1000;
  if (elapsedSec <= 0) return state;
  const rate = cfg.capacity / cfg.refillSeconds; // tokens / second
  const added = elapsedSec * rate;
  const tokens = Math.min(cfg.capacity, state.tokens + added);
  return { tokens, lastRefill: now };
}

function load(bucket) {
  if (!BUCKETS[bucket]) return null;
  const state = readState(bucket) || fresh(bucket);
  return refill(bucket, state);
}

/** Snapshot — does NOT consume. Returns { allowed, remaining, resetIn(ms) }. */
export function checkRateLimit(bucket) {
  if (!BUCKETS[bucket]) return { allowed: true, remaining: Infinity, resetIn: 0 };
  const state = load(bucket);
  writeState(bucket, state);

  if (state.tokens >= 1) {
    return { allowed: true, remaining: Math.floor(state.tokens), resetIn: 0 };
  }
  const cfg = BUCKETS[bucket];
  const rate = cfg.capacity / cfg.refillSeconds;
  const secondsUntilOne = (1 - state.tokens) / rate;
  return { allowed: false, remaining: 0, resetIn: Math.ceil(secondsUntilOne * 1000) };
}

/** Atomically check + consume. Returns true if allowed, false if blocked. */
export function consumeRateToken(bucket) {
  if (!BUCKETS[bucket]) return true;
  const state = load(bucket);
  if (state.tokens < 1) {
    writeState(bucket, state);
    return false;
  }
  state.tokens -= 1;
  writeState(bucket, state);
  return true;
}

/** Used by Settings UI to show "X / Y left this hour". */
export function getRateLimitStatus(bucket) {
  const cfg = BUCKETS[bucket];
  if (!cfg) return null;
  const state = load(bucket);
  return {
    bucket,
    label: cfg.label,
    capacity: cfg.capacity,
    refillSeconds: cfg.refillSeconds,
    remaining: Math.floor(state.tokens),
    fractional: state.tokens, // for callers that want the precise value
  };
}

/** Force a bucket back to full. Surfaced in Settings for testing/debug. */
export function resetBucket(bucket) {
  if (!BUCKETS[bucket]) return;
  writeState(bucket, fresh(bucket));
}

/** Friendly "12m" / "1h 30m" string for resetIn. */
export function formatResetTime(ms) {
  if (ms <= 0) return 'now';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 1) return 'less than a minute';
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}
