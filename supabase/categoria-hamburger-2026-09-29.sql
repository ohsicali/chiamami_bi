-- 29/09 — Categoria "Hamburger" per la bolla della home.
-- I burger stavano sotto "Panineria", che però raccoglie anche pescherie,
-- kebab e salumerie: la bolla Hamburger (HOME_CATEGORY_MAP in
-- src/lib/hooks/useRestaurants.js) legge solo "Hamburger"/"Burger".
-- Già eseguito. Per un nuovo burger basta spuntare "Hamburger" nel form admin.

insert into categories (name, icon, color, sort_order, group_key)
select 'Hamburger', '🍔', '#D97706', coalesce(max(sort_order), 0) + 1, 'cucina'
from categories
where not exists (select 1 from categories where name = 'Hamburger');

update restaurants
set category = array_append(category, 'Hamburger')
where name in ('Quality Burger', 'Smashers', 'SUPERSONIC')
  and not ('Hamburger' = any(category));
