-- BLOCCO 6 — Salvati per liste.
--
-- Le liste sono ETICHETTE, non cartelle: un locale può stare in più liste
-- contemporaneamente, e resta comunque in "tutti i salvati". Per questo
-- `saved_list_items` è una tabella a parte e non una colonna `list_id` su
-- `saved_restaurants` — quella costringerebbe a scegliere una lista sola.
--
-- Le tre liste pronte ("Da provare", "Per un date", "Con i miei") non si
-- creano qui: nascono la prima volta che l'utente ne tocca una, così chi non
-- usa le liste non si ritrova tre cartelle vuote nel profilo.
--
-- Eseguito sul progetto Chiamami_bi il 2026-09-08.

CREATE TABLE IF NOT EXISTS saved_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Due liste con lo stesso nome nello stesso profilo sono sempre un errore
  -- di doppio tocco, mai una scelta.
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS saved_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_lists_user ON saved_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_list_items_list ON saved_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_saved_list_items_restaurant ON saved_list_items(restaurant_id);

ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_list_items ENABLE ROW LEVEL SECURITY;

-- Le liste sono private: nessuno le legge tranne chi le ha fatte.
DROP POLICY IF EXISTS "Owner manages own lists" ON saved_lists;
CREATE POLICY "Owner manages own lists" ON saved_lists
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Le righe di una lista seguono il proprietario della lista: senza il
-- controllo sulla lista collegata, chiunque conosca un list_id potrebbe
-- infilarci dentro dei locali.
DROP POLICY IF EXISTS "Owner manages own list items" ON saved_list_items;
CREATE POLICY "Owner manages own list items" ON saved_list_items
  FOR ALL
  USING (EXISTS (SELECT 1 FROM saved_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM saved_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_list_items TO authenticated;
