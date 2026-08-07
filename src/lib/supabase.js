import { createClient } from '@supabase/supabase-js';

// URL snapshot from BEFORE the client below runs its detectSessionInUrl
// exchange — that exchange strips auth markers (recovery hash / PKCE ?code=)
// from the address bar, and ResetPassword needs to know they were ever there.
export const BOOT_HASH = (typeof window !== 'undefined' && window.location) ? window.location.hash : '';
export const BOOT_SEARCH = (typeof window !== 'undefined' && window.location) ? window.location.search : '';
export const BOOT_PATH = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hbkwbjkicmhtlsiiavjh.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3diamtpY21odGxzaWlhdmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzYzNjksImV4cCI6MjA5MDQxMjM2OX0.Qs7j8w_TSBtt7HgyYqTDNeZikF6LRKE02UhTeR_kkVI';

export const supabase = createClient(supabaseUrl, supabaseKey);
