import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addShoppingItem, updatePantryItem } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { useToast } from '../components/ToastContext';
import { isPinned, togglePin } from '../lib/preferences';
import CategoryBadge from './CategoryBadge';
import ExpirationBadge from './ExpirationBadge';
import ConsumeModal from './ConsumeModal';
import './ItemCard.css';

function haptic(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

export default function ItemCard({ item, onDelete, onRefresh, onPinChange }) {
  const navigate = useNavigate();
  const { activePantry } = usePantry();
  const { showToast } = useToast();
  const cardRef = useRef(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  // Last tapped quantity, so bursts of +/- taps compound instead of all
  // reading the same pre-refetch value. Resynced when the prop catches up.
  const pendingQty = useRef(null);
  if (pendingQty.current === item.quantity) pendingQty.current = null;
  // Optimistic display: the write + refetch takes ~500ms, during which the
  // old number sitting still reads as "my tap didn't register" (QA finding).
  const [optimisticQty, setOptimisticQty] = useState(null);
  // Server caught up (or another device changed it) — drop the local guess.
  if (optimisticQty !== null && optimisticQty === item.quantity) setOptimisticQty(null);
  const shownQty = optimisticQty ?? item.quantity;
  const [swiped, setSwiped] = useState(false);
  const [offset, setOffset] = useState(0);
  const [showConsume, setShowConsume] = useState(false);
  const [pinned, setPinned] = useState(() => isPinned(activePantry?.id, item.id));

  const SWIPE_THRESHOLD = 100;
  const SWIPE_REVEAL = 168;

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
  };

  const handleTouchMove = (e) => {
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    // Only allow left swipe
    if (diff > 0) {
      const clamped = Math.min(diff, SWIPE_REVEAL + 20);
      setOffset(clamped);
    } else {
      setOffset(0);
    }
  };

  const handleTouchEnd = () => {
    const diff = startX.current - currentX.current;
    if (diff >= SWIPE_THRESHOLD) {
      setSwiped(true);
      setOffset(SWIPE_REVEAL);
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

  const addToList = async () => {
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
      if (err.code === 'DUPLICATE_ITEM') {
        showToast(`"${item.name}" is already on your list`);
      } else {
        console.error(err);
        showToast('Error adding to list', 'error');
      }
    }
  };

  const handleAddToList = (e) => {
    e.stopPropagation();
    addToList();
  };

  const handleQtyChange = async (e, delta) => {
    e.stopPropagation();
    // Build on the last TAP, not the last fetch — item.quantity only updates
    // after a full refetch, so rapid taps would otherwise all read the same
    // stale base and collapse into a single change.
    const base = pendingQty.current ?? item.quantity;
    const newQty = Math.max(1, base + delta);
    if (newQty === base) return; // Already at minimum
    pendingQty.current = newQty;
    setOptimisticQty(newQty); // paint immediately; reconciled below
    try {
      await updatePantryItem(item.id, { quantity: newQty });
      if (onRefresh) onRefresh();
      // Running low after a decrement — offer a one-tap restock.
      if (delta < 0 && newQty <= 1) {
        showToast(`Only ${newQty} ${item.unit} left`, 'info', {
          action: { label: 'Add to list', onClick: addToList },
        });
      }
    } catch (err) {
      console.error(err);
      // Roll back the optimistic base — but only if no newer tap has moved
      // it — so a failed write can't poison every subsequent tap (and then
      // silently clobber a housemate's concurrent edit with a stale base).
      if (pendingQty.current === newQty) pendingQty.current = null;
      setOptimisticQty(null); // failed write: fall back to the server's value
      if (onRefresh) onRefresh();
      showToast('Failed to update quantity', 'error');
    }
  };

  const handleUseClick = (e) => {
    e.stopPropagation();
    haptic(10);
    // Reset swipe state so the modal feels "fresh".
    setSwiped(false);
    setOffset(0);
    setShowConsume(true);
  };

  // Mouse/keyboard path to the same action row swiping reveals — without this,
  // desktop users have no way to reach Use/List (swipe is touch-only).
  const handleToggleActions = (e) => {
    e.stopPropagation();
    if (swiped) {
      setSwiped(false);
      setOffset(0);
    } else {
      setSwiped(true);
      setOffset(SWIPE_REVEAL);
    }
  };

  const handlePinClick = (e) => {
    e.stopPropagation();
    if (!activePantry) return;
    haptic(8);
    const nowPinned = togglePin(activePantry.id, item.id);
    setPinned(nowPinned);
    if (onPinChange) onPinChange(item.id, nowPinned);
    showToast(nowPinned ? `"${item.name}" pinned` : `"${item.name}" unpinned`);
  };

  return (
    <div className={`item-card-wrapper ${pinned ? 'pinned' : ''}`}>
      {/* Swipe action row behind the card: Use → List → Delete */}
      {/* Closed drawer must leave the tab order entirely: it renders at
          opacity 0 but stayed focusable, so Tab could reach an invisible
          Delete and destroy an item (QA HIGH). */}
      <div
        className={`item-card-swipe-action ${swiped ? 'revealed' : ''}`}
        aria-hidden={!swiped ? 'true' : undefined}
        inert={!swiped ? '' : undefined}
      >
        <button className="item-card-swipe-use" onClick={handleUseClick} aria-label="Use some">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h2l3 9 4-18 3 9h6" />
          </svg>
          Use
        </button>
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
        role="button"
        tabIndex={0}
        aria-label={`Edit ${item.name}`}
        onKeyDown={(e) => {
          // Keyboard path to the editor — the card is the only affordance
          // that opens Edit Item (QA HIGH: WCAG 2.1.1 failure without this).
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            handleCardClick();
          }
        }}
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(-${offset}px)`, '--swipe-offset': `${offset}px`, transition: offset === 0 || swiped ? 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }}
      >
        <button
          className={`item-card-pin ${pinned ? 'pinned' : ''}`}
          onClick={handlePinClick}
          aria-label={pinned ? `Unpin ${item.name}` : `Pin ${item.name}`}
          aria-pressed={pinned}
        >
          {/* Pushpin: simple, recognizable, scales well at 14px */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
          </svg>
        </button>

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
            <span className="item-card-qty-value">{shownQty}</span>
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
        <button
          className="item-card-actions-toggle"
          onClick={handleToggleActions}
          aria-label={swiped ? `Hide actions for ${item.name}` : `Show actions for ${item.name}`}
          aria-expanded={swiped}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {showConsume && (
        <ConsumeModal
          item={item}
          pantryId={activePantry?.id}
          onClose={() => setShowConsume(false)}
          onDone={() => { if (onRefresh) onRefresh(); }}
        />
      )}
    </div>
  );
}
