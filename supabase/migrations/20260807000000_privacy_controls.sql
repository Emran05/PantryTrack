-- ---------------------------------------------------------------------------
-- CCPA/CPRA Do-Not-Sell-or-Share opt-out. One flag per user, synced through
-- user_preferences like every other preference so it follows the account, not
-- the device. The client also honors the GPC browser signal at read time.
-- ---------------------------------------------------------------------------
alter table public.user_preferences
  add column if not exists do_not_sell boolean not null default false;
