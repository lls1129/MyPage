-- Per-photo manual sort order.
--
-- Numeric so we can interleave inserts without renumbering the
-- whole list (we'll typically space these out by 10s — 10, 20, 30
-- — and bisect when admin drops a photo between two neighbors).
--
-- Default 0 so existing rows compare equal until admin chooses
-- manual sort; in any other sort mode the column is ignored.
--
-- Added to both photos and astrophotos so the same UI can reorder
-- either library.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table photos
  add column if not exists sort_order numeric default 0 not null;

alter table astrophotos
  add column if not exists sort_order numeric default 0 not null;
