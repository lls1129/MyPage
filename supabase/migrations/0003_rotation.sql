-- Rotation column for both albums. Stored as an integer that's always one of
-- {0, 90, 180, 270} and applied display-only via CSS transform (the file
-- itself is never re-encoded).
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

alter table photos
  add column if not exists rotation int default 0 not null;

alter table astrophotos
  add column if not exists rotation int default 0 not null;

-- Constrain to right-angle values. Two-step ADD/DROP so it works on existing
-- databases too.
alter table photos drop constraint if exists photos_rotation_chk;
alter table photos
  add constraint photos_rotation_chk
  check (rotation in (0, 90, 180, 270));

alter table astrophotos drop constraint if exists astrophotos_rotation_chk;
alter table astrophotos
  add constraint astrophotos_rotation_chk
  check (rotation in (0, 90, 180, 270));
