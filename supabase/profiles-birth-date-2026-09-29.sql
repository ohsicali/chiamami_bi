-- =====================================================================
-- DATA DI NASCITA DEGLI UTENTI (29/09)
-- =====================================================================
-- Da oggi la registrazione con email la chiede (LoginPage) e chi aveva già
-- un account la trova chiesta da un popup (BirthDateGate). Regole lato app:
-- src/lib/birthDate.js — i limiti di età qui sotto sono gli stessi
-- (MIN_AGE 16 come i Termini di Servizio, MAX_AGE 110): se cambi l'uno
-- cambia anche l'altro.
--
-- Idempotente: si può rieseguire.
-- =====================================================================

-- 1. La colonna, e i permessi NELLA STESSA TRANSAZIONE.
-- `profiles` ha solo grant di colonna per `authenticated`: una colonna nuova
-- senza grant fa fallire per intero il `select('*')` con cui l'app legge il
-- profilo (useAuth, ProfilePage) — cioè il profilo di tutti.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
GRANT SELECT (birth_date), INSERT (birth_date), UPDATE (birth_date)
  ON public.profiles TO authenticated;
-- anon non ha niente su profiles (audit 23/09) e resta così.


-- 2. Una data sola regola: niente date impossibili né chi ha meno di 16 anni.
-- Restituisce NULL invece di lanciare, così il trigger di registrazione non
-- si rompe per dei metadati scritti a mano.
CREATE OR REPLACE FUNCTION private.valid_birth_date(p text)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  d date;
BEGIN
  IF p IS NULL OR p !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN NULL;
  END IF;
  BEGIN
    d := p::date;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF d > (current_date - interval '16 years')::date
     OR d < (current_date - interval '110 years')::date THEN
    RETURN NULL;
  END IF;
  RETURN d;
END;
$function$;
REVOKE ALL ON FUNCTION private.valid_birth_date(text) FROM PUBLIC, anon, authenticated;


-- 3. Chi scrive nel profilo (browser, admin) non può mettere una data fuori
-- regola. Scatta solo quando birth_date cambia: un profilo vecchio non si
-- blocca il giorno in cui le regole cambiano. SECURITY DEFINER perché chi
-- scrive dal browser non ha accesso allo schema `private`.
CREATE OR REPLACE FUNCTION public.check_profile_birth_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.birth_date IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.birth_date IS DISTINCT FROM OLD.birth_date)
     AND private.valid_birth_date(NEW.birth_date::text) IS NULL THEN
    RAISE EXCEPTION 'birth_date fuori regola (minimo 16 anni)'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.check_profile_birth_date() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_profile_birth_date ON public.profiles;
CREATE TRIGGER check_profile_birth_date
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_birth_date();


-- 4. La registrazione: la data arriva nei metadati (signUp in useAuth, come
-- il nome) e il trigger la copia nel profilo. Resto identico a prima,
-- compreso il "non bloccare mai la registrazione".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, birth_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    private.valid_birth_date(NEW.raw_user_meta_data->>'birth_date')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    birth_date = COALESCE(profiles.birth_date, EXCLUDED.birth_date);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Non bloccare la registrazione se il profilo fallisce
  -- Il client creerà il profilo al primo login
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
