import { useState, useEffect, useRef } from 'react';
import { consumePantryItem, addShoppingItem } from '../lib/supabaseStorage';
import { logConsumptionEvent } from '../lib/preferences';
import { useToast } from './ToastContext';
import './ConsumeModal.css';

const REASONS = [
  { id: 'used', label: 'Used / Cooked', emoji: '🍳' },
  { id: 'wasted', label: 'Expired / Wasted', emoji: '🗑' },
  { id: 'donated', label: 'Donated / Gave away', emoji: '🤝' },
];

export default function ConsumeModal({ item, pantryId, onClose, onDone }) {
  const { showToast } = useToast();
  // Default to consuming everything — most common case ("I finished it").
  const [amount, setAmount] = useState(item.quantity);
  const [reason, setReason] = useState('used');
  const [restock, setRestock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Lock body scroll while modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    // Focus the amount field on mount, but select instead of caret-at-end so
    // the user can immediately overtype the default value.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const setAmountClamped = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    const next = (!Number.isFinite(n) || n < 0) ? 0 : Math.min(n, item.quantity);
    setAmount(next);
    // The restock checkbox is only visible (and only makes sense) at full
    // quantity — clear it if the user dials the amount back down, otherwise a
    // hidden-but-checked box silently adds to the shopping list on save.
    if (next !== item.quantity && restock) setRestock(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (submitting) return;
    if (amount <= 0) {
      showToast('Enter how much you used');
      return;
    }
    setSubmitting(true);
    try {
      const result = await consumePantryItem(item.id, amount);

      logConsumptionEvent(pantryId, {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        qty: amount,
        unit: item.unit,
        reason,
        // Track whether the item was fully consumed for downstream stats.
        finished: result.removed,
      });

      // If the user opted to restock — or the item is now gone and they didn't
      // explicitly opt out — surface a clear path to the shopping list.
      const finished = result.removed;
      if (restock && finished) {
        try {
          await addShoppingItem(
            pantryId,
            { name: item.name, quantity: 1, unit: item.unit, category: item.category }
          );
          showToast(`Removed · "${item.name}" added to shopping list`);
        } catch (err) {
          if (err.code === 'DUPLICATE_ITEM') {
            showToast(`Removed · "${item.name}" already on your list`);
          } else {
            console.error(err);
            showToast('Removed (but failed to add to shopping list)', 'error');
          }
        }
      } else if (finished) {
        // Smart restock prompt: item just hit zero. Offer one-tap add.
        showToast(`"${item.name}" finished`, 'success', {
          action: {
            label: 'Add to list',
            onClick: async () => {
              try {
                await addShoppingItem(
                  pantryId,
                  { name: item.name, quantity: 1, unit: item.unit, category: item.category }
                );
                showToast(`"${item.name}" added to shopping list`);
              } catch (err) {
                if (err.code === 'DUPLICATE_ITEM') {
                  showToast(`Already on your list`);
                } else {
                  showToast('Could not add to list', 'error');
                }
              }
            },
          },
        });
      } else if (result.newQty <= 1) {
        // Low-stock nudge.
        showToast(`Only ${result.newQty} ${item.unit} left`, 'info', {
          action: {
            label: 'Add to list',
            onClick: async () => {
              try {
                await addShoppingItem(
                  pantryId,
                  { name: item.name, quantity: 1, unit: item.unit, category: item.category }
                );
                showToast(`"${item.name}" added to shopping list`);
              } catch (err) {
                if (err.code === 'DUPLICATE_ITEM') {
                  showToast(`Already on your list`);
                } else {
                  showToast('Could not add to list', 'error');
                }
              }
            },
          },
        });
      } else {
        showToast(`Used ${amount} ${item.unit} of ${item.name}`);
      }

      if (onDone) onDone(result);
      onClose();
    } catch (err) {
      console.error('consumePantryItem failed:', err);
      showToast('Could not update — please try again', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick presets: useful for common cases like "I drank a glass" or "ate one".
  const presets = [
    { label: 'Some', value: Math.min(1, item.quantity) },
    { label: 'Half', value: item.quantity / 2 },
    { label: 'All', value: item.quantity },
  ].filter((p) => p.value > 0);

  return (
    <div className="consume-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Use ${item.name}`}>
      <div className="consume-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="consume-handle" aria-hidden="true" />
        <div className="consume-header">
          <h3 className="consume-title">Use {item.name}</h3>
          <p className="consume-subtitle">
            {item.quantity} {item.unit} on hand
          </p>
        </div>

        <form onSubmit={handleSubmit} className="consume-form">
          <label className="consume-label">How much?</label>
          <div className="consume-amount-row">
            <button
              type="button"
              className="consume-step-btn"
              onClick={() => setAmountClamped(amount - 0.5)}
              aria-label="Decrease"
              disabled={amount <= 0}
            >
              −
            </button>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max={item.quantity}
              className="consume-amount-input"
              value={amount}
              onChange={(e) => setAmountClamped(e.target.value)}
            />
            <span className="consume-amount-unit">{item.unit}</span>
            <button
              type="button"
              className="consume-step-btn"
              onClick={() => setAmountClamped(amount + 0.5)}
              aria-label="Increase"
              disabled={amount >= item.quantity}
            >
              +
            </button>
          </div>

          <div className="consume-presets">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`consume-preset-btn ${amount === p.value ? 'active' : ''}`}
                onClick={() => setAmountClamped(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="consume-label">Why?</label>
          <div className="consume-reasons">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`consume-reason-btn ${reason === r.id ? 'active' : ''}`}
                onClick={() => setReason(r.id)}
              >
                <span className="consume-reason-emoji" aria-hidden="true">{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {amount === item.quantity && (
            <label className="consume-restock">
              <input
                type="checkbox"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
              />
              <span>Add to shopping list (need to restock)</span>
            </label>
          )}

          <div className="consume-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || amount <= 0}>
              {submitting ? 'Saving…' : amount === item.quantity ? 'Finish item' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
