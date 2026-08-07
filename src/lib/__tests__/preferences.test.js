import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// preferences.js pushes to Supabase in the background; these tests cover the
// synchronous localStorage layer plus the push/merge bookkeeping, with the
// network mocked out.
const upsertMock = vi.fn(async () => ({ error: null }));
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    },
    from: vi.fn(() => ({
      upsert: upsertMock,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

const {
  logConsumptionEvent,
  getConsumptionLog,
  consumptionStatsLastNDays,
  getPinnedIds,
  isPinned,
  togglePin,
  reconcilePins,
  getFavoriteRecipeIds,
  isFavoriteRecipe,
  toggleFavoriteRecipe,
  getDiet,
  setDiet,
} = await import('../preferences');

const flushAsync = () => new Promise((r) => setTimeout(r, 0));

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    upsertMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('consumption log', () => {
    it('records events newest-first with ids and timestamps', () => {
      logConsumptionEvent('p1', { itemName: 'milk', qty: 1, reason: 'used' });
      logConsumptionEvent('p1', { itemName: 'eggs', qty: 2, reason: 'wasted' });

      const log = getConsumptionLog('p1');
      expect(log).toHaveLength(2);
      expect(log[0].itemName).toBe('eggs');
      expect(log[0].id).toBeTypeOf('string');
      expect(log[0].timestamp).toBeTypeOf('number');
    });

    it('scopes logs per pantry and ignores missing pantry ids', () => {
      logConsumptionEvent('p1', { itemName: 'milk', qty: 1, reason: 'used' });
      logConsumptionEvent(null, { itemName: 'ghost', qty: 1, reason: 'used' });
      expect(getConsumptionLog('p1')).toHaveLength(1);
      expect(getConsumptionLog('p2')).toHaveLength(0);
    });

    it('filters by sinceTs', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 1));
      logConsumptionEvent('p1', { itemName: 'old', qty: 1, reason: 'used' });
      vi.setSystemTime(new Date(2026, 6, 6));
      logConsumptionEvent('p1', { itemName: 'new', qty: 1, reason: 'used' });

      const since = new Date(2026, 6, 3).getTime();
      const recent = getConsumptionLog('p1', since);
      expect(recent).toHaveLength(1);
      expect(recent[0].itemName).toBe('new');
    });

    it('sums stats by reason over the window', () => {
      logConsumptionEvent('p1', { itemName: 'a', qty: 2, reason: 'used' });
      logConsumptionEvent('p1', { itemName: 'b', qty: 1, reason: 'wasted' });
      logConsumptionEvent('p1', { itemName: 'c', qty: 3, reason: 'donated' });
      logConsumptionEvent('p1', { itemName: 'd', reason: 'used' }); // qty defaults to 1

      const stats = consumptionStatsLastNDays('p1', 30);
      expect(stats).toMatchObject({ used: 3, wasted: 1, donated: 3, total: 7 });
    });

    it('pushes events to Supabase in the background and marks them synced', async () => {
      logConsumptionEvent('p1', { itemName: 'milk', qty: 1, reason: 'used' });
      await flushAsync();
      expect(upsertMock).toHaveBeenCalled();
      expect(getConsumptionLog('p1')[0].synced).toBe(true);
    });
  });

  describe('pins', () => {
    it('toggles and reads pins per pantry', () => {
      expect(isPinned('p1', 'item-1')).toBe(false);
      expect(togglePin('p1', 'item-1')).toBe(true);
      expect(isPinned('p1', 'item-1')).toBe(true);
      expect(isPinned('p2', 'item-1')).toBe(false);
      expect(togglePin('p1', 'item-1')).toBe(false);
      expect(getPinnedIds('p1')).toEqual([]);
    });

    it('reconcilePins drops ids that no longer exist', () => {
      togglePin('p1', 'live');
      togglePin('p1', 'deleted');
      expect(reconcilePins('p1', ['live', 'unrelated'])).toEqual(['live']);
      expect(getPinnedIds('p1')).toEqual(['live']);
    });
  });

  describe('favorites and diet', () => {
    it('toggles recipe favorites', () => {
      expect(isFavoriteRecipe('pasta')).toBe(false);
      toggleFavoriteRecipe('pasta');
      expect(getFavoriteRecipeIds()).toEqual(['pasta']);
      toggleFavoriteRecipe('pasta');
      expect(isFavoriteRecipe('pasta')).toBe(false);
    });

    it('defaults diet to "all" and persists changes', () => {
      expect(getDiet()).toBe('all');
      setDiet('vegan');
      expect(getDiet()).toBe('vegan');
    });
  });
});
