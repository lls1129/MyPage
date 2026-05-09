-- Pins for the 3D explorer. Each row is a point on the surface of either
-- Earth or Moon, with a type (travel/diary/astronomy) and a free-text note.
-- Position is stored as the unit-sphere vector (x/y/z) so the client can
-- project it back without re-doing trig.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists pins (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  type text not null default 'travel',
  position_x double precision not null,
  position_y double precision not null,
  position_z double precision not null,
  note text default '' not null,
  created_at timestamptz default now() not null
);

alter table pins drop constraint if exists pins_body_chk;
alter table pins
  add constraint pins_body_chk check (body in ('earth', 'moon'));

alter table pins drop constraint if exists pins_type_chk;
alter table pins
  add constraint pins_type_chk check (type in ('travel', 'diary', 'astronomy'));

create index if not exists pins_body_created_at_idx on pins (body, created_at desc);

alter table pins enable row level security;

drop policy if exists "public can read pins" on pins;
create policy "public can read pins" on pins
  for select
  using (true);
