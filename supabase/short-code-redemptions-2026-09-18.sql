-- ============================================================================
-- Sblocco sconto digitando un codice — `discount_redemptions.short_code`
--
-- Il QR resta il percorso principale. Questo aggiunge il piano B per quando
-- la fotocamera non collabora (vetrina controluce, telefono del cliente con
-- lo schermo rotto, ristoratore col tablet fisso alla cassa): un codice di
-- 6 caratteri — una lettera e cinque cifre, es. `K48213` — che il cliente
-- legge ad alta voce e il ristoratore digita.
--
-- Formato scelto per essere dettabile senza equivoci:
--   - prima posizione lettera → si vede subito da che verso si legge il
--     codice, e la tastiera del locale parte in modalità testo per un solo
--     carattere e poi passa al tastierino numerico;
--   - niente I e O fra le lettere → non si confondono con 1 e 0;
--   - sempre maiuscolo, niente separatori nel dato salvato.
--
-- Da eseguire nel SQL editor di Supabase. Idempotente.
-- ============================================================================

-- ── 1) Colonna ──────────────────────────────────────────────────────────────
ALTER TABLE discount_redemptions
  ADD COLUMN IF NOT EXISTS short_code text;

-- ── 2) Generatore ───────────────────────────────────────────────────────────
-- Usa gen_random_bytes (pgcrypto) e non random(): il codice è corto, e un
-- generatore deterministico renderebbe prevedibile il prossimo codice a chi
-- ne ha già visti un paio.
CREATE OR REPLACE FUNCTION public.generate_redemption_short_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
-- `extensions` nel search_path perché su Supabase pgcrypto (gen_random_bytes)
-- è installato lì, non in public.
SET search_path = public, extensions
AS $$
DECLARE
  -- 24 lettere: alfabeto inglese meno I e O.
  c_letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes   bytea;
  v_digits  bigint;
  v_cand    text;
  v_try     int := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    v_bytes := gen_random_bytes(5);
    v_digits := (get_byte(v_bytes, 0)::bigint << 24)
              | (get_byte(v_bytes, 1)::bigint << 16)
              | (get_byte(v_bytes, 2)::bigint << 8)
              |  get_byte(v_bytes, 3)::bigint;
    v_cand := substr(c_letters, 1 + (get_byte(v_bytes, 4) % length(c_letters)), 1)
           || lpad((v_digits % 100000)::text, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM discount_redemptions WHERE short_code = v_cand
    );

    -- Lo spazio è di 2.4 milioni di codici: arrivare a 50 tentativi a vuoto
    -- vuol dire che è quasi pieno, e va allungato il formato — meglio un
    -- errore esplicito che un loop infinito che blocca l'INSERT.
    IF v_try >= 50 THEN
      RAISE EXCEPTION 'short_code: nessun codice libero dopo % tentativi', v_try;
    END IF;
  END LOOP;

  RETURN v_cand;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_redemption_short_code() FROM public, anon, authenticated;

-- ── 3) Assegnazione automatica ──────────────────────────────────────────────
-- Trigger e non DEFAULT: il default non può leggere la tabella per evitare
-- le collisioni. Sta qui e non nel client perché i punti che inseriscono un
-- riscatto sono già due (useDiscounts.js e SconteRedesignPage.jsx) e nessuno
-- dei due deve poter dimenticare il codice.
CREATE OR REPLACE FUNCTION public.set_redemption_short_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.generate_redemption_short_code();
  ELSE
    -- Un codice passato dal client viene normalizzato, non preso per buono.
    NEW.short_code := upper(regexp_replace(NEW.short_code, '[^A-Za-z0-9]', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_redemption_short_code ON discount_redemptions;
CREATE TRIGGER trg_redemption_short_code
  BEFORE INSERT ON discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_redemption_short_code();

-- ── 4) Backfill dei riscatti già esistenti ─────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM discount_redemptions WHERE short_code IS NULL LOOP
    UPDATE discount_redemptions
      SET short_code = public.generate_redemption_short_code()
      WHERE id = r.id;
  END LOOP;
END $$;

-- ── 5) Vincoli ──────────────────────────────────────────────────────────────
ALTER TABLE discount_redemptions
  ALTER COLUMN short_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_redemptions_short_code
  ON discount_redemptions(short_code);

ALTER TABLE discount_redemptions
  DROP CONSTRAINT IF EXISTS discount_redemptions_short_code_format;
ALTER TABLE discount_redemptions
  ADD CONSTRAINT discount_redemptions_short_code_format
  CHECK (short_code ~ '^[A-HJ-NP-Z][0-9]{5}$');

-- ── 6) Anti-forza-bruta ─────────────────────────────────────────────────────
-- Un codice di 6 caratteri si può tirare a indovinare, cosa impossibile con
-- il QR. Chi ci prova ha già un device_token valido (è un locale del
-- circuito), quindi il contatore sta sul dispositivo: dieci codici
-- inesistenti in un quarto d'ora e la verifica si chiude per quel
-- dispositivo. Una scansione andata a buon fine azzera il contatore, quindi
-- il locale che lavora normalmente non se ne accorge mai.
ALTER TABLE verified_devices
  ADD COLUMN IF NOT EXISTS failed_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_since timestamptz;
