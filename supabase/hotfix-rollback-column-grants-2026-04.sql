-- ============================================================================
-- HOTFIX 2026-04-15: ripristina GRANT SELECT completo su profiles e restaurants
-- ============================================================================
-- Il commit security-hardening-2026-04.sql aveva REVOCATO SELECT sulle tabelle
-- e ri-GRANTato SOLO alcune colonne. Ma il frontend usa `select('*')` in vari
-- punti → PostgreSQL risolve `*` in tutte le colonne e FALLISCE se anche una
-- sola colonna non è GRANTata. Conseguenze osservate:
--   • Mappa homepage vuota (restaurants select('*') → permission denied)
--   • Admin login va in loop (profiles select('*') → permission denied)
--
-- Questo hotfix ripristina SELECT completo su entrambe le tabelle.
-- Le protezioni vere (RLS, RPC, trigger anti-escalation, rate limits) RESTANO
-- attive. Le colonne sensibili (verify_pin, recovery_otp) tornano leggibili,
-- le indirizzeremo più avanti con:
--   • DROP COLUMN restaurants.verify_pin (ora gestito da restaurant_partners)
--   • HASH recovery_otp (bcrypt/pgcrypto)
-- ============================================================================

-- 1) Restaurants: ripristina SELECT completo
GRANT SELECT ON public.restaurants TO anon, authenticated;

-- 2) Profiles: ripristina SELECT / INSERT / UPDATE completi a livello tabella
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- 3) Doppia sicurezza: concedi USAGE sullo schema (di solito già presente)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ============================================================================
-- Cosa resta ATTIVO dal hardening originale:
--   ✓ Trigger prevent_self_admin_escalation (impedisce self-upgrade a admin)
--   ✓ RLS policies ristrette su discount_redemptions (owner + admin)
--   ✓ RLS policies ristrette su user_reviews (no self-publish)
--   ✓ RPC verify_login / verify_touch_device / verify_redeem_qr / verify_activity_list
--   ✓ increment_discount_redeemed ristretta ad admin
--   ✓ Tutte le protezioni server-side (SSRF, rate limiting, security headers)
-- ============================================================================

SELECT 'Hotfix applicato. Ricarica il sito.' AS status;
