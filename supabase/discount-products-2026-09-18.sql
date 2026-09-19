-- ============================================================================
-- I prodotti dello sconto — `discount_products`
--
-- Oggi uno sconto dice «10% sulle bevande Matcha» e mostra la foto del
-- bancone. Chi legge non sa se parliamo di un matcha latte, di un matcha
-- tonic o di uno scaffale di lattine: la foto che vede non è quello che sta
-- comprando. Questa tabella tiene le foto di cosa lo sconto copre davvero.
--
-- Perché non si riusano le foto in `restaurant_photos`:
--   - quelle sono foto *del locale* (sala, bancone, vetrina), nessuna è
--     «il matcha latte»;
--   - lo stesso locale può avere sconti diversi su prodotti diversi, quindi
--     la foto appartiene allo sconto, non al ristorante;
--   - quando lo sconto finisce le sue foto se ne vanno con lui (CASCADE).
--
-- Niente colonna prezzo, ed è deliberato: il prezzo del singolo prodotto
-- cambia più spesso dello sconto, e due verità (il prezzo scritto qui e
-- quello sul menù del locale) divergono al primo aumento. Il valore del
-- risparmio lo dice già `discounts.discount_value` — «10%», «-1€», «3x2» —
-- e vale su tutti i prodotti elencati qui.
--
-- Da eseguire nel SQL editor di Supabase. Idempotente.
-- ============================================================================

-- ── 1) Tabella ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  -- Una riga sola, tipo «ceremonial grade, latte o avena». Facoltativa:
  -- serve a distinguere due prodotti che in foto si somigliano.
  note        text,
  photo_url   text,
  thumb_url   text,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- L'ordine è quello che decide l'admin: la prima riga è la foto che finisce
-- in anteprima sulla card in lista, quindi l'indice copre anche quel caso.
CREATE INDEX IF NOT EXISTS idx_discount_products_discount
  ON discount_products(discount_id, sort_order);

-- ── 2) RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE discount_products ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica, ma solo dei prodotti di uno sconto che il pubblico può
-- già vedere: la condizione ricalca esattamente la policy "Public read active
-- discounts" su `discounts`. Senza l'EXISTS, i prodotti di uno sconto
-- disattivato o scaduto resterebbero leggibili da chiunque — e con loro il
-- listino di quello che un locale stava per mettere in offerta.
DROP POLICY IF EXISTS "Public read products of active discounts" ON discount_products;
CREATE POLICY "Public read products of active discounts" ON discount_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM discounts d
      WHERE d.id = discount_products.discount_id
        AND d.is_active = true
        AND d.valid_until > now()
    )
  );

-- Scrittura: solo admin, come per gli sconti stessi.
DROP POLICY IF EXISTS "Admin full access discount products" ON discount_products;
CREATE POLICY "Admin full access discount products" ON discount_products
  FOR ALL USING (public.is_admin());

-- ── 3) Verifica ─────────────────────────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'discount_products';
