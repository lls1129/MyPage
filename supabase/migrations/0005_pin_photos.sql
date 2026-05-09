-- Add a `photo_ids` array column so admins can attach existing photos
-- (from the /photos album) to a pin. Stored as a uuid[] for simplicity;
-- if cardinality grows, we can split this into a join table later.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table pins
  add column if not exists photo_ids uuid[] default '{}' not null;

-- GIN index lets us search "pins containing photo X" quickly later.
create index if not exists pins_photo_ids_idx on pins using gin (photo_ids);
