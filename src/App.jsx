import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ToastContext';
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

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Header />
        <Routes>
          <Route path="/" element={<Pantry />} />
          <Route path="/item/:id" element={<AddEditItem />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scan" element={<ScanReceipt />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <BottomNav />
      </ToastProvider>
    </BrowserRouter>
  );
}
