import { describe, it, expect } from 'vitest';
import { computeUnder16 } from '../preferences';

// CCPA opt-in threshold is exactly 16. These lock the boundary, because getting
// it wrong means selling a minor's data by default.
describe('computeUnder16', () => {
  const TODAY = '2026-08-07';

  it('returns null when not answered or unparseable', () => {
    expect(computeUnder16('', TODAY)).toBe(null);
    expect(computeUnder16(null, TODAY)).toBe(null);
    expect(computeUnder16('not-a-date', TODAY)).toBe(null);
  });

  it('is true for a 15-year-old', () => {
    expect(computeUnder16('2011-01-01', TODAY)).toBe(true);
  });

  it('is true the day before the 16th birthday', () => {
    expect(computeUnder16('2010-08-08', TODAY)).toBe(true);
  });

  it('is false exactly on the 16th birthday', () => {
    expect(computeUnder16('2010-08-07', TODAY)).toBe(false);
  });

  it('is false the day after turning 16', () => {
    expect(computeUnder16('2010-08-06', TODAY)).toBe(false);
  });

  it('is false for an adult', () => {
    expect(computeUnder16('2000-06-15', TODAY)).toBe(false);
  });

  it('handles a birthday later this month (not yet reached)', () => {
    // Born 2010-08-20: on 2026-08-07 they are still 15.
    expect(computeUnder16('2010-08-20', TODAY)).toBe(true);
  });
});
