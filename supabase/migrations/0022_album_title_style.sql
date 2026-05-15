-- Album title-strip styling overrides.
--
-- Bag of optional knobs applied to the title placement chosen via
-- albums.title_placement (migration 0020). Shape:
--   { radius?: string,     -- Tailwind rounded class, e.g. "rounded-md"
--     size?:   "sm"|"md"|"lg",
--     opacity?: number }   -- 0..1, applied to caption-bar bg
--
-- Renderer falls back to per-placement defaults for any missing
-- field so existing rows ({}) render unchanged.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists title_style jsonb default '{}' not null;
