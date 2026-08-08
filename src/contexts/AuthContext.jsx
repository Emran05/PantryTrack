import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ensureProfileFromMetadata } from '../lib/supabaseStorage';
import { syncUserPreferences } from '../lib/preferences';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Dismisses the consent gate within a session after the metadata write, since
  // the reference-stability guard below keeps the same user object (same id) and
  // would otherwise leave stale metadata making needsConsent stick true. A full
  // reload reads the real, now-populated metadata and needs no flag.
  const [consentSatisfied, setConsentSatisfied] = useState(false);
  const lastSyncedUserId = useRef(null);

  useEffect(() => {
    // supabase-js fires SIGNED_IN on every return-to-foreground, not just real
    // logins. Two consequences handled here: keep the user object reference
    // stable when the identity hasn't changed (a fresh object would remount
    // the whole authenticated tree and wipe in-progress forms), and run the
    // profile/preferences sync only when the actual account changes.
    const applyUser = (u) => {
      setUser(prev => (prev?.id === u?.id ? prev : u));
      if (u && u.id !== lastSyncedUserId.current) {
        lastSyncedUserId.current = u.id;
        setConsentSatisfied(false); // a different account may still owe consent
        ensureProfileFromMetadata(u);
        syncUserPreferences();
      }
      if (!u) { lastSyncedUserId.current = null; setConsentSatisfied(false); }
    };

    // The initial session check must never strand the splash: failures and
    // hangs both resolve to "not signed in" instead of a forever-blank screen.
    let settled = false;
    const watchdog = setTimeout(() => {
      if (!settled) {
        console.error('getSession() did not settle within 8s — rendering app anyway');
        setLoading(false);
      }
    }, 8000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => applyUser(session?.user ?? null))
      .catch((err) => {
        console.error('getSession failed:', err);
        setUser(null);
      })
      .finally(() => {
        settled = true;
        clearTimeout(watchdog);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      settled = true;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    // Unsubscribe push BEFORE the session dies — the push_subscriptions
    // delete needs this user's session to pass RLS. Without this, the device
    // keeps receiving the previous account's expiry reminders (shared-device
    // roommate case). Best-effort: a failure must never block signing out.
    try {
      const { disablePushNotifications } = await import('../lib/push');
      await disablePushNotifications();
    } catch (err) {
      // No subscription, unsupported browser, or network failure — proceed,
      // but leave a trace: a persistent failure here means this device may
      // still receive the signed-out account's reminders.
      console.warn('Push unsubscribe on sign-out failed:', err);
    }
    // Clear per-user local state so the next account doesn't inherit it.
    try {
      localStorage.removeItem('pantry_active_id');
    } catch {
      // localStorage may be unavailable (private mode) — ignore
    }
    return supabase.auth.signOut();
  }, []);

  // True once a user exists but is missing EITHER an accepted policy OR an age
  // band. Both are required before the app renders, because the account is
  // sold-by-default otherwise and CCPA needs opt-in for under-16s:
  //   - OAuth accounts never run the signup form (no consent, no age),
  //   - accounts created before consent was required have no policy on file,
  //   - accounts created before the age band existed have consent but no age —
  //     still unsellable-by-law until we know they are 16+.
  const meta = user?.user_metadata;
  const needsConsent =
    !!user &&
    (!meta?.legal_accepted_at || typeof meta?.is_under_16 !== 'boolean') &&
    !consentSatisfied;
  const markConsentGiven = useCallback(() => setConsentSatisfied(true), []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, needsConsent, markConsentGiven }}>
      {loading ? (
        <div style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-primary, #0f172a)',
          color: 'var(--color-accent, #22c55e)',
          fontFamily: "'Inter', sans-serif",
          gap: '12px'
        }}>
          <span style={{ fontSize: '2rem', fontWeight: 700 }}>P</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #94a3b8)' }}>Loading...</span>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

