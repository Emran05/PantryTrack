import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPantryItems } from '../lib/storage';
import { CATEGORIES, getExpirationStatus, getDaysUntilExpiration, getCategoryInfo } from '../lib/helpers';
import './Dashboard.css';

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
  const [items] = useState(() => getPantryItems());
  const navigate = useNavigate();

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
        <div className="highlight-card highlight-streak">
          <div className="highlight-icon">🔥</div>
          <div className="highlight-value">{stats.streakDays}</div>
          <div className="highlight-label">Day Streak</div>
          <div className="highlight-detail">No waste</div>
        </div>
        <div className="highlight-card highlight-saved">
          <div className="highlight-icon">💰</div>
          <div className="highlight-value">${stats.savedEstimate}</div>
          <div className="highlight-label">Est. Saved</div>
          <div className="highlight-detail">This month</div>
        </div>
        <div className="highlight-card highlight-added">
          <div className="highlight-icon">📦</div>
          <div className="highlight-value">{stats.addedThisWeek}</div>
          <div className="highlight-label">Added</div>
          <div className="highlight-detail">This week</div>
        </div>
      </div>

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
