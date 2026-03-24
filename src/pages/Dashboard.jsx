import { useState, useMemo } from 'react';
import { getPantryItems } from '../lib/storage';
import { CATEGORIES, getExpirationStatus, getDaysUntilExpiration, getCategoryInfo } from '../lib/helpers';
import './Dashboard.css';

export default function Dashboard() {
  const [items] = useState(() => getPantryItems());

  const stats = useMemo(() => {
    const total = items.length;
    const expired = items.filter((i) => getExpirationStatus(i.expirationDate) === 'expired').length;
    const expiringSoon = items.filter((i) => getExpirationStatus(i.expirationDate) === 'soon').length;

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

    return { total, expired, expiringSoon, categories, upcomingExpiry };
  }, [items]);

  return (
    <div className="page-content app-container">
      <div className="dashboard-header animate-fade-in">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">Overview of your pantry</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid animate-fade-in">
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="stat-value">{stats.expiringSoon}</div>
          <div className="stat-label">Expiring Soon</div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="stat-value">{stats.expired}</div>
          <div className="stat-label">Expired</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {stats.categories.length > 0 && (
        <div className="dashboard-section animate-fade-in">
          <h3 className="section-title">By Category</h3>
          <div className="category-breakdown">
            {stats.categories.map((cat) => {
              const pct = Math.round((cat.count / stats.total) * 100);
              return (
                <div key={cat.id} className="category-bar-item">
                  <div className="category-bar-header">
                    <span className="category-bar-label">
                      <span className="category-bar-dot" style={{ background: cat.color }} />
                      {cat.label}
                    </span>
                    <span className="category-bar-count">
                      {cat.count} ({pct}%)
                    </span>
                  </div>
                  <div className="category-bar-track">
                    <div
                      className="category-bar-fill"
                      style={{ width: `${pct}%`, background: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
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
                <div key={item.id} className={`expiry-item expiry-${status}`}>
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
