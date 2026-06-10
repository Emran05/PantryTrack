import { useEffect } from 'react';
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
    emoji: '🍳',
    title: '"I cooked this"',
    desc: 'Made a recipe? One tap updates your pantry — confirm what you used and quantities adjust automatically.',
  },
  {
    emoji: '🥗',
    title: 'Dietary filters',
    desc: 'Vegetarian, vegan, gluten-free, or dairy-free — recipes now respect how you eat.',
  },
  {
    emoji: '❤️',
    title: 'Recipe favorites',
    desc: 'Heart the recipes you love and they stay pinned at the top of your suggestions.',
  },
  {
    emoji: '📌',
    title: 'Pin your staples',
    desc: 'Pinned items float to the top of your pantry, and you can now sort by expiration date or name.',
  },
  {
    emoji: '🎙️',
    title: 'Voice add',
    desc: 'Say "two pounds ground beef" and your shopping list fills itself in.',
  },
  {
    emoji: '📊',
    title: 'Honest dashboard',
    desc: 'Your streak and savings now come from what you actually use — plus a new activity feed.',
  },
  {
    emoji: '🌗',
    title: 'System theme',
    desc: 'A new theme that follows your device’s light/dark mode automatically.',
  },
  {
    emoji: '📤',
    title: 'CSV export',
    desc: 'Download your whole pantry as a spreadsheet from Settings → Data.',
  },
];

export default function WhatsNew({ onClose }) {
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
    <div className="whatsnew-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label="What's new in Pantry Snap">
      <div className="whatsnew-card animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="whatsnew-hero">
          <div className="whatsnew-sparkle" aria-hidden="true">✨</div>
          <h2 className="whatsnew-title">What&rsquo;s New</h2>
          <p className="whatsnew-subtitle">Pantry Snap {WHATS_NEW_VERSION} — fresh out of the kitchen</p>
        </div>

        <div className="whatsnew-list">
          {FEATURES.map((f) => (
            <div key={f.title} className="whatsnew-item">
              <span className="whatsnew-emoji" aria-hidden="true">{f.emoji}</span>
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
