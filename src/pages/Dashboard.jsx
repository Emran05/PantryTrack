import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPantryItems } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { CATEGORIES, getExpirationStatus, getDaysUntilExpiration, getCategoryInfo } from '../lib/helpers';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import './Dashboard.css';

// --- Animated SVG Icons ---
function FlameIcon({ animated }) {
  return (
    <svg className={`highlight-svg-icon ${animated ? 'icon-bounce' : ''}`} width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path className="flame-body" d="M12 2C12 2 4 9.5 4 14.5C4 18.64 7.58 22 12 22C16.42 22 20 18.64 20 14.5C20 9.5 12 2 12 2Z" fill="url(#flameGrad)" />
      <path className="flame-core" d="M12 22C14.21 22 16 19.76 16 17C16 14.5 12 10 12 10C12 10 8 14.5 8 17C8 19.76 9.79 22 12 22Z" fill="url(#flameCoreGrad)" />
      <defs>
        <linearGradient id="flameGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9500" /><stop offset="1" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id="flameCoreGrad" x1="12" y1="10" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" /><stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PiggyIcon({ animated }) {
  return (
    <svg className={`highlight-svg-icon ${animated ? 'icon-bounce' : ''}`} width="28" height="28" viewBox="0 0 24 24" fill="none">
      <ellipse className="piggy-body" cx="12" cy="13" rx="8" ry="6.5" fill="url(#piggyGrad)" />
      <circle cx="9" cy="11.5" r="1" fill="#1a5c2e" />
      <ellipse cx="12" cy="14.5" rx="2.5" ry="1.5" fill="#16a34a" opacity="0.5" />
      <circle cx="11.2" cy="14.2" r="0.5" fill="#15803d" />
      <circle cx="12.8" cy="14.2" r="0.5" fill="#15803d" />
      <path d="M6 17L5 20" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 17L19 20" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" />
      <path className="piggy-coin" d="M17 7L19 5M19 5L21 7M19 5V9" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="piggyGrad" x1="4" y1="7" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ade80" /><stop offset="1" stopColor="#22c55e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function BoxIcon({ animated }) {
  return (
    <svg className={`highlight-svg-icon ${animated ? 'icon-bounce' : ''}`} width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path className="box-body" d="M3 8L12 3L21 8V16L12 21L3 16V8Z" fill="url(#boxGrad)" stroke="url(#boxStrokeGrad)" strokeWidth="1" />
      <path d="M3 8L12 13L21 8" stroke="#6366f1" strokeWidth="1" opacity="0.4" />
      <path d="M12 13V21" stroke="#6366f1" strokeWidth="1" opacity="0.4" />
      <path className="box-lid" d="M7.5 5.5L16.5 10.5" stroke="#c4b5fd" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <circle className="box-sparkle" cx="17" cy="5" r="1.5" fill="#a78bfa" opacity="0.7" />
      <defs>
        <linearGradient id="boxGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" /><stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="boxStrokeGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" /><stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// SVG Donut chart helpers
function DonutChart({ segments, size = 120, strokeWidth = 14 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let accumulated = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-chart">
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke="var(--color-bg-primary)" strokeWidth={strokeWidth}
      />
      {segments.map((seg, i) => {
        const dashLen = circumference * seg.pct;
        const dashGap = circumference - dashLen;
        const offset = circumference * (1 - accumulated) + circumference * 0.25;
        accumulated += seg.pct;
        return (
          <circle
            key={i} cx={center} cy={center} r={radius}
            fill="none" stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dashLen} ${dashGap}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="donut-segment"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const { activePantry } = usePantry();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePopup, setActivePopup] = useState(null);
  const [animatedCard, setAnimatedCard] = useState(null);
  const navigate = useNavigate();

  const fetchItems = () => {
    if (activePantry) {
      getPantryItems(activePantry.id).then(data => {
        setItems(data);
        setLoading(false);
      });
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [activePantry]);

  useRealtimeSync(activePantry?.id, 'pantry_items', fetchItems);

  const handleHighlightClick = (cardId) => {
    setAnimatedCard(cardId);
    setTimeout(() => setAnimatedCard(null), 600);
    setActivePopup(activePopup === cardId ? null : cardId);
  };

  const stats = useMemo(() => {
    const total = items.length;
    const expired = items.filter((i) => getExpirationStatus(i.expirationDate) === 'expired').length;
    const expiringSoon = items.filter((i) => getExpirationStatus(i.expirationDate) === 'soon').length;
    const fresh = items.filter((i) => getExpirationStatus(i.expirationDate) === 'fresh').length;

    // Category breakdown
    const byCategory = {};
    items.forEach((item) => {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    });
    const categories = Object.entries(byCategory)
      .map(([id, count]) => ({ ...getCategoryInfo(id), count }))
      .sort((a, b) => b.count - a.count);

    // Items expiring soonest
    const upcomingExpiry = items
      .filter((i) => i.expirationDate && getExpirationStatus(i.expirationDate) !== 'expired')
      .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
      .slice(0, 5);

    // Streak: days since last expired item
    const lastExpired = items
      .filter((i) => getExpirationStatus(i.expirationDate) === 'expired')
      .sort((a, b) => new Date(b.expirationDate) - new Date(a.expirationDate))[0];
    
    let streakDays = 0;
    if (lastExpired) {
      const expDate = new Date(lastExpired.expirationDate);
      const now = new Date();
      streakDays = Math.max(0, Math.floor((now - expDate) / (1000 * 60 * 60 * 24)));
    } else if (total > 0) {
      streakDays = 7; // If nothing expired, assume a week streak
    }

    // "Waste saved" — rough estimate: items used before expiry × $3 avg
    const usedBeforeExpiry = fresh + expiringSoon;
    const savedEstimate = usedBeforeExpiry * 3;

    // Weekly snapshot — items added in last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const addedThisWeek = items.filter((i) => new Date(i.createdAt) >= weekAgo).length;

    // Donut chart segments
    const donutSegments = categories.map((cat) => ({
      color: cat.color,
      pct: cat.count / total,
      label: cat.label,
      count: cat.count,
    }));

    return { total, expired, expiringSoon, fresh, categories, upcomingExpiry, streakDays, savedEstimate, addedThisWeek, donutSegments };
  }, [items]);

  return (
    <div className="page-content app-container">
      <div className="dashboard-header animate-fade-in">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">Your pantry at a glance</p>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions animate-fade-in">
        <button className="quick-action-btn" onClick={() => navigate('/item/new')}>
          <div className="quick-action-icon" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span>Add Item</span>
        </button>
        <button className="quick-action-btn" onClick={() => navigate('/scan')}>
          <div className="quick-action-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: 'var(--color-info)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <span>Scan</span>
        </button>
        <button className="quick-action-btn" onClick={() => navigate('/recipes')}>
          <div className="quick-action-icon" style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <span>Recipes</span>
        </button>
        <button className="quick-action-btn" onClick={() => navigate('/shopping')}>
          <div className="quick-action-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <span>Shop</span>
        </button>
      </div>

      {/* Highlight Cards */}
      <div className="highlight-grid animate-fade-in">
        <div
          className={`highlight-card highlight-streak ${animatedCard === 'streak' ? 'card-pop' : ''}`}
          onClick={() => handleHighlightClick('streak')}
        >
          <div className="highlight-icon">
            <FlameIcon animated={animatedCard === 'streak'} />
          </div>
          <div className="highlight-value">{stats.streakDays}</div>
          <div className="highlight-label">Day Streak</div>
          <div className="highlight-detail">No waste</div>
          {activePopup === 'streak' && (
            <div className="highlight-popup animate-scale-in">
              <div className="highlight-popup-title">Waste-Free Streak</div>
              <p className="highlight-popup-desc">
                You've gone <strong>{stats.streakDays} days</strong> without any food going to waste. Keep it up!
              </p>
              <div className="highlight-popup-stat">
                <span>{stats.expired} expired</span>
                <span>{stats.fresh} fresh</span>
              </div>
            </div>
          )}
        </div>
        <div
          className={`highlight-card highlight-saved ${animatedCard === 'saved' ? 'card-pop' : ''}`}
          onClick={() => handleHighlightClick('saved')}
        >
          <div className="highlight-icon">
            <PiggyIcon animated={animatedCard === 'saved'} />
          </div>
          <div className="highlight-value">${stats.savedEstimate}</div>
          <div className="highlight-label">Est. Saved</div>
          <div className="highlight-detail">This month</div>
          {activePopup === 'saved' && (
            <div className="highlight-popup animate-scale-in">
              <div className="highlight-popup-title">Money Saved</div>
              <p className="highlight-popup-desc">
                By using <strong>{stats.fresh + stats.expiringSoon} items</strong> before they expired, you saved an estimated <strong>${stats.savedEstimate}</strong>.
              </p>
              <div className="highlight-popup-stat">
                <span>~$3/item avg</span>
                <span>{stats.fresh + stats.expiringSoon} used</span>
              </div>
            </div>
          )}
        </div>
        <div
          className={`highlight-card highlight-added ${animatedCard === 'added' ? 'card-pop' : ''}`}
          onClick={() => handleHighlightClick('added')}
        >
          <div className="highlight-icon">
            <BoxIcon animated={animatedCard === 'added'} />
          </div>
          <div className="highlight-value">{stats.addedThisWeek}</div>
          <div className="highlight-label">Added</div>
          <div className="highlight-detail">This week</div>
          {activePopup === 'added' && (
            <div className="highlight-popup animate-scale-in">
              <div className="highlight-popup-title">Weekly Activity</div>
              <p className="highlight-popup-desc">
                You added <strong>{stats.addedThisWeek} items</strong> this week. Your pantry has <strong>{stats.total} items</strong> total.
              </p>
              <div className="highlight-popup-stat">
                <span>{stats.total} total</span>
                <span>{stats.categories.length} categories</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popup backdrop */}
      {activePopup && <div className="highlight-popup-backdrop" onClick={() => setActivePopup(null)} />}

      {/* Stats Cards */}
      <div className="stats-grid animate-fade-in">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.expiringSoon}</div>
          <div className="stat-label">Expiring</div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-value">{stats.expired}</div>
          <div className="stat-label">Expired</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-value">{stats.fresh}</div>
          <div className="stat-label">Fresh</div>
        </div>
      </div>

      {/* Category Donut + Legend */}
      {stats.categories.length > 0 && (
        <div className="dashboard-section animate-fade-in">
          <h3 className="section-title">Categories</h3>
          <div className="donut-section card">
            <div className="donut-chart-wrapper">
              <DonutChart segments={stats.donutSegments} />
              <div className="donut-center-label">
                <span className="donut-center-value">{stats.total}</span>
                <span className="donut-center-text">items</span>
              </div>
            </div>
            <div className="donut-legend">
              {stats.categories.map((cat) => (
                <div key={cat.id} className="donut-legend-item">
                  <span className="donut-legend-dot" style={{ background: cat.color }} />
                  <span className="donut-legend-label">{cat.label}</span>
                  <span className="donut-legend-count">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming expirations */}
      {stats.upcomingExpiry.length > 0 && (
        <div className="dashboard-section animate-fade-in">
          <h3 className="section-title">Expiring Next</h3>
          <div className="expiry-list">
            {stats.upcomingExpiry.map((item) => {
              const days = getDaysUntilExpiration(item.expirationDate);
              const status = getExpirationStatus(item.expirationDate);
              return (
                <div key={item.id} className={`expiry-item card expiry-${status}`}>
                  <div className="expiry-item-info">
                    <span className="expiry-item-name">{item.name}</span>
                    <span className="expiry-item-cat-dot" style={{ background: getCategoryInfo(item.category).color }} />
                  </div>
                  <span className="expiry-item-days">
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="empty-state animate-fade-in">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h3>No data yet</h3>
          <p>Add items to your pantry to see stats here</p>
        </div>
      )}
    </div>
  );
}
