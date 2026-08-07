-- Observability. Before this, a production crash was undetectable by the
-- owner: the ErrorBoundary showed a friendly screen and console.error'd into
-- a browser nobody was watching. No Sentry, no logging, no signal at all.
--
-- Deliberately minimal and self-hosted: no third-party processor to add to the
-- privacy policy, no new dependency, no cost. Writes are insert-only from the
-- client; nobody can read them back through the API (dashboard/service role
-- only), so one user's stack traces can never leak to another.
create table if not exists public.error_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,                 -- 'render' | 'unhandled' | 'rejection'
  message text not null,
  stack text,
  component_stack text,
  route text,
  user_agent text,
  app_version text
);

create index if not exists error_reports_created_at_idx
  on public.error_reports (created_at desc);

alter table public.error_reports enable row level security;

-- Insert-only, including for anonymous visitors (the landing page can crash
-- too). No select/update/delete policy exists, so the table is write-only
-- from the client's perspective.
drop policy if exists "anyone may report an error" on public.error_reports;
create policy "anyone may report an error" on public.error_reports
  for insert to anon, authenticated with check (true);
