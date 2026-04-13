import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut: () => supabase.auth.signOut() }}>
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

