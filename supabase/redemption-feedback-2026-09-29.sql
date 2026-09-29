-- ============================================================
-- Feedback dopo lo sconto convalidato — 2026-09-29
-- ============================================================
-- Quando il locale convalida un codice (verify_redeem_qr mette
-- status = 'redeemed'), sul telefono di chi l'ha usato parte la festa
-- "convalidato" e poi le stelle da 1 a 5, poi un modulo facoltativo per
-- scrivere a Bi. Chi non finisce riceve un'email dopo ~30 minuti e una
-- dopo un giorno (api/_email/feedback.js, giro ogni 10 minuti: vedi
-- redemption-feedback-cron-2026-09-29.sql).
--
-- Una riga per riscatto convalidato, creata dal trigger qui sotto nello
-- stesso istante della convalida: così esiste già quando il realtime avvisa
-- il telefono, e il giro delle email trova chi è a metà senza dover
-- incrociare tabelle.
--
-- Il browser non scrive mai sulla tabella: legge la propria riga (RLS) e
-- passa dalle tre funzioni feedback_* col `token` della riga. Lo stesso
-- token sta nei link delle email, così chi apre il link da un telefono
-- dove non è entrato lascia il feedback senza dover fare l'accesso.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.redemption_feedback (
  redemption_id uuid PRIMARY KEY REFERENCES public.discount_redemptions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discount_id   uuid REFERENCES public.discounts(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  token         uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  redeemed_at   timestamptz NOT NULL DEFAULT now(),
  rating        smallint CHECK (rating BETWEEN 1 AND 5),
  rated_at      timestamptz,
  -- { liked: ['cibo','servizio',…], sconto: 'liscio'|'intoppo'|'problema',
  --   tornare: 'si'|'forse'|'no' } — le chiavi le decide
  -- src/lib/redemptionFeedback.js, il DB controlla solo forma e misura.
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment       text CHECK (comment IS NULL OR char_length(comment) <= 1500),
  -- Il modulo è stato mandato. È "finito": niente più email.
  completed_at  timestamptz,
  -- Da dove è arrivato: 'app' (subito dopo la convalida) o 'email'.
  source        text CHECK (source IS NULL OR source IN ('app', 'email')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redemption_feedback_pending_idx
  ON public.redemption_feedback (redeemed_at)
  WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS redemption_feedback_restaurant_idx
  ON public.redemption_feedback (restaurant_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS redemption_feedback_user_idx
  ON public.redemption_feedback (user_id);

ALTER TABLE public.redemption_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own feedback" ON public.redemption_feedback;
CREATE POLICY "Read own feedback" ON public.redemption_feedback
  FOR SELECT USING (public.is_admin() OR (SELECT auth.uid()) = user_id);

-- Nessuna policy di scrittura: si scrive solo dalle funzioni qui sotto.
REVOKE INSERT, UPDATE, DELETE ON public.redemption_feedback FROM anon, authenticated;
GRANT SELECT ON public.redemption_feedback TO authenticated;

-- ── La riga nasce con la convalida ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_redemption_feedback_on_redeem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'redeemed' AND OLD.status IS DISTINCT FROM 'redeemed' THEN
    INSERT INTO redemption_feedback (redemption_id, user_id, discount_id, restaurant_id, redeemed_at)
    SELECT NEW.id, NEW.user_id, NEW.discount_id, d.restaurant_id, COALESCE(NEW.redeemed_at, now())
      FROM discounts d
     WHERE d.id = NEW.discount_id
    ON CONFLICT (redemption_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_redemption_feedback_on_redeem() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_redemption_feedback_on_redeem ON public.discount_redemptions;
CREATE TRIGGER tr_redemption_feedback_on_redeem
  AFTER UPDATE OF status ON public.discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_redemption_feedback_on_redeem();

-- ── Il link vale un mese ─────────────────────────────────────────────
-- Dopo, un feedback su una cena di due mesi fa non dice più niente, e un
-- link rimasto in una casella di posta non deve restare aperto per sempre.

-- Cosa serve alla pagina: il locale, lo sconto, a che punto si è.
CREATE OR REPLACE FUNCTION public.feedback_get(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row  redemption_feedback%ROWTYPE;
  v_out  jsonb;
BEGIN
  SELECT * INTO v_row FROM redemption_feedback WHERE token = p_token;
  IF v_row.redemption_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_row.redeemed_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT jsonb_build_object(
           'redemption_id', v_row.redemption_id,
           'redeemed_at',   v_row.redeemed_at,
           'rating',        v_row.rating,
           'answers',       v_row.answers,
           'comment',       v_row.comment,
           'completed',     v_row.completed_at IS NOT NULL,
           'first_name',    NULLIF(split_part(trim(COALESCE(p.full_name, '')), ' ', 1), ''),
           'restaurant',    jsonb_build_object(
                              'name',  r.name,
                              'slug',  r.slug,
                              'photo', (SELECT COALESCE(rp.thumb_url, rp.photo_url)
                                          FROM restaurant_photos rp
                                         WHERE rp.restaurant_id = r.id
                                         ORDER BY rp.sort_order NULLS LAST
                                         LIMIT 1)),
           'discount',      jsonb_build_object(
                              'title',          d.title,
                              'discount_type',  d.discount_type,
                              'discount_value', d.discount_value,
                              'is_drop',        COALESCE(d.is_drop, false))
         )
    INTO v_out
    FROM (SELECT 1) one
    LEFT JOIN restaurants r ON r.id = v_row.restaurant_id
    LEFT JOIN discounts   d ON d.id = v_row.discount_id
    LEFT JOIN profiles    p ON p.id = v_row.user_id;

  RETURN v_out;
END;
$function$;

-- Le stelle. Si salvano appena toccate: chi chiude subito dopo le ha date
-- comunque, e il giro delle email gli chiede solo di raccontare il resto.
CREATE OR REPLACE FUNCTION public.feedback_rate(p_token uuid, p_rating integer, p_source text DEFAULT 'app')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('error', 'invalid_rating');
  END IF;

  UPDATE redemption_feedback
     SET rating     = p_rating,
         rated_at   = now(),
         source     = COALESCE(source, CASE WHEN p_source IN ('app', 'email') THEN p_source END),
         updated_at = now()
   WHERE token = p_token
     AND redeemed_at >= now() - interval '30 days'
  RETURNING redemption_id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- Il modulo. Le stelle ci sono per forza (senza, il modulo non si apre).
CREATE OR REPLACE FUNCTION public.feedback_submit(
  p_token   uuid,
  p_rating  integer,
  p_answers jsonb,
  p_comment text,
  p_source  text DEFAULT 'app'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id      uuid;
  v_comment text := NULLIF(trim(COALESCE(p_comment, '')), '');
  v_answers jsonb := COALESCE(p_answers, '{}'::jsonb);
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('error', 'invalid_rating');
  END IF;
  IF jsonb_typeof(v_answers) <> 'object' OR octet_length(v_answers::text) > 2000 THEN
    RETURN jsonb_build_object('error', 'invalid_answers');
  END IF;
  IF v_comment IS NOT NULL AND char_length(v_comment) > 1500 THEN
    v_comment := left(v_comment, 1500);
  END IF;

  UPDATE redemption_feedback
     SET rating       = p_rating,
         rated_at     = COALESCE(rated_at, now()),
         answers      = v_answers,
         comment      = v_comment,
         completed_at = now(),
         source       = COALESCE(source, CASE WHEN p_source IN ('app', 'email') THEN p_source END),
         updated_at   = now()
   WHERE token = p_token
     AND redeemed_at >= now() - interval '30 days'
  RETURNING redemption_id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.feedback_get(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.feedback_rate(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.feedback_submit(uuid, integer, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feedback_get(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_rate(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_submit(uuid, integer, jsonb, text, text) TO anon, authenticated;

-- ── Il giro delle email si fa riconoscere così ───────────────────────
-- Il giro parte da pg_cron (vedi il file -cron) e chiama l'endpoint con un
-- token che sta nel Vault. L'endpoint lo confronta qui, con la service
-- role: così il segreto non va copiato a mano da nessuna parte.
CREATE OR REPLACE FUNCTION public.cron_token_ok(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(length(p_token) >= 32 AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
     WHERE name = 'chiamamibi_cron_token'
       AND decrypted_secret = p_token
  ), false);
$function$;

REVOKE EXECUTE ON FUNCTION public.cron_token_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_token_ok(text) TO service_role;
