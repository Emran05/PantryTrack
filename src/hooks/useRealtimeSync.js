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
          event: 'INSERT',
          schema: 'public',
          table: table,
          filter: `pantry_id=eq.${pantryId}`
        },
        () => {
          callbackRef.current(); // Uses ref — no stale closure
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: table,
          filter: `pantry_id=eq.${pantryId}`
        },
        () => {
          callbackRef.current();
        }
      )
      .on(
        'postgres_changes',
        // DELETE payloads only carry the old row's primary key (unless the table
        // has REPLICA IDENTITY FULL), so a pantry_id filter silently drops every
        // delete event. Subscribe unfiltered and just refetch — the refetch is
        // already scoped to the active pantry, so a cross-pantry delete costs one
        // harmless extra query.
        { event: 'DELETE', schema: 'public', table: table },
        () => {
          callbackRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pantryId, table]); // onRefresh intentionally excluded
}
