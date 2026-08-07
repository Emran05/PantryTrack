// Verify rename_pantry / leave_pantry against the live project.
// Creates a throwaway home, renames it, leaves it (expect 'deleted' since the
// QA account is its only member), and checks the last-home guardrail.
// Usage: node scripts/qa/check-home-management.mjs ~/.claude/autonomous/qa-test-account
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
const rpc = (fn, body) => fetch(`${REST}/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) });

let exit = 0;
// Create a throwaway home + membership (mirrors createPantry).
const createRes = await fetch(`${REST}/pantries`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'QA throwaway home', created_by: user.id }) });
if (!createRes.ok) { console.error('FAIL: create home', createRes.status, (await createRes.text()).slice(0, 160)); process.exit(1); }
const [home] = await createRes.json();
await fetch(`${REST}/pantry_members`, { method: 'POST', headers: H, body: JSON.stringify({ pantry_id: home.id, user_id: user.id, role: 'owner' }) });

// Rename
const ren = await rpc('rename_pantry', { p_pantry_id: home.id, p_name: 'QA renamed home' });
if (!ren.ok) { console.error('FAIL: rename', (await ren.text()).slice(0, 140)); exit = 1; }
else {
  const [row] = await (await fetch(`${REST}/pantries?select=name&id=eq.${home.id}`, { headers: H })).json();
  console.log(row?.name === 'QA renamed home' ? 'ok: rename applied' : `FAIL: name is ${row?.name}`);
  if (row?.name !== 'QA renamed home') exit = 1;
}

// Blank name must be rejected.
const blank = await rpc('rename_pantry', { p_pantry_id: home.id, p_name: '   ' });
console.log(blank.ok ? 'FAIL: blank rename accepted' : 'ok: blank rename rejected');
if (blank.ok) exit = 1;

// Leave as sole member -> deleted, and the row is gone.
const left = await rpc('leave_pantry', { p_pantry_id: home.id });
const outcome = left.ok ? await left.json() : null;
if (outcome !== 'deleted') { console.error(`FAIL: expected 'deleted', got ${JSON.stringify(outcome)}`); exit = 1; }
else {
  const rows = await (await fetch(`${REST}/pantries?select=id&id=eq.${home.id}`, { headers: H })).json();
  console.log(rows.length === 0 ? "ok: sole-member leave deleted the home" : 'FAIL: home still exists');
  if (rows.length !== 0) exit = 1;
}

// Guardrail: cannot leave your last remaining home.
const mine = await (await fetch(`${REST}/pantry_members?select=pantry_id&user_id=eq.${user.id}`, { headers: H })).json();
if (mine.length === 1) {
  const last = await rpc('leave_pantry', { p_pantry_id: mine[0].pantry_id });
  console.log(last.ok ? 'FAIL: leaving the last home was allowed' : 'ok: last-home guardrail holds');
  if (last.ok) exit = 1;
} else {
  console.log(`skip: last-home guardrail (account has ${mine.length} homes)`);
}
process.exit(exit);
