-- Per-photo horizontal flip.
--
-- Boolean — applied alongside `rotation` as a CSS transform on
-- display. Source pixels stay untouched; renderers compose
-- scaleX(-1) when the column is true. Default false so existing
-- rows render unchanged.
--
-- Same column added to both photos and astrophotos so the upload
-- flow can flip either kind. NULL is treated as false by the
-- renderer (defensive — the default keeps the column non-null in
-- practice).
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table photos
  add column if not exists flipped boolean default false not null;

alter table astrophotos
  add column if not exists flipped boolean default false not null;
