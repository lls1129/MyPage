-- Sample meal library so /meals + the homepage widget have content before
-- the admin editor exists. Safe to re-run; uses raw insert (no upsert) so
-- expect duplicates if you do — truncate first for a clean reset.

insert into meals (name, tagline, glyph, moods, cuisine, time_minutes, ingredients) values
  ('miso butter udon', 'warm, slurpy, 15 min', '🍜', '{cozy,fast}', 'japanese', 15, '{udon,miso,butter}'),
  ('tomato burrata toast', 'summery and lazy', '🍅', '{light,fast}', 'italian', 10, '{tomato,bread,cheese}'),
  ('mushroom risotto', 'stir, sip wine, repeat', '🍄', '{cozy,fancy}', 'italian', 45, '{rice,mushroom,butter}'),
  ('scallion pancakes', 'crispy edges = the goal', '🥞', '{cozy,fast}', 'chinese', 30, '{flour,scallion}'),
  ('mapo tofu', 'numbing, spicy, fast', '🌶', '{spicy,fast}', 'chinese', 20, '{tofu,sichuan-peppercorn,pork}'),
  ('cacio e pepe', 'three ingredients, no shortcuts', '🍝', '{fancy,fast}', 'italian', 20, '{pasta,pecorino,pepper}'),
  ('shakshuka', 'eggs that bake themselves', '🍳', '{cozy,medium}', 'middle-eastern', 30, '{eggs,tomato,pepper}'),
  ('green curry', 'fragrant and a little wild', '🍛', '{cozy,medium}', 'thai', 40, '{coconut-milk,basil,chicken}'),
  ('caprese salad', 'tomato. mozzarella. done.', '🥗', '{light,fast}', 'italian', 10, '{tomato,mozzarella,basil}'),
  ('french onion soup', 'patience and bread', '🧅', '{cozy,fancy,slow}', 'french', 90, '{onion,broth,gruyere}'),
  ('chicken tikka masala', 'a slow saturday', '🍛', '{cozy,slow}', 'indian', 60, '{chicken,tomato,cream}'),
  ('veggie poke bowl', 'rice, raw color, sesame', '🍱', '{light,fast}', 'japanese', 15, '{rice,avocado,seaweed}'),
  ('dan dan noodles', 'sesame heat, mouth music', '🍜', '{spicy,medium}', 'chinese', 25, '{noodles,sesame,chili}'),
  ('tacos al pastor', 'pineapple is the secret', '🌮', '{spicy,medium}', 'mexican', 45, '{pork,pineapple,tortilla}'),
  ('ramen', 'broth as a love language', '🍲', '{cozy,slow}', 'japanese', 60, '{noodles,broth,pork,egg}'),
  ('chocolate mug cake', 'three minutes, real cake', '🍫', '{fancy,fast}', 'dessert', 5, '{cocoa,butter,sugar}'),
  ('peanut sesame noodles', 'pantry magic', '🥜', '{cozy,fast}', 'chinese', 15, '{noodles,peanut,sesame}'),
  ('chickpea stew', 'spice cabinet weather', '🫕', '{cozy,medium}', 'middle-eastern', 35, '{chickpeas,tomato,cumin}');
