import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import { HOME } from '../lib/redesignRoutes';
import './AuthV2.css';

// The auth page (DESIGN_SYSTEM.md §5). Shipped to /login 2026-08-07.
//
// Applied from nine measured production auth pages:
//   • opaque card + hairline ring (zero of the nine use backdrop-filter)
//   • OAuth first in position, secondary in weight — one filled button total
//   • two fields; nobody splits first/last name on a consumer signup, so the
//     single "Name" field is split server-side to keep profile data identical
//   • the H1 names the action, not the wordmark
//
// Deviation, on purpose: the legal consent CHECKBOX stays. The pattern says
// passive prose, but our EULA discloses data sale and explicit consent is a
// legal position — that call belongs to the attorney, not to a design rule.

export default function AuthV2() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('mode') === 'signup') setIsLogin(false);
  }, [location.search]);

  const reset = () => { setError(null); setInfo(null); };

  // Switching mode has to move the URL too, or a reload silently throws the
  // user back to whatever ?mode= said — someone who switched to log in, then
  // refreshed, landed on signup again. Built from location.pathname so it keeps
  // built from location.pathname, so it survived the preview -> /login swap.
  const switchMode = (login) => {
    setIsLogin(login);
    reset();
    navigate(login ? location.pathname : `${location.pathname}?mode=signup`, { replace: true });
  };

  const handleForgot = async () => {
    reset();
    if (!email.trim()) {
      setError('Enter your email above and we\'ll send a reset link.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(err.message);
    else setInfo('Check your email for a reset link.');
    setLoading(false);
  };

  const handleGoogle = async () => {
    reset();
    // Same gate as the email path. The consent checkbox is the only record
    // that this user accepted an EULA disclosing that their data is sold, and
    // `disabled` on a button is an affordance rather than a guard.
    if (!isLogin && !agreed) {
      setError('Please agree to the terms before creating an account.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (err) { setError(err.message); setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);

    if (isLogin) {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      // One visible field, same stored shape as before.
      const parts = name.trim().split(/\s+/);
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: parts[0] || '',
            last_name: parts.slice(1).join(' '),
            legal_version: '2026-08-06-draft',
            legal_accepted_at: new Date().toISOString(),
          },
        },
      });
      if (err) setError(err.message);
      else if (data?.user && !data.session) {
        setInfo(`Check ${email} for a confirmation link, then log in.`);
      }
    }
    setLoading(false);
  };

  const canSubmit = isLogin ? true : agreed;

  return (
    <div className="av2">
      <div className="av2-card">
        {/* The wordmark is the way back. Without it the card was a dead end —
            a visitor who landed here by mistake had only the back button. */}
        <button type="button" className="av2-brand" onClick={() => navigate(HOME)}>
          <Icon name="pantry" size={17} />
          Pantry Snap
        </button>

        <h1 className="av2-h1">{isLogin ? 'Log in to your pantry' : 'Create your pantry'}</h1>
        <p className="av2-sub">
          {isLogin
            ? 'Pick up where your kitchen left off.'
            : 'Free for students. No card, and nothing to download.'}
        </p>

        {error && <div className="av2-msg av2-msg-error">{error}</div>}
        {info && <div className="av2-msg av2-msg-info">{info}</div>}

        <button className="av2-oauth" onClick={handleGoogle} disabled={loading || !canSubmit} type="button">
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="av2-divider">or</div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="av2-field">
              <label className="av2-label" htmlFor="av2-name">Name</label>
              <input
                id="av2-name"
                name="name"
                className="av2-input"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
          )}

          <div className="av2-field">
            <label className="av2-label" htmlFor="av2-email">Email</label>
            <input
              id="av2-email"
              name="email"
              type="email"
              className="av2-input"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
            />
          </div>

          <div className="av2-field">
            <label className="av2-label" htmlFor="av2-password">Password</label>
            <input
              id="av2-password"
              name="password"
              type="password"
              className="av2-input"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {isLogin && (
              <button type="button" className="av2-forgot" onClick={handleForgot} disabled={loading}>
                Forgot password?
              </button>
            )}
          </div>

          {!isLogin && (
            <label className="av2-consent">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                {/* All three open in a new tab. "how that works" used to
                    navigate in place, which threw away a half-filled form the
                    moment someone tried to read what they were agreeing to —
                    the worst possible time to lose their input. */}
                I agree to the <a href="/legal/eula.html" target="_blank" rel="noreferrer">Terms</a>{' '}
                and <a href="/legal/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>,
                including the sharing of my data described there —{' '}
                <a href="/why-free" target="_blank" rel="noreferrer">how that works</a>.
              </span>
            </label>
          )}

          <button className="av2-submit" type="submit" disabled={loading || !canSubmit}>
            {loading ? 'One moment…' : isLogin ? 'Log in' : 'Create pantry'}
          </button>
        </form>

        <div className="av2-alt">
          {isLogin ? (
            <>New here? <button type="button" onClick={() => switchMode(false)}>Create a pantry</button></>
          ) : (
            <>Already have one? <button type="button" onClick={() => switchMode(true)}>Log in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
