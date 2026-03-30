import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePantry } from '../contexts/PantryContext';
import { createPantry, inviteMemberByEmail, getAreas, createArea, deleteArea, getProfile, updateProfile } from '../lib/supabaseStorage';
import { useToast } from '../components/ToastContext';
import ThemePicker from '../components/ThemePicker';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const { pantries, activePantry, refreshPantries, switchPantry } = usePantry();
  
  const [profile, setProfile] = useState({ first_name: '', last_name: '', venmo_handle: '' });
  const [newHomeName, setNewHomeName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [areas, setAreas] = useState([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const data = await getProfile(user.id);
        if (data) {
          setProfile({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            venmo_handle: data.venmo_handle || ''
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    }
    fetchProfile();
  }, [user]);

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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user.id, profile);
      showToast('Profile updated!');
    } catch (err) {
      console.error(err);
      showToast('Failed to update profile');
    }
    setLoading(false);
  };

  const handleCreateHome = async (e) => {
    e.preventDefault();
    if (!newHomeName.trim()) return;
    setLoading(true);
    try {
      const pantry = await createPantry(newHomeName.trim());
      await refreshPantries();
      switchPantry(pantry.id); // switch immediately to the new home
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
          <h3 className="settings-section-title">Profile & Account</h3>
          <div className="settings-card card">
            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <span className="settings-label">Email</span>
                <span className="settings-value">{user?.email || 'Guest'}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="settings-label" style={{ fontSize: '0.9rem' }}>First Name</label>
                  <input type="text" value={profile.first_name} onChange={e => setProfile({...profile, first_name: e.target.value})} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="settings-label" style={{ fontSize: '0.9rem' }}>Last Name</label>
                  <input type="text" value={profile.last_name} onChange={e => setProfile({...profile, last_name: e.target.value})} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="settings-label" style={{ fontSize: '0.9rem' }}>Venmo Handle</label>
                <input type="text" placeholder="@venmo_handle" value={profile.venmo_handle} onChange={e => setProfile({...profile, venmo_handle: e.target.value})} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Save Profile
              </button>
            </form>
            <div style={{ height: '1px', background: 'var(--color-border)', margin: '16px 0' }} />
            <button className="btn btn-secondary btn-full" onClick={handleSignOut}>
              Log out
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">My Homes</h3>
          <div className="settings-card card">
            <div className="homes-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {pantries.map(p => (
                <div key={p.id} className="settings-row" style={{ 
                  background: p.id === activePantry?.id ? 'var(--color-primary)' : 'var(--color-bg-primary)', 
                  border: '1px solid var(--color-border)',
                  color: p.id === activePantry?.id ? '#fff' : 'var(--color-text-primary)',
                  padding: '12px', 
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span className="settings-label" style={{ color: 'inherit' }}>{p.name} {p.id === activePantry?.id && '(Active)'}</span>
                  {p.id !== activePantry?.id && (
                    <button 
                      onClick={() => switchPantry(p.id)}
                      className="btn"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'transparent', border: '1px solid currentColor', color: 'inherit' }}
                    >
                      Switch
                    </button>
                  )}
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
