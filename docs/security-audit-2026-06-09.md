# Audit Sicurezza & Funzionalità — 2026-06-09

Audit completo: dipendenze, header, endpoint API, frontend/route, env, RLS/DB live.
Branch: `claude/friendly-brown-ply0bv`.

## 🔴 CRITICO — RISOLTO & VERIFICATO SUL DB LIVE

### C1 — PIN ristoratori leggibili da `anon` (account-takeover merchant)
La policy SELECT su `restaurants` era `USING(true)` e `anon` aveva il GRANT SELECT
di **tabella**: con la sola anon key pubblica (nel bundle JS) si potevano leggere
`restaurants.verify_pin` (6 ristoranti), `magic_token`, `partner_email`, e
`restaurant_partners.pin_code` (7 partner attivi). Con il `verify_pin` si fa login
alla dashboard ristoratore → riscatto QR, statistiche, impostazioni.

**Fix applicato** (`supabase/hotfix-pin-column-exposure-2026-06-09.sql`):
- `restaurants`: policy → `is_published = true OR is_admin()`; revoca SELECT di
  tabella ad `anon` e ri-concessione delle sole colonne pubbliche (escluse
  `verify_pin`, `magic_token`, `magic_token_expires_at`, `partner_email`,
  `onboarding_email_sent_at`).
- `restaurant_partners`: policy SELECT → `is_admin()` (il flusso merchant usa gli
  RPC `verify_*` SECURITY DEFINER, non più query dirette → nessuna rottura).
- `profiles`: `recovery_email` rimosso dalle colonne leggibili da `anon`.

Verificato: `anon` riceve `permission denied` su `verify_pin` e legge solo i
ristoranti pubblicati; le colonne pubbliche restano leggibili → sito intatto.

## 🟠 ALTO — residuo noto (richiede follow-up)

### A1 — `authenticated` legge ancora `verify_pin` dei ristoranti pubblicati
Il ruolo `authenticated` conserva SELECT su `verify_pin`/`magic_token`/`partner_email`
perché il pannello admin (anch'esso `authenticated`) li legge via PostgREST
(`DiscountManager` fa un select esplicito di `verify_pin`; `CredenzialiTab` lo
mostra). Con registrazione aperta, un utente loggato può ancora leggere il
`verify_pin` dei 6 ristoranti pubblicati.
**Fix consigliato (non applicato per non rischiare di rompere l'admin senza test
in browser):** RPC `admin_get_verify_pin(restaurant_id)` SECURITY DEFINER guardata
da `is_admin()`, poi REVOKE di queste colonne anche da `authenticated`, aggiornando
`DiscountManager`/`CredenzialiTab`/`EditRestaurant`/`RestaurantDrawer` a usarla.

### A2 — Dipendenze vulnerabili — RISOLTO
`npm audit`: 6 vuln (3 high) → **0**. `react-router-dom` 7.13.1 → **7.17.0** (chiude
RCE/open-redirect/XSS di turbo-stream), + `postcss`/`ws`/`js-cookie`/
`protocol-buffers-schema`. Rimossa chiave duplicata `@react-pdf/renderer` in
`package.json`. Build OK.

### A3 — `send-email.js`: invio a destinatario arbitrario senza captcha
I tipi `user`/`confirmation`/`partner-application-confirmation` sono non
autenticati e protetti solo dal rate-limit in-memory (aggirabile) → spam/phishing
brandizzato dal dominio. **Parziale:** aggiunta validazione formato email al tipo
`user`. **Da fare:** Turnstile su questi tipi (richiede invio token lato client) +
rate-limit durable.

### A4 — `recovery-otp.js`: brute-force OTP
Il cap `failed_attempts` viene **saltato** se la colonna non esiste (errori
swallowed), lasciando solo il rate-limit in-memory. OTP valido → reset password /
cambio email senza policy. **Da fare:** rendere il cap obbligatorio (fail-closed) e
uniformare le risposte del verify-step (oggi enumerabili).

## 🟡 MEDIO

- **`track.js`** — RISOLTO: unico writer service_role non autenticato; aggiunti
  rate-limit (120/min), validazione `user_id` come UUID, cap lunghezze.
- **`places-details.js` GET `?placeId=`** — RISOLTO: ora admin-only (consumava
  budget Google senza auth). Il ramo `?restaurantId=` resta pubblico e cached.
- **`_rate-limit.js`** — migliorato: usa l'IP fidato di Vercel (`x-real-ip`) prima
  dell'`x-forwarded-for` spoofabile. Resta in-memory → migrare a Upstash/KV (root
  di A3/A4).
- **`_turnstile.js` fail-open** — se `TURNSTILE_SECRET_KEY` manca, il captcha è
  saltato anche in prod. **Da fare:** fail-closed in produzione (non applicato:
  romperebbe i form se il secret non è configurato — verificare env prima).
- **CORS `*.vercel.app`** — wildcard ampio (`_cors.js:22`); restringere al prefisso
  del progetto.
- **Supabase advisors** — `increment_discount_redeemed` e funzioni-trigger
  eseguibili via RPC da `anon`; 2 funzioni con `search_path` mutabile. Revocare
  EXECUTE dalle funzioni-trigger, settare `search_path`.

## 🟢 BASSO / qualità

- **`discount-pdf.js`** — RISOLTO: rimossi header `X-Photo-Url`/`X-Photo-Status`
  che leakavano URL storage interni.
- **Lint: 411 errori** (non bloccano la build): chiamate impure (`Date.now()` in
  render, `VerifyPage.jsx:207`), hook deps mancanti, variabili inutilizzate.
- **`resolve-maps.js`** — path Instagram reel segue redirect senza ri-validazione
  per-hop (path Maps invece ben difeso); `_debug` verboso in risposta.
- **Bundle Mapbox 1,67 MB** — valutare lazy-load.
- **Guard admin** replicato in 15 pagine invece di un `<ProtectedRoute>` (dati
  comunque protetti da RLS); `innerHTML` con emoji admin in `MapView.jsx`; nessun
  filtro protocollo `javascript:` su `href` da DB; dead code `RestaurantForm.jsx`.

## ✅ Punti di forza
Nessun secret hardcoded; `service_role` mai lato client; `.env` non in git; header
HTTP completi (HSTS/CSP/X-Frame/Permissions-Policy); SSRF ben difeso in `img.js` e
nel path Maps; IDOR prevenuto in `discount-pdf.js`/`delete-account.js`/`ai.js`;
output HTML/XML/JSON sempre escaped; `discount_redemptions` e `verified_devices`
già hardenati (owner/admin-only, confermato live).
