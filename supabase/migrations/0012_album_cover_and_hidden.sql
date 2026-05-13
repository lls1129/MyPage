-- Album cover override + per-album hide.
--
-- - cover_image_url: when set, the library page uses this URL as the
--   album's cover instead of auto-picking the most recent photo.
--   Lets admin pin a specific image, and lets empty albums have a
--   meaningful cover too. Stays null until admin sets one.
-- - hidden: when true, the album is invisible to public visitors.
--   Behaves like photos.hidden — admin sees them with a visual badge.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists cover_image_url text,
  add column if not exists hidden boolean default false not null;

create index if not exists albums_hidden_idx
  on albums (hidden) where hidden;

drop policy if exists "public can read albums" on albums;
drop policy if exists "public can read non-hidden albums" on albums;
create policy "public can read non-hidden albums" on albums
  for select
  using (hidden = false);
