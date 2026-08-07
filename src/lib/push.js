// Web-push plumbing for expiry notifications.
//
// Client side: subscribe this browser via the PushManager and store the
// endpoint in push_subscriptions. Server side: the scheduled function
// netlify/functions/expiry-notifications.mjs reads those rows daily and sends
// "your milk expires tomorrow" pushes signed with the VAPID keys.
//
// Requires VITE_VAPID_PUBLIC_KEY at build time (see .env.example). The service
// worker (public/sw.js) owns the push/notificationclick handlers.

import { supabase } from './supabase';

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isPushConfigured() {
  return !!PUBLIC_KEY;
}

// 'unsupported' (API absent — e.g. iOS Safari not installed to Home Screen),
// or the real Notification.permission ('default' | 'granted' | 'denied').
// Callers must distinguish "no API" from "user said no" to show the right hint.
export function getNotificationPermission() {
  return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
}

// PushManager wants the VAPID key as a Uint8Array, not base64url.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// getRegistration (not .ready) — .ready never resolves in `vite dev`, where
// main.jsx skips SW registration entirely.
async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.getRegistration();
}

/** The browser's current subscription, or null. */
export async function getExistingSubscription() {
  const reg = await getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Ask permission, subscribe this browser, and store the endpoint.
 * Throws coded errors: PUSH_UNSUPPORTED, PUSH_UNCONFIGURED, PUSH_NO_SW,
 * PUSH_DENIED.
 */
export async function enablePushNotifications() {
  const fail = (message, code) => {
    const err = new Error(message);
    err.code = code;
    throw err;
  };

  if (!isPushSupported()) fail('This browser doesn\'t support notifications', 'PUSH_UNSUPPORTED');
  if (!PUBLIC_KEY) fail('Push isn\'t configured for this build', 'PUSH_UNCONFIGURED');

  const reg = await getRegistration();
  if (!reg) fail('No service worker — notifications only work in the installed/production app', 'PUSH_NO_SW');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') fail('Notifications are blocked for this site', 'PUSH_DENIED');

  // Auth check BEFORE the irreversible browser subscribe.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) fail('Not logged in', 'PUSH_NO_USER');

  let sub = await reg.pushManager.getSubscription();
  const createdHere = !sub;
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  // RPC (not a plain upsert): a browser endpoint can already belong to another
  // account that used this browser, and ON CONFLICT DO UPDATE would trip RLS.
  // store_push_subscription reassigns the endpoint to the current user.
  const { error } = await supabase.rpc('store_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) {
    // Roll back a subscription we just created — otherwise the browser stays
    // subscribed with no server row, and the toggle lies "on" forever while
    // no notification can ever arrive.
    if (createdHere) await sub.unsubscribe().catch(() => {});
    throw error;
  }

  return sub;
}

/** Unsubscribe this browser and delete its stored endpoint. */
export async function disablePushNotifications() {
  const sub = await getExistingSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
