-- Album cover frame width.
--
-- Adds a small-ish text column whose value picks one of the size
-- variants defined per-preset in app/components/cover-decorations.ts.
-- Default "medium" matches what's already shipped today so existing
-- rows render unchanged. Unknown values fall back to medium in the
-- renderer.
--
-- Width is intentionally album-only for now — photos that override
-- the frame still inherit the album's width. We can add a per-photo
-- size column later if that ever feels limiting.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists cover_frame_width text default 'medium' not null;
