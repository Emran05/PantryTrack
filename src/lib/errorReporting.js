// Minimal self-hosted crash reporting.
//
// Before this, a production crash was invisible to the owner: the error
// boundary showed a friendly screen and console.error'd into a browser nobody
// was watching. This writes to our own error_reports table (insert-only RLS),
// so there is no third-party processor to disclose and no new dependency.
//
// Deliberately conservative: never throws, never blocks a render, never
// reports the same signature twice per session, and caps per session so a
// render loop can't spam the table.

import { supabase } from './supabase';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
const MAX_PER_SESSION = 8;
const seen = new Set();
let sent = 0;

function signature(kind, message, stack) {
  return `${kind}:${message}:${(stack || '').slice(0, 120)}`;
}

/**
 * Report a crash. Fire-and-forget by design — reporting must never affect
 * what the user sees, and a failure to report is not worth a second error.
 */
export function reportError(kind, error, extra = {}) {
  try {
    if (sent >= MAX_PER_SESSION) return;
    const message = String(error?.message || error || 'Unknown error').slice(0, 500);
    const stack = error?.stack ? String(error.stack).slice(0, 4000) : null;
    const sig = signature(kind, message, stack);
    if (seen.has(sig)) return;
    seen.add(sig);
    sent += 1;

    supabase
      .from('error_reports')
      .insert({
        kind,
        message,
        stack,
        component_stack: extra.componentStack ? String(extra.componentStack).slice(0, 4000) : null,
        route: typeof location !== 'undefined' ? location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
        app_version: APP_VERSION,
      })
      .then(({ error: err }) => {
        if (err) console.warn('Error report failed to send:', err.message);
      });
  } catch {
    // Reporting must never itself throw.
  }
}

/** Catch what React's error boundary cannot: async and event-handler errors. */
export function installGlobalErrorReporting() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    reportError('unhandled', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportError('rejection', e.reason);
  });
}
