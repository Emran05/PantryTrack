import { useState, useEffect, useMemo } from 'react';
import { consumePantryItems } from '../lib/supabaseStorage';
import { logConsumptionEvent } from '../lib/preferences';
import { nameMatchesIngredient } from '../lib/recipes';
import { useToast } from './ToastContext';
import './CookThisModal.css';

// Bottom-sheet shown from a recipe card's "I cooked this" button. Lists the
// pantry items that fuzzy-match the recipe's matched ingredients and lets the
// user confirm (or deselect) what actually got used before decrementing.
// The explicit review step matters because nameMatchesIngredient is fuzzy —
// "almond milk" matches "milk" in both directions.
export default function CookThisModal({ recipe, items, pantryId, onClose, onDone }) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Pantry items that match any of the recipe's matched ingredients.
  const targets = useMemo(() => {
    const matched = recipe.matched || [];
    return items.filter((item) =>
      matched.some((ing) => nameMatchesIngredient(item.name, ing))
    );
  }, [recipe, items]);

  // Per-row state: selected + quantity to consume.
  const [rows, setRows] = useState({});
  useEffect(() => {
    const next = {};
    for (const item of targets) {
      next[item.id] = { selected: true, qty: Math.min(1, item.quantity) };
    }
    setRows(next);
  }, [targets]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const setQty = (item, qty) => {
    const clamped = Math.min(Math.max(0.5, qty), item.quantity);
    setRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], qty: clamped } }));
  };

  const toggleRow = (itemId) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId]?.selected },
    }));
  };

  const selectedTargets = targets.filter((t) => rows[t.id]?.selected);

  const handleCook = async () => {
    if (submitting || selectedTargets.length === 0) return;
    setSubmitting(true);

    // One transaction: every ingredient is deducted or none are. A partial
    // deduction would leave the pantry disagreeing with what was cooked.
    let outcome;
    try {
      outcome = await consumePantryItems(
        pantryId,
        selectedTargets.map((item) => ({ id: item.id, qty: rows[item.id]?.qty ?? 1 }))
      );
    } catch (err) {
      console.error('Cook-this consume failed:', err);
      setSubmitting(false);
      showToast('Could not update your pantry — nothing was changed', 'error');
      return;
    }

    const byId = new Map(outcome.results.map((r) => [r.id, r]));
    selectedTargets.forEach((item) => {
      const r = byId.get(item.id);
      if (!r) return;
      logConsumptionEvent(pantryId, {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        qty: rows[item.id]?.qty ?? 1,
        unit: item.unit,
        reason: 'used',
        finished: r.removed,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
      });
    });

    const used = outcome.results.length;
    const finished = outcome.results.filter((r) => r.removed).length;
    const failed = outcome.failed || 0;

    setSubmitting(false);

    if (used === 0) {
      showToast('Could not update your pantry — please try again', 'error');
      return;
    }
    let msg = `Cooked ${recipe.title} · ${used} item${used !== 1 ? 's' : ''} used`;
    if (finished > 0) msg += ` · ${finished} finished`;
    // Only reachable on the non-atomic fallback path (unapplied migrations).
    if (failed > 0) msg = `Only ${used} of ${used + failed} items were updated — check your pantry`;
    showToast(msg, failed > 0 ? 'error' : 'success');

    if (onDone) onDone();
    onClose();
  };

  return (
    <div className="cookthis-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Cooked ${recipe.title}`}>
      <div className="cookthis-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="cookthis-handle" aria-hidden="true" />
        <div className="cookthis-header">
          <h3 className="cookthis-title">Cooked {recipe.title}?</h3>
          <p className="cookthis-subtitle">
            {targets.length > 0
              ? 'Confirm what you used — we’ll update your pantry.'
              : 'We couldn’t match any pantry items to this recipe.'}
          </p>
        </div>

        <div className="cookthis-rows">
          {targets.map((item) => {
            const row = rows[item.id] || { selected: true, qty: 1 };
            return (
              <div key={item.id} className={`cookthis-row ${row.selected ? '' : 'deselected'}`}>
                <button
                  type="button"
                  className={`cookthis-check ${row.selected ? 'checked' : ''}`}
                  onClick={() => toggleRow(item.id)}
                  aria-label={row.selected ? `Skip ${item.name}` : `Include ${item.name}`}
                >
                  {row.selected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <div className="cookthis-row-info">
                  <span className="cookthis-row-name">{item.name}</span>
                  <span className="cookthis-row-have">{item.quantity} {item.unit} on hand</span>
                </div>
                <div className="cookthis-stepper">
                  <button
                    type="button"
                    className="cookthis-step-btn"
                    onClick={() => setQty(item, (row.qty ?? 1) - 0.5)}
                    disabled={!row.selected || row.qty <= 0.5}
                    aria-label="Use less"
                  >
                    −
                  </button>
                  <span className="cookthis-qty">{row.qty}</span>
                  <button
                    type="button"
                    className="cookthis-step-btn"
                    onClick={() => setQty(item, (row.qty ?? 1) + 0.5)}
                    disabled={!row.selected || row.qty >= item.quantity}
                    aria-label="Use more"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cookthis-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCook}
            disabled={submitting || selectedTargets.length === 0}
          >
            {submitting ? 'Updating…' : `Use ${selectedTargets.length} item${selectedTargets.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
