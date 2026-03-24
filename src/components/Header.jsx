import { useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const isItemPage = location.pathname.startsWith('/item');

  return (
    <header className="header">
      <div className="header-inner app-container">
        {isItemPage ? (
          <button className="header-back" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        ) : (
          <div className="header-brand">
            <span className="header-logo-mark">P</span>
            <h1 className="header-title">Pantry</h1>
          </div>
        )}
        {!isItemPage && (
          <button
            className="header-action btn btn-primary"
            onClick={() => navigate('/item/new')}
            aria-label="Add item"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        )}
      </div>
    </header>
  );
}
