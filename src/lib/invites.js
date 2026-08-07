// Invite links — the consumer-grade replacement for pasting raw Home IDs.
// A link looks like https://pantrysnap.netlify.app/join/<token>; tokens live
// in invite_tokens (7-day expiry, 10 uses) and are redeemed by the
// redeem_pantry_invite RPC. Backed by supabase/migrations/…_invites_and_push.sql.

import { supabase } from './supabase';

// localStorage key holding an invite token seen while signed out; App.jsx
// resumes the join after login. localStorage, not sessionStorage: the
// email-confirmation signup path opens a NEW tab, and the invite must
// survive that hop. Tokens expire server-side (7 days), so a stale
// leftover just fails the redeem cleanly.
export const PENDING_INVITE_KEY = 'pantry_pending_invite';

export function isMissingInviteSchema(error) {
  return error?.code === '42P01' || error?.code === 'PGRST202' || error?.code === 'PGRST205';
}

/** Create a shareable link for a pantry. Returns { url, expiresAt }. */
export async function createInviteLink(pantryId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const { data, error } = await supabase
    .from('invite_tokens')
    .insert({ pantry_id: pantryId, created_by: user.id })
    .select('token, expires_at')
    .single();
  if (error) throw error;

  return {
    url: `${window.location.origin}/join/${data.token}`,
    expiresAt: data.expires_at,
  };
}

/**
 * Redeem an invite token. Returns the RPC payload:
 * { ok, reason?, already_member?, pantry_id?, pantry_name? }
 */
export async function redeemInvite(token) {
  const { data, error } = await supabase.rpc('redeem_pantry_invite', { p_token: token });
  if (error) throw error;
  return data;
}
