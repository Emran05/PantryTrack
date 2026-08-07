-- Retention features: real invite links and web-push subscriptions.
-- Apply after 20260706000000_up_to_standard.sql (needs is_pantry_member()).

-- ---------------------------------------------------------------------------
-- Invite links. A member creates a token; anyone signed-in who opens
-- /join/<token> redeems it via the SECURITY DEFINER RPC (the joiner isn't a
-- member yet, so RLS would hide the row from them — the RPC is their only path).
-- ---------------------------------------------------------------------------
create table if not exists public.invite_tokens (
  token uuid primary key default gen_random_uuid(),
  pantry_id uuid not null references public.pantries (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses int not null default 10,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invite_tokens enable row level security;

drop policy if exists "members read invites" on public.invite_tokens;
create policy "members read invites" on public.invite_tokens
  for select using (is_pantry_member(pantry_id));
drop policy if exists "members create invites" on public.invite_tokens;
create policy "members create invites" on public.invite_tokens
  for insert with check (created_by = auth.uid() and is_pantry_member(pantry_id));
drop policy if exists "members revoke invites" on public.invite_tokens;
create policy "members revoke invites" on public.invite_tokens
  for delete using (is_pantry_member(pantry_id));

create or replace function public.redeem_pantry_invite(p_token uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite invite_tokens%rowtype;
  v_name text;
  v_email text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite from invite_tokens where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_invite.use_count >= v_invite.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'exhausted');
  end if;

  select name into v_name from pantries where id = v_invite.pantry_id;

  if exists (
    select 1 from pantry_members
    where pantry_id = v_invite.pantry_id and user_id = v_user
  ) then
    return jsonb_build_object(
      'ok', true, 'already_member', true,
      'pantry_id', v_invite.pantry_id, 'pantry_name', v_name
    );
  end if;

  select email into v_email from auth.users where id = v_user;
  insert into pantry_members (pantry_id, user_id, email, role)
  values (v_invite.pantry_id, v_user, v_email, 'member');
  update invite_tokens set use_count = use_count + 1 where token = p_token;

  return jsonb_build_object(
    'ok', true, 'already_member', false,
    'pantry_id', v_invite.pantry_id, 'pantry_name', v_name
  );
end;
$$;

revoke execute on function public.redeem_pantry_invite(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Web-push subscriptions. One row per browser endpoint; the daily expiry
-- notifier (netlify/functions/expiry-notifications.mjs) reads these with the
-- service-role key, which bypasses RLS.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Store (or reassign) a subscription for the current user. A browser push
-- endpoint is per origin+service-worker, NOT per account, so when a second
-- user signs into the same browser the endpoint already belongs to the first
-- user. A plain upsert-on-endpoint would hit ON CONFLICT DO UPDATE against a
-- row the RLS UPDATE policy forbids → 42501. This SECURITY DEFINER function
-- claims the endpoint for whoever is signed in now.
create or replace function public.store_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user, p_endpoint, p_p256dh, p_auth);
end;
$$;

revoke execute on function public.store_push_subscription(text, text, text) from anon;
