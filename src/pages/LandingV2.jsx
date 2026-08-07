import { useEffect, useRef } from 'react';
import LivePantryHero from '../components/LivePantryHero';
import FloatingNav from '../components/FloatingNav';
import { useTransition } from '../contexts/TransitionContext';
import { initReveals } from '../lib/reveal';
import './LandingV2.css';

// Redesign proposal — see DESIGN_DIRECTION.md. Reachable at /preview-landing
// while the current landing stays live at /. Nothing merges without approval.
//
// Direction: the hero IS the pantry. No decorative gradient field, no 6rem
// display type, product before marketing.

export default function LandingV2() {
  const startTransition = useTransition();
  const rootRef = useRef(null);

  useEffect(() => initReveals(rootRef.current || document), []);

  const toSignup = () => startTransition('/login?mode=signup');

  return (
    <div className="v2" ref={rootRef}>
      <FloatingNav
        onLogin={() => startTransition('/login')}
        onSignup={toSignup}
        onNavigate={(to) => {
          if (to.startsWith('#')) document.querySelector(`[data-anchor="${to.slice(1)}"]`)?.scrollIntoView({ behavior: 'smooth' });
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
              <span className="v2-step-n">1</span>
              <h3>Photograph the receipt</h3>
              <p>Crumpled, faded, folded — it reads them. Nothing to type.</p>
            </div>
            <div className="v2-step">
              <span className="v2-step-n">2</span>
              <h3>Items sort themselves</h3>
              <p>Names, quantities, categories and realistic expiry dates, filled in.</p>
            </div>
            <div className="v2-step">
              <span className="v2-step-n">3</span>
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

      <footer className="v2-footer">
        <span>© {new Date().getFullYear()} Pantry Snap</span>
        <a href="/legal/privacy.html">Privacy</a>
        <a href="/legal/eula.html">EULA</a>
        <a href="/legal/do-not-sell.html">Do Not Sell or Share</a>
      </footer>
    </div>
  );
}
