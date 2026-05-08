-- Sample photos so the /photos grid has something to render before upload
-- is wired. Uses picsum.photos seeded URLs (deterministic placeholders).
-- Run this once in Supabase Dashboard → SQL Editor after the migration.
-- Re-running will keep adding duplicates; truncate first if you want a clean reset.

insert into photos (image_url, caption, tags, width, height) values
  ('https://picsum.photos/seed/myworld-river/800/1200',  'a river morning',          '{travel,nature}', 800, 1200),
  ('https://picsum.photos/seed/myworld-road/1200/800',   'mountain road, july',      '{travel,nature}', 1200, 800),
  ('https://picsum.photos/seed/myworld-pasta/800/800',   'tomato pasta night',       '{food}',          800, 800),
  ('https://picsum.photos/seed/myworld-galaxy/800/1100', 'milky way over the desert','{sky,nature}',    800, 1100),
  ('https://picsum.photos/seed/myworld-puppy/800/600',   'puppy at the park',        '{pets}',          800, 600),
  ('https://picsum.photos/seed/myworld-tea/1200/900',    'tea ceremony',             '{food,travel}',   1200, 900),
  ('https://picsum.photos/seed/myworld-blossom/800/1000','cherry blossoms',          '{nature,sky}',    800, 1000),
  ('https://picsum.photos/seed/myworld-door/900/700',    'old town doorway',         '{travel}',        900, 700),
  ('https://picsum.photos/seed/myworld-cat/900/1100',    'shop cat, kyoto',          '{pets,travel}',   900, 1100);
