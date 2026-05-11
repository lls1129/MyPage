-- Adds richer detail to meals: a free-form `instructions` paragraph and
-- `ingredients_detail` (qty + name strings, e.g. "200g udon noodles").
-- The existing `ingredients` text[] stays as the filter/search list.
-- This migration also backfills the 18 seed meals so existing installs
-- pick up the detail without re-seeding.

alter table meals
  add column if not exists instructions text,
  add column if not exists ingredients_detail text[] not null default '{}';

update meals set
  instructions = 'boil udon per package. melt butter in a pan, whisk in miso with a splash of pasta water until glossy. toss noodles with the sauce, finish with cracked pepper and scallions.',
  ingredients_detail = array['200g fresh udon', '1 tbsp white miso', '1 tbsp butter', 'scallions, sliced', 'black pepper, to taste']
where name = 'miso butter udon';

update meals set
  instructions = 'toast thick sourdough until golden. tear burrata over the top, scatter halved cherry tomatoes, finish with olive oil, flaky salt, and torn basil.',
  ingredients_detail = array['1 thick slice sourdough', '1 ball burrata', '8 cherry tomatoes, halved', 'olive oil', 'flaky salt', 'fresh basil']
where name = 'tomato burrata toast';

update meals set
  instructions = 'sauté shallots in butter, add arborio and toast for a minute. ladle warm broth in slowly, stirring; add sautéed mushrooms midway. finish with parmesan and a knob of butter.',
  ingredients_detail = array['1 cup arborio rice', '4 cups warm mushroom broth', '200g mixed mushrooms', '1 shallot, minced', '1/2 cup parmesan', '2 tbsp butter', 'splash of white wine']
where name = 'mushroom risotto';

update meals set
  instructions = 'knead flour with hot water into a smooth dough, rest 30 min. roll thin, brush with sesame oil, scatter scallions, roll into a snake, coil, and roll flat. pan-fry both sides until crisp.',
  ingredients_detail = array['2 cups flour', '3/4 cup hot water', '4 scallions, finely sliced', '2 tbsp sesame oil', 'neutral oil for frying', 'salt']
where name = 'scallion pancakes';

update meals set
  instructions = 'brown ground pork, push aside. sauté ginger, garlic, doubanjiang, and sichuan peppercorns until fragrant. add stock, slide in cubed tofu, simmer 5 min. thicken with a cornstarch slurry, finish with chili oil and scallions.',
  ingredients_detail = array['1 block silken tofu, cubed', '100g ground pork', '2 tbsp doubanjiang (chili bean paste)', '1 tsp ground sichuan peppercorn', '3 cloves garlic', '1 inch ginger', '1 cup stock', 'scallions to garnish']
where name = 'mapo tofu';

update meals set
  instructions = 'boil pasta in well-salted water. toast cracked pepper in a dry pan. off heat, add a splash of starchy pasta water, then drained pasta, then grated pecorino — toss vigorously until it''s a glossy sauce.',
  ingredients_detail = array['180g spaghetti or tonnarelli', '80g pecorino romano, finely grated', '2 tsp freshly cracked black pepper', 'salt for pasta water']
where name = 'cacio e pepe';

update meals set
  instructions = 'sauté onion and pepper in olive oil until soft. add garlic, cumin, paprika, then crushed tomatoes; simmer until thick. make wells with a spoon and crack eggs in. cover, cook until whites set.',
  ingredients_detail = array['4 eggs', '1 can crushed tomatoes', '1 onion, diced', '1 red pepper, diced', '3 cloves garlic', '1 tsp cumin', '1 tsp paprika', 'olive oil', 'feta + parsley to serve']
where name = 'shakshuka';

update meals set
  instructions = 'fry green curry paste in a splash of coconut cream until aromatic. add the rest of the coconut milk, fish sauce, sugar, then chicken; simmer 15 min. add eggplant or beans, finish with thai basil and lime.',
  ingredients_detail = array['3 tbsp green curry paste', '1 can coconut milk', '300g chicken thighs, sliced', '1 tbsp fish sauce', '1 tsp sugar', '1 thai eggplant or handful green beans', 'thai basil', '1 lime']
where name = 'green curry';

update meals set
  instructions = 'slice tomato and mozzarella into rounds, alternate on a plate. tuck basil between layers, drizzle with good olive oil and a few drops of balsamic, finish with flaky salt and pepper.',
  ingredients_detail = array['2 ripe tomatoes', '1 ball fresh mozzarella', 'fresh basil leaves', 'extra virgin olive oil', 'balsamic vinegar', 'flaky salt + pepper']
where name = 'caprese salad';

