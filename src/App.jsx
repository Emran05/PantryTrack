import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PantryProvider, usePantry } from './contexts/PantryContext';
import { ToastProvider } from './components/ToastContext';
import { getSavedTheme, applyTheme } from './lib/themes';
import { TransitionProvider } from './contexts/TransitionContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Tour, { isTourCompleted } from './components/Tour';
import WhatsNew, { shouldShowWhatsNew, markWhatsNewSeen } from './components/WhatsNew';
import Landing from './pages/Landing';
// Redesign proposal, reachable at /preview-landing only. Not linked from
// anywhere; the live landing stays at '/' until the owner approves.
const LandingV2 = lazy(() => import('./pages/LandingV2'));
import Auth from './pages/Auth';
// Eager, not lazy: these render in the unauthenticated route set too, which
// has no Suspense boundary — and deep links (recovery emails, invites) should
// never hit a loading race.
import ResetPassword from './pages/ResetPassword';
import JoinPantry from './pages/JoinPantry';
import { PENDING_INVITE_KEY } from './lib/invites';
import ErrorBoundary from './components/ErrorBoundary';
import './components/Toast.css';

// Lazy-loaded pages for code splitting (authenticated routes only)
const Pantry = lazy(() => import('./pages/Pantry'));
const AddEditItem = lazy(() => import('./pages/AddEditItem'));
const ShoppingList = lazy(() => import('./pages/ShoppingList'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ScanReceipt = lazy(() => import('./pages/ScanReceipt'));
const Recipes = lazy(() => import('./pages/Recipes'));
const Settings = lazy(() => import('./pages/Settings'));

function PageTransitionWrapper({ children }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const { loading, error: pantryError, pantries, retryPantries } = usePantry();
  const location = useLocation();
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Resume an invite that was opened while signed out: JoinPantry stashed the
  // token, auth completed, now finish the join.
  useEffect(() => {
    if (!user || loading) return;
    let pending = null;
    try {
      pending = localStorage.getItem(PENDING_INVITE_KEY);
    } catch {
      return;
    }
    if (pending && !location.pathname.startsWith('/join/')) {
      navigate(`/join/${pending}`, { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  // Check tour status when user arrives at the authenticated shell.
  // New users get the tour (which already covers the new features); returning
  // users who finished the tour get the one-time What's New popup instead.
  useEffect(() => {
    if (user && !loading) {
      if (!isTourCompleted()) {
        setShowTour(true);
      } else if (shouldShowWhatsNew()) {
        setShowWhatsNew(true);
      }
    }
  }, [user, loading]);

  // Listen for "restart tour" / "show what's new" events dispatched from Settings
  useEffect(() => {
    const tourHandler = () => setShowTour(true);
    const whatsNewHandler = () => setShowWhatsNew(true);
    window.addEventListener('pantry-restart-tour', tourHandler);
    window.addEventListener('pantry-show-whats-new', whatsNewHandler);
    return () => {
      window.removeEventListener('pantry-restart-tour', tourHandler);
      window.removeEventListener('pantry-show-whats-new', whatsNewHandler);
    };
  }, []);

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
    // The tour walks through everything the popup would list — don't stack it.
    markWhatsNewSeen();
  }, []);

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/preview-landing" element={<Suspense fallback={null}><LandingV2 /></Suspense>} />
        <Route path="/login" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/join/:token" element={<JoinPantry />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (loading) {
    // Password reset must render immediately — a recovery link creates a
    // session, so without this the reset form hides behind the pantry fetch.
    if (location.pathname === '/reset-password') {
      return <ResetPassword />;
    }
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
        Loading home data...
      </div>
    );
  }

  // Pantry load/create failed and we have nothing to show — say so instead of
  // leaving every page on a spinner that never resolves.
  if (pantryError && pantries.length === 0) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Couldn&rsquo;t load your homes</p>
        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Check your connection and try again.</p>
        <button className="btn btn-primary" onClick={retryPantries} style={{ marginTop: '8px' }}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <Header />
      <Suspense fallback={<div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>}>
        <PageTransitionWrapper>
          <Routes>
            <Route path="/" element={<Pantry />} />
            <Route path="/item/:id" element={<AddEditItem />} />
            <Route path="/shopping" element={<ShoppingList />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scan" element={<ScanReceipt />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join/:token" element={<JoinPantry />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageTransitionWrapper>
      </Suspense>
      <BottomNav />
      {showTour && <Tour onComplete={handleTourComplete} />}
      {showWhatsNew && !showTour && <WhatsNew onClose={() => setShowWhatsNew(false)} />}
    </>
  );
}

export default function App() {
  // Apply the saved theme once for the whole app — previously this lived in
  // PageTransitionWrapper, which (a) only exists on authenticated routes, so
  // Landing/Auth flashed the default theme, and (b) remounts on every route
  // change, re-applying the theme each navigation.
  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <PantryProvider>
          <BrowserRouter>
            <TransitionProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </TransitionProvider>
          </BrowserRouter>
        </PantryProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
