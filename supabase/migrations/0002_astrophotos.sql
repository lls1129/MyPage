-- Astrophotos table: a sibling of `photos` with technical metadata for
-- astrophotography (telescope / mount / camera / exposure stack / processing).
-- Kept separate from `photos` so the visitor album and the astronomy hub can
-- query independently and so the schema can grow without coupling.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists astrophotos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  object_name text not null default '',
  caption text default '' not null,
  taken_at timestamptz,
  hidden boolean default false not null,
  width int,
  height int,

  -- Technical / equipment metadata. Free-text for v1; can split into
  -- structured columns later (exposure_seconds, frame_count, filters[]) if
  -- we ever want to filter by them.
  telescope text,
  mount text,
  camera text,
  exposure_stack text,
  processing text,
  location text,

  created_at timestamptz default now() not null
);

create index if not exists astrophotos_created_at_idx on astrophotos (created_at desc);

alter table astrophotos enable row level security;

drop policy if exists "public can read non-hidden astrophotos" on astrophotos;
create policy "public can read non-hidden astrophotos" on astrophotos
  for select
  using (hidden = false);
