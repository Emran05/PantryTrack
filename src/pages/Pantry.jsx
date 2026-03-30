import { useState, useCallback } from 'react';
import { getPantryItems, deletePantryItem } from '../lib/storage';
import { CATEGORIES } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import SearchBar from '../components/SearchBar';
import ItemCard from '../components/ItemCard';
import './Pantry.css';

export default function Pantry() {
  const [items, setItems] = useState(() => getPantryItems());
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const { showToast } = useToast();

  const refresh = useCallback(() => {
    setItems(getPantryItems());
  }, []);

  const handleDelete = useCallback((id) => {
    const item = items.find((i) => i.id === id);
    deletePantryItem(id);
    refresh();
    showToast(`"${item?.name || 'Item'}" removed`);
  }, [items, refresh, showToast]);

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

  return (
    <div className="page-content app-container">
      <div className="pantry-header animate-fade-in">
        <h2 className="page-title">My Pantry</h2>
        <p className="page-subtitle">{items.length} item{items.length !== 1 ? 's' : ''} tracked</p>
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

      <div className="pantry-list">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <ItemCard key={item.id} item={item} onDelete={handleDelete} />
          ))
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
