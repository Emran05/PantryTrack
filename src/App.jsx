import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Pantry from './pages/Pantry';
import AddEditItem from './pages/AddEditItem';
import ShoppingList from './pages/ShoppingList';
import Dashboard from './pages/Dashboard';
import ScanReceipt from './pages/ScanReceipt';
import Recipes from './pages/Recipes';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Pantry />} />
        <Route path="/item/:id" element={<AddEditItem />} />
        <Route path="/shopping" element={<ShoppingList />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scan" element={<ScanReceipt />} />
        <Route path="/recipes" element={<Recipes />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  );
}
