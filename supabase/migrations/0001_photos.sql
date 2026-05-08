-- Photos table for the /photos section.
-- Storage bucket integration arrives in the upload milestone; for now
-- image_url holds any publicly accessible URL (Supabase Storage public URLs
-- and external CDN URLs both work).
--
-- Run this once in Supabase Dashboard → SQL Editor.
-- Safe to re-run.

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text default '' not null,
  tags text[] default '{}' not null,
  hidden boolean default false not null,
  width int,
  height int,
  taken_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists photos_created_at_idx on photos (created_at desc);
create index if not exists photos_tags_idx on photos using gin (tags);

alter table photos enable row level security;

-- Public can read non-hidden rows. No write access via the anon key — admin
-- writes will go through the server with the service-role key in the upload
-- milestone.
drop policy if exists "public can read non-hidden photos" on photos;
create policy "public can read non-hidden photos" on photos
  for select
  using (hidden = false);
