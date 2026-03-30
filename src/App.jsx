import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ToastContext';
import { getSavedTheme, applyTheme } from './lib/themes';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Pantry from './pages/Pantry';
import AddEditItem from './pages/AddEditItem';
import ShoppingList from './pages/ShoppingList';
import Dashboard from './pages/Dashboard';
import ScanReceipt from './pages/ScanReceipt';
import Recipes from './pages/Recipes';
import Settings from './pages/Settings';
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

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
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
          </Routes>
        </PageTransitionWrapper>
        <BottomNav />
      </ToastProvider>
    </BrowserRouter>
  );
}
