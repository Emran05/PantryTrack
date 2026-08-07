import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CATEGORIES,
  DEFAULT_SHELF_LIFE,
  getDefaultExpirationDate,
  getCategoryInfo,
  getExpirationStatus,
  getDaysUntilExpiration,
  formatDate,
} from '../helpers';

describe('helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Noon local time — away from midnight so day math is unambiguous.
    vi.setSystemTime(new Date(2026, 6, 6, 12, 0, 0)); // July 6 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getDefaultExpirationDate', () => {
    it('uses the category shelf life', () => {
      expect(getDefaultExpirationDate('produce')).toBe('2026-07-13'); // +7d
      expect(getDefaultExpirationDate('meat')).toBe('2026-07-11'); // +5d
    });

    it('falls back to the "other" shelf life for unknown categories', () => {
      expect(getDefaultExpirationDate('nonsense')).toBe(
        getDefaultExpirationDate('other')
      );
    });

    it('honors an explicit shelfLifeDays override', () => {
      expect(getDefaultExpirationDate('produce', 1)).toBe('2026-07-07');
    });

    it('formats with local date components (zero-padded)', () => {
      vi.setSystemTime(new Date(2026, 0, 30, 23, 30, 0)); // Jan 30, late evening
      expect(getDefaultExpirationDate('produce', 2)).toBe('2026-02-01');
    });
  });

  describe('getExpirationStatus', () => {
    it('classifies expired / soon / fresh around the 3-day boundary', () => {
      expect(getExpirationStatus('2026-07-05')).toBe('expired');
      expect(getExpirationStatus('2026-07-06')).toBe('soon'); // today = 0 days
      expect(getExpirationStatus('2026-07-09')).toBe('soon'); // +3 days
      expect(getExpirationStatus('2026-07-10')).toBe('fresh'); // +4 days
    });

    it('returns null for missing dates', () => {
      expect(getExpirationStatus(null)).toBeNull();
      expect(getExpirationStatus('')).toBeNull();
    });
  });

  describe('getDaysUntilExpiration', () => {
    it('counts days from today', () => {
      expect(getDaysUntilExpiration('2026-07-06')).toBe(0);
      expect(getDaysUntilExpiration('2026-07-08')).toBe(2);
      expect(getDaysUntilExpiration('2026-07-04')).toBe(-2);
    });

    it('returns null for missing dates', () => {
      expect(getDaysUntilExpiration(null)).toBeNull();
    });
  });

  describe('getCategoryInfo', () => {
    it('finds a known category', () => {
      expect(getCategoryInfo('dairy').label).toBe('Dairy');
    });

    it('falls back to the last category (other) for unknown ids', () => {
      expect(getCategoryInfo('mystery')).toBe(CATEGORIES[CATEGORIES.length - 1]);
    });
  });

  describe('formatDate', () => {
    it('renders a friendly date and tolerates empties', () => {
      expect(formatDate('2026-07-06')).toBe('Jul 6, 2026');
      expect(formatDate('')).toBe('');
      expect(formatDate(null)).toBe('');
    });
  });

  it('DEFAULT_SHELF_LIFE covers every category', () => {
    for (const cat of CATEGORIES) {
      expect(DEFAULT_SHELF_LIFE[cat.id], `shelf life for ${cat.id}`).toBeTypeOf('number');
    }
  });
});
