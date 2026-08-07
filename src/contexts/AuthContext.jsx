import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ensureProfileFromMetadata } from '../lib/supabaseStorage';
import { syncUserPreferences } from '../lib/preferences';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
        ensureProfileFromMetadata(u);
        syncUserPreferences();
      }
      if (!u) lastSyncedUserId.current = null;
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

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
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

