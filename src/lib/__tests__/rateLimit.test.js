import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BUCKETS,
  bucketName,
  checkRateLimit,
  consumeRateToken,
  getRateLimitStatus,
  resetBucket,
  formatResetTime,
} from '../rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 6, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bucketName joins feature and tier', () => {
    expect(bucketName('receipts', 'project')).toBe('receipts_project');
  });

  it('starts full and counts down as tokens are consumed', () => {
    const cap = BUCKETS.receipts_project.capacity;
    expect(checkRateLimit('receipts_project')).toMatchObject({
      allowed: true,
      remaining: cap,
    });

    for (let i = 0; i < cap; i++) {
      expect(consumeRateToken('receipts_project')).toBe(true);
    }
    expect(consumeRateToken('receipts_project')).toBe(false);

    const blocked = checkRateLimit('receipts_project');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetIn).toBeGreaterThan(0);
  });

  it('refills linearly over the window', () => {
    const { capacity, refillSeconds } = BUCKETS.receipts_project;
    for (let i = 0; i < capacity; i++) consumeRateToken('receipts_project');
    expect(checkRateLimit('receipts_project').allowed).toBe(false);

    // One token returns every refillSeconds / capacity.
    vi.advanceTimersByTime(((refillSeconds / capacity) + 1) * 1000);
    const after = checkRateLimit('receipts_project');
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(1);
  });

  it('never refills past capacity', () => {
    consumeRateToken('recipes_project');
    vi.advanceTimersByTime(1000 * 60 * 60 * 24); // a full day
    expect(checkRateLimit('recipes_project').remaining).toBe(
      BUCKETS.recipes_project.capacity
    );
  });

  it('resetBucket restores a full bucket', () => {
    const cap = BUCKETS.receipts_user.capacity;
    for (let i = 0; i < cap; i++) consumeRateToken('receipts_user');
    resetBucket('receipts_user');
    expect(checkRateLimit('receipts_user').remaining).toBe(cap);
  });

  it('unknown buckets are always allowed (fail open)', () => {
    expect(checkRateLimit('no_such_bucket').allowed).toBe(true);
    expect(consumeRateToken('no_such_bucket')).toBe(true);
    expect(getRateLimitStatus('no_such_bucket')).toBeNull();
  });

  it('survives corrupted localStorage state', () => {
    localStorage.setItem('pantry_ratelimit_receipts_project', '{not json');
    expect(checkRateLimit('receipts_project').allowed).toBe(true);
  });

  describe('formatResetTime', () => {
    it('formats the ranges the banner shows', () => {
      expect(formatResetTime(0)).toBe('now');
      expect(formatResetTime(30 * 1000)).toBe('1m');
      expect(formatResetTime(12 * 60 * 1000)).toBe('12m');
      expect(formatResetTime(90 * 60 * 1000)).toBe('1h 30m');
      expect(formatResetTime(120 * 60 * 1000)).toBe('2h');
    });
  });
});
