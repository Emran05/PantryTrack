// Daily expiry reminders — "the single biggest waste-reduction lever"
// (FEATURE_POOL #4), finally real.
//
// Runs on Netlify's scheduler at 15:00 UTC (~8am PT). Finds pantry items
// expiring within the next 2 days, groups them per member, and web-pushes one
// notification per subscribed browser. public/sw.js renders it and deep-links
// back into the app.
//
// Env (Netlify dashboard):
//   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS to read items/members/subscriptions.
//   VITE_SUPABASE_URL         — already set for the build.
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT — web-push identity
//     (generate once: npx web-push generate-vapid-keys; subject is a mailto:).
//     VAPID_PUBLIC_KEY must equal the client's VITE_VAPID_PUBLIC_KEY.

import webpush from 'web-push';

export const config = { schedule: '0 15 * * *' };

const EXPIRY_WINDOW_DAYS = 2;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function supaGet(path, supabaseUrl, serviceKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

function formatItemLine(item, todayIso) {
  if (item.expiration_date === todayIso) return `${item.name} (today!)`;
  const days = Math.round(
    (new Date(item.expiration_date) - new Date(todayIso)) / 86400000
  );
  return days === 1 ? `${item.name} (tomorrow)` : `${item.name} (${days}d)`;
}

export default async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@pantrysnap.app';

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    console.warn('expiry-notifications: missing env (SUPABASE_SERVICE_ROLE_KEY / VAPID_*) — skipping run.');
    return new Response('unconfigured', { status: 200 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const today = isoDate(new Date());
  const horizon = isoDate(new Date(Date.now() + EXPIRY_WINDOW_DAYS * 86400000));

  // 1) Items expiring in [today, horizon]
  const items = await supaGet(
    `pantry_items?select=pantry_id,name,expiration_date&expiration_date=gte.${today}&expiration_date=lte.${horizon}`,
    supabaseUrl,
    serviceKey
  );
  if (!items.length) {
    console.log('expiry-notifications: nothing expiring — done.');
    return new Response('nothing expiring', { status: 200 });
  }

  const byPantry = new Map();
  for (const item of items) {
    if (!byPantry.has(item.pantry_id)) byPantry.set(item.pantry_id, []);
    byPantry.get(item.pantry_id).push(item);
  }

  // 2) Members of those pantries → per-user item lists (a user in two homes
  //    gets one combined notification).
  const pantryIds = [...byPantry.keys()].join(',');
  const members = await supaGet(
    `pantry_members?select=pantry_id,user_id&pantry_id=in.(${pantryIds})`,
    supabaseUrl,
    serviceKey
  );
  const byUser = new Map();
  for (const m of members) {
    if (!m.user_id) continue;
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id).push(...byPantry.get(m.pantry_id));
  }
  if (!byUser.size) return new Response('no members', { status: 200 });

  // 3) Their push subscriptions
  const userIds = [...byUser.keys()].join(',');
  const subs = await supaGet(
    `push_subscriptions?select=user_id,endpoint,p256dh,auth&user_id=in.(${userIds})`,
    supabaseUrl,
    serviceKey
  );
  if (!subs.length) {
    console.log('expiry-notifications: expiring items but no subscribers — done.');
    return new Response('no subscribers', { status: 200 });
  }

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    const userItems = byUser.get(sub.user_id) || [];
    if (!userItems.length) continue;

    const sorted = [...userItems].sort(
      (a, b) => new Date(a.expiration_date) - new Date(b.expiration_date)
    );
    const lines = sorted.slice(0, 3).map((i) => formatItemLine(i, today));
    const extra = sorted.length > 3 ? ` +${sorted.length - 3} more` : '';
    const payload = JSON.stringify({
      title: sorted.length === 1 ? 'Use it before you lose it 🥕' : `${sorted.length} items expiring soon 🥕`,
      body: lines.join(', ') + extra,
      url: '/',
      tag: 'pantry-expiry',
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err) {
      // 404/410 = the browser dropped this subscription — prune the row.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await fetch(
          `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
          {
            method: 'DELETE',
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          }
        ).catch(() => {});
        pruned++;
      } else {
        console.error(`push failed (${err.statusCode || 'network'}):`, err.message);
      }
    }
  }

  console.log(`expiry-notifications: sent ${sent}, pruned ${pruned}, users ${byUser.size}.`);
  return new Response(`sent ${sent}`, { status: 200 });
};
