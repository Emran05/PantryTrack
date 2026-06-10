import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getPantryItems, deletePantryItem } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { CATEGORIES } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import { getPinnedIds, reconcilePins } from '../lib/preferences';
import SearchBar from '../components/SearchBar';
import ItemCard from '../components/ItemCard';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import './Pantry.css';

export default function Pantry() {
  const { activePantry } = usePantry();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  // 'recent' (created desc, fetch order) | 'expiring' (soonest first) | 'name'
  const [sortBy, setSortBy] = useState(() => {
    try {
      return localStorage.getItem('pantry_sort') || 'recent';
    } catch {
      return 'recent';
    }
  });
  // Bumped when a pin toggles so the pinned-first sort recomputes.
  const [pinTick, setPinTick] = useState(0);
  const { showToast } = useToast();
  const fetchSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!activePantry) return;
    const seq = ++fetchSeqRef.current;
    try {
      const data = await getPantryItems(activePantry.id);
      // If the user switched pantries while this request was in flight,
      // a newer fetch already started — discard this stale response.
      if (seq !== fetchSeqRef.current) return;
      // GC pins for items that no longer exist before they feed the sort.
      reconcilePins(activePantry.id, data.map((i) => i.id));
      setItems(data);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Failed to load pantry items:', err);
      showToast('Failed to load pantry items', 'error');
    }
  }, [activePantry, showToast]);

  const pinnedSet = useMemo(
    () => new Set(getPinnedIds(activePantry?.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePantry, items, pinTick]
  );

  useEffect(() => {
    if (activePantry) {
      setLoading(true);
      // Clear stale items immediately so the user doesn't see another
      // pantry's contents flash before the fresh fetch lands.
      setItems([]);
      refresh().finally(() => setLoading(false));
    }
  }, [activePantry, refresh]);

  useRealtimeSync(activePantry?.id, 'pantry_items', refresh);

  const handleDelete = useCallback(async (id) => {
    const item = items.find((i) => i.id === id);
    try {
      await deletePantryItem(id);
      refresh();
      showToast(`"${item?.name || 'Item'}" removed`);
    } catch (err) {
      console.error('Failed to delete item:', err);
      showToast('Failed to delete item', 'error');
    }
  }, [items, refresh, showToast]);

  const handleSortChange = (value) => {
    setSortBy(value);
    try {
      localStorage.setItem('pantry_sort', value);
    } catch {
      // localStorage unavailable — sort still works for this session
    }
  };

  // Secondary sort within each area (pinned-first stays the primary order).
  const compareItems = (a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'expiring') {
      // Items without an expiration date sink to the bottom.
      if (!a.expirationDate && !b.expirationDate) return 0;
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      return new Date(a.expirationDate) - new Date(b.expirationDate);
    }
    return 0; // 'recent' — preserve fetch order (created_at desc)
  };

  const filtered = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Count items per category for filter badges
  const categoryCounts = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const groupedItems = filtered.reduce((acc, item) => {
    const area = item.areaName || 'Unassigned';
    if (!acc[area]) acc[area] = [];
    acc[area].push(item);
    return acc;
  }, {});

  return (
    <div className="page-content app-container">
      <div className="pantry-header animate-fade-in">
        <h2 className="page-title">My Pantry</h2>
        {!loading && <p className="page-subtitle">{items.length} item{items.length !== 1 ? 's' : ''} tracked</p>}
      </div>

      <div className="pantry-search animate-fade-in">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <div className="category-filters animate-fade-in">
        <button
          className={`category-filter-btn ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All ({items.length})
        </button>
        {CATEGORIES.filter((c) => categoryCounts[c.id]).map((cat) => (
          <button
            key={cat.id}
            className={`category-filter-btn ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
            style={{ '--filter-color': cat.color }}
          >
            {cat.label} ({categoryCounts[cat.id]})
          </button>
        ))}
      </div>

      {items.length > 1 && (
        <div className="pantry-sort-row animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', margin: '4px 0' }}>
          <label htmlFor="pantry-sort" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Sort
          </label>
          <select
            id="pantry-sort"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', fontSize: '0.8rem' }}
          >
            <option value="recent">Recently added</option>
            <option value="expiring">Expiring first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      )}

      <div className="pantry-list">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading pantry items...</div>
        ) : filtered.length > 0 ? (
          Object.entries(groupedItems)
            .sort(([a], [b]) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)))
            .map(([area, areaItems]) => {
              // Pinned items float to the top of their area; relative order is
              // otherwise preserved (sort is stable).
              const sorted = [...areaItems].sort((a, b) => {
                const ap = pinnedSet.has(a.id);
                const bp = pinnedSet.has(b.id);
                if (ap !== bp) return ap ? -1 : 1;
                return compareItems(a, b);
              });
              return (
                <div key={area} className="pantry-area-group">
                  <h3 className="pantry-area-title" style={{ marginTop: '16px', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {area}
                  </h3>
                  {sorted.map((item) => (
                    <ItemCard key={item.id} item={item} onDelete={handleDelete} onRefresh={refresh} onPinChange={() => setPinTick((t) => t + 1)} />
                  ))}
                </div>
              );
            })
        ) : (
          <div className="empty-state animate-fade-in">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <h3>{search || activeCategory !== 'all' ? 'No matches' : 'Your pantry is empty'}</h3>
            <p>
              {search || activeCategory !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Tap "+ Add" to start tracking your groceries'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
