import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { addPantryItem } from '../lib/storage';
import { CATEGORIES, UNITS } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import './ScanReceipt.css';

// Mock OCR: simulates parsing a receipt image into grocery items.
// In production, replace with Google Vision / Tesseract.js / OpenAI Vision API.
function mockParseReceipt() {
  const possibleItems = [
    { name: 'Eggs (12ct)', category: 'dairy', quantity: 1, unit: 'boxes' },
    { name: 'Bread (Whole Wheat)', category: 'grains', quantity: 1, unit: 'pcs' },
    { name: 'Cheddar Cheese', category: 'dairy', quantity: 1, unit: 'lbs' },
    { name: 'Tomatoes', category: 'produce', quantity: 4, unit: 'pcs' },
    { name: 'Pasta (Penne)', category: 'grains', quantity: 1, unit: 'boxes' },
    { name: 'Ground Beef', category: 'meat', quantity: 1, unit: 'lbs' },
    { name: 'Orange Juice', category: 'beverages', quantity: 1, unit: 'bottles' },
    { name: 'Spinach', category: 'produce', quantity: 1, unit: 'bags' },
    { name: 'Frozen Pizza', category: 'frozen', quantity: 2, unit: 'pcs' },
    { name: 'Sour Cream', category: 'dairy', quantity: 1, unit: 'cups' },
  ];
  // Return a random subset of 4-7 items to simulate real scans
  const count = 4 + Math.floor(Math.random() * 4);
  const shuffled = [...possibleItems].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default function ScanReceipt() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { showToast } = useToast();

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setIsProcessing(true);
      // Simulate OCR processing delay
      setTimeout(() => {
        const items = mockParseReceipt();
        setParsedItems(items.map((item, i) => ({ ...item, _key: i, _selected: true })));
        setIsProcessing(false);
      }, 1500);
    };
    reader.readAsDataURL(file);
  };

  const toggleItem = (key) => {
    setParsedItems((prev) =>
      prev.map((item) => (item._key === key ? { ...item, _selected: !item._selected } : item))
    );
  };

  const updateItem = (key, field, value) => {
    setParsedItems((prev) =>
      prev.map((item) => (item._key === key ? { ...item, [field]: value } : item))
    );
  };

  const handleConfirm = () => {
    const selected = parsedItems.filter((item) => item._selected);
    selected.forEach((item) => {
      addPantryItem({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
      });
    });
    setIsDone(true);
    showToast(`${selected.length} item${selected.length !== 1 ? 's' : ''} added to pantry`);
    setTimeout(() => navigate('/'), 1200);
  };

  const selectedCount = parsedItems.filter((i) => i._selected).length;

  return (
    <div className="page-content app-container">
      <div className="scan-page animate-fade-in">
        {/* Header */}
        <div className="scan-header">
          <button className="scan-back" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <h2 className="page-title">Scan Receipt</h2>
          <p className="page-subtitle">Capture or upload a receipt to auto-import items</p>
        </div>

        {/* Capture Zone */}
        {!preview && (
          <div className="scan-capture-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="scan-capture-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <p className="scan-capture-text">Tap to capture or upload receipt</p>
            <p className="scan-capture-hint">Supports camera and photo library</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="scan-file-input"
              onChange={handleCapture}
            />
          </div>
        )}

        {/* Preview + Processing */}
        {preview && !parsedItems.length && (
          <div className="scan-preview">
            <img src={preview} alt="Receipt preview" className="scan-preview-img" />
            {isProcessing && (
              <div className="scan-processing">
                <div className="scan-spinner" />
                <p>Scanning receipt...</p>
              </div>
            )}
          </div>
        )}

        {/* Parsed Items */}
        {parsedItems.length > 0 && !isDone && (
          <div className="scan-results animate-fade-in">
            <div className="scan-results-header">
              <h3>{parsedItems.length} items found</h3>
              <span className="scan-results-selected">{selectedCount} selected</span>
            </div>

            <div className="scan-items-list">
              {parsedItems.map((item) => (
                <div key={item._key} className={`scan-item ${item._selected ? '' : 'deselected'}`}>
                  <button
                    className={`scan-item-check ${item._selected ? 'checked' : ''}`}
                    onClick={() => toggleItem(item._key)}
                    aria-label={item._selected ? 'Deselect' : 'Select'}
                  >
                    {item._selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <div className="scan-item-details">
                    <input
                      className="scan-item-name"
                      value={item.name}
                      onChange={(e) => updateItem(item._key, 'name', e.target.value)}
                    />
                    <div className="scan-item-meta">
                      <input
                        type="number"
                        className="scan-item-qty"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item._key, 'quantity', parseInt(e.target.value) || 1)}
                      />
                      <select
                        className="scan-item-unit"
                        value={item.unit}
                        onChange={(e) => updateItem(item._key, 'unit', e.target.value)}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <select
                        className="scan-item-category"
                        value={item.category}
                        onChange={(e) => updateItem(item._key, 'category', e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="scan-actions">
              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handleConfirm}
                disabled={selectedCount === 0}
              >
                Add {selectedCount} item{selectedCount !== 1 ? 's' : ''} to Pantry
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => { setPreview(null); setParsedItems([]); }}>
                Scan Again
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {isDone && (
          <div className="scan-success animate-fade-in">
            <div className="scan-success-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Items Added</h3>
            <p>Redirecting to your pantry...</p>
          </div>
        )}
      </div>
    </div>
  );
}
