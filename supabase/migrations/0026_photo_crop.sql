-- Per-photo crop.
--
-- Same shape as the album cover's crop columns (migration 0014):
-- four numerics in source-relative units (0..1) marking the
-- top-left corner + width + height of the crop rectangle.
--
-- Default (0, 0, 1, 1) = "no crop set" — renderer treats this as
-- trivial and shows the full photo. Per-photo crops do NOT need
-- to be square (the album cover's crop is locked to square because
-- of the aspect-square card; per-photo crops are free-form so admin
-- can trim arbitrary edges).
--
-- Added to both photos and astrophotos so either upload flow can
-- crop before publishing.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table photos
  add column if not exists crop_x numeric default 0 not null,
  add column if not exists crop_y numeric default 0 not null,
  add column if not exists crop_w numeric default 1 not null,
  add column if not exists crop_h numeric default 1 not null;

alter table astrophotos
  add column if not exists crop_x numeric default 0 not null,
  add column if not exists crop_y numeric default 0 not null,
  add column if not exists crop_w numeric default 1 not null,
  add column if not exists crop_h numeric default 1 not null;
