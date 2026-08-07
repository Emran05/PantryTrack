-- Homes could be created but never renamed, left, or deleted: a mistyped home
-- was permanent, and leaving a shared household was impossible from the app.
--
-- Two RPCs so the rules live server-side (a client-side delete would be gated
-- only by RLS, which cannot express "last member wins" or "keep at least one").

-- Rename: any member may rename the household they belong to.
create or replace function public.rename_pantry(p_pantry_id uuid, p_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_pantry_member(p_pantry_id) then
    raise exception 'not a member of this pantry';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'name cannot be blank';
  end if;
  update pantries set name = btrim(p_name) where id = p_pantry_id;
end;
$$;

-- Leave: remove yourself. If you were the last member the household (and
-- everything in it) goes with you — otherwise it would be orphaned forever,
-- invisible to everyone but still holding rows.
create or replace function public.leave_pantry(p_pantry_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_my_count int;
begin
  if not is_pantry_member(p_pantry_id) then
    raise exception 'not a member of this pantry';
  end if;

  -- Never strand a user with zero households; the app assumes one exists.
  select count(*) into v_my_count from pantry_members where user_id = auth.uid();
  if v_my_count <= 1 then
    raise exception 'you must belong to at least one home';
  end if;

  delete from pantry_members
  where pantry_id = p_pantry_id and user_id = auth.uid();

  select count(*) into v_remaining from pantry_members where pantry_id = p_pantry_id;
  if v_remaining = 0 then
    -- Sole member: take the household and its contents with us.
    delete from shopping_items where pantry_id = p_pantry_id;
    delete from pantry_items where pantry_id = p_pantry_id;
    delete from areas where pantry_id = p_pantry_id;
    delete from pantries where id = p_pantry_id;
    return 'deleted';
  end if;
  return 'left';
end;
$$;

grant execute on function public.rename_pantry(uuid, text) to authenticated;
grant execute on function public.leave_pantry(uuid) to authenticated;
