-- ============================================================
-- Avvisi agli admin su Telegram — 2026-09-30
-- ============================================================
-- Un messaggio nel gruppo Telegram degli admin quando:
--   ✅ un locale convalida uno sconto (discount_redemptions → 'redeemed');
--   ⭐ chi l'ha usato manda la recensione (redemption_feedback.completed_at);
--   💡 arriva un suggerimento di locale (restaurant_suggestions);
--   🤝 arriva una candidatura di un locale (partner_applications).
--
-- Tutto nel DB: i trigger scrivono il testo e lo spediscono con pg_net
-- (asincrono: parte dopo il COMMIT, e se la transazione salta non parte
-- niente). Nessun endpoint Vercel in mezzo, nessun deploy da aspettare.
--
-- Token del bot e id del gruppo stanno nel Vault, non nel codice:
--   telegram_bot_token      — quello che dà @BotFather
--   telegram_admin_chat_id  — l'id del gruppo (numero negativo)
-- Senza uno dei due non parte niente e non si rompe niente.
--
-- Regola che non si salta: un avviso non deve MAI far fallire quello che
-- lo ha fatto partire (la convalida al banco, il modulo di un utente).
-- Ogni trigger ha il suo EXCEPTION WHEN OTHERS che si limita a un WARNING.
--
-- Configurare (una volta, dal SQL editor di Supabase):
--   SELECT vault.create_secret('<token di BotFather>', 'telegram_bot_token');
--   -- aggiungere il bot al gruppo, scrivere un messaggio nel gruppo, poi:
--   SELECT net.http_get('https://api.telegram.org/bot' ||
--     (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_bot_token')
--     || '/getUpdates');
--   -- qualche secondo dopo, l'id del gruppo è in "chat":{"id":-100…}:
--   SELECT content FROM net._http_response ORDER BY created DESC LIMIT 1;
--   SELECT vault.create_secret('-100…', 'telegram_admin_chat_id');
--
-- Spegnere tutto: cancellare il segreto telegram_admin_chat_id
--   DELETE FROM vault.secrets WHERE name = 'telegram_admin_chat_id';
--
-- Idempotente.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS private;

-- ── Testo sicuro per parse_mode=HTML ─────────────────────────────────
-- Telegram vuole escapati solo & < >. Il testo arriva dagli utenti (nomi,
-- recensioni, suggerimenti): senza escape un "<" rompe il messaggio intero.
CREATE OR REPLACE FUNCTION private.tg_html(p_text text, p_max integer DEFAULT 600)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT replace(replace(replace(
           CASE WHEN char_length(trim(COALESCE(p_text, ''))) > p_max
                THEN left(trim(p_text), p_max - 1) || '…'
                ELSE trim(COALESCE(p_text, '')) END,
         '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$function$;

-- Il nome di battesimo, come lo vedono i locali in /verify.
CREATE OR REPLACE FUNCTION private.tg_first_name(p_user_id uuid, p_fallback text DEFAULT NULL)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    NULLIF(split_part(trim(COALESCE((SELECT full_name FROM profiles WHERE id = p_user_id), '')), ' ', 1), ''),
    NULLIF(split_part(trim(COALESCE(p_fallback, '')), ' ', 1), ''),
    'Un utente');
$function$;

-- ── Spedire ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.telegram_admin_send(p_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_chat  text;
BEGIN
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'telegram_bot_token';
  SELECT decrypted_secret INTO v_chat  FROM vault.decrypted_secrets WHERE name = 'telegram_admin_chat_id';
  IF COALESCE(v_token, '') = '' OR COALESCE(v_chat, '') = '' OR COALESCE(p_text, '') = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body    := jsonb_build_object(
                 'chat_id', v_chat,
                 'text', left(p_text, 4000),
                 'parse_mode', 'HTML',
                 'disable_web_page_preview', true),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
END;
$function$;

-- ── ✅ Sconto usato ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.tg_notify_redeemed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_d      record;
  v_used   integer;
  v_today  integer;
  v_kind   text;
  v_text   text;
BEGIN
  IF NOT (NEW.status = 'redeemed' AND OLD.status IS DISTINCT FROM 'redeemed') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT d.title, d.is_drop, d.is_test, d.max_redemptions, r.name AS restaurant
      INTO v_d
      FROM discounts d
      LEFT JOIN restaurants r ON r.id = d.restaurant_id
     WHERE d.id = NEW.discount_id;

    SELECT count(*) INTO v_used
      FROM discount_redemptions
     WHERE discount_id = NEW.discount_id AND status = 'redeemed';

    -- "Oggi" all'ora di Roma, non di UTC.
    SELECT count(*) INTO v_today
      FROM discount_redemptions
     WHERE status = 'redeemed'
       AND redeemed_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome');

    v_kind := CASE
      WHEN COALESCE(v_d.is_drop, false) AND v_d.max_redemptions IS NOT NULL
        THEN 'Drop · usati ' || v_used || ' su ' || v_d.max_redemptions
      WHEN COALESCE(v_d.is_drop, false)
        THEN 'Drop · ' || v_used || '° uso'
      ELSE 'Convenzione · ' || v_used || '° uso'
    END;

    v_text :=
      CASE WHEN COALESCE(v_d.is_test, false) THEN '🧪 <b>PROVA</b> · ' ELSE '' END
      || '✅ <b>Sconto usato</b> — ' || private.tg_html(COALESCE(v_d.restaurant, 'Locale'), 120) || E'\n'
      || private.tg_html(COALESCE(v_d.title, 'Sconto'), 160) || ' · ' || v_kind || E'\n'
      || '👤 ' || private.tg_html(private.tg_first_name(NEW.user_id, NEW.user_name), 60)
      || ' · ' || to_char(COALESCE(NEW.redeemed_at, now()) AT TIME ZONE 'Europe/Rome', 'HH24:MI') || E'\n'
      || '📊 Oggi: ' || v_today || CASE WHEN v_today = 1 THEN ' sconto usato' ELSE ' sconti usati' END;

    PERFORM private.telegram_admin_send(v_text);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'telegram (redeemed): %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_telegram_redeemed ON public.discount_redemptions;
CREATE TRIGGER tr_telegram_redeemed
  AFTER UPDATE OF status ON public.discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION private.tg_notify_redeemed();

-- ── ⭐ Recensione ────────────────────────────────────────────────────
-- Parte quando il modulo è mandato (completed_at), non al tocco sulle
-- stelle: così ogni recensione è un messaggio solo, con stelle e parole
-- insieme. Il modulo si manda da solo anche se chi scrive chiude l'app
-- (submitFeedbackNow), e dalle email si arriva allo stesso punto.
-- Le chiavi di `answers` e le etichette sono quelle di
-- src/lib/redemptionFeedback.js.
CREATE OR REPLACE FUNCTION private.tg_notify_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_d      record;
  v_liked  text;
  v_extra  text[] := '{}';
  v_text   text;
BEGIN
  IF NOT (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT d.title, d.is_test, r.name AS restaurant
      INTO v_d
      FROM (SELECT 1) one
      LEFT JOIN discounts d   ON d.id = NEW.discount_id
      LEFT JOIN restaurants r ON r.id = NEW.restaurant_id;

    SELECT string_agg(CASE k
             WHEN 'cibo'      THEN 'il cibo'
             WHEN 'servizio'  THEN 'il servizio'
             WHEN 'atmosfera' THEN 'l''atmosfera'
             WHEN 'prezzo'    THEN 'il prezzo'
             WHEN 'attesa'    THEN 'l''attesa'
             ELSE k END, ', ')
      INTO v_liked
      FROM jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(NEW.answers->'liked') = 'array' THEN NEW.answers->'liked' ELSE '[]'::jsonb END
           ) AS k;

    IF NEW.answers->>'sconto' IS NOT NULL THEN
      v_extra := v_extra || ('Sconto: ' || CASE NEW.answers->>'sconto'
        WHEN 'liscio'   THEN 'liscio come l''olio'
        WHEN 'intoppo'  THEN 'qualche intoppo'
        WHEN 'problema' THEN '⚠️ non ha funzionato'
        ELSE NEW.answers->>'sconto' END);
    END IF;
    IF NEW.answers->>'tornare' IS NOT NULL THEN
      v_extra := v_extra || ('Ci tornerebbe: ' || CASE NEW.answers->>'tornare'
        WHEN 'si' THEN 'sì' ELSE NEW.answers->>'tornare' END);
    END IF;

    v_text :=
      CASE WHEN COALESCE(v_d.is_test, false) THEN '🧪 <b>PROVA</b> · ' ELSE '' END
      || '⭐ <b>Recensione</b> — ' || private.tg_html(COALESCE(v_d.restaurant, 'Locale'), 120) || E'\n'
      || repeat('★', COALESCE(NEW.rating, 0)) || repeat('☆', 5 - COALESCE(NEW.rating, 0))
      || ' ' || COALESCE(NEW.rating, 0) || '/5 · ' || CASE NEW.rating
           WHEN 1 THEN 'Proprio no'
           WHEN 2 THEN 'Poteva andare meglio'
           WHEN 3 THEN 'Nella media'
           WHEN 4 THEN 'Mi è piaciuto'
           WHEN 5 THEN 'Da tornarci!'
           ELSE '' END || E'\n'
      || CASE WHEN v_liked IS NOT NULL
              THEN CASE WHEN COALESCE(NEW.rating, 0) >= 4 THEN 'Piaciuto: ' ELSE 'Da migliorare: ' END
                   || v_liked || E'\n'
              ELSE '' END
      || CASE WHEN array_length(v_extra, 1) > 0 THEN array_to_string(v_extra, ' · ') || E'\n' ELSE '' END
      || CASE WHEN NULLIF(trim(COALESCE(NEW.comment, '')), '') IS NOT NULL
              THEN '💬 «' || private.tg_html(NEW.comment, 1500) || '»' || E'\n'
              ELSE '' END
      || '👤 ' || private.tg_html(private.tg_first_name(NEW.user_id), 60)
      || ' · ' || private.tg_html(COALESCE(v_d.title, 'Sconto'), 120) || E'\n'
      || 'https://chiamamibi.com/admin/feedback';

    PERFORM private.telegram_admin_send(v_text);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'telegram (feedback): %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_telegram_feedback ON public.redemption_feedback;
CREATE TRIGGER tr_telegram_feedback
  AFTER UPDATE OF completed_at ON public.redemption_feedback
  FOR EACH ROW EXECUTE FUNCTION private.tg_notify_feedback();

-- ── 💡 Suggerimento di un locale ─────────────────────────────────────
-- Il modulo accetta anche chi non ha un account: oltre 20 in un'ora gli
-- avvisi si fermano (il pannello li ha comunque tutti), così uno spam sul
-- modulo non diventa uno spam nel gruppo.
CREATE OR REPLACE FUNCTION private.tg_notify_suggestion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recent integer;
  v_text   text;
BEGIN
  BEGIN
    SELECT count(*) INTO v_recent
      FROM restaurant_suggestions
     WHERE created_at > now() - interval '1 hour';
    IF v_recent > 20 THEN
      RETURN NEW;
    END IF;

    v_text :=
      '💡 <b>Nuovo suggerimento</b> — ' || private.tg_html(NEW.restaurant_name, 120) || E'\n'
      || CASE WHEN NULLIF(trim(COALESCE(NEW.address, '')), '') IS NOT NULL
              THEN '📍 ' || private.tg_html(NEW.address, 200) || E'\n' ELSE '' END
      || CASE WHEN COALESCE(array_length(NEW.tags, 1), 0) > 0
              THEN '🏷 ' || private.tg_html(array_to_string(NEW.tags, ', '), 200) || E'\n' ELSE '' END
      || CASE WHEN NULLIF(trim(COALESCE(NEW.description, '')), '') IS NOT NULL
              THEN '«' || private.tg_html(NEW.description, 800) || '»' || E'\n' ELSE '' END
      || '👤 ' || CASE WHEN NEW.user_id IS NOT NULL
                       THEN private.tg_html(private.tg_first_name(NEW.user_id), 60)
                       ELSE 'senza account' END || E'\n'
      || 'https://chiamamibi.com/admin/suggestions';

    PERFORM private.telegram_admin_send(v_text);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'telegram (suggestion): %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_telegram_suggestion ON public.restaurant_suggestions;
CREATE TRIGGER tr_telegram_suggestion
  AFTER INSERT ON public.restaurant_suggestions
  FOR EACH ROW EXECUTE FUNCTION private.tg_notify_suggestion();

-- ── 🤝 Candidatura di un locale ──────────────────────────────────────
-- Le scrive solo api/partner-application.js (captcha + rate limit), che
-- manda già l'email a info@. Email e telefono del candidato restano
-- nell'email e nel pannello: su Telegram non servono per capire chi è.
CREATE OR REPLACE FUNCTION private.tg_notify_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_text text;
BEGIN
  BEGIN
    v_text :=
      '🤝 <b>Nuova candidatura</b> — ' || private.tg_html(NEW.restaurant_name, 120) || E'\n'
      || CASE WHEN NULLIF(trim(COALESCE(NEW.address, '')), '') IS NOT NULL
              THEN '📍 ' || private.tg_html(NEW.address, 200) || E'\n' ELSE '' END
      || '👤 ' || private.tg_html(COALESCE(NEW.contact_name, ''), 120) || E'\n'
      || CASE WHEN NULLIF(trim(COALESCE(NEW.instagram, '')), '') IS NOT NULL
              THEN '📸 ' || private.tg_html(NEW.instagram, 120) || E'\n' ELSE '' END
      || CASE WHEN NULLIF(trim(COALESCE(NEW.motivation, NEW.message, '')), '') IS NOT NULL
              THEN '«' || private.tg_html(COALESCE(NEW.motivation, NEW.message), 800) || '»' || E'\n' ELSE '' END
      || 'https://chiamamibi.com/admin/applications';

    PERFORM private.telegram_admin_send(v_text);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'telegram (application): %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_telegram_application ON public.partner_applications;
CREATE TRIGGER tr_telegram_application
  AFTER INSERT ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION private.tg_notify_application();

-- ── Nessuno le chiama da fuori ───────────────────────────────────────
REVOKE EXECUTE ON FUNCTION private.tg_first_name(uuid, text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.telegram_admin_send(text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.tg_notify_redeemed()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.tg_notify_feedback()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.tg_notify_suggestion()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.tg_notify_application()     FROM PUBLIC, anon, authenticated;
