// Shared scroll-reveal observer — Linear's production pattern, no deps.
//
// CSS owns the animation (see Landing.css). This module only toggles a class.
// The hidden state is double-gated in CSS on `html.js` (added here, so no-JS
// users always see content) and `prefers-reduced-motion: no-preference`.
// One module-level observer serves every element; reveal fires once.

const REDUCED =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

let observer = null;

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
    );
  }
  return observer;
}

/** Observe every `.reveal` under root. Call from a mount effect; returns a cleanup. */
export function initReveals(root = document) {
  if (typeof document === 'undefined') return () => {};
  document.documentElement.classList.add('js');
  if (REDUCED || !('IntersectionObserver' in window)) {
    root.querySelectorAll('.reveal').forEach((el) => el.classList.add('revealed'));
    return () => {};
  }
  const els = Array.from(root.querySelectorAll('.reveal'));
  const obs = getObserver();
  els.forEach((el) => obs.observe(el));
  return () => els.forEach((el) => obs.unobserve(el));
}
