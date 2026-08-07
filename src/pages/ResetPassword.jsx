import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastContext';
import './Auth.css';

// Landing target for the resetPasswordForEmail redirect. The recovery link
// carries tokens in the URL hash; supabase-js (detectSessionInUrl) exchanges
// them and fires a PASSWORD_RECOVERY event, switching the session to the
// account the link was issued for. We gate on THAT signal — not on "is anyone
// signed in" — because a plain session would let someone who wandered to this
// route change the currently-logged-in account's password without any link.
export default function ResetPassword() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // null = still checking; the token exchange resolves just after mount.
  const [isRecovery, setIsRecovery] = useState(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // The recovery hash is present on the initial navigation from the email.
    const hash = window.location.hash || '';
    const hashLooksLikeRecovery = /type=recovery/.test(hash);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setEmail(session?.user?.email || '');
      }
    });

    // Fallback for when the event fired before this listener attached: if the
    // URL still carries the recovery marker, trust it and read the session.
    if (hashLooksLikeRecovery) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsRecovery(true);
        setEmail(session?.user?.email || '');
      });
    } else {
      // Give the async exchange a beat; if no PASSWORD_RECOVERY arrives, this
      // was a direct/expired visit, not a real recovery.
      const t = setTimeout(() => setIsRecovery((prev) => (prev === null ? false : prev)), 1200);
      return () => {
        clearTimeout(t);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords don\'t match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    showToast('Password updated');
    navigate('/');
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card">
        <h1 className="auth-title">Reset Password</h1>

        {isRecovery === false ? (
          <>
            <p className="auth-subtitle">This reset link is invalid or has expired.</p>
            <Link to="/login" className="btn btn-primary auth-submit">
              Request a new link
            </Link>
          </>
        ) : (
          <>
            <p className="auth-subtitle">
              {email ? `Choose a new password for ${email}.` : 'Choose a new password for your account.'}
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading || isRecovery === null}>
                {loading ? '...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
