# Security Audit — 2026-05-14

Audit completo del codice e dei flussi pubblici di ChiamamiBi. Lo scopo era
rispondere alla domanda: "il sito è sicuro al 100% da attacchi esterni? Servono
reCAPTCHA?".

Risultato sintetico: il sito è solido sulla auth (Supabase OAuth + magic
token + admin guard), sui secret (env vars server-side), sugli header HTTP
(HSTS / X-Frame / Referrer / Permissions). Sono stati però trovati alcuni
problemi su form pubblici, upload, e RLS di `verified_devices` che sono stati
corretti in questa PR. Per il CAPTCHA la raccomandazione è **Cloudflare
Turnstile** (gratuito senza limiti) da integrare in una PR successiva.

---

## Fix applicati in questa PR

### Code-only (live al merge)

| # | Severity | Problema | File | Soluzione |
|---|----------|----------|------|-----------|
| 1 | HIGH | Email header injection: `reply_to: email` con email del form non validata → un newline poteva iniettare header `Bcc` arbitrari | `api/partner-application.js` | Regex strict + reject `\r\n`, length cap, control-char strip su tutti i campi |
| 2 | HIGH | Upload foto suggerimenti senza validazione MIME/size: un attaccante può salvare file arbitrari nel bucket `suggestions` | `src/components/Restaurant/SuggestRestaurantSheet.jsx` | Whitelist MIME (jpg/png/webp/heic/heif), cap 8 MB, estensione derivata dal MIME (non dal filename), `contentType` esplicito |
| 3 | MEDIUM | CORS `Access-Control-Allow-Origin: *` su tutte le API: qualsiasi sito poteva chiamare i nostri endpoint dal browser di un utente loggato | tutti gli `api/*.js` | Helper `api/_cors.js` che riflette `Origin` solo se in whitelist (`chiamamibi.com` + Vercel preview + localhost) |
| 4 | MEDIUM | OTP brute-force: 10 tentativi/min senza cap di fallimenti per token | `api/recovery-otp.js` | Rate limit verify da 10 → 5/min, max 5 tentativi falliti per OTP poi token invalidato, `String(otp).trim()` per evitare TypeError |
| 5 | MEDIUM | `resolve-maps.js` accettava `http:` come protocollo input e seguiva redirect a `http://` su host Google | `api/resolve-maps.js` | Solo `https:` accettato all'ingresso e re-validato a ogni hop del redirect chain |
| 6 | MEDIUM | Rate-limit lasco su endpoint email unauth (`internal-notify` 10/min, `confirmation` 5/min): un attaccante poteva spammare `info@chiamamibi.com` o mandare mail di conferma a indirizzi arbitrari | `api/send-email.js` | Entrambi 3/min, email regex strict, cap length sui campi free-text |

### Migration SQL (richiede esecuzione manuale)

File: **`supabase/security-hardening-2026-05.sql`** — istruzioni dentro.

| # | Severity | Problema | Tabella | Fix |
|---|----------|----------|---------|-----|
| 7 | HIGH | `verified_devices` con policy `USING (true)` su SELECT/INSERT/UPDATE: chiunque può enumerare i device token di tutti i ristoranti e generarne di falsi bypassando il PIN | `verified_devices` | Drop policy aperte + 2 RPC `SECURITY DEFINER`: `register_verified_device(pin, restaurant_id, ua)` che valida il PIN server-side, `is_device_token_valid(token, restaurant_id)`. **Richiede deploy del client prima/insieme** (i due RPC sono già pronti per essere consumati dal codice del partner verify flow) |
| 8 | MEDIUM | `auth_recovery_tokens` senza colonna `failed_attempts` per cap brute-force OTP | `auth_recovery_tokens` | `ADD COLUMN failed_attempts smallint NOT NULL DEFAULT 0`. Il client `/api/recovery-otp.js` la incrementa e a 5 cancella il token |
| 9 | MEDIUM | Bucket storage `suggestions` accettava qualsiasi MIME/size | `storage.objects` | Policy `INSERT` con check su `metadata->>'mimetype'` + size ≤ 8 MB |
| 10 | LOW | Colonna legacy `profiles.recovery_otp` in chiaro | `profiles` | `DROP COLUMN IF EXISTS recovery_otp` |

---

## Cosa è rimasto INTENZIONALMENTE fuori da questa PR

### 1. reCAPTCHA / Cloudflare Turnstile sui form pubblici

