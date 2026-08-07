// Prove a member cannot mint an unbounded invite by posting directly to the
// API: a 100-year expiry / million-use token must be rejected, while a normal
// default-terms invite still works.
// Usage: node scripts/qa/check-invite-bounds.mjs ~/.claude/autonomous/qa-test-account
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

const mk = (extra) => fetch(`${REST}/invite_tokens`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ pantry_id: m.pantry_id, created_by: user.id, ...extra }),
});

let exit = 0;
const created = [];

// 1) Abusive terms must be rejected.
const evil = await mk({ expires_at: '2099-01-01T00:00:00Z', max_uses: 1000000 });
if (evil.ok) {
  const [row] = await evil.json(); created.push(row.token);
  console.error('FAIL: unbounded invite accepted (100-year expiry, 1M uses)'); exit = 1;
} else {
  console.log('ok: unbounded invite rejected');
}

// 2) Negative use_count must be rejected.
const neg = await mk({ use_count: -5 });
if (neg.ok) {
  const [row] = await neg.json(); created.push(row.token);
  console.error('FAIL: negative use_count accepted'); exit = 1;
} else {
  console.log('ok: negative use_count rejected');
}

// 3) Normal invite still works.
const good = await mk({});
if (!good.ok) { console.error('FAIL: normal invite rejected:', (await good.text()).slice(0, 140)); exit = 1; }
else {
  const [row] = await good.json(); created.push(row.token);
  const days = (new Date(row.expires_at) - new Date(row.created_at)) / 86400000;
  console.log(`ok: normal invite created (max_uses ${row.max_uses}, expires in ${days.toFixed(0)}d)`);
}

for (const t of created) {
  await fetch(`${REST}/invite_tokens?token=eq.${t}`, { method: 'DELETE', headers: H });
}
console.log('cleaned up test invites');
process.exit(exit);
