-- Per-photo overlays (stickers / captions / highlights / drawings).
--
-- Same jsonb shape as albums.cover_overlays (migration 0019) — the
-- renderer runs each entry through the same normalizeOverlays
-- helper. Default '[]' so existing rows render with no overlays.
--
-- Photos AND astrophotos get the column so both upload flows can
-- decorate each photo independently of the album's overlays.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table photos
  add column if not exists cover_overlays jsonb default '[]' not null;

alter table astrophotos
  add column if not exists cover_overlays jsonb default '[]' not null;
