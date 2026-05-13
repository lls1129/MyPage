-- Album cover history (cross-device).
--
-- Persists the recently-pinned cover URLs and recently-applied crops
-- on the album row itself, so admin sees the same recent list on any
-- device. Previously lived in localStorage (per-browser).
--
-- Shape:
--   [
--     { "url": "https://…", "crops": [{ "x": 0.1, "y": 0.05, "w": 0.4, "h": 0.6 }, …] },
--     …
--   ]
--
-- Cap (12 URLs × 6 crops each) is enforced in application code, not
-- in the schema — keeps the column type simple.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists cover_history jsonb default '[]'::jsonb not null;
