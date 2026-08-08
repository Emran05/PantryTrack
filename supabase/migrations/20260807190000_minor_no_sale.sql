-- CCPA/CPRA §1798.120(c): selling or sharing the personal information of a
-- consumer under 16 requires affirmative opt-IN. The app collected no age
-- signal at all, so every account defaulted to do_not_sell = false — meaning a
-- 14-year-old was opted INTO the sale by default. Holding no age signal is also
-- itself the statutory trigger for "willfully disregards the consumer's age".
--
-- Data minimisation on purpose: we do NOT store a date of birth. The client
-- computes the age band at signup and sends only the boolean. A DOB would be
-- more sensitive PI than the question needs, and we would then have to disclose
-- and protect it.

alter table public.user_preferences
  add column if not exists is_under_16 boolean not null default false;

-- A minor's opt-out is not theirs to toggle off — it is the legal default until
-- they are old enough to opt in. Enforced in the constraint layer because a
-- client-side check is not a boundary: anyone can POST to PostgREST directly.
alter table public.user_preferences
  drop constraint if exists minors_are_never_sold;

alter table public.user_preferences
  add constraint minors_are_never_sold
  check (not (is_under_16 and do_not_sell = false));

-- Existing rows predate any age signal, so their band is unknown. Leaving them
-- false is the honest state (we genuinely do not know), not an assertion that
-- they are adults. The signup path sets it going forward; Settings should ask
-- existing users once. Flagged in BUGSTACK rather than silently backfilled.

comment on column public.user_preferences.is_under_16 is
  'Age band only, never a date of birth. True forces do_not_sell and cannot be cleared while true (see minors_are_never_sold).';
