-- ============================================================
-- FIX: "infinite recursion detected in policy for relation profiles"
-- ============================================================
-- Il problema: la tabella `profiles` ha una policy RLS che controlla
-- se l'utente è admin leggendo la stessa tabella `profiles`,
-- creando un loop infinito.
--
-- Esegui questo SQL nel SQL Editor di Supabase (https://supabase.com/dashboard)
-- ============================================================

-- STEP 1: Rimuovi le policy esistenti su profiles che causano la ricorsione
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users" ON profiles;

-- STEP 2: Crea policy SEMPLICI che non causano ricorsione
-- Ogni utente può leggere il proprio profilo
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Ogni utente può aggiornare il proprio profilo
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Ogni utente può inserire il proprio profilo (per la registrazione)
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- STEP 3: Crea una funzione SECURITY DEFINER per il check admin
-- Questa funzione bypassa le RLS policies, evitando la ricorsione
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- STEP 4: Aggiungi policy per permettere la lettura dei profili altrui
-- (necessario per vedere i nomi nelle recensioni, ecc.)
CREATE POLICY "Public read basic profile info" ON profiles
  FOR SELECT USING (true);

-- STEP 5: Ora aggiorna tutte le policy delle altre tabelle
-- che usavano il vecchio pattern con subquery su profiles.
-- Sostituisci con la funzione is_admin().

-- == DISCOUNTS ==
DROP POLICY IF EXISTS "Admin full access discounts" ON discounts;
CREATE POLICY "Admin full access discounts" ON discounts
  FOR ALL USING (public.is_admin());

-- == DISCOUNT REDEMPTIONS ==
DROP POLICY IF EXISTS "Admin read all redemptions" ON discount_redemptions;
CREATE POLICY "Admin read all redemptions" ON discount_redemptions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin update redemptions" ON discount_redemptions;
CREATE POLICY "Admin update redemptions" ON discount_redemptions
  FOR UPDATE USING (public.is_admin());

-- == RESTAURANT PARTNERS ==
DROP POLICY IF EXISTS "Admin full access partners" ON restaurant_partners;
CREATE POLICY "Admin full access partners" ON restaurant_partners
  FOR ALL USING (public.is_admin());

-- == USER REVIEWS (se esiste) ==
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_reviews') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access reviews" ON user_reviews';
    EXECUTE 'CREATE POLICY "Admin full access reviews" ON user_reviews FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- == TRANSLATIONS (se esiste) ==
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'translations') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage translations" ON translations';
    EXECUTE 'CREATE POLICY "Admin manage translations" ON translations FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- ============================================================
-- DONE! Dopo aver eseguito questo SQL, l'errore sparirà.
-- ============================================================
