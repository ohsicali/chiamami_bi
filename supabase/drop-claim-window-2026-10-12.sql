-- ============================================================
-- Drop: 7 giorni per usarlo, poi il posto passa a chi è in lista (12/10)
-- ============================================================
--
-- Richiesta del proprietario del 12/10, per i drop da adesso in poi (quelli
-- già usciti restano come sono):
--   - un drop ha N posti; chi riesce a prenderlo ha 7 giorni per usarlo, e i
--     7 giorni partono dal tocco su "Sblocca sconto";
--   - passati i 7 giorni senza usarlo il codice non vale più, e il posto va
--     al primo della lista d'attesa;
--   - chi arriva a drop esaurito vede il "sold out" e può mettersi in lista.
--
-- Cosa c'è qui:
--   1. `discounts.claim_window_days`: i giorni per usarlo. NULL = nessun
--      limite (i drop di prima, le convenzioni). Il pannello lo mette a 7 sui
--      drop nuovi.
--   2. `discount_redemptions.expires_at`: fin quando vale quel riscatto. Lo
--      scrive il DB (guard_redemption_insert), mai il browser.
--   3. `drop_waitlist`: la lista d'attesa. Ci si entra e si esce solo dalle
--      RPC `drop_waitlist_join/leave`; `drop_waitlist_status` dice a tutti
--      quanti sono in lista e a chi è dentro il suo posto.
--   4. Posti: `total_redeemed` conta i posti occupati (presi e non scaduti,
--      più gli usati). Un riscatto che scade lo abbassa, la promozione di chi
--      è in lista lo rialza. Chi non è in lista non può prendere un posto
--      che si è liberato mentre c'è qualcuno in attesa davanti a lui.
--   5. `drop_claims_tick()`: il giro. Segna scaduti i riscatti oltre i loro
--      giorni e dà i posti liberi ai primi della lista (un riscatto nuovo,
--      con i suoi 7 giorni). Lo lancia pg_cron ogni 10 minuti
--      (drop-claims-cron-2026-10-12.sql), insieme alle email.
--   6. `verify_redeem_qr` rifiuta un riscatto oltre i suoi giorni anche se
--      il giro non è ancora passato, e dice al locale perché.
--   7. `my_claim_rank` restituisce anche `expires_at` (la barra della festa).
--
-- Idempotente: si può rilanciare.
-- ============================================================

-- ── 1-2. Colonne ─────────────────────────────────────────────

ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS claim_window_days integer;
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_claim_window_days_check;
ALTER TABLE public.discounts ADD CONSTRAINT discounts_claim_window_days_check
  CHECK (claim_window_days IS NULL OR claim_window_days BETWEEN 1 AND 60);

ALTER TABLE public.discount_redemptions ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Il giro cerca i riscatti ancora da usare con una scadenza: pochi, e solo loro.
CREATE INDEX IF NOT EXISTS idx_redemptions_expiring
  ON public.discount_redemptions (expires_at)
  WHERE status = 'generated' AND expires_at IS NOT NULL;

-- Le due tabelle hanno già i grant di tabella (le colonne nuove sono
-- leggibili da sé); quelli di colonna servono se un giorno passano ai soli
-- grant di colonna, come `profiles` e `restaurants`.
GRANT SELECT (claim_window_days) ON public.discounts TO anon, authenticated;
GRANT SELECT (expires_at) ON public.discount_redemptions TO authenticated;

