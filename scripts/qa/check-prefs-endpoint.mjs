// Verify user_preferences is live for the QA account (post-migration check).
// Prints status only; never prints secrets.
// Usage: node scripts/qa/check-prefs-endpoint.mjs ~/.claude/autonomous/qa-test-account
import { readFileSync } from 'fs';

const kv = (t, sep = '=') => Object.fromEntries(
  t.split('\n').filter(l => l.includes(sep) && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf(sep)).trim(), l.slice(l.indexOf(sep) + 1).trim()])
);
const env = kv(readFileSync(new URL('../../.env', import.meta.url), 'utf8'));
const creds = kv(readFileSync(process.argv[2], 'utf8'), ':');

const login = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: creds.email, password: creds.password }),
});
if (!login.ok) { console.error('FAIL: login', login.status); process.exit(1); }
const { access_token, user } = await login.json();
const prefs = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/user_preferences?select=user_id&user_id=eq.${user.id}`, {
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}` },
});
console.log(`user_preferences GET: ${prefs.status}${prefs.ok ? ' — table live (was 404 pre-migration)' : ''}`);
process.exit(prefs.ok ? 0 : 1);
