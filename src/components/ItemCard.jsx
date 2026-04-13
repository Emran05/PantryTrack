import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addShoppingItem, updatePantryItem } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { useToast } from '../components/ToastContext';
import CategoryBadge from './CategoryBadge';
import ExpirationBadge from './ExpirationBadge';
import './ItemCard.css';

function haptic(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

export default function ItemCard({ item, onDelete, onRefresh }) {
  const navigate = useNavigate();
  const { activePantry } = usePantry();
  const { showToast } = useToast();
  const cardRef = useRef(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [swiped, setSwiped] = useState(false);
  const [offset, setOffset] = useState(0);

  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
  };

  const handleTouchMove = (e) => {
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    // Only allow left swipe
    if (diff > 0) {
      const clamped = Math.min(diff, 120);
      setOffset(clamped);
    } else {
      setOffset(0);
    }
  };

  const handleTouchEnd = () => {
    const diff = startX.current - currentX.current;
    if (diff >= SWIPE_THRESHOLD) {
      setSwiped(true);
      setOffset(120);
      haptic(15);
    } else {
      setSwiped(false);
      setOffset(0);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    haptic(10);
    onDelete(item.id);
  };

  const handleCardClick = () => {
    if (swiped) {
      setSwiped(false);
      setOffset(0);
      return;
    }
    navigate(`/item/${item.id}`);
  };

  const handleAddToList = async (e) => {
    e.stopPropagation();
    if (!activePantry) return;
    try {
      await addShoppingItem(activePantry.id, {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category || 'other',
      });
      showToast(`"${item.name}" added to shopping list`);
    } catch (err) {
      console.error(err);
      showToast('Error adding to list');
    }
  };

  const handleQtyChange = async (e, delta) => {
    e.stopPropagation();
    const newQty = Math.max(1, item.quantity + delta);
    if (newQty === item.quantity) return; // Already at minimum
    try {
      await updatePantryItem(item.id, { quantity: newQty });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      showToast('Failed to update quantity');
    }
  };

  return (
    <div className="item-card-wrapper">
      {/* Delete action behind the card */}
      <div className={`item-card-swipe-action ${swiped ? 'revealed' : ''}`}>
        <button className="item-card-swipe-list" onClick={handleAddToList} aria-label="Add to shopping list">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          List
        </button>
        <button className="item-card-swipe-delete" onClick={handleDelete} aria-label="Delete">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Delete
        </button>
      </div>

      {/* Card surface */}
      <div
        ref={cardRef}
        className="item-card card animate-fade-in"
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(-${offset}px)`, transition: offset === 0 || swiped ? 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }}
      >
        <div className="item-card-top">
          <div className="item-card-info">
            <h3 className="item-card-name">{item.name}</h3>
            <div className="item-card-meta">
              <CategoryBadge categoryId={item.category} />
              <ExpirationBadge date={item.expirationDate} />
            </div>
          </div>
          <div className="item-card-qty">
            <button className="item-qty-btn" onClick={(e) => handleQtyChange(e, -1)} aria-label="Decrease">−</button>
            <span className="item-card-qty-value">{item.quantity}</span>
            <button className="item-qty-btn" onClick={(e) => handleQtyChange(e, 1)} aria-label="Increase">+</button>
            <span className="item-card-qty-unit">{item.unit}</span>
          </div>
        </div>
        {item.notes && <p className="item-card-notes">{item.notes}</p>}
        <button
          className="item-card-delete"
          onClick={handleDelete}
          aria-label={`Delete ${item.name}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
