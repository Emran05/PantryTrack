import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getUserPantries, createPantry } from '../lib/supabaseStorage';

const PantryContext = createContext({});

export const usePantry = () => useContext(PantryContext);

// Module-level guard: prevents two instances (tabs) from both racing to create
// the default "My Home" pantry. The real fix requires a server-side unique
// constraint, but this eliminates the same-tab race.
let defaultPantryBeingCreated = false;

export function PantryProvider({ children }) {
  const { user } = useAuth();
  const [pantries, setPantries] = useState([]);
  const [activePantry, setActivePantry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!user) {
      setPantries([]);
      setActivePantry(null);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchPantries() {
      try {
        setLoading(true);
        setError(null);
        let data = await getUserPantries();

        if (data.length === 0 && !defaultPantryBeingCreated) {
          defaultPantryBeingCreated = true;
          try {
            await createPantry('My Home');
            data = await getUserPantries();
          } finally {
            defaultPantryBeingCreated = false;
          }
        }

        setPantries(data);
        if (data.length > 0) {
          const defaultActive = localStorage.getItem('pantry_active_id');
          const found = data.find(p => p.id === defaultActive);
          setActivePantry(found || data[0]);
        }
      } catch (error) {
        console.error('Error fetching pantries:', error);
        setError(error);
      } finally {
        setLoading(false);
      }
    }

    fetchPantries();
    // user?.id, not user: token refreshes swap the session object but not the
    // identity — pantries only depend on WHO is signed in.
  }, [user?.id, retryTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Surface a Retry to the UI instead of a silent forever-spinner.
  const retryPantries = () => setRetryTick(t => t + 1);

  const switchPantry = (pantryId) => {
    const found = pantries.find(p => p.id === pantryId);
    if (found) {
      setActivePantry(found);
      localStorage.setItem('pantry_active_id', pantryId);
    }
  };

  // Set active pantry directly from a pantry object (bypasses stale state)
  const setActivePantryDirect = (pantry) => {
    if (pantry) {
      setActivePantry(pantry);
      localStorage.setItem('pantry_active_id', pantry.id);
    }
  };

  const refreshPantries = async () => {
    const data = await getUserPantries();
    setPantries(data);
    if (activePantry) {
      const fresh = data.find(p => p.id === activePantry.id);
      if (!fresh) {
        // Active pantry is gone (left/deleted) — fall back to the first one.
        setActivePantry(data[0] || null);
      } else if (fresh.name !== activePantry.name) {
        // Re-point only when something visible changed; keeping the same
        // object identity otherwise avoids pointless refetches in pages whose
        // effects key on `activePantry`.
        setActivePantry(fresh);
      }
    }
    return data; // Return fresh list so callers can use it
  };

  return (
    <PantryContext.Provider value={{ pantries, activePantry, switchPantry, setActivePantryDirect, refreshPantries, loading, error, retryPantries }}>
      {children}
    </PantryContext.Provider>
  );
}
