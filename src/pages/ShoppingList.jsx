import { useState, useCallback, useEffect } from 'react';
import {
  getShoppingList,
  addShoppingItem,
  deleteShoppingItem,
  updateShoppingItem,
  moveCheckedToPantry,
} from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { UNITS, CATEGORIES, getCategoryInfo } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import './ShoppingList.css';

export default function ShoppingList() {
  const { activePantry } = usePantry();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const [category, setCategory] = useState('other');
  const { showToast } = useToast();

  const refresh = useCallback(async () => {
    if (activePantry) {
      try {
        const data = await getShoppingList(activePantry.id);
        setItems(data);
      } catch (err) {
        console.error('Failed to load shopping list:', err);
        showToast('Failed to load shopping list');
      }
    }
  }, [activePantry, showToast]);

  useEffect(() => {
    if (activePantry) {
      setLoading(true);
      refresh().finally(() => setLoading(false));
    }
  }, [activePantry, refresh]);

  useRealtimeSync(activePantry?.id, 'shopping_items', refresh);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !activePantry) return;
    try {
      await addShoppingItem(activePantry.id, { name: name.trim(), quantity, unit, category });
      showToast(`"${name.trim()}" added to list`);
      setName('');
      setQuantity(1);
      setCategory('other');
      refresh();
    } catch (err) {
      console.error('Failed to add item:', err);
      showToast('Failed to add item');
    }
  };

  const handleToggle = async (id, currentChecked) => {
    try {
      await updateShoppingItem(id, { isChecked: !currentChecked });
      refresh();
    } catch (err) {
      console.error('Failed to update item:', err);
      showToast('Failed to update item');
    }
  };

  const handleDelete = async (id) => {
    const item = items.find((i) => i.id === id);
    try {
      await deleteShoppingItem(id);
      refresh();
      showToast(`"${item?.name || 'Item'}" removed`);
    } catch (err) {
      console.error('Failed to delete item:', err);
      showToast('Failed to delete item');
    }
  };

  const handleMoveToPantry = async () => {
    if (!activePantry) return;
    try {
      const count = await moveCheckedToPantry(activePantry.id);
      if (count > 0) {
        refresh();
        showToast(`${count} item${count !== 1 ? 's' : ''} moved to pantry`);
      }
    } catch (err) {
      console.error('Failed to move items:', err);
      showToast('Failed to move items to pantry');
    }
  };

  const unchecked = items.filter((i) => !i.isChecked);
  const checked = items.filter((i) => i.isChecked);

  return (
    <div className="page-content app-container">
      <div className="shopping-header animate-fade-in">
        <h2 className="page-title">Shopping List</h2>
        {!loading && <p className="page-subtitle">{items.length} item{items.length !== 1 ? 's' : ''}</p>}
      </div>

      <form className="shopping-add-form animate-fade-in" onSubmit={handleAdd}>
        <input
          type="text"
          className="shopping-add-input"
          placeholder="Add an item..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="shopping-add-row">
          <input
            type="number"
            className="shopping-qty-input"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
          <select
            className="shopping-unit-select"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <select
            className="shopping-cat-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary shopping-add-btn">
            Add
          </button>
        </div>
      </form>

      <div className="shopping-list">
        {unchecked.length > 0 && (
          <div className="shopping-section">
            <h3 className="shopping-section-title">To Buy</h3>
            {unchecked.map((item) => (
              <div key={item.id} className="shopping-item animate-fade-in">
                <button
                  className="shopping-check"
                  onClick={() => handleToggle(item.id, item.isChecked)}
                  aria-label="Mark as bought"
                >
                  <span className="shopping-check-box" />
                </button>
                <div className="shopping-item-info">
                  <span className="shopping-item-name">{item.name}</span>
                  <span className="shopping-item-qty">
                    {item.quantity} {item.unit}
                    <span className="shopping-item-cat" style={{ color: getCategoryInfo(item.category).color, marginLeft: '6px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600, opacity: 0.8 }}>
                      {getCategoryInfo(item.category).label}
                    </span>
                  </span>
                </div>
                <button
                  className="shopping-item-delete"
                  onClick={() => handleDelete(item.id)}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {checked.length > 0 && (
          <div className="shopping-section">
            <div className="shopping-section-header">
              <h3 className="shopping-section-title">Bought ({checked.length})</h3>
              <button className="btn btn-primary shopping-move-btn" onClick={handleMoveToPantry}>
                Move to Pantry
              </button>
            </div>
            {checked.map((item) => (
              <div key={item.id} className="shopping-item checked animate-fade-in">
                <button
                  className="shopping-check"
                  onClick={() => handleToggle(item.id, item.isChecked)}
                  aria-label="Unmark"
                >
                  <span className="shopping-check-box checked" />
                </button>
                <div className="shopping-item-info">
                  <span className="shopping-item-name">{item.name}</span>
                  <span className="shopping-item-qty">
                    {item.quantity} {item.unit}
                  </span>
                </div>
                <button
                  className="shopping-item-delete"
                  onClick={() => handleDelete(item.id)}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading shopping list...</div>
        ) : items.length === 0 && (
          <div className="empty-state animate-fade-in">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <h3>Your list is empty</h3>
            <p>Add items you need to pick up from the store</p>
          </div>
        )}
      </div>
    </div>
  );
}
