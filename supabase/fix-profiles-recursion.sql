-- ============================================================
-- FIX: "infinite recursion detected in policy for relation profiles"
-- ============================================================
-- Esegui TUTTO questo SQL nel SQL Editor di Supabase
-- Dashboard → SQL Editor → New query → Incolla → Run
-- ============================================================

-- STEP 1: Rimuovi TUTTE le policy su profiles (nessuna esclusa)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users" ON profiles;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public read basic profile info" ON profiles;

-- STEP 2: Ricrea la funzione is_admin() con SECURITY DEFINER
-- Questa bypassa RLS, evitando la ricorsione
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

-- STEP 3: Ricrea le policy su profiles (SENZA ricorsione)
-- Chiunque può leggere i profili (nomi utente nelle recensioni, ecc.)
CREATE POLICY "Public read basic profile info" ON profiles
  FOR SELECT USING (true);

-- Ogni utente può aggiornare il proprio profilo
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Ogni utente può inserire il proprio profilo (registrazione)
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin accesso completo ai profili
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING (public.is_admin());

-- ============================================================
-- DONE! L'errore "infinite recursion" sparirà.
-- ============================================================
