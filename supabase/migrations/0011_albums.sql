-- Albums: group photos / astrophotos into named collections.
--
-- Design:
-- - One albums table for both libraries (and future ones like pets);
--   `kind` discriminates which library it belongs to. (slug, kind)
--   is unique so /photos/album/foo and /astronomy/album/foo can
--   independently exist.
-- - `photos.album_id` and `astrophotos.album_id` are nullable
--   foreign keys. Existing rows stay null → they render in the
--   "uncategorized" grid on the library page, preserving the current
--   flat view as the fallback.
-- - ON DELETE SET NULL so deleting an album doesn't delete its
--   photos — they fall back to uncategorized.
-- - Cover photo is computed at read time (the album's most recent
--   non-hidden photo). No explicit cover_photo_id column for v1.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  kind text not null check (kind in ('photos', 'astrophotos')),
  created_at timestamptz default now() not null,
  unique (kind, slug)
);

create index if not exists albums_kind_idx on albums (kind);

alter table albums enable row level security;

drop policy if exists "public can read albums" on albums;
create policy "public can read albums" on albums
  for select using (true);

-- Add album_id FK to photos.
alter table photos
  add column if not exists album_id uuid
    references albums(id) on delete set null;

create index if not exists photos_album_idx
  on photos (album_id) where album_id is not null;

-- Same for astrophotos.
alter table astrophotos
  add column if not exists album_id uuid
    references albums(id) on delete set null;

create index if not exists astrophotos_album_idx
  on astrophotos (album_id) where album_id is not null;
