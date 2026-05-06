// Persist an in-progress receipt scan across page reloads.
//
// Why: tabbing away during a scan can cause the page to refresh — Vite HMR
// auto-reload on dev-server restart, mobile-Safari tab eviction, BFCache
// disqualification due to active fetches, etc. None of these are something we
// can stop from the page side. So we store the scan's progress in
// sessionStorage and resume on mount.
//
// Stages stored, each builds on the previous:
//   1. Captured  : dataUrl + base64 + mimeType
//   2. OCR-done  : + ocrText + ocrLines
//   3. Parsed    : + parsedItems (the user just hadn't reviewed/imported yet)
//
// All fields are optional; the consumer picks the furthest stage reached.

const KEY = 'pantry_pending_scan';
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes — older than this, just throw it out

export function readPendingScan() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.timestamp !== 'number') return null;
    if (Date.now() - data.timestamp > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// Merge-update — preserves earlier-stage fields when the caller only sets new ones.
export function writePendingScan(patch) {
  try {
    const existing = readPendingScan() || {};
    const next = { ...existing, ...patch, timestamp: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    // Quota exceeded (large photo) — persistence is best-effort, swallow it.
    // The user will still see their scan complete this session; only a
    // mid-scan refresh would lose state, and that's the case we couldn't help.
    if (err?.name !== 'QuotaExceededError') {
      console.warn('Could not persist scan progress:', err);
    }
  }
}

export function clearPendingScan() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Convert a stored dataUrl back into a Blob so Tesseract can re-OCR after a
// reload (it needs a Blob/File, not a string).
export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}
