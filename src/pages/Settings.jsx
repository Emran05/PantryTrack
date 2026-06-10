import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePantry } from '../contexts/PantryContext';
import { createPantry, joinPantryById, getAreas, createArea, deleteArea, getProfile, updateProfile } from '../lib/supabaseStorage';
import { useToast } from '../components/ToastContext';
import { resetTourFlag } from '../components/Tour';
import ThemePicker from '../components/ThemePicker';
import { setUserApiKey, getKeySource, hasUserKey, hasProjectKey } from '../lib/gemini';
import { getRateLimitStatus } from '../lib/rateLimit';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const { pantries, activePantry, refreshPantries, switchPantry, setActivePantryDirect } = usePantry();
  
  const [profile, setProfile] = useState({ first_name: '', last_name: '', venmo_handle: '' });
  const [newHomeName, setNewHomeName] = useState('');
  const [joinHomeId, setJoinHomeId] = useState('');
  const [areas, setAreas] = useState([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [loading, setLoading] = useState(false);

  // AI settings — Gemini key + rate limit status
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [aiKeySource, setAiKeySource] = useState(getKeySource()); // null | 'project' | 'user'
  const [aiQuotaTick, setAiQuotaTick] = useState(0);

  const refreshAiStatus = useCallback(() => {
    setAiKeySource(getKeySource());
    setAiQuotaTick((t) => t + 1);
  }, []);

  // Refresh quota numbers every 30s while Settings is open. The token bucket
  // refills continuously, so the displayed remaining count drifts upward.
  useEffect(() => {
    const id = setInterval(() => setAiQuotaTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    const trimmed = aiKeyInput.trim();
    if (!trimmed) {
      showToast('Paste a Gemini API key first');
      return;
    }
    setUserApiKey(trimmed);
    setAiKeyInput('');
    refreshAiStatus();
    showToast('Gemini key saved on this device');
  };

  const handleClearApiKey = () => {
    setUserApiKey(null);
    setAiKeyInput('');
    refreshAiStatus();
    showToast('Gemini key removed');
  };

  // Quotas are recomputed each render. aiQuotaTick is the dep that forces the
  // numbers to re-read every 30s and after key changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recipeUserQuota = useMemo(() => getRateLimitStatus('recipes_user'), [aiQuotaTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recipeProjectQuota = useMemo(() => getRateLimitStatus('recipes_project'), [aiQuotaTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const receiptUserQuota = useMemo(() => getRateLimitStatus('receipts_user'), [aiQuotaTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const receiptProjectQuota = useMemo(() => getRateLimitStatus('receipts_project'), [aiQuotaTick]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const userKeySet = useMemo(() => hasUserKey(), [aiKeySource]);
  const projectKeySet = useMemo(() => hasProjectKey(), []);

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
      showToast('Failed to update profile', 'error');
    }
    setLoading(false);
  };

  const handleCreateHome = async (e) => {
    e.preventDefault();
    if (!newHomeName.trim()) return;
    setLoading(true);
    try {
      const pantry = await createPantry(newHomeName.trim());
      const freshList = await refreshPantries();
      // Use the fresh list to find the pantry, avoiding stale-state race
      const found = freshList.find(p => p.id === pantry.id);
      setActivePantryDirect(found || pantry);
      setNewHomeName('');
      showToast('New home created!');
    } catch (err) {
      console.error(err);
      showToast('Failed to create home', 'error');
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
      showToast('Failed to create area', 'error');
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
      showToast('Failed to delete area', 'error');
    }
    setLoading(false);
  };

  const handleCopyHomeId = () => {
    if (!activePantry) return;
    navigator.clipboard.writeText(activePantry.id)
      .then(() => showToast('Home ID copied to clipboard'))
      .catch(() => showToast('Could not copy — try manually selecting the ID', 'error'));
  };

  const handleJoinHome = async (e) => {
    e.preventDefault();
    const id = joinHomeId.trim();
    if (!id) return;
    setLoading(true);
    try {
      await joinPantryById(id);
      await refreshPantries();
      setJoinHomeId('');
      showToast('Joined home successfully!');
    } catch (err) {
      console.error(err);
      if (err.code === 'ALREADY_MEMBER') {
        showToast('You are already a member of this home');
      } else {
        showToast('Could not join — check the Home ID and try again', 'error');
      }
    }
    setLoading(false);
  };

  const handleRestartTour = () => {
    resetTourFlag();
    window.dispatchEvent(new CustomEvent('pantry-restart-tour'));
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
            <h3 className="settings-section-title">Share {activePantry.name}</h3>
            <div className="settings-card card">
              <p className="settings-desc">Share your Home ID with roommates or family. They paste it in the "Join a Home" section below.</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)', fontSize: '0.78rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  {activePantry.id}
                </code>
                <button className="btn btn-primary" onClick={handleCopyHomeId} style={{ flexShrink: 0 }}>
                  Copy ID
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="settings-section">
          <h3 className="settings-section-title">Join a Home</h3>
          <div className="settings-card card">
            <p className="settings-desc">Have a Home ID from a roommate? Paste it here to join their pantry.</p>
            <form onSubmit={handleJoinHome} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Paste Home ID..."
                value={joinHomeId}
                onChange={e => setJoinHomeId(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>Join</button>
            </form>
          </div>
        </div>

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
          <h3 className="settings-section-title">AI</h3>
          <div className="settings-card card">
            <p className="settings-desc">
              AI recipe suggestions and receipt scanning use Google Gemini. We try your personal key first; if it's missing or rejected, we fall back to a shared free-tier key.
            </p>

            {/* Tier status pills */}
            <div className="ai-tiers">
              <div className={`ai-tier-row ${userKeySet ? 'ok' : 'muted'}`}>
                <div className="ai-tier-info">
                  <span className="ai-tier-name">Your key</span>
                  <span className="ai-tier-sub">
                    {userKeySet ? 'Stored on this device' : 'Not set — using free tier'}
                  </span>
                </div>
                <span className={`ai-status-pill ${userKeySet ? 'ok' : 'warn'}`}>
                  {userKeySet ? 'Active' : 'Off'}
                </span>
              </div>
              <div className={`ai-tier-row ${projectKeySet ? 'ok' : 'muted'}`}>
                <div className="ai-tier-info">
                  <span className="ai-tier-name">Free tier</span>
                  <span className="ai-tier-sub">
                    {projectKeySet
                      ? userKeySet ? 'Standby — used if your key fails' : 'In use — limited quota'
                      : 'Not configured by site'}
                  </span>
                </div>
                <span className={`ai-status-pill ${projectKeySet ? 'ok' : 'warn'}`}>
                  {projectKeySet ? 'Available' : 'Off'}
                </span>
              </div>
            </div>

            {/* Quota readouts — only show the relevant tier(s) */}
            <h4 className="ai-subhead">Hourly quota</h4>
            {userKeySet && (
              <div className="ai-quota-grid">
                <div className="ai-quota-cell">
                  <span className="ai-quota-label">Recipes (your key)</span>
                  <span className="ai-quota-value">
                    {recipeUserQuota.remaining} <span className="ai-quota-max">/ {recipeUserQuota.capacity}</span>
                  </span>
                </div>
                <div className="ai-quota-cell">
                  <span className="ai-quota-label">Receipts (your key)</span>
                  <span className="ai-quota-value">
                    {receiptUserQuota.remaining} <span className="ai-quota-max">/ {receiptUserQuota.capacity}</span>
                  </span>
                </div>
              </div>
            )}
            {projectKeySet && (
              <div className="ai-quota-grid" style={{ marginTop: userKeySet ? 8 : 0 }}>
                <div className="ai-quota-cell">
                  <span className="ai-quota-label">Recipes (free tier)</span>
                  <span className="ai-quota-value">
                    {recipeProjectQuota.remaining} <span className="ai-quota-max">/ {recipeProjectQuota.capacity}</span>
                  </span>
                </div>
                <div className="ai-quota-cell">
                  <span className="ai-quota-label">Receipts (free tier)</span>
                  <span className="ai-quota-value">
                    {receiptProjectQuota.remaining} <span className="ai-quota-max">/ {receiptProjectQuota.capacity}</span>
                  </span>
                </div>
              </div>
            )}

            <div style={{ height: 1, background: 'var(--color-border)', margin: '16px 0' }} />

            {/* Key input */}
            <p className="settings-desc">
              Use your own Gemini API key (recommended for higher limits — stored only in this browser):
            </p>
            <form onSubmit={handleSaveApiKey} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                type="password"
                placeholder={userKeySet ? 'Replace existing key…' : 'Paste your Gemini API key'}
                value={aiKeyInput}
                onChange={(e) => setAiKeyInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <button type="submit" className="btn btn-primary">Save</button>
            </form>
            {userKeySet && (
              <button
                type="button"
                onClick={handleClearApiKey}
                className="btn btn-secondary"
                style={{ marginTop: 8 }}
              >
                Remove my key
              </button>
            )}

            {/* Step-by-step guide */}
            <details className="ai-guide">
              <summary>How to get a free Gemini API key →</summary>
              <ol className="ai-guide-list">
                <li>
                  Open{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                  >
                    aistudio.google.com/app/apikey
                  </a>{' '}
                  and sign in with any Google account.
                </li>
                <li>
                  Click <strong>Create API key</strong> (top-right). If asked, choose{' '}
                  <strong>Create API key in new project</strong>.
                </li>
                <li>
                  Copy the key — it starts with <code>AIzaSy…</code>
                </li>
                <li>
                  Paste it in the field above and tap <strong>Save</strong>.
                </li>
              </ol>
              <p className="ai-guide-note">
                The free tier allows ~1,500 requests per day — far more than this app uses. Your key never leaves this device.
              </p>
            </details>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">Help</h3>
          <div className="settings-card card">
            <p className="settings-desc">Need a refresher? Walk through the app’s features again.</p>
            <button className="btn btn-secondary btn-full" onClick={handleRestartTour} style={{ marginTop: '12px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              Retake App Tour
            </button>
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
