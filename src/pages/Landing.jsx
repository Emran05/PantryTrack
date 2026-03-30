import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
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
      elements.forEach((el, index) => {
        // Different layers move at different depths
        const depth = index === 0 ? 30 : index === 1 ? -20 : 15;
        const rotateX = -y * depth;
        const rotateY = x * depth;
        // Keep their base transforms
        const baseTx = el.classList.contains('mockup-item-1') ? '-50%' : '0';
        const baseTz = el.classList.contains('mockup-item-1') ? '60px' : el.classList.contains('mockup-item-2') ? '20px' : '40px';
        const baseRotZ = el.classList.contains('mockup-item-2') ? '-10deg' : el.classList.contains('mockup-item-3') ? '10deg' : '0deg';

        el.style.transform = `translateX(${baseTx}) translateZ(${baseTz}) rotateZ(${baseRotZ}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
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
          <Link to="/login" className="nav-link">Log In</Link>
          <Link to="/login" className="nav-btn">Start Free</Link>
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
          <div className="mockup-item mockup-item-2">
            <div style={{ padding: '20px', background: '#fdfdfd', color: '#111', height: '100%', borderRadius: '8px', opacity: 0.9 }}>
              <strong style={{ fontSize: '18px' }}>Store Receipt</strong>
              <div style={{ height: '4px', background: '#ccc', width: '80%', marginTop: '16px', borderRadius: '4px' }}></div>
              <div style={{ height: '4px', background: '#ccc', width: '60%', marginTop: '8px', borderRadius: '4px' }}></div>
              <div style={{ height: '4px', background: '#ccc', width: '90%', marginTop: '8px', borderRadius: '4px' }}></div>
              <div style={{ height: '4px', background: '#ccc', width: '40%', marginTop: '8px', borderRadius: '4px' }}></div>
            </div>
          </div>
          <div className="mockup-item mockup-item-3">
             <h4 style={{ color: '#fff' }}>Dashboard</h4>
             <div style={{ flex: 1, border: '4px solid #333', borderRadius: '50%', width: '120px', height: '120px', alignSelf: 'center', marginTop: '20px' }}></div>
             <div style={{ height: '24px', background: '#333', width: '100%', marginTop: 'auto', borderRadius: '8px' }}></div>
          </div>
          <div className="mockup-item mockup-item-1">
             <div style={{ flex: 1, background: '#111', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '2px solid #a855f7', width: '80%', height: '80%', borderRadius: '8px' }}></div>
             </div>
             <button style={{ background: '#fff', color: '#000', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Scan Barcode</button>
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
            <div className={`story-visual ${isStoryTriggered ? 'triggered' : ''}`}>
               <div className="receipt-paper">
                 <strong style={{ fontSize: '20px', marginBottom: '16px', display: 'block' }}>GROCERY CO.</strong>
                 <div className="receipt-text-line" style={{ width: '90%' }}></div>
                 <div className="receipt-text-line" style={{ width: '70%' }}></div>
                 <div className="receipt-text-line" style={{ width: '85%' }}></div>
                 <div className="receipt-text-line" style={{ width: '60%' }}></div>
                 <div className="receipt-text-line" style={{ width: '95%' }}></div>
                 <br/><br/>
                 <div className="receipt-text-line" style={{ width: '40%' }}></div>
               </div>
               
               <div className="app-card-rendered">
                 <h3 style={{ marginBottom: '16px' }}>Added to Pantry</h3>
                 <div className="app-item-row"><div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#4ade80' }}></div> Fresh Spinach (1 bag)</div>
                 <div className="app-item-row"><div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#facc15' }}></div> Cheddar Cheese (1 lb)</div>
                 <div className="app-item-row"><div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f87171' }}></div> Ground Beef (2 lbs)</div>
                 <button style={{ width: '100%', padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Confirm Items</button>
               </div>
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
             <div className="bento-visual-placeholder"></div>
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
            <Link to="/login" className="magnetic-button">
              Get Started Free
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
