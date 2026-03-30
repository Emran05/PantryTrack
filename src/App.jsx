import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PantryProvider, usePantry } from './contexts/PantryContext';
import { ToastProvider } from './components/ToastContext';
import { getSavedTheme, applyTheme } from './lib/themes';
import { TransitionProvider } from './contexts/TransitionContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Landing from './pages/Landing';
import Pantry from './pages/Pantry';
import AddEditItem from './pages/AddEditItem';
import ShoppingList from './pages/ShoppingList';
import Dashboard from './pages/Dashboard';
import ScanReceipt from './pages/ScanReceipt';
import Recipes from './pages/Recipes';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import './components/Toast.css';

function PageTransitionWrapper({ children }) {
  const location = useLocation();

  useEffect(() => {
    // Apply saved theme on initial mount
    applyTheme(getSavedTheme());
  }, []);

  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const { loading } = usePantry();

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
        Loading home data...
      </div>
    );
  }

  return (
    <>
      <Header />
      <PageTransitionWrapper>
        <Routes>
          <Route path="/" element={<Pantry />} />
          <Route path="/item/:id" element={<AddEditItem />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scan" element={<ScanReceipt />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransitionWrapper>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
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
  );
}
