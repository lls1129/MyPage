-- Optional restaurant info on each meal — name + website + location
-- of a place where the user has tried this dish. Turns the meals
-- page into a light dining journal.
--
-- All nullable; meal cards just skip the restaurant strip when none
-- of the fields are set. Wikipedia / TheMealDB external snapshots
-- ignore these (their image_url comes from the source; the
-- restaurant slot is for the admin's own notes).
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table meals
  add column if not exists restaurant_name text,
  add column if not exists restaurant_url text,
  add column if not exists restaurant_location text;
