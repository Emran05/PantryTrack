import { useState, useCallback, useEffect } from 'react';
import './Tour.css';

// ─── Tour Step Definitions ──────────────────────────────────────────────────

const STEPS = [
  {
    id: 'welcome',
    illustrationClass: 'tour-illustration-welcome',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    ),
    title: 'Welcome to Pantry Snap!',
    description: 'Your smart kitchen companion that tracks groceries, reduces waste, and keeps your household in sync. Let\u2019s take a quick tour.',
  },
  {
    id: 'pantry',
    illustrationClass: 'tour-illustration-pantry',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    title: 'Your Pantry',
    description: 'This is your home base. Every item in your kitchen lives here \u2014 search, filter by category, and tap any item to edit it. Swipe left to delete or add to your shopping list.',
  },
  {
    id: 'add',
    illustrationClass: 'tour-illustration-add',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M9 8v8M12 8v8M15 8v8" />
        <line x1="12" y1="3" x2="12" y2="5" strokeWidth="2" />
        <line x1="11" y1="4" x2="13" y2="4" strokeWidth="2" />
      </svg>
    ),
    title: 'Add Items Easily',
    description: 'Tap the "+ Add" button to create items manually. You can also scan a barcode \u2014 we\u2019ll look it up and fill in the name for you automatically.',
  },
  {
    id: 'scan',
    illustrationClass: 'tour-illustration-scan',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
        <path d="M12 9v1" opacity="0.5" />
      </svg>
    ),
    title: 'Smart Receipt Scanning',
    description: 'Snap a photo of your grocery receipt and our AI will parse every item \u2014 name, quantity, and category. Review, adjust, and import in seconds.',
  },
  {
    id: 'shopping',
    illustrationClass: 'tour-illustration-shop',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
    title: 'Shopping List',
    description: 'Plan your grocery runs and check off items as you shop. When you\u2019re done, tap "Move to Pantry" and everything jumps into your inventory with smart expiration dates.',
  },
  {
    id: 'recipes',
    illustrationClass: 'tour-illustration-recipes',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="13" y2="11" />
      </svg>
    ),
    title: 'Recipe Suggestions',
    description: 'Get personalized recipes based on what\u2019s in your pantry. Our AI prioritizes items expiring soon so nothing goes to waste. Missing an ingredient? Add it to your list in one tap.',
  },
  {
    id: 'dashboard',
    illustrationClass: 'tour-illustration-dash',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: 'Your Dashboard',
    description: 'See your pantry at a glance \u2014 total items, expiration warnings, category breakdowns, and your waste-reduction streak. Knowledge is power.',
  },
  {
    id: 'settings',
    illustrationClass: 'tour-illustration-settings',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Homes & Collaboration',
    description: 'Create multiple homes, invite roommates to share a pantry, organize items by area (Fridge, Shelf, Closet), and personalize your look with curated themes.',
  },
  {
    id: 'done',
    illustrationClass: 'tour-illustration-done',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: 'You\u2019re All Set!',
    description: 'Start by adding your first item or scanning a receipt. Happy tracking \u2014 and say goodbye to food waste! \ud83c\udf31',
  },
];

const TOUR_STORAGE_KEY = 'pantry_tour_completed';

// ─── Public helpers ─────────────────────────────────────────────────────────

export function isTourCompleted() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTourCompleted() {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    // localStorage unavailable — fail silently
  }
}

export function resetTourFlag() {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Tour({ onComplete }) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const totalSteps = STEPS.length;
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  const current = STEPS[step];

  const finish = useCallback(() => {
    setExiting(true);
    markTourCompleted();
    // Wait for exit animation
    setTimeout(() => {
      onComplete();
    }, 350);
  }, [onComplete]);

  const next = useCallback(() => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, finish]);

  const back = useCallback(() => {
    if (!isFirst) setStep((s) => s - 1);
  }, [isFirst]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, back, skip]);

  // Prevent body scroll while tour is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className={`tour-overlay ${exiting ? 'exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="App tour"
    >
      <div className="tour-card">
        {/* Skip button (hidden on last step) */}
        {!isLast && (
          <button className="tour-skip" onClick={skip} aria-label="Skip tour">
            Skip
          </button>
        )}

        {/* Step content — sliding track */}
        <div className="tour-step-viewport">
          <div
            className="tour-step-track"
            style={{ transform: `translateX(-${step * 100}%)` }}
          >
            {STEPS.map((s) => (
              <div className="tour-step" key={s.id}>
                <div className={`tour-illustration ${s.illustrationClass}`}>
                  {s.icon}
                </div>
                <h2 className="tour-title">{s.title}</h2>
                <p className="tour-description">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="tour-footer">
          {/* Progress dots */}
          <div className="tour-dots" role="tablist" aria-label="Tour progress">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`tour-dot ${i === step ? 'active' : ''}`}
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1} of ${totalSteps}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="tour-nav">
            {!isFirst && (
              <button className="tour-btn tour-btn-back" onClick={back} aria-label="Previous step">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}

            {isLast ? (
              <button className="tour-btn tour-btn-next tour-btn-start" onClick={finish}>
                Get Started
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            ) : (
              <button className="tour-btn tour-btn-next" onClick={next}>
                {isFirst ? 'Start Tour' : 'Next'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>

          <span className="tour-keyboard-hint">
            Use arrow keys to navigate · Esc to skip
          </span>
        </div>
      </div>
    </div>
  );
}
