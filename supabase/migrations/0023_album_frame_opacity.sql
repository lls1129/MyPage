-- Album-level frame opacity.
--
-- A scalar 0..1 applied to the cover's frame overlay. Lets admin
-- soften a bold mat or polaroid border without having to redesign
-- the preset itself. NULL / missing column → renderer treats as 1
-- (fully opaque), matching pre-0023 behavior.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists cover_frame_opacity numeric;
