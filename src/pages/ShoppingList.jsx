import { useState, useCallback, useEffect, useRef } from 'react';
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

// Web Speech API — Chrome/Safari/Edge. Null on Firefox; the mic button hides.
const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
};

const UNIT_MAP = {
  piece: 'pcs', pieces: 'pcs', pcs: 'pcs',
  pound: 'lbs', pounds: 'lbs', lb: 'lbs', lbs: 'lbs',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  gram: 'g', grams: 'g', g: 'g',
  liter: 'L', liters: 'L', l: 'L',
  milliliter: 'mL', milliliters: 'mL', ml: 'mL',
  cup: 'cups', cups: 'cups',
  bag: 'bags', bags: 'bags',
  box: 'boxes', boxes: 'boxes',
  can: 'cans', cans: 'cans',
  bottle: 'bottles', bottles: 'bottles',
};

// "add two pounds of ground beef" → { quantity: 2, unit: 'lbs', name: 'ground beef' }
export function parseVoiceTranscript(text) {
  let t = text.trim().toLowerCase().replace(/^(add|put|get|buy)\s+/, '');

  let quantity = 1;
  const numMatch = t.match(/^(\d+(?:\.\d+)?)\s+/);
  const wordMatch = numMatch ? null : t.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)\s+/);
  if (numMatch) {
    quantity = parseFloat(numMatch[1]);
    t = t.slice(numMatch[0].length);
  } else if (wordMatch) {
    quantity = NUMBER_WORDS[wordMatch[1]];
    t = t.slice(wordMatch[0].length);
  }

  let unit = 'pcs';
  const unitMatch = t.match(/^([a-z]+)\s+(?:of\s+)?(.+)$/);
  if (unitMatch && UNIT_MAP[unitMatch[1]]) {
    unit = UNIT_MAP[unitMatch[1]];
    t = unitMatch[2];
  }

  return { quantity, unit, name: t.trim() };
}

function VoiceMicButton({ onTranscript, onError }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // Stop any in-flight recognition if the page unmounts mid-listen.
  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  if (!SpeechRecognitionImpl) return null;

  const start = () => {
    const r = new SpeechRecognitionImpl();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => onTranscript(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      if (e.error !== 'aborted' && e.error !== 'no-speech') onError(e.error);
    };
    recognitionRef.current = r;
    r.start();
    setListening(true);
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <button
      type="button"
      className={`voice-mic ${listening ? 'listening' : ''}`}
      onClick={listening ? stop : start}
      aria-label={listening ? 'Stop listening' : 'Add item by voice'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}

export default function ShoppingList() {
  const { activePantry } = usePantry();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const [category, setCategory] = useState('other');
  const { showToast } = useToast();
  const fetchSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!activePantry) return;
    const seq = ++fetchSeqRef.current;
    try {
      const data = await getShoppingList(activePantry.id);
      if (seq !== fetchSeqRef.current) return;
      setItems(data);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Failed to load shopping list:', err);
      showToast('Failed to load shopping list', 'error');
    }
  }, [activePantry, showToast]);

  useEffect(() => {
    if (activePantry) {
      setLoading(true);
      setItems([]);
      refresh().finally(() => setLoading(false));
    }
  }, [activePantry, refresh]);

  useRealtimeSync(activePantry?.id, 'shopping_items', refresh);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !activePantry) return;
    try {
      await addShoppingItem(activePantry.id, { name: trimmed, quantity, unit, category });
      showToast(`"${trimmed}" added to list`);
      setName('');
      setQuantity(1);
      setCategory('other');
      refresh();
    } catch (err) {
      if (err.code === 'DUPLICATE_ITEM') {
        showToast(`"${trimmed}" is already on your list`);
      } else {
        console.error('Failed to add item:', err);
        showToast('Failed to add item', 'error');
      }
    }
  };

  const handleToggle = async (id, currentChecked) => {
    try {
      await updateShoppingItem(id, { isChecked: !currentChecked });
      refresh();
    } catch (err) {
      console.error('Failed to update item:', err);
      showToast('Failed to update item', 'error');
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
      showToast('Failed to delete item', 'error');
    }
  };

  const handleMoveToPantry = async () => {
    if (!activePantry) return;
    try {
      const { moved, failed } = await moveCheckedToPantry(activePantry.id);
      if (moved > 0 || failed > 0) refresh();
      if (failed > 0) {
        showToast(`${moved} moved · ${failed} failed — still on your list`, 'error');
      } else if (moved > 0) {
        showToast(`${moved} item${moved !== 1 ? 's' : ''} moved to pantry`);
      }
    } catch (err) {
      console.error('Failed to move items:', err);
      showToast('Failed to move items to pantry', 'error');
    }
  };

  const handleVoiceTranscript = (transcript) => {
    const parsed = parseVoiceTranscript(transcript);
    if (!parsed.name) {
      showToast(`Heard "${transcript}" — couldn't find an item name`, 'info');
      return;
    }
    // Populate the form instead of auto-submitting so the user can adjust.
    setName(parsed.name);
    setQuantity(parsed.quantity);
    setUnit(parsed.unit);
    showToast(`Heard: ${parsed.quantity} ${parsed.unit} ${parsed.name} — tap Add to confirm`, 'info');
  };

  const handleVoiceError = (errCode) => {
    if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
      showToast('Microphone access denied — check browser permissions', 'error');
    } else {
      showToast('Voice input failed — try again', 'error');
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
        <div className="shopping-name-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            className="shopping-add-input"
            placeholder="Add an item..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <VoiceMicButton onTranscript={handleVoiceTranscript} onError={handleVoiceError} />
        </div>
        <div className="shopping-add-row">
          <input
            type="number"
            className="shopping-qty-input"
            min="0.5"
            step="0.5"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
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
