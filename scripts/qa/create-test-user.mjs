// Seed (or verify) the QA test account — user-approved for continuous QA.
// Reads Supabase creds from the project .env and the QA credentials from the
// file given as argv[2] (never from the repo). Prints status only; never
// prints secrets.
//
// Usage: node scripts/qa/create-test-user.mjs ~/.claude/autonomous/qa-test-account

import { readFileSync } from 'fs';

function parseKv(text, sep = '=') {
  return Object.fromEntries(
    text.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && l.includes(sep))
      .map(l => [l.slice(0, l.indexOf(sep)).trim(), l.slice(l.indexOf(sep) + 1).trim()])
  );
}

const env = parseKv(readFileSync(new URL('../../.env', import.meta.url), 'utf8'));
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon) { console.error('FAIL: VITE_SUPABASE_URL / anon key missing from .env'); process.exit(1); }

const credsPath = process.argv[2];
if (!credsPath) { console.error('FAIL: pass path to credentials file'); process.exit(1); }
const creds = parseKv(readFileSync(credsPath, 'utf8'), ':');
const email = creds.email;
const password = creds.password;
if (!email || !password) { console.error('FAIL: credentials file needs email:/password: lines'); process.exit(1); }

// 1) If the account already works, we're done.
const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (login.ok) { console.log('ok: test account exists and logs in'); process.exit(0); }

// 2) Create it pre-confirmed via the admin API (needs service role key).
if (!svc) {
  console.error('FAIL: login failed and SUPABASE_SERVICE_ROLE_KEY not in .env — cannot create. Add the key locally or create the account via the signup UI.');
  process.exit(1);
}
const create = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: 'QA', last_name: 'Tester',
      legal_version: '2026-08-06-draft',
      legal_accepted_at: new Date().toISOString(),
      qa_account: true,
    },
  }),
});
if (create.ok) { console.log('ok: test account created (pre-confirmed)'); process.exit(0); }
const detail = await create.text().catch(() => '');
if (!detail.includes('email_exists')) {
  console.error(`FAIL: create returned ${create.status}: ${detail.slice(0, 200)}`);
  process.exit(1);
}

// 3) Exists but can't log in — unconfirmed or stale password. Admin-repair it.
const listRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
  headers: { apikey: svc, Authorization: `Bearer ${svc}` },
});
if (!listRes.ok) { console.error(`FAIL: admin list ${listRes.status}`); process.exit(1); }
const { users = [] } = await listRes.json();
const existing = users.find(u => u.email === email);
if (!existing) { console.error('FAIL: email_exists but user not found in first 1000'); process.exit(1); }
const fix = await fetch(`${url}/auth/v1/admin/users/${existing.id}`, {
  method: 'PUT',
  headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ password, email_confirm: true }),
});
if (!fix.ok) { console.error(`FAIL: admin update ${fix.status}`); process.exit(1); }
const relogin = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
console.log(relogin.ok ? 'ok: existing account confirmed + password set, login verified' : `FAIL: repaired but login still ${relogin.status}`);
process.exit(relogin.ok ? 0 : 1);
