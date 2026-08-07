// Verify the DB accepts fractional quantities (post-migration check).
// Creates a throwaway item in the QA account's pantry, sets qty 1.5, cleans up.
// Usage: node scripts/qa/check-fractional-qty.mjs ~/.claude/autonomous/qa-test-account
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
const H = {
  apikey: env.VITE_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${access_token}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const memRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/pantry_members?select=pantry_id&user_id=eq.${user.id}&limit=1`, { headers: H });
const [membership] = await memRes.json();
if (!membership) { console.error('FAIL: QA account has no pantry'); process.exit(1); }

const createRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/pantry_items`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ pantry_id: membership.pantry_id, name: 'QA fractional probe', quantity: 1.5, unit: 'pcs', category: 'other' }),
});
const body = await createRes.text();
if (!createRes.ok) {
  console.error(`FAIL: fractional insert rejected (${createRes.status}): ${body.slice(0, 160)}`);
  process.exit(1);
}
const [created] = JSON.parse(body);
console.log(`ok: fractional quantity accepted and stored as ${created.quantity}`);
await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/pantry_items?id=eq.${created.id}`, { method: 'DELETE', headers: H });
console.log('cleaned up probe item');
