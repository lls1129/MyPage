-- Album cover decorations: frame + filter.
--
-- - cover_frame: nullable preset id ("soft" | "dashed" | "mat" | ...)
--   that the renderer maps to a Tailwind class. Null = no frame.
-- - cover_filter: nullable preset id ("warm" | "mono" | "dreamy" | …)
--   that the renderer maps to a CSS filter value. Null = no filter.
--
-- IDs live in app code (app/components/cover-decorations.ts) so we
-- can add presets without touching the schema. Bad IDs are ignored
-- by the renderer (treated as null).
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists cover_frame text default null,
  add column if not exists cover_filter text default null;
