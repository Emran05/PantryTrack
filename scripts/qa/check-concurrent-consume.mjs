// Prove the single-item consume path is race-safe: fire two concurrent
// "use 1" calls at the same item and assert BOTH landed (5 → 3), which the
// old read-then-write path could not guarantee (it would land 5 → 4).
// Usage: node scripts/qa/check-concurrent-consume.mjs ~/.claude/autonomous/qa-test-account
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
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const REST = `${env.VITE_SUPABASE_URL}/rest/v1`;

const [m] = await (await fetch(`${REST}/pantry_members?select=pantry_id&user_id=eq.${user.id}&limit=1`, { headers: H })).json();
if (!m) { console.error('FAIL: no pantry'); process.exit(1); }

const createRes = await fetch(`${REST}/pantry_items`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ pantry_id: m.pantry_id, name: 'QA race probe', quantity: 5, unit: 'pcs', category: 'other' }),
});
if (!createRes.ok) { console.error('FAIL: create', (await createRes.text()).slice(0, 140)); process.exit(1); }
const [item] = await createRes.json();

let exit = 0;
try {
  // Two "housemates" use 1 each, simultaneously.
  const call = () => fetch(`${REST}/rpc/consume_pantry_item_atomic`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_pantry_id: m.pantry_id, p_item_id: item.id, p_qty: 1 }),
  });
  const [a, b] = await Promise.all([call(), call()]);
  if (!a.ok || !b.ok) { console.error('FAIL: a concurrent call errored', a.status, b.status); exit = 1; }

  const [after] = await (await fetch(`${REST}/pantry_items?select=quantity&id=eq.${item.id}`, { headers: H })).json();
  const qty = Number(after?.quantity);
  if (qty === 3) console.log('ok: both concurrent writes landed — 5 → 3 (race-safe)');
  else if (qty === 4) { console.error('FAIL: lost update — 5 → 4 (one write clobbered the other)'); exit = 1; }
  else { console.error(`FAIL: unexpected quantity ${qty}`); exit = 1; }
} finally {
  await fetch(`${REST}/pantry_items?id=eq.${item.id}`, { method: 'DELETE', headers: H });
  console.log('cleaned up probe item');
}
process.exit(exit);
