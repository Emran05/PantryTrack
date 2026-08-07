import { lazy, Suspense, useEffect, useRef, useState } from 'react';

// Loaded only when the visitor taps "Try it live" — zero initial-page cost.
const TryItDemo = lazy(() => import('../components/TryItDemo'));
import SyncCanvas from '../components/SyncCanvas';
import MagicBoxDashboard from '../components/MagicBoxDashboard';
import PixelReceipt from '../components/PixelReceipt';
import BarcodeScannerMockup from '../components/BarcodeScannerMockup';
import MagicSnapAnimation from '../components/MagicSnapAnimation';
import { useTransition } from '../contexts/TransitionContext';
import { initReveals } from '../lib/reveal';
import './Landing.css';

export default function Landing() {
  const startTransition = useTransition();
  const containerRef = useRef(null);
  const magneticRef = useRef(null);
  const storyRef = useRef(null);
  const heroCtaRef = useRef(null);
  const [isStoryTriggered, setIsStoryTriggered] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const scrollToStory = () => {
    document.querySelector('.scroll-story')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Below-fold reveals (shared observer; above-fold stays frozen per research).
  useEffect(() => initReveals(containerRef.current || document), []);

  // Battery: pause the aurora layers while the hero is off-screen.
  useEffect(() => {
    const root = containerRef.current;
    const hero = root?.querySelector('.landing-hero');
    const aurora = root?.querySelector('.hero-aurora');
    if (!hero || !aurora || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([entry]) => {
      aurora.classList.toggle('paused', !entry.isIntersecting);
    });
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);

  // Sticky CTA appears once the hero's primary CTA has scrolled off the top.
  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([entry]) => {
      setShowStickyCta(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Parallax Hero Effect — pointer devices only; on touch these handlers are
  // dead weight for the exact audience the page targets (research finding).
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return;
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 2; // -1 to 1
      const y = (e.clientY / innerHeight - 0.5) * 2; // -1 to 1
      
      const elements = containerRef.current.querySelectorAll('.mockup-item');
      elements.forEach((el) => {
        const isItem1 = el.classList.contains('mockup-item-1');
        const isItem2 = el.classList.contains('mockup-item-2');
        
        // Different layers move at different depths
        const depth = isItem1 ? 15 : isItem2 ? 30 : -20;
        const rotateX = -y * depth;
        const rotateY = x * depth;
        
        // Keep their base transforms from CSS
        const baseTz = isItem1 ? '60px' : isItem2 ? '20px' : '40px';
        const baseRotZ = isItem2 ? '-10deg' : !isItem1 ? '10deg' : '0deg';

        el.style.transform = `translateZ(${baseTz}) rotateZ(${baseRotZ}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Magnetic Button Effect — pointer devices only (see parallax note).
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return;
    const btnBox = magneticRef.current;
    if (!btnBox) return;

    const btn = btnBox.querySelector('.magnetic-button');
    let rafId = null;

    const handleBtnMouseMove = (e) => {
      const rect = btnBox.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Interpolate smoothly
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        btn.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px)`;
      });
    };

    const handleBtnMouseLeave = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        btn.style.transform = `translate(0px, 0px)`;
      });
    };

    btnBox.addEventListener('mousemove', handleBtnMouseMove);
    btnBox.addEventListener('mouseleave', handleBtnMouseLeave);

    return () => {
      btnBox.removeEventListener('mousemove', handleBtnMouseMove);
      btnBox.removeEventListener('mouseleave', handleBtnMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Intersection Observer for Story ("The Snap")
  useEffect(() => {
    const target = storyRef.current;
    if (!target) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsStoryTriggered(true);
      } else {
        // Optional: Reset if you want it to trigger again when scrolling back up
        // setIsStoryTriggered(false);
      }
    }, {
      root: null,
      threshold: 0.5,
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page" ref={containerRef}>
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-logo">
          Pantry Snap
        </div>
        <div className="landing-nav-actions">
          <button onClick={() => startTransition('/login')} className="nav-link">Log In</button>
          <button onClick={() => startTransition('/login?mode=signup')} className="nav-btn">Start Free</button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="landing-hero">
        {/* Dynamic background: aurora color field + grain texture, each layer
            on its own animation clock so the combination never visibly loops. */}
        <div className="hero-aurora" aria-hidden="true">
          <span className="aurora-blob blob-a"></span>
          <span className="aurora-blob blob-b"></span>
          <span className="aurora-blob blob-c"></span>
          <span className="aurora-blob blob-d"></span>
          <span className="aurora-grain"></span>
          <span className="aurora-grid"></span>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="hero-title-static">Never buy the same milk twice&nbsp;—</span>
            <span className="hero-rotator" aria-hidden="true">
              <span>in your dorm.</span>
              <span>with your roommates.</span>
              <span>on a student budget.</span>
              <span>in your first apartment.</span>
            </span>
            <span className="sr-only">in your dorm, with your roommates, on a student budget.</span>
          </h1>
          <p className="hero-subtitle">
            Snap a receipt and PantrySnap keeps the list for you — what you have,
            what&rsquo;s expiring, what to cook tonight. The average person tosses{' '}
            <strong>$728 of food a year</strong>. Roommates who don&rsquo;t share a list toss the most.
          </p>
          <div className="hero-cta-row">
            <button
              ref={heroCtaRef}
              onClick={() => startTransition('/login?mode=signup')}
              className="hero-cta-primary"
            >
              Build my pantry — free
            </button>
            <button onClick={scrollToStory} className="hero-cta-secondary">
              See how it works
            </button>
          </div>
          <p className="hero-proof">Free for students · No card · 60-second setup</p>
          {!demoOpen && (
            <button className="try-demo-launch" onClick={() => setDemoOpen(true)}>
              ▶ Try it live — no account, no download
            </button>
          )}
        </div>
        
        {demoOpen && (
          <div className="try-demo-wrap">
            <Suspense fallback={<div className="try-demo-note">Loading the demo…</div>}>
              <TryItDemo />
            </Suspense>
          </div>
        )}

        <div className="hero-mockup-container" style={demoOpen ? { display: 'none' } : undefined}>
          <div className="mockup-item mockup-item-2" style={{ padding: 0 }}>
             <PixelReceipt />
          </div>
          <div className="mockup-item mockup-item-3" style={{ padding: '0', background: 'transparent', border: 'none', overflow: 'hidden' }}>
             <div style={{ padding: '20px', background: 'rgba(20, 20, 20, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', borderRadius: '24px', height: '100%' }}>
               <MagicBoxDashboard />
             </div>
          </div>
          <div className="mockup-item mockup-item-1" style={{ overflow: 'hidden' }}>
             <BarcodeScannerMockup />
          </div>
        </div>
      </header>

      {/* Story Section */}
      <section className="scroll-story">
        <div className="scroll-sticky">
          <div className="story-container" ref={storyRef}>
            <div className="story-text">
              <h2>Snap the receipt. Done.</h2>
              <p>Hold up your grocery receipt — every item lands in your pantry, sorted and counted, before you&rsquo;ve even put the bags away. No typing, ever.</p>
            </div>
            <div className={`story-visual ${isStoryTriggered ? 'triggered' : ''}`} style={{ background: 'transparent', border: 'none' }}>
               <MagicSnapAnimation isTriggered={isStoryTriggered} />
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="bento-section">
        <div className="bento-header reveal">
          <h2>Everything you need. Nothing you don't.</h2>
        </div>
        <div className="bento-grid">
          <div className="bento-card bento-wide reveal" style={{ '--i': 0 }}>
             <div className="bento-bg"></div>
             <h3>Realtime Sync</h3>
             <p>Your roommate grabs milk at the store — it&rsquo;s off your list before they reach the checkout. Everyone sees the same pantry, always.</p>
             <div className="bento-visual-placeholder">
               <SyncCanvas />
             </div>
          </div>
          <div className="bento-card bento-tall theme-card reveal" style={{ '--i': 1 }}>
             <div className="bento-bg"></div>
             <h3>Curated Themes</h3>
             <p>Midnight, Arctic, Lavender, or Sunset. Personalize the look to match your kitchen's vibe.</p>
          </div>
          <div className="bento-card reveal" style={{ '--i': 2 }}>
             <div className="bento-bg"></div>
             <h3>Live Barcodes</h3>
             <p>Point your camera at any barcode — name, brand, and size fill themselves in.</p>
          </div>
          <div className="bento-card reveal" style={{ '--i': 3 }}>
             <div className="bento-bg"></div>
             <h3>Household Invites</h3>
             <p>One link gets your whole apartment on the same pantry. Groceries stop being a group-chat argument.</p>
          </div>
        </div>
      </section>

      {/* Magnetic Footer */}
      <footer className="landing-footer">
        <div className="footer-glow"></div>
        <div className="footer-content reveal">
          <h2>Stop paying for food you forget.</h2>
          <div className="magnetic-button-wrap" ref={magneticRef}>
            <button onClick={() => startTransition('/login?mode=signup')} className="magnetic-button" style={{ border: 'none', cursor: 'pointer' }}>
              Get Started Free
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile: primary CTA follows once the hero's scrolls away (research:
          sticky bottom CTA bars measure +15-25% on conversion). */}
      <div className={`sticky-cta-bar ${showStickyCta ? 'visible' : ''}`} aria-hidden={!showStickyCta}>
        <button
          onClick={() => startTransition('/login?mode=signup')}
          className="hero-cta-primary"
          tabIndex={showStickyCta ? 0 : -1}
        >
          Build my pantry — free
        </button>
      </div>
    </div>
  );
}
