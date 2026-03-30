import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook to listen to real-time changes on a specific Supabase table
 * for a specific pantry, and trigger a refresh callback.
 */
export function useRealtimeSync(pantryId, table, onRefresh) {
  useEffect(() => {
    if (!pantryId) return;

    const channel = supabase
      .channel(`live_${table}_${pantryId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: table, 
          filter: `pantry_id=eq.${pantryId}` 
        },
        () => {
          onRefresh(); // Trigger a data re-fetch on any mutation
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pantryId, table, onRefresh]);
}
