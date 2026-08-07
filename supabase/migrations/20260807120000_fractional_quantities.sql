-- Fractional quantities. The UI has always offered half-steps (quantity input
-- step="0.5", the "Use some" sheet, recipe deductions) and consumption_events
-- already stores qty as double precision — but pantry_items.quantity and
-- shopping_items.quantity were integer, so every fractional save was rejected
-- by Postgres with "invalid input syntax for type integer".
--
-- numeric (not float) so 0.5 steps stay exact and never drift.
alter table public.pantry_items
  alter column quantity type numeric using quantity::numeric;

alter table public.shopping_items
  alter column quantity type numeric using quantity::numeric;
