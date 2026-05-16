-- /pets section — one row per pet, single-photo MVP.
--
-- Schema mirrors the slim shape of meals (entity + one image_url +
-- notes), not the album/photo split. If "multiple photos per pet"
-- becomes a need, we'll add a pet_photos table later.
--
-- removed_at gives a soft-delete column for an undo trash list,
-- matching the meals pattern. hidden hides from visitors but keeps
-- the row admin-visible.
--
-- Public read of non-hidden, non-removed rows; admin write via the
-- service-role client (same as meals).
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  breed text,
  notes text,
  image_url text,
  hidden boolean not null default false,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

alter table pets enable row level security;

-- Public read: only non-hidden, non-removed rows.
drop policy if exists pets_public_read on pets;
create policy pets_public_read
  on pets
  for select
  to anon, authenticated
  using (hidden = false and removed_at is null);

-- Admin (service role) bypasses RLS automatically.
