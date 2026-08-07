import { useEffect, useRef } from 'react';
import FloatingNav from '../components/FloatingNav';
import SiteFooter from '../components/SiteFooter';
import { useAuth } from '../contexts/AuthContext';
import { initReveals } from '../lib/reveal';
import { AUTH_LOGIN, AUTH_SIGNUP } from '../lib/redesignRoutes';
import './WhyFree.css';

// Replaces a pricing page (DESIGN_SYSTEM.md §7). Every researched product with
// a /pricing page has a live SKU; genuinely free products have none. A lone $0
// card reads as a stub — a card is a comparison affordance with nothing to
// compare. What a data-monetized free app actually needs is a trust page.
//
// One reading column, no cards, no grid, native <details> FAQ.

const FAQ = [
  {
    q: 'Are you going to start charging me?',
    a: 'No. Everything you use today stays free. If we ever build something extra, it will be a separate paid add-on — and this sentence will change before that happens.',
  },
  {
    q: 'What exactly leaves my account?',
    a: 'Item names, categories, quantities and dates — stripped of your name, email and account ID before they leave our database. Your photos, receipts, notes and shopping lists never leave.',
  },
  {
    q: 'Can a brand find out it was me?',
    a: 'They receive counts, not people. Nothing we share maps back to an account.',
  },
  {
    q: 'What happens if I turn it off?',
    a: 'Nothing changes in the app. No feature is locked, nothing gets slower, and we will not ask you again. It is a toggle in Settings, and we honour the Global Privacy Control signal automatically.',
  },
  {
    q: 'Why not just run ads?',
    a: 'Ads would follow you around the app you use to check whether you still have milk. Aggregate grocery trends pay for the same thing without turning your pantry into a billboard.',
  },
];

export default function WhyFree({ onNavigate }) {
  const rootRef = useRef(null);
  const { user } = useAuth();
  useEffect(() => initReveals(rootRef.current || document), []);

  const go = (to) => onNavigate?.(to);

  return (
    <div className="wf" ref={rootRef}>
      <FloatingNav
        onLogin={() => go(AUTH_LOGIN)}
        onSignup={() => go(AUTH_SIGNUP)}
        onNavigate={(to) => (to.startsWith('#') ? null : go(to))}
      />

      <main className="wf-main">
        <h1 className="wf-h1">PantrySnap is free. Here&rsquo;s how that works.</h1>
        <p className="wf-lede">
          No trial, no card, no &ldquo;free plan&rdquo; with the useful parts removed.
          Every feature is free for everyone, and it stays that way.
        </p>

        <section className="wf-section reveal">
          <h2 className="wf-h2">How we make money</h2>
          <p>
            We sell <strong>aggregate grocery trends</strong> — what categories of
            food students buy, in what quantities, and how often they go to waste
            — to market-research firms and consumer-insights companies.
          </p>
          <p>
            That is the whole business model. There is no upsell waiting for you
            later and no premium tier holding a feature hostage.
          </p>
        </section>

        <section className="wf-section reveal">
          <h2 className="wf-h2">What leaves, and what never does</h2>
          <div className="wf-split">
            <div>
              <h3 className="wf-h3">Leaves, de-identified</h3>
              <ul className="wf-list">
                <li>Item names and categories</li>
                <li>Quantities and dates</li>
                <li>Broad demographics you chose to give us</li>
              </ul>
            </div>
            <div>
              <h3 className="wf-h3">Never leaves</h3>
              <ul className="wf-list wf-list-never">
                <li>Your name, email or account ID</li>
                <li>Receipt photos and item photos</li>
                <li>Notes and shopping lists</li>
                <li>Anything that identifies you</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="wf-section reveal">
          <h2 className="wf-h2">And you can say no</h2>
          <p>
            One toggle in Settings turns the sharing off. The app behaves exactly
            the same afterwards — nothing is locked, nothing slows down, and we
            will not nag you about it. We also honour the{' '}
            <a href="https://globalprivacycontrol.org" target="_blank" rel="noreferrer">
              Global Privacy Control
            </a>{' '}
            browser signal automatically, so if your browser already says no, we
            already heard it.
          </p>
          {/* /settings exists only in the authenticated route set, so sending a
              logged-out visitor there hit App's catch-all and bounced them to
              the landing page — the one control this page offers as proof of
              "you can say no" looked like a crash. Logged out, point at the
              opt-out page instead: two of the three routes it documents (the
              GPC browser signal and email) work with no account at all. */}
          {user ? (
            <button className="wf-btn" onClick={() => go('/settings')}>
              Open privacy settings
            </button>
          ) : (
            <a className="wf-btn" href="/legal/do-not-sell.html">
              How to opt out
            </a>
          )}
        </section>

        <section className="wf-section reveal">
          <h2 className="wf-h2">Questions people actually ask</h2>
          <div className="wf-faq">
            {FAQ.map((item) => (
              <details key={item.q} className="wf-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="wf-close reveal">
          <p className="wf-close-line">Still free. Still yours to switch off.</p>
          <button className="wf-btn wf-btn-lg" onClick={() => go(AUTH_SIGNUP)}>
            Create my pantry
          </button>
        </section>
      </main>

      <SiteFooter onNavigate={go} />
    </div>
  );
}
