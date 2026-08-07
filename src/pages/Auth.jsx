import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Auth.css';

export default function Auth() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'signup') {
      setIsLogin(false);
    }
  }, [location.search]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            // Consent receipt — which legal terms this account accepted, when.
            legal_version: '2026-08-06-draft',
            legal_accepted_at: new Date().toISOString()
          }
        }
      });
      if (error) {
        setError(error.message);
      } else if (data?.user && !data.session) {
        // Project requires email confirmation — no session was issued.
        // Without this, the user clicks "Sign up", sees nothing happen,
        // and assumes the form is broken.
        setInfo(`We sent a confirmation link to ${email}. Click it to finish signing up, then log in.`);
      }
    }

    setLoading(false);
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      // Same message whether or not the account exists — don't leak signups.
      setInfo(`If an account exists for ${email}, a reset link is on its way. Check your inbox.`);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card">
        <h1 className="auth-title">Pantry Tracker</h1>
        <p className="auth-subtitle">
          {isReset ? 'Enter your email and we\'ll send a reset link.' : isLogin ? 'Welcome back' : 'Create an account to start tracking.'}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}

        {isReset ? (
          <>
            <form onSubmit={handleResetRequest} className="auth-form">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                />
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? '...' : 'Send reset link'}
              </button>
            </form>
            <button
              type="button"
              className="auth-toggle-btn"
              onClick={() => {
                setIsReset(false);
                setError(null);
                setInfo(null);
              }}
            >
              Back to log in
            </button>
          </>
        ) : (
        <>
        <button
          className="btn btn-secondary auth-google-btn" 
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          {!isLogin && (
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          {!isLogin && (
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.85rem', lineHeight: 1.45, marginBottom: 'var(--space-md)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: '3px', flexShrink: 0 }}
              />
              <span>
                I agree to the <a href="/legal/eula.html" target="_blank" rel="noreferrer">EULA</a> and{' '}
                <a href="/legal/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>, including
                the sale/sharing of my data as described there.{' '}
                <a href="/legal/do-not-sell.html" target="_blank" rel="noreferrer">You can opt out any time.</a>
              </span>
            </label>
          )}
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading || (!isLogin && !agreedToTerms)}>
            {loading ? '...' : (isLogin ? 'Log in' : 'Sign up')}
          </button>
        </form>

        {isLogin && (
          <button
            type="button"
            className="auth-toggle-btn"
            onClick={() => {
              setIsReset(true);
              setError(null);
              setInfo(null);
            }}
          >
            Forgot password?
          </button>
        )}

        <button
          type="button"
          className="auth-toggle-btn"
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
            setInfo(null);
          }}
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
