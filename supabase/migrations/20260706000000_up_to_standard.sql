-- Up-to-standard migration: server-side AI quotas, cross-device preferences,
-- household consumption log, and atomic multi-item writes.
--
-- Apply via the Supabase dashboard (SQL Editor → paste → Run) or `supabase db push`.
-- Everything is idempotent-ish (IF NOT EXISTS / OR REPLACE) so re-running is safe.

-- ---------------------------------------------------------------------------
-- Helper: membership check usable inside RLS policies without recursion.
-- SECURITY DEFINER so it can read pantry_members regardless of that table's
-- own policies; search_path pinned per Supabase lint guidance.
-- ---------------------------------------------------------------------------
create or replace function public.is_pantry_member(p_pantry uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from pantry_members
    where pantry_id = p_pantry and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_pantry_member(uuid) from anon;

-- ---------------------------------------------------------------------------
-- AI quota: server-side token bucket consumed by netlify/functions/gemini.mjs.
-- One row per (user, bucket); the RPC is the only access path (no policies).
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  tokens double precision not null,
  last_refill timestamptz not null default now(),
  primary key (user_id, bucket)
);

alter table public.ai_usage enable row level security;

-- The quota table is hardcoded HERE, not taken from the caller. An earlier
-- version derived the refill rate from p_capacity/p_window_seconds, which any
-- authenticated user could call directly (POST /rest/v1/rpc/consume_ai_quota
-- with p_capacity=1000, p_window_seconds=60) to refill their own bucket at
-- ~17 tokens/sec and bypass the shared-tier limit. Now the args are ignored:
-- calling the RPC directly gives you exactly the same rate the proxy uses, so
-- there's nothing to game. Keep these in sync with QUOTAS in gemini.mjs.
create or replace function public.consume_ai_quota(
  p_bucket text,
  p_capacity int default null,   -- ignored; kept for call-site compatibility
  p_window_seconds int default null  -- ignored
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_capacity int;
  v_window int;
  v_rate double precision;
  v_row ai_usage%rowtype;
  v_tokens double precision;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Server-authoritative per-bucket quota. Unknown buckets are denied.
  case p_bucket
    when 'receipts_project' then v_capacity := 5;  v_window := 3600;
    when 'recipes_project'  then v_capacity := 15; v_window := 3600;
    else
      return jsonb_build_object('allowed', false, 'reason', 'unknown_bucket');
  end case;

  v_rate := v_capacity::double precision / v_window;

  insert into ai_usage (user_id, bucket, tokens, last_refill)
  values (v_user, p_bucket, v_capacity, now())
  on conflict (user_id, bucket) do nothing;

  select * into v_row from ai_usage
  where user_id = v_user and bucket = p_bucket
  for update;

  -- Linear refill, capped at capacity (also clamps any inflated value a user
  -- could have written by calling this RPC directly with a huge p_capacity).
  v_tokens := least(
    v_capacity::double precision,
    v_row.tokens + extract(epoch from (now() - v_row.last_refill)) * v_rate
  );

  if v_tokens >= 1 then
    update ai_usage set tokens = v_tokens - 1, last_refill = now()
    where user_id = v_user and bucket = p_bucket;
    return jsonb_build_object('allowed', true, 'remaining', floor(v_tokens - 1));
  end if;

  update ai_usage set tokens = v_tokens, last_refill = now()
  where user_id = v_user and bucket = p_bucket;
  return jsonb_build_object(
    'allowed', false,
    'retry_after_seconds', ceil((1 - v_tokens) / v_rate)
  );
end;
$$;

revoke execute on function public.consume_ai_quota(text, int, int) from anon;

-- ---------------------------------------------------------------------------
-- Cross-device user preferences (pins, recipe favorites, diet).
-- pinned_items mirrors the localStorage shape: { "<pantryId>": ["<itemId>", ...] }
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  diet text not null default 'all',
  favorite_recipes jsonb not null default '[]'::jsonb,
  pinned_items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "own prefs select" on public.user_preferences;
create policy "own prefs select" on public.user_preferences
  for select using (user_id = auth.uid());
drop policy if exists "own prefs insert" on public.user_preferences;
create policy "own prefs insert" on public.user_preferences
  for insert with check (user_id = auth.uid());
drop policy if exists "own prefs update" on public.user_preferences;
create policy "own prefs update" on public.user_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Household consumption log. Append-only; every member of the pantry can read
-- it, so streaks / savings / the activity feed agree across devices and
-- housemates. client_id carries the old localStorage event id so the one-time
-- migration is idempotent.
-- ---------------------------------------------------------------------------
create table if not exists public.consumption_events (
  id uuid primary key default gen_random_uuid(),
  pantry_id uuid not null references public.pantries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text,
  item_name text not null,
  category text,
  qty double precision not null default 1,
  unit text,
  reason text not null check (reason in ('used', 'wasted', 'donated', 'other')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists consumption_events_pantry_created_idx
  on public.consumption_events (pantry_id, created_at desc);
-- Dedupe key for the client's retry-safe upsert (onConflict: 'pantry_id,client_id').
-- Must be a NON-partial unique index/constraint: Postgres can only pick a partial
-- index as an ON CONFLICT arbiter when the statement repeats its WHERE predicate,
-- which PostgREST cannot emit — a `where client_id is not null` index makes every
-- upsert fail with 42P10. A plain unique index is inferable; NULL client_ids stay
-- non-conflicting (NULLs distinct) and the client always sets client_id anyway.
alter table public.consumption_events
  drop constraint if exists consumption_events_pantry_client_key;
alter table public.consumption_events
  add constraint consumption_events_pantry_client_key unique (pantry_id, client_id);

alter table public.consumption_events enable row level security;

drop policy if exists "members read events" on public.consumption_events;
create policy "members read events" on public.consumption_events
  for select using (is_pantry_member(pantry_id));
drop policy if exists "members insert own events" on public.consumption_events;
create policy "members insert own events" on public.consumption_events
  for insert with check (user_id = auth.uid() and is_pantry_member(pantry_id));

-- Live activity feed: let realtime broadcast inserts to subscribed members.
do $$
begin
  alter publication supabase_realtime add table public.consumption_events;
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic receipt import: all items land or none do. SECURITY INVOKER (default)
-- so the existing pantry_items RLS still applies to every insert; the plpgsql
-- body just gives us one transaction instead of N racing client calls.
-- ---------------------------------------------------------------------------
create or replace function public.import_receipt_items(p_pantry uuid, p_items jsonb)
returns int
language plpgsql
set search_path = public
as $$
declare
  v jsonb;
  v_name text;
  v_count int := 0;
begin
  if not is_pantry_member(p_pantry) then
    raise exception 'not a member of this pantry';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;

  for v in select * from jsonb_array_elements(p_items) loop
    v_name := trim(coalesce(v->>'name', ''));
    if v_name = '' then
      raise exception 'item name cannot be blank';
    end if;
    insert into pantry_items (pantry_id, area_id, name, category, quantity, unit, expiration_date, notes)
    values (
      p_pantry,
      nullif(v->>'area_id', '')::uuid,
      v_name,
      coalesce(nullif(v->>'category', ''), 'other'),
      coalesce((v->>'quantity')::double precision, 1),
      coalesce(nullif(v->>'unit', ''), 'pcs'),
      nullif(v->>'expiration_date', '')::date,
      coalesce(v->>'notes', '')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.import_receipt_items(uuid, jsonb) from anon;

-- ---------------------------------------------------------------------------
-- Atomic move-to-pantry. p_moves: [{ "id": "<shopping_item uuid>",
-- "expiration_date": "YYYY-MM-DD" | "" }] — expiration is computed client-side
-- where the category→shelf-life mapping lives. Rows that aren't checked (or
-- were already moved by a housemate) are skipped, not errors.
-- ---------------------------------------------------------------------------
create or replace function public.move_checked_to_pantry(p_pantry uuid, p_moves jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v jsonb;
  r shopping_items%rowtype;
  v_moved int := 0;
begin
  if not is_pantry_member(p_pantry) then
    raise exception 'not a member of this pantry';
  end if;
  if jsonb_typeof(p_moves) <> 'array' then
    raise exception 'p_moves must be a JSON array';
  end if;

  for v in select * from jsonb_array_elements(p_moves) loop
    select * into r from shopping_items
    where id = (v->>'id')::uuid and pantry_id = p_pantry and is_checked
    for update;
    if not found then
      continue;
    end if;

    insert into pantry_items (pantry_id, name, category, quantity, unit, expiration_date, notes)
    values (
      p_pantry,
      r.name,
      coalesce(r.category, 'other'),
      coalesce(r.quantity, 1),
      coalesce(r.unit, 'pcs'),
      nullif(v->>'expiration_date', '')::date,
      ''
    );
    delete from shopping_items where id = r.id;
    v_moved := v_moved + 1;
  end loop;

  return jsonb_build_object('moved', v_moved, 'failed', 0);
end;
$$;

revoke execute on function public.move_checked_to_pantry(uuid, jsonb) from anon;
