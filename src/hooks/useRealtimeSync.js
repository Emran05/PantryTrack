import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook to listen to real-time changes on a specific Supabase table
 * for a specific pantry, and trigger a refresh callback.
 *
 * Uses a ref for onRefresh so the subscription doesn't re-create
 * when the callback identity changes (common with inline functions).
 */
export function useRealtimeSync(pantryId, table, onRefresh) {
  const callbackRef = useRef(onRefresh);

  // Always keep the ref up-to-date with the latest callback
  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

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
          callbackRef.current(); // Uses ref — no stale closure
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pantryId, table]); // onRefresh intentionally excluded
}
