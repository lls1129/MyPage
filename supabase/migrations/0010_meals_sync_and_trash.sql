-- Sync TheMealDB picks across the admin's devices, sync favorites
-- alongside the rest of meal_status, and add a remove/undo trash flow.
--
-- (1) external_meal_snapshots: TheMealDB picks the admin has interacted
-- with (favorited, tried, rated, etc.). Snapshotting them into Postgres
-- means every device sees them, not just the one that fetched them.
--
-- (2) meal_status.favorited: favorites become DB-backed so they sync
-- across the admin's devices. Reads stay public; writes go through the
-- service-role client.
--
-- (3) removed_at on both meals + external_meal_snapshots: soft-delete.
-- Active rows have removed_at IS NULL. The picker's UI filters them
-- out and surfaces the most recent 3 trashed rows in an "undo" panel.
-- Server-side, removing a 4th row hard-purges the oldest.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists external_meal_snapshots (
  meal_id text primary key,
  name text not null,
  tagline text default '' not null,
  glyph text default '' not null,
  moods text[] default '{}' not null,
  cuisine text default '' not null,
  time_minutes int,
  ingredients text[] default '{}' not null,
  ingredients_detail text[] default '{}' not null,
  instructions text,
  image_url text,
  external_source text default 'themealdb' not null,
  removed_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists external_meal_snapshots_created_idx
  on external_meal_snapshots (created_at desc);
create index if not exists external_meal_snapshots_removed_idx
  on external_meal_snapshots (removed_at desc) where removed_at is not null;

alter table external_meal_snapshots enable row level security;

drop policy if exists "public can read external snapshots" on external_meal_snapshots;
create policy "public can read active external snapshots" on external_meal_snapshots
  for select using (removed_at is null);

-- Favorited bit on meal_status — admin write via service role, public read.
alter table meal_status
  add column if not exists favorited boolean default false not null;

create index if not exists meal_status_favorited_idx
  on meal_status (favorited) where favorited;

-- Soft-delete on library meals + update the public read policy so trash
-- is invisible to anonymous reads. Admin uses the service-role client and
-- bypasses RLS, so trash + restore actions still work.
alter table meals
  add column if not exists removed_at timestamptz;

create index if not exists meals_removed_idx
  on meals (removed_at desc) where removed_at is not null;

drop policy if exists "public can read non-hidden meals" on meals;
drop policy if exists "public can read active meals" on meals;
create policy "public can read active meals" on meals
  for select
  using (hidden = false and removed_at is null);
