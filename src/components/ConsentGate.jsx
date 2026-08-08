import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { setUnder16, computeUnder16, flushPrefs } from '../lib/preferences';
import '../pages/AuthV2.css';

// Post-authentication consent gate.
//
// "Continue with Google" is one button for both login and signup, and Supabase
// creates the account on the redirect before any form runs — so an OAuth user
// never sees the signup consent checkbox or the age field, and no consent
// receipt or age band is recorded. Accounts created before consent was required
// have the same gap. This gate stands in front of the app for exactly those
// users (AuthContext.needsConsent) and collects both before letting them in.
//
// It deliberately has no dismiss: consenting or signing out are the only exits,
// because the alternative is using a data-selling app with no accepted policy.
export default function ConsentGate() {
  const { user, signOut, markConsentGiven } = useAuth();
  const [dob, setDob] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!agreed || !dob) return;
    setLoading(true);

    const under16 = computeUnder16(dob);
    // Settle the age band before writing, so the prefs flush below cannot
    // violate the minors_are_never_sold constraint.
    setUnder16(under16 === true);

    const { error: err } = await supabase.auth.updateUser({
      data: {
        legal_version: '2026-08-06-draft',
        legal_accepted_at: new Date().toISOString(),
        is_under_16: under16 === true,
      },
    });
    if (err) {
      setError(err.message || 'Could not save. Please try again.');
      setLoading(false);
      return;
    }

    // Persist the opt-out for a minor immediately; best-effort, the local flag
    // already holds and the next sync will retry.
    await flushPrefs().catch(() => {});
    setLoading(false);
    markConsentGiven();
  };

  const canSubmit = agreed && !!dob;
  const firstName = user?.user_metadata?.first_name;

  return (
    <div className="av2">
      <div className="av2-card">
        <div className="av2-brand">
          <span>Pantry Snap</span>
        </div>

        <h1 className="av2-h1">One thing before you start</h1>
        <p className="av2-sub">
          {firstName ? `Welcome, ${firstName}. ` : ''}
          PantrySnap is free because it shares de-identified grocery trends.
          We need your agreement — and your age range — before your pantry opens.
        </p>

        {error && <div className="av2-msg av2-msg-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="av2-field">
            <label className="av2-label" htmlFor="cg-dob">Date of birth</label>
            <input
              id="cg-dob"
              name="dob"
              type="date"
              className="av2-input"
              autoComplete="bday"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <p className="av2-hint">
              We keep your age range, never the date. Under-16 accounts are
              never included in data sharing.
            </p>
          </div>

          <label className="av2-consent">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              I agree to the <a href="/legal/eula.html" target="_blank" rel="noreferrer">Terms</a>{' '}
              and <a href="/legal/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>,
              including the sharing of my data described there —{' '}
              <a href="/why-free" target="_blank" rel="noreferrer">how that works</a>.
            </span>
          </label>

          <button className="av2-submit" type="submit" disabled={loading || !canSubmit}>
            {loading ? 'One moment…' : 'Agree and continue'}
          </button>
        </form>

        <div className="av2-alt">
          Changed your mind?{' '}
          <button type="button" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
