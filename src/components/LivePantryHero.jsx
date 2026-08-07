import { useEffect, useRef, useState } from 'react';
import './LivePantryHero.css';

// The hero IS the pantry (see DESIGN_DIRECTION.md). A real, populated pantry
// in the app's own card language — not a mockup drawing — that the visitor can
// poke before any account exists. Scanning the sample receipt drops new items
// into this same stack.

const SEED = [
  { id: 'milk', name: 'Oat milk', qty: 1, unit: 'carton', cat: 'Drinks', days: 2 },
  { id: 'spinach', name: 'Spinach', qty: 1, unit: 'bag', cat: 'Produce', days: 5 },
  { id: 'eggs', name: 'Eggs', qty: 12, unit: 'pcs', cat: 'Dairy', days: 21 },
  { id: 'pasta', name: 'Spaghetti', qty: 2, unit: 'box', cat: 'Pantry', days: 400 },
];

const SCANNED = [
  { id: 'cheddar', name: 'Cheddar', qty: 1, unit: 'block', cat: 'Dairy', days: 14 },
  { id: 'chicken', name: 'Chicken breast', qty: 1, unit: 'lb', cat: 'Meat', days: 3 },
  { id: 'tortillas', name: 'Tortillas', qty: 8, unit: 'pcs', cat: 'Pantry', days: 30 },
];

// Expiry colour carries information, not decoration: red = act today,
// amber = this week, neutral = fine.
// Scanned items were prepended, which left a 30-day item sitting above a 3-day
// one while the line right above the list promises the soonest-to-expire comes
// first. Sorting on insert also makes the demo *show* the sort it claims: each
// scanned row drops into its place by date instead of piling on top.
const byExpiry = (list) => [...list].sort((a, b) => a.days - b.days);

function expiry(days) {
  if (days <= 2) return { label: days <= 1 ? 'Today' : `${days} days`, tone: 'urgent' };
  if (days <= 7) return { label: `${days} days`, tone: 'soon' };
  if (days >= 365) return { label: '1 yr+', tone: 'calm' };
  return { label: `${days} days`, tone: 'calm' };
}

const REDUCED =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function LivePantryHero({ onSaveClick }) {
  const [items, setItems] = useState(SEED);
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const runScan = () => {
    if (phase !== 'idle') return;
    setPhase('scanning');
    if (REDUCED) {
      setItems((prev) => byExpiry([...SCANNED, ...prev]));
      setPhase('done');
      return;
    }
    SCANNED.forEach((item, i) => {
      timers.current.push(
        setTimeout(() => setItems((prev) => byExpiry([item, ...prev])), 420 + i * 260)
      );
    });
    timers.current.push(setTimeout(() => setPhase('done'), 420 + SCANNED.length * 260));
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setItems(SEED);
    setPhase('idle');
  };

  const soonest = items.reduce((a, b) => (a.days <= b.days ? a : b), items[0]);

  return (
    <div className="lp-hero">
      <div className="lp-hero-head">
        <span className="lp-hero-eyebrow">Your pantry, right now</span>
        <p className="lp-hero-status">
          {soonest ? (
            <>
              <strong>{soonest.name}</strong> goes first — {expiry(soonest.days).label.toLowerCase()}
            </>
          ) : (
            'Nothing tracked yet'
          )}
        </p>
      </div>

      <ul className="lp-list">
        {items.map((item) => {
          const e = expiry(item.days);
          return (
            <li key={item.id} className={`lp-item lp-item-${e.tone}`}>
              <span className="lp-item-main">
                <span className="lp-item-name">{item.name}</span>
                <span className="lp-item-cat">{item.cat}</span>
              </span>
              <span className="lp-item-right">
                <span className={`lp-expiry lp-expiry-${e.tone}`}>{e.label}</span>
                <span className="lp-qty">
                  {item.qty} {item.unit}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="lp-actions">
        {phase === 'idle' && (
          <button className="lp-btn lp-btn-primary" onClick={runScan}>
            Scan a receipt
          </button>
        )}
        {phase === 'scanning' && (
          <button className="lp-btn lp-btn-primary" disabled>
            Reading receipt…
          </button>
        )}
        {phase === 'done' && (
          <>
            <button className="lp-btn lp-btn-primary" onClick={onSaveClick}>
              Save this pantry — free
            </button>
            <button className="lp-btn lp-btn-quiet" onClick={reset}>
              Reset
            </button>
          </>
        )}
      </div>
      <p className="lp-foot">
        {phase === 'done'
          ? 'Three items added from one photo. Works in your browser — nothing to download.'
          : 'No account needed. Try it right here.'}
      </p>
    </div>
  );
}
