import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePantry } from '../contexts/PantryContext';
import { useToast } from '../components/ToastContext';
import { redeemInvite, isMissingInviteSchema, PENDING_INVITE_KEY } from '../lib/invites';
import './Auth.css';

const REASON_TEXT = {
  invalid: 'This invite link isn\'t valid — ask your housemate to send a new one.',
  expired: 'This invite link has expired — ask your housemate for a fresh one.',
  exhausted: 'This invite link has been used up — ask your housemate for a fresh one.',
};

// Landing target for /join/<token>. Signed out: stash the token and route
// through auth (App.jsx resumes the join after login). Signed in: redeem,
// switch to the new home, and land on the pantry.
export default function JoinPantry() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { refreshPantries, setActivePantryDirect } = usePantry();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const redeemedRef = useRef(false); // StrictMode double-mount guard

  useEffect(() => {
    if (authLoading || !user || redeemedRef.current) return;
    redeemedRef.current = true;

    // Consume the stashed token NOW, before the attempt settles. Clearing only
    // on success left a failed redeem (expired/invalid link, missing schema)
    // stuck in sessionStorage, so App.jsx's resume effect bounced the user back
    // to /join on every navigation — an inescapable loop. The token still lives
    // in the URL, so this redeem proceeds normally.
    try {
      localStorage.removeItem(PENDING_INVITE_KEY);
    } catch {
      // ignore
    }

    (async () => {
      try {
        const res = await redeemInvite(token);
        if (!res?.ok) {
          setError(REASON_TEXT[res?.reason] || REASON_TEXT.invalid);
          return;
        }
        const list = await refreshPantries();
        const joined = list.find((p) => p.id === res.pantry_id);
        if (joined) setActivePantryDirect(joined);
        showToast(
          res.already_member
            ? `You're already a member of ${res.pantry_name}`
            : `Welcome to ${res.pantry_name}!`
        );
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Invite redeem failed:', err);
        setError(
          isMissingInviteSchema(err)
            ? 'Invite links aren\'t set up yet — ask for the Home ID instead (Settings → Join a Home).'
            : 'Couldn\'t join right now — check your connection and try the link again.'
        );
      }
    })();
  }, [authLoading, user, token, refreshPantries, setActivePantryDirect, showToast, navigate]);

  // Signed out: remember the token so login/signup flows straight back here.
  useEffect(() => {
    if (!authLoading && !user) {
      try {
        localStorage.setItem(PENDING_INVITE_KEY, token);
      } catch {
        // ignore
      }
    }
  }, [authLoading, user, token]);

  if (!authLoading && !user) {
    return (
      <div className="auth-container animate-fade-in">
        <div className="auth-card">
          <h1 className="auth-title">You're invited! 🎉</h1>
          <p className="auth-subtitle">
            Someone wants to share their pantry with you. Log in or create an
            account and you'll join automatically.
          </p>
          <Link to="/login" className="btn btn-primary auth-submit" style={{ marginBottom: 8 }}>
            Log in
          </Link>
          <Link to="/login?mode=signup" className="btn btn-secondary auth-submit">
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card">
        <h1 className="auth-title">{error ? 'Couldn\'t join' : 'Joining home…'}</h1>
        {error ? (
          <>
            <p className="auth-subtitle">{error}</p>
            <Link to="/" className="btn btn-primary auth-submit">
              Back to my pantry
            </Link>
          </>
        ) : (
          <p className="auth-subtitle">Hang tight — adding you to the pantry.</p>
        )}
      </div>
    </div>
  );
}
