import { useEffect, useRef } from 'react';
import LivePantryHero from '../components/LivePantryHero';
import FloatingNav from '../components/FloatingNav';
import SiteFooter from '../components/SiteFooter';
import Icon from '../components/Icon';
import { useTransition } from '../contexts/TransitionContext';
import { initReveals } from '../lib/reveal';
import { AUTH_LOGIN, AUTH_SIGNUP } from '../lib/redesignRoutes';
import './LandingV2.css';

// The landing page — see DESIGN_DIRECTION.md. Shipped to '/' 2026-08-07
// while the current landing stays live at /. Nothing merges without approval.
//
// Direction: the hero IS the pantry. No decorative gradient field, no 6rem
// display type, product before marketing.

export default function LandingV2() {
  const startTransition = useTransition();
  const rootRef = useRef(null);

  useEffect(() => initReveals(rootRef.current || document), []);

  // Arriving from another page's header (/why-free links "How it works" here as
  // /#how), or on a cold deep-link.
  //
  // A single deferred scroll is not enough: this page is lazy-loaded and its
  // sections animate in, so the target's offset keeps moving for a while after
  // mount — one attempt at 80ms landed 900px short. Retry until the section is
  // actually on screen, then stop. Re-scrolling to a correct position is a
  // no-op, so the retries are harmless.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The browser restores the previous scroll offset after the lazy chunk
    // resolves, which lands on top of anything we do here. Only opt out while
    // we are honouring a hash; normal back/forward keeps its restoration.
    const prevRestore = history.scrollRestoration;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let tries = 0;
    const timers = [];
    const attempt = () => {
      const el = document.querySelector(`[data-anchor="${id}"]`);
      if (el) {
        const { top, bottom } = el.getBoundingClientRect();
        if (top >= 0 && top < window.innerHeight * 0.5 && bottom > 0) return; // arrived
        el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      }
      if (++tries < 6) timers.push(setTimeout(attempt, 250));
    };
    timers.push(setTimeout(attempt, 80));
    return () => {
      timers.forEach(clearTimeout);
      if ('scrollRestoration' in history) history.scrollRestoration = prevRestore;
    };
  }, []);

  const toSignup = () => startTransition(AUTH_SIGNUP);

  return (
    <div className="v2" ref={rootRef}>
      <FloatingNav
        onLogin={() => startTransition(AUTH_LOGIN)}
        onSignup={toSignup}
        onNavigate={(to) => {
          if (to.startsWith('#')) document.querySelector(`[data-anchor="${to.slice(1)}"]`)?.scrollIntoView({
            // The CSS honours reduced-motion everywhere; this JS scroll is the
            // one motion that ignored it, and a long smooth scroll is exactly
            // what triggers vestibular symptoms.
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          });
          else startTransition(to);
        }}
      />

      <header className="v2-hero">
        <div className="v2-hero-copy">
          <h1 className="v2-h1">
            Know what&rsquo;s in your fridge.<br />
            <span className="v2-h1-dim">Stop re-buying. Stop tossing.</span>
          </h1>
          <p className="v2-sub">
            Snap a receipt — every item lands in a shared pantry that tells you what
            dies first. Built for people who split a kitchen and a budget.
          </p>
          <ul className="v2-points">
            <li>Receipt photo → itemised pantry in seconds</li>
            <li>One list your whole apartment sees, live</li>
            <li>A nudge before food expires, not after</li>
          </ul>
          <div className="v2-cta-row">
            <button className="v2-btn" onClick={toSignup}>Start free</button>
            <span className="v2-cta-note">No card · works on any phone</span>
          </div>
        </div>

        <div className="v2-hero-demo">
          <LivePantryHero onSaveClick={toSignup} />
        </div>
      </header>

      <section className="v2-section reveal" data-anchor="how">
        <div className="v2-section-inner">
          <h2 className="v2-h2">The part everyone hates, automated</h2>
          <div className="v2-steps">
            <div className="v2-step">
              <span className="v2-step-n"><Icon name="camera" size={18} /></span>
              <h3>Photograph the receipt</h3>
              <p>Crumpled, faded, folded — it reads them. Nothing to type.</p>
            </div>
            <div className="v2-step">
              <span className="v2-step-n"><Icon name="pantry" size={18} /></span>
              <h3>Items sort themselves</h3>
              <p>Names, quantities, categories and realistic expiry dates, filled in.</p>
            </div>
            <div className="v2-step">
              <span className="v2-step-n"><Icon name="clock" size={18} accent /></span>
              <h3>You get told before it&rsquo;s too late</h3>
              <p>&ldquo;Spinach goes tomorrow&rdquo; — while you can still cook it.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="v2-section v2-section-alt reveal" data-anchor="shared">
        <div className="v2-section-inner v2-split">
          <div>
            <h2 className="v2-h2">Built for a shared kitchen</h2>
            <p className="v2-body">
              Send one link. Your roommates see the same pantry, instantly. Someone
              grabs milk on the way home and it&rsquo;s off the list before they reach
              the checkout — so nobody buys the third carton.
            </p>
            <p className="v2-body v2-muted">
              Everyone keeps their own view: pin your staples, filter to your diet,
              and see who used what.
            </p>
          </div>
          <ul className="v2-feed" aria-label="Example activity">
            <li><span className="v2-feed-who">Maya</span> added <strong>Oat milk</strong><span className="v2-feed-when">just now</span></li>
            <li><span className="v2-feed-who">You</span> used <strong>2 eggs</strong><span className="v2-feed-when">12m</span></li>
            <li><span className="v2-feed-who">Jo</span> checked off <strong>Coffee</strong><span className="v2-feed-when">1h</span></li>
            <li><span className="v2-feed-who">Maya</span> scanned a receipt · <strong>9 items</strong><span className="v2-feed-when">yesterday</span></li>
          </ul>
        </div>
      </section>

      <section className="v2-close reveal">
        <h2 className="v2-h2">Start with what&rsquo;s in your kitchen right now.</h2>
        <button className="v2-btn v2-btn-lg" onClick={toSignup}>Create my pantry — free</button>
        <p className="v2-cta-note">Free for students · no card · 60-second setup</p>
      </section>

      <SiteFooter onNavigate={(to) => startTransition(to)} />
    </div>
  );
}
