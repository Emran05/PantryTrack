import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SyncCanvas from '../components/SyncCanvas';
import MagicBoxDashboard from '../components/MagicBoxDashboard';
import PixelReceipt from '../components/PixelReceipt';
import BarcodeScannerMockup from '../components/BarcodeScannerMockup';
import MagicSnapAnimation from '../components/MagicSnapAnimation';
import { useTransition } from '../contexts/TransitionContext';
import './Landing.css';

export default function Landing() {
  const startTransition = useTransition();
  const containerRef = useRef(null);
  const magneticRef = useRef(null);
  const storyRef = useRef(null);
  const [isStoryTriggered, setIsStoryTriggered] = useState(false);

  // Parallax Hero Effect
  useEffect(() => {
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

  // Magnetic Button Effect
  useEffect(() => {
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
        <div className="hero-glow"></div>
        <div className="hero-content">
          <h1 className="hero-title">Your Pantry,<br/>Memorized in a Snap.</h1>
          <p className="hero-subtitle">
            The intelligent inventory tracker that turns receipts into structured data and organizes your household with zero friction.
          </p>
        </div>
        
        <div className="hero-mockup-container">
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
              <h2>The Magic Snap Component</h2>
              <p>Forget manual entry. Just hold up your receipt and let our bespoke Vision AI do the parsing, categorization, and quantity matching instantly.</p>
            </div>
            <div className={`story-visual ${isStoryTriggered ? 'triggered' : ''}`} style={{ background: 'transparent', border: 'none' }}>
               <MagicSnapAnimation isTriggered={isStoryTriggered} />
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="bento-section">
        <div className="bento-header">
          <h2>Everything you need. Nothing you don't.</h2>
        </div>
        <div className="bento-grid">
          <div className="bento-card bento-wide">
             <div className="bento-bg"></div>
             <h3>Realtime Sync</h3>
             <p>A change on your phone updates your partner's phone instantaneously. Zero refresh required.</p>
             <div className="bento-visual-placeholder">
               <SyncCanvas />
             </div>
          </div>
          <div className="bento-card bento-tall theme-card">
             <div className="bento-bg"></div>
             <h3>Curated Themes</h3>
             <p>Midnight, Arctic, Lavender, or Sunset. Personalize the look to match your kitchen's vibe.</p>
          </div>
          <div className="bento-card">
             <div className="bento-bg"></div>
             <h3>Live Barcodes</h3>
             <p>Scan a packed item and let the Open Food Facts API fill in the details.</p>
          </div>
          <div className="bento-card">
             <div className="bento-bg"></div>
             <h3>Household Invites</h3>
             <p>Invite roommates with a link to seamlessly share inventory.</p>
          </div>
        </div>
      </section>

      {/* Magnetic Footer */}
      <footer className="landing-footer">
        <div className="footer-glow"></div>
        <div className="footer-content">
          <h2>Ready to track?</h2>
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
    </div>
  );
}
