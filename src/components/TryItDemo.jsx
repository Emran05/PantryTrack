import { useEffect, useState } from 'react';
import { useTransition } from '../contexts/TransitionContext';

// Try-before-signup hero demo (research: signup wall behind first value —
// Duolingo's +20% DAU inversion + Navattic's +20-25% site conversion).
// Deterministic: a bundled sample receipt "parses" over ~1.2s into real rows
// with expiry chips. The only account wall is "Save my pantry".
// Lazy-loaded on tap, so it costs the initial page nothing.

const SAMPLE_RECEIPT = [
  { line: 'OAT MILK 1QT', price: '4.29' },
  { line: 'EGGS DOZEN AA', price: '4.29' },
  { line: 'SPINACH BAGGED', price: '2.99' },
  { line: 'PASTA SPAGHETTI', price: '1.99' },
  { line: 'CHEDDAR SHARP', price: '4.50' },
];

const PARSED = [
  { name: 'Oat milk', qty: 1, cat: 'Dairy', expiry: '7d left', urgent: false },
  { name: 'Eggs', qty: 12, cat: 'Dairy', expiry: '21d left', urgent: false },
  { name: 'Spinach', qty: 1, cat: 'Produce', expiry: '5d left', urgent: true },
  { name: 'Spaghetti', qty: 1, cat: 'Pantry', expiry: '1y+', urgent: false },
  { name: 'Cheddar', qty: 1, cat: 'Dairy', expiry: '14d left', urgent: false },
];

const REDUCED =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function TryItDemo() {
  const startTransition = useTransition();
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (phase !== 'scanning') return;
    if (REDUCED) {
      setRevealed(PARSED.length);
      setPhase('done');
      return;
    }
    // Rows land one by one over ~1.2s, then the save CTA appears.
    const timers = PARSED.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), 350 + i * 220)
    );
    timers.push(setTimeout(() => setPhase('done'), 350 + PARSED.length * 220 + 150));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  return (
    <div className="try-demo">
      {phase === 'idle' && (
        <>
          <div className="try-demo-receipt" aria-hidden="true">
            <div className="try-demo-receipt-head">CAMPUS MARKET</div>
            {SAMPLE_RECEIPT.map((r) => (
              <div key={r.line} className="try-demo-receipt-line">
                <span>{r.line}</span>
                <span>{r.price}</span>
              </div>
            ))}
          </div>
          <button className="hero-cta-primary try-demo-scan" onClick={() => setPhase('scanning')}>
            Scan this receipt
          </button>
          <p className="try-demo-note">Sample receipt · takes 3 seconds</p>
        </>
      )}

      {phase !== 'idle' && (
        <>
          <div className={`try-demo-progress ${phase === 'done' ? 'done' : ''}`} aria-hidden="true">
            <span />
          </div>
          <div className="try-demo-list">
            {PARSED.slice(0, revealed).map((item) => (
              <div key={item.name} className="try-demo-row">
                <div className="try-demo-row-main">
                  <span className="try-demo-name">{item.name}</span>
                  <span className="try-demo-cat">{item.cat}</span>
                  <span className={`try-demo-expiry ${item.urgent ? 'urgent' : ''}`}>{item.expiry}</span>
                </div>
                <span className="try-demo-qty">x{item.qty}</span>
              </div>
            ))}
          </div>
          {phase === 'done' && (
            <div className="try-demo-save">
              <button
                className="hero-cta-primary"
                onClick={() => startTransition('/login?mode=signup')}
              >
                Save my pantry — free
              </button>
              <p className="try-demo-note">Works in your browser. Nothing to download.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
