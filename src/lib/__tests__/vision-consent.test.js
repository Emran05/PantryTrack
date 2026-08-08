import { describe, it, expect, beforeEach } from 'vitest';
import { getVisionConsent, setVisionConsent } from '../preferences';

// The receipt image only leaves the device on an explicit yes. The gate in
// ScanReceipt keys off these three states, so they must be exact.
describe('vision-fallback consent', () => {
  beforeEach(() => localStorage.clear());

  it('is null (never asked) by default', () => {
    expect(getVisionConsent()).toBe(null);
  });

  it('remembers a granted yes', () => {
    setVisionConsent(true);
    expect(getVisionConsent()).toBe(true);
  });

  it('records an explicit no as false, not null', () => {
    setVisionConsent(false);
    expect(getVisionConsent()).toBe(false);
  });

  it('only true means "proceed" — null and false both gate', () => {
    expect(getVisionConsent() !== true).toBe(true); // unasked → gate
    setVisionConsent(false);
    expect(getVisionConsent() !== true).toBe(true); // declined → gate
    setVisionConsent(true);
    expect(getVisionConsent() !== true).toBe(false); // granted → proceed
  });
});
