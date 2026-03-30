import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPantryItems, addPantryItem, updatePantryItem } from '../lib/storage';
import { CATEGORIES, UNITS } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import './AddEditItem.css';

export default function AddEditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEditing = id && id !== 'new';

  const [form, setForm] = useState({
    name: '',
    category: 'other',
    quantity: 1,
    unit: 'pcs',
    expirationDate: '',
    notes: '',
  });

  useEffect(() => {
    if (isEditing) {
      const items = getPantryItems();
      const item = items.find((i) => i.id === id);
      if (item) {
        setForm({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          expirationDate: item.expirationDate || '',
          notes: item.notes || '',
        });
      }
    }
  }, [id, isEditing]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (isEditing) {
      updatePantryItem(id, form);
      showToast(`"${form.name}" updated`);
    } else {
      addPantryItem(form);
      showToast(`"${form.name}" added to pantry`);
    }
    navigate('/');
  };

  return (
    <div className="page-content app-container">
      <div className="add-edit-page animate-fade-in">
        <h2 className="page-title">{isEditing ? 'Edit Item' : 'Add Item'}</h2>
        <p className="page-subtitle">{isEditing ? 'Update your item details' : 'Add a new item to your pantry'}</p>

        <form className="item-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Item Name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Whole Milk"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <div className="category-grid">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-option ${form.category === cat.id ? 'selected' : ''}`}
                  style={{ '--cat-color': cat.color }}
                  onClick={() => handleChange('category', cat.id)}
                >
                  <span className="category-option-dot" style={{ background: cat.color }} />
                  <span className="category-option-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                min="0"
                step="0.5"
                value={form.quantity}
                onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="unit">Unit</label>
              <select
                id="unit"
                value={form.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="expiration">Expiration Date</label>
            <input
              id="expiration"
              type="date"
              value={form.expirationDate}
              onChange={(e) => handleChange('expirationDate', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              rows="2"
              placeholder="Any additional notes..."
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-full btn-lg">
              {isEditing ? 'Save Changes' : 'Add to Pantry'}
            </button>
            <button type="button" className="btn btn-secondary btn-full" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
