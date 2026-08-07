-- Atomic multi-item consumption for "I cooked this".
--
-- The client previously fired one write per ingredient via Promise.allSettled,
-- so a single failure left the pantry half-deducted — some ingredients spent,
-- others not, with no way to tell which. Recipes deduct several items at once,
-- so it has to be all-or-nothing.
--
-- Mirrors consumePantryItem's semantics exactly: round to 2dp, delete the row
-- when it reaches 0, otherwise update. Returns one row per item so the client
-- can still report which finished.
create or replace function public.consume_pantry_items(p_pantry_id uuid, p_items jsonb)
returns table (item_id uuid, item_name text, prev_qty numeric, new_qty numeric, removed boolean)
language plpgsql security definer
set search_path = public
as $$
declare
  v jsonb;
  v_id uuid;
  v_amount numeric;
  v_prev numeric;
  v_next numeric;
  v_name text;
begin
  if not is_pantry_member(p_pantry_id) then
    raise exception 'not a member of this pantry';
  end if;

  for v in select * from jsonb_array_elements(p_items)
  loop
    v_id := (v->>'id')::uuid;
    v_amount := coalesce((v->>'qty')::numeric, 0);
    if v_amount <= 0 then
      raise exception 'consume amount must be positive for item %', v_id;
    end if;

    -- Lock the row so concurrent cooks can't both read the same starting qty.
    select quantity, name into v_prev, v_name
    from pantry_items
    where id = v_id and pantry_id = p_pantry_id
    for update;

    if v_prev is null then
      raise exception 'item % not found in this pantry', v_id;
    end if;

    v_next := greatest(0, round(v_prev - v_amount, 2));

    if v_next = 0 then
      delete from pantry_items where id = v_id;
      item_id := v_id; item_name := v_name; prev_qty := v_prev; new_qty := 0; removed := true;
    else
      update pantry_items set quantity = v_next where id = v_id;
      item_id := v_id; item_name := v_name; prev_qty := v_prev; new_qty := v_next; removed := false;
    end if;
    return next;
  end loop;
end;
$$;

grant execute on function public.consume_pantry_items(uuid, jsonb) to authenticated;
