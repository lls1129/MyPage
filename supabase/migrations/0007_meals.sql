-- Meals library for the homepage widget + the /meals picker. Admin-curated;
-- TheMealDB is used as a "surprise me" fallback in the picker itself.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text default '' not null,
  glyph text default '' not null,
  moods text[] default '{}' not null,
  cuisine text default '' not null,
  time_minutes int,
  ingredients text[] default '{}' not null,
  image_url text,
  hidden boolean default false not null,
  created_at timestamptz default now() not null
);

create index if not exists meals_created_at_idx on meals (created_at desc);
create index if not exists meals_moods_idx on meals using gin (moods);
create index if not exists meals_ingredients_idx on meals using gin (ingredients);

alter table meals enable row level security;

drop policy if exists "public can read non-hidden meals" on meals;
create policy "public can read non-hidden meals" on meals
  for select
  using (hidden = false);