update meals set
  instructions = 'slice onions thin, cook low and slow in butter for 45 min until deeply caramelized. deglaze with wine, add beef broth and thyme, simmer 30 min. ladle into bowls, top with toasted baguette + gruyère, broil until bubbly.',
  ingredients_detail = array['4 large onions, thinly sliced', '3 tbsp butter', '1/2 cup dry white wine', '6 cups beef broth', 'few sprigs thyme', '1 baguette', '150g gruyère, grated']
where name = 'french onion soup';

update meals set
  instructions = 'marinate chicken in yogurt + spices for an hour, then char under the broiler. for the sauce: sauté onion, ginger, garlic; add tomato, garam masala, paprika; simmer with cream. fold in the chicken, finish with cilantro.',
  ingredients_detail = array['600g chicken thighs, cubed', '1/2 cup yogurt', '2 tbsp garam masala', '1 can crushed tomatoes', '1 cup heavy cream', '1 onion, diced', '4 cloves garlic', '1 inch ginger', 'fresh cilantro']
where name = 'chicken tikka masala';

update meals set
  instructions = 'cook short-grain rice. arrange in a bowl with sliced avocado, cucumber, edamame, and shredded carrot. drizzle with soy + sesame oil + a touch of rice vinegar, top with sesame seeds and nori.',
  ingredients_detail = array['1 cup short-grain rice', '1 avocado, sliced', '1/2 cucumber, sliced', '1/2 cup edamame', '1 carrot, shredded', 'soy sauce', 'sesame oil', 'rice vinegar', 'sesame seeds + nori']
where name = 'veggie poke bowl';

update meals set
  instructions = 'whisk sesame paste, soy, chili oil, sichuan peppercorn, and a splash of stock into a sauce. brown ground pork with preserved mustard greens. boil noodles, toss with the sauce, top with the pork and scallions.',
  ingredients_detail = array['200g wheat noodles', '150g ground pork', '2 tbsp sesame paste (or tahini)', '2 tbsp soy sauce', '2 tbsp chili oil', '1 tsp sichuan peppercorn', '2 tbsp preserved mustard greens', 'scallions']
where name = 'dan dan noodles';

update meals set
  instructions = 'marinate sliced pork in dried chili paste + pineapple juice + spices overnight. sear hard in a hot pan with bits of pineapple. tuck into warm corn tortillas with white onion, cilantro, and lime.',
  ingredients_detail = array['500g pork shoulder, thinly sliced', '1/2 small pineapple', '3 dried guajillo chilies', '2 tbsp achiote paste', 'garlic + cumin + oregano', 'corn tortillas', 'white onion + cilantro + lime']
where name = 'tacos al pastor';

update meals set
  instructions = 'simmer pork bones, kombu, and aromatics for hours to build broth (or shortcut with good stock + dashi). cook noodles to package, divide into bowls. add tare, hot broth, sliced pork, soft egg, scallions, nori.',
  ingredients_detail = array['fresh ramen noodles for 2', '1 liter rich pork or chicken broth', '2 tbsp tare (soy + mirin + sake)', '200g chashu pork, sliced', '2 ajitsuke (soft) eggs', 'scallions + nori', 'menma (optional)']
where name = 'ramen';

update meals set
  instructions = 'whisk flour, cocoa, sugar, baking powder in a mug. add milk, melted butter, and a splash of vanilla; stir until smooth. microwave 60–80 sec — top should be just set, middle still glossy.',
  ingredients_detail = array['4 tbsp flour', '2 tbsp cocoa', '3 tbsp sugar', '1/4 tsp baking powder', '3 tbsp milk', '2 tbsp melted butter', 'drop of vanilla']
where name = 'chocolate mug cake';

update meals set
  instructions = 'whisk peanut butter, soy sauce, rice vinegar, sesame oil, grated garlic, and chili oil with hot water until pourable. boil noodles, drain and rinse cool. toss with sauce, top with cucumber and crushed peanuts.',
  ingredients_detail = array['200g wheat or soba noodles', '3 tbsp peanut butter', '2 tbsp soy sauce', '1 tbsp rice vinegar', '1 tbsp sesame oil', '1 clove garlic, grated', 'chili oil to taste', 'cucumber + crushed peanuts to top']
where name = 'peanut sesame noodles';

update meals set
  instructions = 'sauté onion, garlic, ginger in olive oil. add cumin, coriander, paprika, then tomato and chickpeas. simmer 20 min until thick. finish with a squeeze of lemon and fresh herbs; serve with bread or rice.',
  ingredients_detail = array['2 cans chickpeas, drained', '1 can crushed tomatoes', '1 onion, diced', '4 cloves garlic', '1 inch ginger', '1 tbsp cumin', '1 tsp coriander', '1 tsp paprika', 'olive oil + lemon + parsley']
where name = 'chickpea stew';
