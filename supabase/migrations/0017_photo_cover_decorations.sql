-- Per-photo cover decoration overrides.
--
-- Adds cover_frame + cover_filter to photos and astrophotos so admin
-- can decorate individual rows. NULL on a photo means "inherit the
-- album's setting" — the renderer falls back to album.cover_frame /
-- album.cover_filter when the photo's column is null. (Album setting
-- itself can also be null, in which case nothing renders.)
--
-- IDs match the album side (see 0016 + cover-decorations.ts).
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table photos
  add column if not exists cover_frame text default null,
  add column if not exists cover_filter text default null;

alter table astrophotos
  add column if not exists cover_frame text default null,
  add column if not exists cover_filter text default null;
