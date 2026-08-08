import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import './FloatingNav.css';

// Floating island header (desktop) / plain bar (mobile).
// See DESIGN_SYSTEM.md §3 — the pill is near-opaque and the blur lives in a
// separate scrim, which is what Clerk actually ships and what cheap
// "liquid glass" copies get backwards.

const SECTIONS = [
  { to: '#how', label: 'How it works' },
  { to: '#shared', label: 'Shared kitchens' },
  { to: '/why-free', label: 'Why it’s free' },
];

export default function FloatingNav({ onLogin, onSignup, onNavigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const ticking = useRef(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      // rAF-throttled: this runs on every scroll frame otherwise.
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12);
        ticking.current = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes and hands focus back to the button that opened it —
  // otherwise focus is stranded on a panel that no longer exists.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const goAndClose = (to) => {
    setOpen(false);
    // Defer navigation until the panel has actually collapsed. Scrolling to a
    // section while the ~200px-tall menu is still in the DOM computes the target
    // against a layout that is about to shift up by exactly that height, landing
    // the heading a menu-height off-screen. Two frames clears the reflow.
    requestAnimationFrame(() => requestAnimationFrame(() => onNavigate?.(to)));
  };

  return (
    <div className="fnav" data-scrolled={scrolled ? 'true' : 'false'}>
      <div className="fnav__scrim" aria-hidden="true" />
      <nav className="fnav__pill" aria-label="Main">
        <button className="fnav__brand" onClick={() => onNavigate?.('/')}>
          Pantry Snap
        </button>

        <div className="fnav__links">
          {SECTIONS.map((s) => (
            <button key={s.to} className="fnav__link" onClick={() => onNavigate?.(s.to)}>{s.label}</button>
          ))}
        </div>

        <div className="fnav__actions">
          <button className="fnav__link fnav__login" onClick={onLogin}>Log in</button>
          <button className="fnav__cta" onClick={onSignup}>Start free</button>

          {/* Below 901px the section links are hidden, which used to mean they
              simply did not exist on a phone. This is their only route. */}
          <button
            ref={triggerRef}
            type="button"
            className="fnav__burger"
            aria-expanded={open}
            aria-controls="fnav-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </nav>

      <div id="fnav-menu" className="fnav__menu" hidden={!open}>
        {SECTIONS.map((s) => (
          <button key={s.to} className="fnav__menu-link" onClick={() => goAndClose(s.to)}>{s.label}</button>
        ))}
        <button className="fnav__menu-link" onClick={() => { setOpen(false); onLogin?.(); }}>Log in</button>
      </div>
    </div>
  );
}
