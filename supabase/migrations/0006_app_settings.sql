-- Tiny site-wide key/value store for admin preferences that need to be
-- visible to all visitors (e.g. UI mode toggles). Reads are public; writes
-- go through admin server actions using the service-role key.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now() not null
);

alter table app_settings enable row level security;

drop policy if exists "public can read settings" on app_settings;
create policy "public can read settings" on app_settings
  for select
  using (true);
