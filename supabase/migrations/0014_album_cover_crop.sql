-- Album cover cropping.
--
-- Replaces the focal-point fields (0013) with a square crop rectangle
-- normalized to source dimensions. The UI enforces a square-in-source-
-- pixels crop (so cover_crop_w * source_W == cover_crop_h * source_H);
-- the renderer trusts that constraint. Default (0,0,1,1) is the
-- "no crop set" sentinel — renderer falls back to object-cover, which
-- handles unknown source aspect ratios gracefully.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums drop column if exists cover_focal_x;
alter table albums drop column if exists cover_focal_y;

alter table albums
  add column if not exists cover_crop_x numeric(6,4) default 0 not null,
  add column if not exists cover_crop_y numeric(6,4) default 0 not null,
  add column if not exists cover_crop_w numeric(6,4) default 1 not null,
  add column if not exists cover_crop_h numeric(6,4) default 1 not null;
