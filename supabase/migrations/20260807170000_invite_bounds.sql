-- The invite INSERT policy only checked WHO was creating the token, never the
-- token's own terms. The 7-day expiry and 10-use cap were column DEFAULTS, so
-- a member posting straight to PostgREST could supply
--   { expires_at: '2099-01-01', max_uses: 1000000, use_count: -5 }
-- and mint a permanent, effectively unlimited invite to a shared household —
-- defaults are not a security boundary.
--
-- Enforce the bounds in the constraint layer, where a client cannot opt out.
alter table public.invite_tokens
  drop constraint if exists invite_tokens_bounds;

alter table public.invite_tokens
  add constraint invite_tokens_bounds check (
    max_uses between 1 and 50
    and use_count >= 0
    and expires_at > created_at
    and expires_at <= created_at + interval '30 days'
  );

-- Redemption still needs to increment use_count, which the WITH CHECK on an
-- UPDATE policy would otherwise have to allow loosely; redeem_pantry_invite is
-- SECURITY DEFINER and is the only writer, so no UPDATE policy is granted to
-- clients at all. (Verified: no "for update" policy exists on this table.)
