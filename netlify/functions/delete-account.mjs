// Account deletion — the "Delete my account" promise in the privacy policy.
//
// Client-side Supabase can't delete an auth user, so this function does it
// with the service role key. It verifies the caller's own session token, so a
// user can only ever delete themself.
//
// Env (same vars expiry-notifications.mjs already needs):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Request:  POST with Authorization: Bearer <supabase access token>
// Response: 200 {ok:true} | 401/405/500 {message}
//
// Cleanup order matters: pantries where the user is the only member go first
// (items/areas/shopping lists by pantry_id — the legacy tables predate the
// checked-in migrations, so we don't rely on cascades for them), then the
// user's own rows, then the auth user itself (which cascades the tables that
// DO declare on-delete-cascade: preferences, push, consumption, ai_usage,
// invite_tokens).

export const config = { path: '/api/delete-account' };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { message: 'POST only' });

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return json(500, { message: 'Server not configured' });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { message: 'Missing session token' });

  // Who is this? Ask Supabase auth with the caller's own token.
  const whoRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!whoRes.ok) return json(401, { message: 'Invalid session' });
  const user = await whoRes.json();
  const userId = user?.id;
  if (!userId) return json(401, { message: 'Invalid session' });

  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const rest = (path, init = {}) =>
    fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...svc, ...(init.headers || {}) } });

  try {
    // Pantries this user belongs to.
    const memRes = await rest(`pantry_members?user_id=eq.${userId}&select=pantry_id`);
    const memberships = memRes.ok ? await memRes.json() : [];

    for (const { pantry_id } of memberships) {
      const othersRes = await rest(
        `pantry_members?pantry_id=eq.${pantry_id}&user_id=neq.${userId}&select=user_id&limit=1`
      );
      const others = othersRes.ok ? await othersRes.json() : [{}]; // on error, assume shared — don't delete
      if (others.length === 0) {
        // Sole member: remove the pantry and everything in it.
        for (const table of ['shopping_items', 'pantry_items', 'areas', 'invite_tokens']) {
          await rest(`${table}?pantry_id=eq.${pantry_id}`, { method: 'DELETE' });
        }
        await rest(`pantry_members?pantry_id=eq.${pantry_id}`, { method: 'DELETE' });
        await rest(`pantries?id=eq.${pantry_id}`, { method: 'DELETE' });
      }
    }

    // The user's own rows in tables without a declared cascade.
    await rest(`pantry_members?user_id=eq.${userId}`, { method: 'DELETE' });
    await rest(`profiles?id=eq.${userId}`, { method: 'DELETE' });

    // Auth user last — cascades user_preferences, push_subscriptions,
    // consumption_events, ai_usage, invite_tokens.created_by.
    const delRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: svc,
    });
    if (!delRes.ok) {
      const detail = await delRes.text().catch(() => '');
      console.error('auth user delete failed:', delRes.status, detail);
      return json(500, { message: 'Could not delete account — contact support' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('delete-account failed:', err);
    return json(500, { message: 'Could not delete account — contact support' });
  }
}