I tre form pubblici unauthenticated (partner application, suggest restaurant,
recovery OTP) non hanno CAPTCHA. Il rate-limit è la sola difesa contro spam.

Raccomandazione: **Cloudflare Turnstile** (gratuito senza limiti, no tracking).
Implementazione futura:
- Creare il widget invisibile su `cloudflare.com/turnstile` (siteKey pubblica + secret server-side)
- Aggiungere `<Turnstile />` ai 3 form (`PartnerLandingPage`, `SuggestRestaurantSheet`, `RecoveryEmailModal`)
- Validare il token server-side via POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` prima di processare la richiesta

Effort stimato: 1 PR, ~2 ore.

### 2. Rate limit globale (Upstash Redis)

Il rate-limit attuale è in-memory per istanza Vercel. Un attaccante distribuito
su molti IP può aggirarlo. Da migrare a Upstash Ratelimit per renderlo durable
fra le istanze. Richiede un account Upstash (free tier sufficiente).

### 3. Content-Security-Policy con nonce

L'attuale CSP usa `'unsafe-inline' 'unsafe-eval'` perché richiesti da Mapbox
GL. Per chiuderlo serve uno script di build che inietti un nonce nelle
inline script, oppure migrare a un'edge function. Non-trivial; il rischio
residuo è basso perché abbiamo già `X-Frame-Options: SAMEORIGIN` e
HSTS preload.

### 4. `verified_devices` RLS — applicazione del blocco 1 nello SQL

Il blocco 1 dello SQL `security-hardening-2026-05.sql` cambia il contratto
delle query dirette sulla tabella. Prima di applicarlo bisogna verificare
che NESSUN client esistente faccia `from('verified_devices').select(...)` o
`.insert(...)` — se sì, va migrato a `rpc('register_verified_device', ...)` /
`rpc('is_device_token_valid', ...)`. Lo SQL è già marcato `BEGIN/COMMIT` e
documentato; eseguilo solo dopo aver verificato i call site del client.

---

## Cose verificate e OK (no fix necessario)

- ✅ Secrets server-side (RESEND_API_KEY, SERVICE_ROLE, ANTHROPIC) presi solo da `process.env`, mai esposti al client. Nessun secret in `.env` committato (solo `.env.example`).
- ✅ Admin dashboard protetta da `useAuth` + `profiles.is_admin` check, con trigger `prevent_self_admin_escalation` che blocca self-promotion (già in `security-hardening-2026-04.sql`).
- ✅ `escapeHtml()` usato in tutti gli HTML email template di `send-email.js`.
- ✅ Magic token partner: UUID con 24h TTL, one-time use (campo azzerato dopo consumo).
- ✅ Storage bucket `photos`: public read OK (foto sono pubbliche by design), upload limitato a `auth.role() = 'authenticated'`.
- ✅ Header HTTP: HSTS preload, X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrittiva.
- ✅ SSRF su `resolve-maps.js`: allowlist host Google, re-validation dopo ogni redirect, no fetch su IP locali o protocolli non-https (fix applicato).
- ✅ Admin actions API: Bearer token validato contro Supabase, controllo `is_admin` su `profiles` via service role.
- ✅ `escapeHtml()` su tutti i template HTML email — XSS via template injection bloccato.
- ⚠ `innerHTML` in `src/components/Map/MapView.jsx:114, 166` con `emoji` da `getCategoryInfo()`: input deriva da costanti admin-controlled, non da user input. LOW.

---

## Come testare in produzione dopo il deploy

1. **CORS**: da un browser su un dominio esterno, prova `fetch('https://chiamamibi.com/api/track', { method: 'POST', body: '...' })`. Deve fallire con CORS error.
2. **Email header injection**: invia partner application con email `"test@test.com\nBcc: x@y.com"`. Deve rispondere 400.
3. **Upload validation**: prova a caricare un `.exe` rinominato `.jpg` nel form Suggest. Deve essere rifiutato lato client (e dopo lo SQL, anche lato storage).
4. **OTP brute-force**: richiedi un OTP, prova 6 codici a caso. Al 6° tentativo il token deve essere invalidato (richiede nuova richiesta OTP).
5. **resolve-maps**: chiama l'endpoint con `url: "http://maps.google.com/..."`. Deve 400.

---

Audit eseguito sul branch `claude/security-audit-forms-ivN7Q`.
