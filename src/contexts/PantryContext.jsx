import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getUserPantries, createPantry } from '../lib/supabaseStorage';

const PantryContext = createContext({});

export const usePantry = () => useContext(PantryContext);

export function PantryProvider({ children }) {
  const { user } = useAuth();
  const [pantries, setPantries] = useState([]);
  const [activePantry, setActivePantry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPantries([]);
      setActivePantry(null);
      setLoading(false);
      return;
    }

    async function fetchPantries() {
      try {
        setLoading(true);
        let data = await getUserPantries();
        
        // If user has no pantries, create a default "My Home"
        if (data.length === 0) {
          const newPantry = await createPantry('My Home');
          data = await getUserPantries(); // refetch to get the full formatted object with members
        }
        
        setPantries(data);
        // Default to the first pantry if none is selected
        if (data.length > 0) {
          const defaultActive = localStorage.getItem('pantry_active_id');
          const found = data.find(p => p.id === defaultActive);
          setActivePantry(found || data[0]);
        }
      } catch (error) {
        console.error('Error fetching pantries:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPantries();
  }, [user]);

  const switchPantry = (pantryId) => {
    const found = pantries.find(p => p.id === pantryId);
    if (found) {
      setActivePantry(found);
      localStorage.setItem('pantry_active_id', pantryId);
    }
  };

  const refreshPantries = async () => {
    const data = await getUserPantries();
    setPantries(data);
    if (activePantry && !data.find(p => p.id === activePantry.id)) {
      setActivePantry(data[0] || null);
    }
  };

  return (
    <PantryContext.Provider value={{ pantries, activePantry, switchPantry, refreshPantries, loading }}>
      {children}
    </PantryContext.Provider>
  );
}
