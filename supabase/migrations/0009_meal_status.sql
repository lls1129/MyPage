-- Per-meal status: have I tried it, do I want to try it, rating + notes.
-- Keyed by meal_id (text) so library uuids and "themealdb-..." ids both
-- fit. Public-read so ratings + notes surface on the live site; admin
-- writes use the service-role client so no public write policy is needed.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists meal_status (
  meal_id text primary key,
  tried boolean default false not null,
  want_to_try boolean default false not null,
  rating smallint,
  notes text,
  updated_at timestamptz default now() not null,
  constraint meal_status_rating_range
    check (rating is null or (rating between 1 and 5))
);

create index if not exists meal_status_want_to_try_idx
  on meal_status (want_to_try) where want_to_try;
create index if not exists meal_status_tried_idx
  on meal_status (tried) where tried;

alter table meal_status enable row level security;

drop policy if exists "public can read meal status" on meal_status;
create policy "public can read meal status" on meal_status
  for select
  using (true);