-- ── 3. Lista d'attesa ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drop_waitlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id   uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- waiting: in fila · promoted: ha avuto il posto (redemption_id) ·
  -- left: è uscito da sé · closed: il drop è finito prima del suo turno
  status        text NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'promoted', 'left', 'closed')),
  joined_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  promoted_at   timestamptz,
  redemption_id uuid REFERENCES public.discount_redemptions(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (discount_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_drop_waitlist_queue
  ON public.drop_waitlist (discount_id, joined_at, id)
  WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_drop_waitlist_user ON public.drop_waitlist (user_id);

ALTER TABLE public.drop_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drop_waitlist FROM anon, authenticated;
GRANT SELECT ON public.drop_waitlist TO authenticated;

-- Si legge la propria riga (l'admin tutte). Si scrive solo dalle RPC.
DROP POLICY IF EXISTS "Read own waitlist" ON public.drop_waitlist;
CREATE POLICY "Read own waitlist" ON public.drop_waitlist
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- ── 4. Chi prende un posto ───────────────────────────────────
--
-- Rispetto alla versione del 30/09 (drop-claim-rank-2026-09-30.sql):
--   - scrive `expires_at` (generated_at + i giorni del drop), anche per i
--     riscatti creati dall'admin o dal giro, se non ce l'hanno già;
--   - un drop coi giorni contati e qualcuno in lista: il posto libero è dei
--     primi della fila. Passa chi ha meno persone davanti di quanti posti ci
--     sono (chi non è in lista ha davanti tutta la fila).

CREATE OR REPLACE FUNCTION public.guard_redemption_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_discount discounts%ROWTYPE;
  v_max      int;
  v_free     int;
  v_ahead    int;
  v_my_at    timestamptz;
  v_my_id    uuid;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    IF NEW.expires_at IS NULL THEN
      SELECT COALESCE(NEW.generated_at, now()) + make_interval(days => d.claim_window_days)
        INTO NEW.expires_at
        FROM discounts d
       WHERE d.id = NEW.discount_id AND d.claim_window_days IS NOT NULL;
    END IF;
    RETURN NEW;
  END IF;
  NEW.status := 'generated'; NEW.redeemed_at := NULL; NEW.redeemed_by_restaurant := false; NEW.generated_at := now();
  NEW.user_name := LEFT(NEW.user_name, 120);
  NEW.expires_at := NULL;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':' || NEW.discount_id::text, 0));
  IF EXISTS (SELECT 1 FROM discount_redemptions WHERE user_id = NEW.user_id AND discount_id = NEW.discount_id) THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = '23505';
  END IF;
  -- Un riscatto alla volta per sconto (vedi drop-claim-rank-2026-09-30.sql).
  PERFORM pg_advisory_xact_lock(hashtextextended('discount:' || NEW.discount_id::text, 0));
  NEW.generated_at := clock_timestamp();
  SELECT * INTO v_discount FROM discounts WHERE id = NEW.discount_id;
  IF NOT FOUND OR NOT COALESCE(v_discount.is_active, false) THEN RAISE EXCEPTION 'discount_not_available' USING ERRCODE = 'P0001'; END IF;
  IF v_discount.is_test AND NOT public.is_discount_tester(v_discount.id) THEN
    RAISE EXCEPTION 'discount_not_available' USING ERRCODE = 'P0001';
  END IF;
  IF v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now() THEN RAISE EXCEPTION 'discount_expired' USING ERRCODE = 'P0001'; END IF;
  v_max := COALESCE(NULLIF(v_discount.max_quantity, 0), NULLIF(v_discount.max_redemptions, 0));
  v_free := v_max - GREATEST(COALESCE(v_discount.claimed_count, 0), COALESCE(v_discount.total_redeemed, 0));
  IF v_max IS NOT NULL AND v_free <= 0 THEN
    RAISE EXCEPTION 'sold_out' USING ERRCODE = 'P0001';
  END IF;
  IF v_discount.claim_window_days IS NOT NULL THEN
    IF v_max IS NOT NULL THEN
      SELECT w.joined_at, w.id INTO v_my_at, v_my_id
        FROM drop_waitlist w
       WHERE w.discount_id = NEW.discount_id AND w.user_id = NEW.user_id AND w.status = 'waiting';
      SELECT count(*) INTO v_ahead
        FROM drop_waitlist w
       WHERE w.discount_id = NEW.discount_id
         AND w.status = 'waiting'
         AND w.user_id <> NEW.user_id
         AND (v_my_at IS NULL OR (w.joined_at, w.id) < (v_my_at, v_my_id));
      IF v_free <= v_ahead THEN
        RAISE EXCEPTION 'sold_out' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    NEW.expires_at := NEW.generated_at + make_interval(days => v_discount.claim_window_days);
  END IF;
  RETURN NEW;
END;
$function$;

-- Un riscatto che scade libera il posto; uno che torna "da usare" (a mano,
-- dall'admin) lo riprende.
CREATE OR REPLACE FUNCTION public.tg_redeemed_count_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'expired' AND OLD.status IS DISTINCT FROM 'expired' THEN
    UPDATE discounts SET total_redeemed = GREATEST(COALESCE(total_redeemed, 0) - 1, 0) WHERE id = NEW.discount_id;
  ELSIF OLD.status = 'expired' AND NEW.status IS DISTINCT FROM 'expired' THEN
    UPDATE discounts SET total_redeemed = COALESCE(total_redeemed, 0) + 1 WHERE id = NEW.discount_id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_redeemed_count_on_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_redeemed_count_on_status ON public.discount_redemptions;
CREATE TRIGGER tr_redeemed_count_on_status
  AFTER UPDATE OF status ON public.discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_redeemed_count_on_status();

-- Cancellare un riscatto già scaduto non libera niente: il posto l'aveva
-- già liberato la scadenza (redemptions-counter-on-delete-2026-09-28.sql).
CREATE OR REPLACE FUNCTION public.tg_decrement_redeemed_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM 'expired' THEN
    UPDATE discounts
       SET total_redeemed = GREATEST(COALESCE(total_redeemed, 0) - 1, 0)
     WHERE id = OLD.discount_id;
  END IF;
  RETURN OLD;
END;
$function$;

-- Chi era in lista e ha avuto il posto (dal giro, o sbloccandolo da sé
-- quando toccava a lui) esce dalla fila.
CREATE OR REPLACE FUNCTION public.tg_waitlist_on_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE drop_waitlist
     SET status = 'promoted', promoted_at = now(), redemption_id = NEW.id, updated_at = now()
   WHERE discount_id = NEW.discount_id AND user_id = NEW.user_id AND status = 'waiting';
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_waitlist_on_claim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_waitlist_on_claim ON public.discount_redemptions;
CREATE TRIGGER tr_waitlist_on_claim
  AFTER INSERT ON public.discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_waitlist_on_claim();

-- ── 3 bis. Le RPC della lista ────────────────────────────────

-- Quanti sono in lista per ogni drop chiesto, e — per chi ha una sessione —
-- il suo posto in fila e lo stato della sua riga. Le prove le vede solo chi
-- è invitato (come la lettura di `discounts`).
CREATE OR REPLACE FUNCTION public.drop_waitlist_status(p_discount_ids uuid[])
RETURNS TABLE (discount_id uuid, waiting int, my_position int, my_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ids AS (
    SELECT DISTINCT x AS id FROM unnest(COALESCE(p_discount_ids, ARRAY[]::uuid[])) AS x LIMIT 50
  ),
  q AS (
    SELECT w.discount_id, w.user_id,
           row_number() OVER (PARTITION BY w.discount_id ORDER BY w.joined_at, w.id)::int AS pos
      FROM drop_waitlist w
      JOIN ids ON ids.id = w.discount_id
     WHERE w.status = 'waiting'
  )
  SELECT ids.id,
         (SELECT count(*)::int FROM q WHERE q.discount_id = ids.id),
         (SELECT q.pos FROM q WHERE q.discount_id = ids.id AND q.user_id = auth.uid()),
         (SELECT w.status FROM drop_waitlist w WHERE w.discount_id = ids.id AND w.user_id = auth.uid())
    FROM ids
    JOIN discounts d ON d.id = ids.id
   WHERE NOT d.is_test OR public.is_admin() OR public.is_discount_tester(d.id);
$function$;

REVOKE ALL ON FUNCTION public.drop_waitlist_status(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.drop_waitlist_status(uuid[]) TO anon, authenticated;

-- Entrare in lista. Risposte (`status`):
--   joined / already       → in fila, con `position` e `waiting`
--   claim_available        → c'è un posto libero per te: sbloccalo e basta
--   already_claimed        → hai già un riscatto di questo drop (anche
--                            scaduto: chi l'ha perso non torna in fila)
--   not_waitlistable       → non è un drop coi giorni contati e i posti
--   not_available          → spento, finito, o una prova non tua
--   not_authenticated
CREATE OR REPLACE FUNCTION public.drop_waitlist_join(p_discount_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_d       discounts%ROWTYPE;
  v_max     int;
  v_free    int;
  v_others  int;
  v_before  text;
  v_row     drop_waitlist%ROWTYPE;
  v_pos     int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status', 'not_authenticated'); END IF;
  -- Stesso lucchetto dei riscatti e del giro: la fila non cambia sotto i piedi.
  PERFORM pg_advisory_xact_lock(hashtextextended('discount:' || p_discount_id::text, 0));

  SELECT * INTO v_d FROM discounts WHERE id = p_discount_id;
  IF NOT FOUND OR (v_d.is_test AND NOT public.is_discount_tester(v_d.id)) THEN
    RETURN jsonb_build_object('status', 'not_available');
  END IF;
  v_max := COALESCE(NULLIF(v_d.max_quantity, 0), NULLIF(v_d.max_redemptions, 0));
  IF NOT COALESCE(v_d.is_drop, false) OR v_d.claim_window_days IS NULL OR v_max IS NULL THEN
    RETURN jsonb_build_object('status', 'not_waitlistable');
  END IF;
  IF NOT COALESCE(v_d.is_active, false)
     OR (v_d.valid_until IS NOT NULL AND v_d.valid_until < now())
     OR (v_d.drop_ends_at IS NOT NULL AND v_d.drop_ends_at < now()) THEN
    RETURN jsonb_build_object('status', 'not_available');
  END IF;
  IF EXISTS (SELECT 1 FROM discount_redemptions WHERE discount_id = p_discount_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('status', 'already_claimed');
  END IF;

  SELECT status INTO v_before FROM drop_waitlist WHERE discount_id = p_discount_id AND user_id = v_uid;
  IF v_before IS DISTINCT FROM 'waiting' THEN
    SELECT count(*) INTO v_others FROM drop_waitlist
     WHERE discount_id = p_discount_id AND status = 'waiting' AND user_id <> v_uid;
    v_free := v_max - GREATEST(COALESCE(v_d.claimed_count, 0), COALESCE(v_d.total_redeemed, 0));
    IF v_free > v_others THEN
      RETURN jsonb_build_object('status', 'claim_available');
    END IF;
    -- Chi rientra dopo essere uscito si rimette in fondo.
    INSERT INTO drop_waitlist (discount_id, user_id)
    VALUES (p_discount_id, v_uid)
    ON CONFLICT (discount_id, user_id) DO UPDATE
       SET status = 'waiting', joined_at = clock_timestamp(), promoted_at = NULL,
           redemption_id = NULL, updated_at = now();
  END IF;

  SELECT * INTO v_row FROM drop_waitlist WHERE discount_id = p_discount_id AND user_id = v_uid;
  SELECT count(*)::int INTO v_pos FROM drop_waitlist w
   WHERE w.discount_id = p_discount_id AND w.status = 'waiting'
     AND (w.joined_at, w.id) <= (v_row.joined_at, v_row.id);
  RETURN jsonb_build_object(
    'status', CASE WHEN v_before = 'waiting' THEN 'already' ELSE 'joined' END,
    'position', v_pos,
    'waiting', (SELECT count(*)::int FROM drop_waitlist WHERE discount_id = p_discount_id AND status = 'waiting')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.drop_waitlist_join(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drop_waitlist_join(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.drop_waitlist_leave(p_discount_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'not_authenticated'); END IF;
  UPDATE drop_waitlist
     SET status = 'left', updated_at = now()
   WHERE discount_id = p_discount_id AND user_id = auth.uid() AND status = 'waiting';
  RETURN jsonb_build_object('status', CASE WHEN FOUND THEN 'left' ELSE 'not_waiting' END);
END;
$function$;

REVOKE ALL ON FUNCTION public.drop_waitlist_leave(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drop_waitlist_leave(uuid) TO authenticated;

-- ── 5. Il giro ───────────────────────────────────────────────

-- Lo stesso formato dei QR fatti dal browser (`BiSc-` + 8 caratteri senza
-- quelli che si confondono), ma con byte casuali veri.
CREATE OR REPLACE FUNCTION private.new_redemption_qr_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  c_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  v_code  text;
  v_bytes bytea;
BEGIN
  LOOP
    v_bytes := extensions.gen_random_bytes(8);
    v_code := 'BiSc-';
    FOR i IN 0..7 LOOP
      v_code := v_code || substr(c_chars, 1 + (get_byte(v_bytes, i) % length(c_chars)), 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM discount_redemptions WHERE qr_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$function$;

REVOKE EXECUTE ON FUNCTION private.new_redemption_qr_code() FROM PUBLIC, anon, authenticated;

-- 1. I riscatti oltre i loro giorni diventano `expired` (e liberano il posto).
-- 2. Un drop finito (data di fine passata) chiude la sua lista.
-- 3. Un drop acceso coi posti liberi li dà ai primi della fila: per ognuno
--    un riscatto nuovo, coi suoi giorni che partono adesso.
-- Restituisce quanti scaduti e quanti promossi, per i log.
CREATE OR REPLACE FUNCTION public.drop_claims_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id       uuid;
  v_d        discounts%ROWTYPE;
  v_w        drop_waitlist%ROWTYPE;
  v_max      int;
  v_free     int;
  v_n        int;
  v_expired  int := 0;
  v_promoted int := 0;
  v_closed   int := 0;
BEGIN
  FOR v_id IN
    SELECT d.id FROM discounts d
     WHERE d.claim_window_days IS NOT NULL
       AND (EXISTS (SELECT 1 FROM discount_redemptions r
                     WHERE r.discount_id = d.id AND r.status = 'generated' AND r.expires_at <= now())
            OR EXISTS (SELECT 1 FROM drop_waitlist w WHERE w.discount_id = d.id AND w.status = 'waiting'))
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('discount:' || v_id::text, 0));

    UPDATE discount_redemptions
       SET status = 'expired'
     WHERE discount_id = v_id AND status = 'generated' AND expires_at <= now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_expired := v_expired + v_n;

    -- Riletto dopo: il trigger ha appena liberato i posti.
    SELECT * INTO v_d FROM discounts WHERE id = v_id;

    IF (v_d.valid_until IS NOT NULL AND v_d.valid_until < now())
       OR (v_d.drop_ends_at IS NOT NULL AND v_d.drop_ends_at < now()) THEN
      UPDATE drop_waitlist SET status = 'closed', updated_at = now()
       WHERE discount_id = v_id AND status = 'waiting';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_closed := v_closed + v_n;
      CONTINUE;
    END IF;
    -- In pausa: la fila aspetta che si riaccenda.
    IF NOT COALESCE(v_d.is_active, false) THEN CONTINUE; END IF;

    v_max := COALESCE(NULLIF(v_d.max_quantity, 0), NULLIF(v_d.max_redemptions, 0));
    IF v_max IS NULL THEN CONTINUE; END IF;
    v_free := v_max - GREATEST(COALESCE(v_d.claimed_count, 0), COALESCE(v_d.total_redeemed, 0));

    WHILE v_free > 0 LOOP
      SELECT * INTO v_w FROM drop_waitlist
       WHERE discount_id = v_id AND status = 'waiting'
       ORDER BY joined_at, id
       LIMIT 1;
      EXIT WHEN NOT FOUND;
      -- Ha già un riscatto (preso a mano dall'admin, per esempio): esce dalla fila.
      IF EXISTS (SELECT 1 FROM discount_redemptions WHERE discount_id = v_id AND user_id = v_w.user_id) THEN
        UPDATE drop_waitlist SET status = 'closed', updated_at = now() WHERE id = v_w.id;
        CONTINUE;
      END IF;
      -- Il trigger `tr_waitlist_on_claim` lo segna `promoted` col suo riscatto.
      INSERT INTO discount_redemptions (discount_id, user_id, qr_code, status, generated_at, expires_at, user_name)
      VALUES (
        v_id, v_w.user_id, private.new_redemption_qr_code(), 'generated', now(),
        now() + make_interval(days => v_d.claim_window_days),
        (SELECT LEFT(full_name, 120) FROM profiles WHERE id = v_w.user_id)
      );
      v_promoted := v_promoted + 1;
      v_free := v_free - 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('expired', v_expired, 'promoted', v_promoted, 'closed', v_closed);
END;
$function$;

REVOKE ALL ON FUNCTION public.drop_claims_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drop_claims_tick() TO service_role;

-- ── 6. Il locale non convalida un riscatto scaduto ───────────
--
-- verify_redeem_qr è lunga e qui cambia solo la riga che decide "scaduto":
-- invece di ricopiarla tutta (e rischiare di riportare indietro una
-- correzione fatta nel frattempo) si prende quella che c'è nel DB e si
-- aggiungono due cose — la scadenza del riscatto alla condizione, e il
-- motivo nella risposta (`reason: 'claim_window'`, così /verify dice al
-- locale che il cliente aveva 7 giorni). Se le righe attese non ci sono,
-- si ferma tutto invece di salvare una funzione a metà.
DO $do$
DECLARE
  v_def text := pg_get_functiondef('public.verify_redeem_qr(text, text)'::regprocedure);
  v_old_if  constant text := $t$IF v_redemption.status = 'expired' OR$t$;
  v_new_if  constant text := $t$IF v_redemption.status = 'expired' OR
     (v_redemption.expires_at IS NOT NULL AND v_redemption.expires_at <= now()) OR$t$;
  v_old_out constant text := $t$'status', 'expired',$t$;
  v_new_out constant text := $t$'status', 'expired',
      'reason', CASE WHEN v_redemption.expires_at IS NOT NULL AND v_redemption.expires_at <= now()
                     THEN 'claim_window' ELSE 'discount_expired' END,$t$;
BEGIN
  IF position('claim_window' IN v_def) > 0 THEN
    RETURN; -- già fatto
  END IF;
  IF position(v_old_if IN v_def) = 0 OR position(v_old_out IN v_def) = 0 THEN
    RAISE EXCEPTION 'verify_redeem_qr non ha la forma attesa: aggiornala a mano';
  END IF;
  v_def := replace(v_def, v_old_if, v_new_if);
  v_def := replace(v_def, v_old_out, v_new_out);
  EXECUTE v_def;
END
$do$;

-- ── 7. La festa del drop sa fin quando vale ──────────────────

DROP FUNCTION IF EXISTS public.my_claim_rank(uuid);

CREATE FUNCTION public.my_claim_rank(p_redemption_id uuid)
RETURNS TABLE (claim_rank int, total int, is_drop boolean, restaurant_name text, expires_at timestamptz, claim_window_days int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*)::int
       FROM discount_redemptions o
      WHERE o.discount_id = r.discount_id
        AND (o.generated_at, o.id) <= (r.generated_at, r.id)),
    COALESCE(NULLIF(d.max_quantity, 0), NULLIF(d.max_redemptions, 0))::int,
    COALESCE(d.is_drop, false),
    rs.name,
    r.expires_at,
    d.claim_window_days
  FROM discount_redemptions r
  JOIN discounts d ON d.id = r.discount_id
  LEFT JOIN restaurants rs ON rs.id = d.restaurant_id
  WHERE r.id = p_redemption_id
    AND r.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.my_claim_rank(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_claim_rank(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
