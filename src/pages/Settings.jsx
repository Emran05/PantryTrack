import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePantry } from '../contexts/PantryContext';
import { createPantry, inviteMemberByEmail, getAreas, createArea, deleteArea } from '../lib/supabaseStorage';
import { useToast } from '../components/ToastContext';
import ThemePicker from '../components/ThemePicker';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const { pantries, activePantry, refreshPantries } = usePantry();
  
  const [newHomeName, setNewHomeName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [areas, setAreas] = useState([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadAreas() {
      if (!activePantry) return;
      try {
        const data = await getAreas(activePantry.id);
        setAreas(data || []);
      } catch (err) {
        console.error('Failed to load areas:', err);
      }
    }
    loadAreas();
  }, [activePantry]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleCreateHome = async (e) => {
    e.preventDefault();
    if (!newHomeName.trim()) return;
    setLoading(true);
    try {
      await createPantry(newHomeName.trim());
      await refreshPantries();
      setNewHomeName('');
      showToast('New home created!');
    } catch (err) {
      console.error(err);
      showToast('Failed to create home');
    }
    setLoading(false);
  };

  const handleCreateArea = async (e) => {
    e.preventDefault();
    if (!newAreaName.trim() || !activePantry) return;
    setLoading(true);
    try {
      const area = await createArea(activePantry.id, newAreaName.trim());
      setAreas(prev => [...prev, area]);
      setNewAreaName('');
      showToast('Area added!');
    } catch (err) {
      console.error(err);
      showToast('Failed to create area');
    }
    setLoading(false);
  };

  const handleDeleteArea = async (areaId) => {
    setLoading(true);
    try {
      await deleteArea(areaId);
      setAreas(prev => prev.filter(a => a.id !== areaId));
      showToast('Area deleted');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete area');
    }
    setLoading(false);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activePantry) return;
    setLoading(true);
    try {
      await inviteMemberByEmail(activePantry.id, inviteEmail.trim());
      setInviteEmail('');
      showToast('Invitation sent!');
    } catch (err) {
      console.error(err);
      showToast('Failed to invite user. They might already be invited.');
    }
    setLoading(false);
  };

  return (
    <div className="page-content app-container">
      <div className="settings-page animate-fade-in">
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">App preferences & account</p>

        <div className="settings-section">
          <h3 className="settings-section-title">Account</h3>
          <div className="settings-card card">
            <div className="settings-row">
              <span className="settings-label">Email</span>
              <span className="settings-value">{user?.email || 'Guest'}</span>
            </div>
            <button className="btn btn-secondary btn-full" onClick={handleSignOut} style={{ marginTop: 'var(--space-md)' }}>
              Log out
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">My Homes</h3>
          <div className="settings-card card">
            <div className="homes-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {pantries.map(p => (
                <div key={p.id} className="settings-row" style={{ background: p.id === activePantry?.id ? 'var(--color-bg-card-hover)' : 'transparent', padding: '8px', borderRadius: '8px' }}>
                  <span className="settings-label">{p.name} {p.id === activePantry?.id && '(Active)'}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateHome} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="New home name..." 
                value={newHomeName}
                onChange={e => setNewHomeName(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>Create</button>
            </form>
          </div>
        </div>

        {activePantry && (
          <div className="settings-section">
            <h3 className="settings-section-title">Invite to {activePantry.name}</h3>
            <div className="settings-card card">
              <p className="settings-desc">Invite roommates or family to track inventory together.</p>
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="email" 
                  placeholder="roommate@example.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={loading}>Invite</button>
              </form>
            </div>
          </div>
        )}

        {activePantry && (
          <div className="settings-section">
            <h3 className="settings-section-title">Areas in {activePantry.name}</h3>
            <div className="settings-card card">
              <p className="settings-desc">Organize items by physical locations (e.g., Fridge, Shelf).</p>
              
              <div className="homes-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {areas.length === 0 ? (
                  <span className="settings-desc" style={{ fontStyle: 'italic' }}>No areas defined yet.</span>
                ) : (
                  areas.map(a => (
                    <div key={a.id} className="settings-row" style={{ padding: '8px', borderRadius: '8px', background: 'var(--color-bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="settings-label">{a.name}</span>
                      <button 
                        onClick={() => handleDeleteArea(a.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                        disabled={loading}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCreateArea} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="New area name..." 
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={loading}>Add</button>
              </form>
            </div>
          </div>
        )}

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
              <span className="settings-value">3.0.0 (Cloud)</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Storage</span>
              <span className="settings-value">Supabase (Cloud)</span>
            </div>
          </div>
        </div>

        <p className="settings-footer">
          Built for students · Reduce food waste 🌱
        </p>
      </div>
    </div>
  );
}
