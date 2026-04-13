import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPantryItems, addPantryItem, updatePantryItem, getAreas } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { CATEGORIES, UNITS, getDefaultExpirationDate } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import './AddEditItem.css';

export default function AddEditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activePantry } = usePantry();
  const isEditing = id && id !== 'new';

  const [form, setForm] = useState({
    name: '',
    category: 'other',
    quantity: 1,
    unit: 'pcs',
    expirationDate: '',
    notes: '',
    area_id: '',
  });

  const [loading, setLoading] = useState(isEditing);
  const [areas, setAreas] = useState([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    async function load() {
      if (!activePantry) return;
      try {
        const fetchedAreas = await getAreas(activePantry.id);
        setAreas(fetchedAreas || []);

        if (isEditing) {
          const items = await getPantryItems(activePantry.id);
          const item = items.find((i) => String(i.id) === String(id));
          if (item) {
            setForm({
              name: item.name,
              category: item.category,
              quantity: item.quantity,
              unit: item.unit,
              expirationDate: item.expirationDate || '',
              notes: item.notes || '',
              area_id: item.area_id || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load item or areas', err);
      }
      setLoading(false);
    }
    load();
  }, [id, isEditing, activePantry]);

  // Handle barcode scanning startup and teardown
  useEffect(() => {
    if (!scanning) return;

    let scannerInstance = null;
    let aborted = false;

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (aborted) return; // Component unmounted or scanning toggled off

      scannerInstance = new Html5QrcodeScanner('reader', {
        qrbox: { width: 250, height: 250 },
        fps: 5,
      }, false);

      scannerInstance.render(
        async (decodedText) => {
          try { await scannerInstance.clear(); } catch (_) {}
          scannerInstance = null;
          setScanning(false);
          if (aborted) return;
          try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}`);
            if (aborted) return;
            const data = await res.json();
            if (data.status === 1 && data.product) {
              setForm(prev => ({ ...prev, name: data.product.product_name || prev.name }));
              showToast(`Found: ${data.product.product_name}`);
            } else {
              showToast('Product not found in database');
            }
          } catch (e) {
            console.error(e);
            if (!aborted) showToast('Error looking up product');
          }
        },
        () => {} // Ignore scan errors per frame
      );
    }).catch(err => {
      console.error('Failed to load html5-qrcode', err);
      if (!aborted) {
        showToast('Scanner failed to load');
        setScanning(false);
      }
    });

    // Synchronous cleanup React can actually call
    return () => {
      aborted = true;
      if (scannerInstance) {
        scannerInstance.clear().catch(console.error);
        scannerInstance = null;
      }
    };
  }, [scanning, showToast]);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value === 'null' ? null : value };
      // Auto-suggest expiration date when category changes and no date is set yet
      if (field === 'category' && !prev.expirationDate && !isEditing) {
        updated.expirationDate = getDefaultExpirationDate(value);
      }
      return updated;
    });
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    if (!form.name.trim()) {
      showToast('Item name is required');
      return;
    }
    
    if (!activePantry) {
      showToast('No pantry selected. Go to Settings to create one.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await updatePantryItem(id, form);
        showToast(`"${form.name}" updated`);
      } else {
        await addPantryItem(activePantry.id, form);
        showToast(`"${form.name}" added to pantry`);
      }
      navigate('/');
    } catch (err) {
      console.error('Error saving item:', err);
      showToast(`Error: ${err.message || 'Failed to save item'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content app-container">
      <div className="add-edit-page animate-fade-in">
        <h2 className="page-title">{isEditing ? 'Edit Item' : 'Add Item'}</h2>
        <p className="page-subtitle">{isEditing ? 'Update your item details' : 'Add a new item to your pantry'}</p>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading item details...</div>
        ) : (
          <form className="item-form" onSubmit={handleSubmit}>
          {!isEditing && (
            <div className="barcode-scanner-section">
              {scanning ? (
                <div className="scanner-container">
                  <div id="reader" className="scanner-reader"></div>
                  <button type="button" className="btn secondary full-width" onClick={() => setScanning(false)} style={{ marginTop: '1rem' }}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="btn outline full-width scan-barcode-btn" onClick={() => setScanning(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M9 8v8M12 8v8M15 8v8"/>
                  </svg>
                  Scan Barcode
                </button>
              )}
            </div>
          )}

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

          {areas.length > 0 && (
            <div className="form-group">
              <label htmlFor="area_id">Area</label>
              <select
                id="area_id"
                value={form.area_id || ''}
                onChange={(e) => handleChange('area_id', e.target.value)}
                style={{ width: '100%', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
              >
                <option value="">No specific area</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

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
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={submitting}>
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add to Pantry'}
            </button>
            <button type="button" className="btn btn-secondary btn-full" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
          </form>
        )}
      </div>
    </div>
  );
}
