// Verify consume_pantry_items is atomic: a batch containing one bad item must
// leave EVERY item untouched. Creates two throwaway items, cleans up after.
// Usage: node scripts/qa/check-atomic-consume.mjs ~/.claude/autonomous/qa-test-account
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

const [membership] = await (await fetch(`${REST}/pantry_members?select=pantry_id&user_id=eq.${user.id}&limit=1`, { headers: H })).json();
if (!membership) { console.error('FAIL: no pantry'); process.exit(1); }
const pantry = membership.pantry_id;

const mk = async (name, qty) => {
  const res = await fetch(`${REST}/pantry_items`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ pantry_id: pantry, name, quantity: qty, unit: 'pcs', category: 'other' }),
  });
  const [row] = await res.json();
  return row;
};
const del = (id) => fetch(`${REST}/pantry_items?id=eq.${id}`, { method: 'DELETE', headers: H });
const qtyOf = async (id) => {
  const [row] = await (await fetch(`${REST}/pantry_items?select=quantity&id=eq.${id}`, { headers: H })).json();
  return row?.quantity ?? null;
};

const a = await mk('QA atomic probe A', 5);
const b = await mk('QA atomic probe B', 5);
let exit = 0;
try {
  // Batch: valid deduction on A, then a nonexistent item — must roll BOTH back.
  const bad = await fetch(`${REST}/rpc/consume_pantry_items`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_pantry_id: pantry, p_items: [
      { id: a.id, qty: 2 },
      { id: '00000000-0000-0000-0000-000000000000', qty: 1 },
    ] }),
  });
  const aAfter = await qtyOf(a.id);
  if (bad.ok) { console.error('FAIL: batch with a bad item unexpectedly succeeded'); exit = 1; }
  else if (Number(aAfter) !== 5) { console.error(`FAIL: NOT atomic — A was deducted to ${aAfter} despite the batch failing`); exit = 1; }
  else console.log('ok: failed batch rolled back — A still 5 (atomic)');

  // Happy path: both deduct together.
  const good = await fetch(`${REST}/rpc/consume_pantry_items`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_pantry_id: pantry, p_items: [{ id: a.id, qty: 2 }, { id: b.id, qty: 5 }] }),
  });
  if (!good.ok) { console.error('FAIL: valid batch rejected:', (await good.text()).slice(0, 140)); exit = 1; }
  else {
    const aQty = await qtyOf(a.id);
    const bQty = await qtyOf(b.id);
    if (Number(aQty) === 3 && bQty === null) console.log('ok: batch applied — A 5→3, B emptied and removed');
    else { console.error(`FAIL: unexpected result A=${aQty} B=${bQty}`); exit = 1; }
  }
} finally {
  await del(a.id); await del(b.id);
  console.log('cleaned up probe items');
}
process.exit(exit);
