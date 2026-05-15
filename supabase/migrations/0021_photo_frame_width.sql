-- Per-photo frame thickness.
--
-- Three-state semantics matching cover_frame / cover_filter on a
-- photo row:
--   null  → inherit the album's width
--   ''    → reserved (no override; behaves the same as null)
--   value → explicit override (one of thin / medium / thick)
--
-- Default null (inherit) so existing rows render unchanged.
-- Unknown values fall back to "medium" in the renderer.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table photos
  add column if not exists cover_frame_width text default null;

alter table astrophotos
  add column if not exists cover_frame_width text default null;
