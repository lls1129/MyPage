-- Album title placement.
--
-- Where the album's name + count chip render on the album card.
-- Values:
--   below       (default) — strip below the cover, no overlap
--   caption-bar           — tinted strip below the cover, polaroid-style
--   corner                — small chip overlaid in the cover's bottom-left
--   stacked               — two-row strip (name on top, count on its own row)
--   hover                 — gradient overlay on the cover, visible on hover
--
-- Unknown values fall back to "below" in the renderer so a typo or
-- stale row can't blank the title.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table albums
  add column if not exists title_placement text default 'below' not null;
