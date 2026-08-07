import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readPendingScan, writePendingScan, clearPendingScan } from '../scanPersistence';

describe('scanPersistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 6, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when nothing is stored', () => {
    expect(readPendingScan()).toBeNull();
  });

  it('round-trips a scan and merges later stages over earlier ones', () => {
    writePendingScan({ dataUrl: 'data:image/png;base64,AAA', mimeType: 'image/png' });
    writePendingScan({ ocrText: 'MILK 2.99' }); // OCR done — must keep the capture

    const pending = readPendingScan();
    expect(pending.dataUrl).toBe('data:image/png;base64,AAA');
    expect(pending.ocrText).toBe('MILK 2.99');
    expect(pending.timestamp).toBeTypeOf('number');
  });

  it('expires stale scans after 10 minutes', () => {
    writePendingScan({ dataUrl: 'data:x' });
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(readPendingScan()).toBeNull();
    // …and cleans up the stale entry.
    expect(sessionStorage.getItem('pantry_pending_scan')).toBeNull();
  });

  it('survives corrupted storage', () => {
    sessionStorage.setItem('pantry_pending_scan', '{nope');
    expect(readPendingScan()).toBeNull();
  });

  it('clearPendingScan removes the entry', () => {
    writePendingScan({ dataUrl: 'data:x' });
    clearPendingScan();
    expect(readPendingScan()).toBeNull();
  });
});
