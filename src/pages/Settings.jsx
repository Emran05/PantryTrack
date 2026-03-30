import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastContext';
import ThemePicker from '../components/ThemePicker';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    localStorage.removeItem('pantry_items');
    localStorage.removeItem('shopping_list');
    localStorage.removeItem('pantry_seeded');
    setShowConfirm(false);
    showToast('All data cleared');
    setTimeout(() => navigate('/'), 600);
  };

  return (
    <div className="page-content app-container">
      <div className="settings-page animate-fade-in">
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">App preferences & information</p>

        <div className="settings-section">
          <h3 className="settings-section-title">Theme</h3>
          <div className="settings-card card">
            <ThemePicker />
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">About</h3>
          <div className="settings-card card">
            <div className="settings-row">
              <span className="settings-label">App</span>
              <span className="settings-value">Pantry Tracker</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Version</span>
              <span className="settings-value">2.0.0</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Storage</span>
              <span className="settings-value">Local (on-device)</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">Data</h3>
          <div className="settings-card card">
            <p className="settings-desc">
              All your pantry and shopping list data is stored locally on this device. Clearing data cannot be undone.
            </p>
            {!showConfirm ? (
              <button
                className="btn btn-danger btn-full"
                onClick={() => setShowConfirm(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear All Data
              </button>
            ) : (
              <div className="settings-confirm">
                <p className="settings-confirm-text">Are you sure? This will delete all items.</p>
                <div className="settings-confirm-actions">
                  <button className="btn btn-danger" onClick={handleReset}>
                    Yes, Delete Everything
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">Quick Actions</h3>
          <div className="settings-card card">
            <button
              className="btn btn-secondary btn-full settings-action-btn"
              onClick={() => {
                localStorage.removeItem('pantry_seeded');
                localStorage.removeItem('pantry_items');
                showToast('Demo data restored!');
                setTimeout(() => navigate('/'), 600);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Restore Demo Data
            </button>
          </div>
        </div>

        <p className="settings-footer">
          Built for students · Reduce food waste 🌱
        </p>
      </div>
    </div>
  );
}
