import { useEffect, useRef, useState } from 'react';
import './FloatingNav.css';

// Floating island header (desktop) / plain bar (mobile).
// See DESIGN_SYSTEM.md §3 — the pill is near-opaque and the blur lives in a
// separate scrim, which is what Clerk actually ships and what cheap
// "liquid glass" copies get backwards.

export default function FloatingNav({ onLogin, onSignup, onNavigate }) {
  const [scrolled, setScrolled] = useState(false);
  const ticking = useRef(false);

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

  return (
    <div className="fnav" data-scrolled={scrolled ? 'true' : 'false'}>
      <div className="fnav__scrim" aria-hidden="true" />
      <nav className="fnav__pill" aria-label="Main">
        <button className="fnav__brand" onClick={() => onNavigate?.('/')}>
          Pantry Snap
        </button>

        <div className="fnav__links">
          <button className="fnav__link" onClick={() => onNavigate?.('#how')}>How it works</button>
          <button className="fnav__link" onClick={() => onNavigate?.('#shared')}>Shared kitchens</button>
          <button className="fnav__link" onClick={() => onNavigate?.('/why-free')}>Why it&rsquo;s free</button>
        </div>

        <div className="fnav__actions">
          <button className="fnav__link" onClick={onLogin}>Log in</button>
          <button className="fnav__cta" onClick={onSignup}>Start free</button>
        </div>
      </nav>
    </div>
  );
}
