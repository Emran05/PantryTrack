import { useNavigate } from 'react-router-dom';
import CategoryBadge from './CategoryBadge';
import ExpirationBadge from './ExpirationBadge';
import './ItemCard.css';

export default function ItemCard({ item, onDelete }) {
  const navigate = useNavigate();

  return (
    <div className="item-card card animate-fade-in" onClick={() => navigate(`/item/${item.id}`)}>
      <div className="item-card-top">
        <div className="item-card-info">
          <h3 className="item-card-name">{item.name}</h3>
          <div className="item-card-meta">
            <CategoryBadge categoryId={item.category} />
            <ExpirationBadge date={item.expirationDate} />
          </div>
        </div>
        <div className="item-card-qty">
          <span className="item-card-qty-value">{item.quantity}</span>
          <span className="item-card-qty-unit">{item.unit}</span>
        </div>
      </div>
      {item.notes && <p className="item-card-notes">{item.notes}</p>}
      <button
        className="item-card-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
        aria-label={`Delete ${item.name}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
