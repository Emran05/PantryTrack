import { useEffect, useRef } from 'react';
import Icon from './Icon';
import './WhatsNew.css';

// Bump this when shipping a batch of features — users who haven't seen the
// current version get the popup once.
export const WHATS_NEW_VERSION = '3.1';

const SEEN_KEY = 'pantry_whats_new_seen';

export function shouldShowWhatsNew() {
  try {
    return localStorage.getItem(SEEN_KEY) !== WHATS_NEW_VERSION;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen() {
  try {
    localStorage.setItem(SEEN_KEY, WHATS_NEW_VERSION);
  } catch {
    // localStorage unavailable — they'll just see it again
  }
}

const FEATURES = [
  {
    icon: 'cook',
    title: '"I cooked this"',
    desc: 'Made a recipe? One tap updates your pantry — confirm what you used and quantities adjust automatically.',
  },
  {
    icon: 'list',
    title: 'Dietary filters',
    desc: 'Vegetarian, vegan, gluten-free, or dairy-free — recipes now respect how you eat.',
  },
  {
    icon: 'pin',
    title: 'Recipe favorites',
    desc: 'Heart the recipes you love and they stay pinned at the top of your suggestions.',
  },
  {
    icon: 'pin',
    title: 'Pin your staples',
    desc: 'Pinned items float to the top of your pantry, and you can now sort by expiration date or name.',
  },
  {
    icon: 'spark',
    title: 'Voice add',
    desc: 'Say "two pounds ground beef" and your shopping list fills itself in.',
  },
  {
    icon: 'chart',
    title: 'Honest dashboard',
    desc: 'Your streak and savings now come from what you actually use — plus a new activity feed.',
  },
  {
    icon: 'settings',
    title: 'System theme',
    desc: 'A new theme that follows your device’s light/dark mode automatically.',
  },
  {
    icon: 'share',
    title: 'CSV export',
    desc: 'Download your whole pantry as a spreadsheet from Settings → Data.',
  },
];

export default function WhatsNew({ onClose }) {
  // Move focus into the dialog on open (QA: screen readers never
  // announced it and Tab kept walking the page behind).
  const overlayRef = useRef(null);
  useEffect(() => { overlayRef.current?.focus(); }, []);

  const handleClose = () => {
    markWhatsNewSeen();
    onClose();
  };

  // Lock body scroll + Esc to dismiss.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={overlayRef} tabIndex={-1} className="whatsnew-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label="What's new in Pantry Snap">
      <div className="whatsnew-card animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="whatsnew-hero">
          <div className="whatsnew-sparkle" aria-hidden="true"><Icon name="spark" size={22} /></div>
          <h2 className="whatsnew-title">What&rsquo;s New</h2>
          <p className="whatsnew-subtitle">Pantry Snap {WHATS_NEW_VERSION} — fresh out of the kitchen</p>
        </div>

        <div className="whatsnew-list">
          {FEATURES.map((f) => (
            <div key={f.title} className="whatsnew-item">
              <span className="whatsnew-emoji" aria-hidden="true"><Icon name={f.icon} size={20} /></span>
              <div className="whatsnew-item-text">
                <span className="whatsnew-item-title">{f.title}</span>
                <span className="whatsnew-item-desc">{f.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="whatsnew-footer">
          <button className="btn btn-primary btn-full" onClick={handleClose}>
            Let&rsquo;s go
          </button>
        </div>
      </div>
    </div>
  );
}
