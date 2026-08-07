-- profiles was world-readable. The SELECT policy was USING (true) and the anon
-- role held GRANT ALL, while the anon key ships literally in the client bundle
-- (src/lib/supabase.js:11). One unauthenticated REST call returned every row.
-- Verified against production before this migration: 14 profiles readable with
-- no session. The table holds first_name, last_name and venmo_handle — a legal
-- name and a financial-account identifier — so this was a live PII exposure,
-- and it contradicted the public claim that nothing maps back to an account.
--
-- Every other table was fine: pantry_items and pantries both returned zero rows
-- to the same anonymous caller. This policy was the single outlier.

-- Helper is SECURITY DEFINER on purpose. A policy on profiles that reads
-- pantry_members would otherwise re-enter RLS on that table, and pantry_members'
-- own policies reference profiles — that is a recursion loop. Running the lookup
-- as the definer breaks the cycle. STABLE so the planner may cache it per row.
create or replace function public.shares_pantry_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pantry_members me
    join pantry_members them on them.pantry_id = me.pantry_id
    where me.user_id = auth.uid()
      and them.user_id = p_other
  );
$$;

revoke all on function public.shares_pantry_with(uuid) from public, anon;
grant execute on function public.shares_pantry_with(uuid) to authenticated;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;

-- Scoped to exactly what the app reads: your own profile (getProfile), and your
-- housemates' names/Venmo for the member list (supabaseStorage.js:145). Nothing
-- in the product needs a stranger's profile.
create policy "Profiles are viewable by self and housemates"
  on public.profiles for select
  using (id = auth.uid() or public.shares_pantry_with(id));

-- The anon role has no reason to touch this table at all: a profile row is only
-- ever created or read once a session exists.
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;
