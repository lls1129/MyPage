-- Album cover focal point.
--
-- The album cover is rendered into a square card with object-cover, so
-- by default the framing is centered. Admin can click anywhere on the
-- cover preview to set a focal point — these columns store that as
-- percentages 0-100, applied via CSS object-position. Defaults to
-- (50, 50) = center, which matches the prior centered behavior.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists cover_focal_x numeric(5,2) default 50 not null,
  add column if not exists cover_focal_y numeric(5,2) default 50 not null;
