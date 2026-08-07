import { useAuth } from '../contexts/AuthContext';
import './SiteFooter.css';

// Two bands on the page's own background, separated by a hairline — not a
// dark slab (DESIGN_SYSTEM.md §4). Scaled to the ~nine destinations this
// product actually has: Family.co's content volume with Linear's typography.
//
// Deliberately absent: a status pill. Every deployed one links to a real
// status subdomain and resolves live; a hardcoded green dot on an app with no
// monitoring is a lie the first time Supabase has an incident.

export default function SiteFooter({ onNavigate }) {
  const { user } = useAuth();

  // The product links point at authenticated routes. Signed out, those routes
  // do not exist — App's catch-all silently redirects to "/", so a visitor who
  // clicked "Scan a receipt" from the redesigned landing page was teleported to
  // the OLD landing page with no explanation and no way back. Signed out, send
  // the same click to signup instead: the intent behind it is exactly the one
  // worth converting.
  const product = (to) => (user ? to : '/login?mode=signup');

  const go = (to) => (e) => {
    if (to.startsWith('/legal')) return; // real hrefs, let the browser handle
    e.preventDefault();
    onNavigate?.(to);
  };

  return (
    <footer className="sfoot">
      <div className="sfoot__inner">
        <div className="sfoot__grid">
          <div className="sfoot__brand-col">
            <span className="sfoot__brand">Pantry Snap</span>
            <p className="sfoot__tagline">
              Free pantry tracking for students. No ads, no subscription.
            </p>
          </div>

          <nav className="sfoot__col" aria-label="Product">
            <h3 className="sfoot__head">Product</h3>
            <a className="sfoot__link" href={product('/scan')} onClick={go(product('/scan'))}>Scan a receipt</a>
            <a className="sfoot__link" href={product('/recipes')} onClick={go(product('/recipes'))}>Recipes</a>
            <a className="sfoot__link" href={product('/shopping')} onClick={go(product('/shopping'))}>Shopping list</a>
          </nav>

          <nav className="sfoot__col" aria-label="Support">
            <h3 className="sfoot__head">Support</h3>
            <a className="sfoot__link" href="mailto:nasseriemran@gmail.com?subject=PantrySnap%20help">Get help</a>
            <a className="sfoot__link" href="mailto:nasseriemran@gmail.com?subject=PantrySnap%20bug">Report a bug</a>
            <a className="sfoot__link" href="mailto:nasseriemran@gmail.com?subject=PantrySnap%20idea">Request a feature</a>
          </nav>

          <nav className="sfoot__col" aria-label="Legal">
            <h3 className="sfoot__head">Legal</h3>
            <a className="sfoot__link" href="/why-free" onClick={go('/why-free')}>Why it&rsquo;s free</a>
            <a className="sfoot__link" href="/legal/privacy.html">Privacy</a>
            <a className="sfoot__link" href="/legal/eula.html">Terms</a>
            <a className="sfoot__link" href="/legal/do-not-sell.html">Do Not Sell or Share</a>
          </nav>
        </div>

        <div className="sfoot__bar">
          <span>© {new Date().getFullYear()} Pantry Snap</span>
          <span className="sfoot__bar-note">Made for people who split a kitchen.</span>
        </div>
      </div>
    </footer>
  );
}
