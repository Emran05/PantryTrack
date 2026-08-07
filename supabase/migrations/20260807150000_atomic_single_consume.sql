-- Single-item consumption ("Use some" on a card) still did a client-side
-- SELECT then a separate UPDATE with no lock: two housemates using the same
-- shared item concurrently both read the same starting quantity and the second
-- write silently overwrites the first. The multi-item recipe path already got
-- consume_pantry_items; this closes the same hole on the far more common
-- single-item path.
--
-- Implemented on top of the existing multi-item function so the semantics
-- (row lock, 2dp rounding, delete at zero) can never drift between them.
create or replace function public.consume_pantry_item_atomic(
  p_pantry_id uuid,
  p_item_id uuid,
  p_qty numeric
)
returns table (item_id uuid, item_name text, prev_qty numeric, new_qty numeric, removed boolean)
language sql security definer
set search_path = public
as $$
  select * from public.consume_pantry_items(
    p_pantry_id,
    jsonb_build_array(jsonb_build_object('id', p_item_id, 'qty', p_qty))
  );
$$;

grant execute on function public.consume_pantry_item_atomic(uuid, uuid, numeric) to authenticated;
