# Audit sicurezza — 23/09/2026

Attacco a tutto il sito (endpoint `/api`, DB Supabase live, storage, frontend,
dipendenze), cercando cosa può fare un estraneo con quello che trova nel
bundle JS pubblico — cioè la chiave anon — più, al massimo, un account
registrato da sé (la registrazione è aperta). Segue l'audit del 09/06
(`docs/security-audit-2026-06-09.md`) e ne chiude i residui.

Ogni falla del DB è stata **provata sul DB live** con `set local role
anon/authenticated` in una transazione annullata, prima e dopo il fix.

## Stato dei fix

| | Dove | Stato |
|---|---|---|
| SQL parte A | `supabase/security-audit-2026-09-23.sql` | ✅ **applicata sul DB live il 23/09** (migration `security_audit_2026_09_23_part_a`) |
| Codice | questa PR (`api/`, `src/`) | da mergiare |
| SQL parte B | `supabase/security-audit-2026-09-23-part-b.sql` | ⏳ **da eseguire DOPO il deploy della PR** |

La parte B va dopo il deploy perché toglie colonne a `authenticated`: il
frontend vecchio chiedeva `select=*` su `restaurants` (pannello admin, pagine
Salvati) e con i grant di colonna quella richiesta fallisce intera. Il
frontend nuovo funziona con e senza la parte B. Provata a secco sul live:
l'admin legge i 107 locali e i 16 PIN (via RPC), un utente i 98 pubblicati e
nessun PIN.

## 🔴 Critiche

### C1 — Email e nomi di tutti gli utenti scaricabili senza login
`profiles` aveva la policy SELECT `USING (true)` e `anon` il grant su `email`:
con la sola chiave pubblica si leggevano **396 email + nomi** (GDPR). Un
utente loggato leggeva anche le `recovery_email` altrui.
**Fix (A, applicato):** policy → `auth.uid() = id OR is_admin()`, revoca di
ogni privilegio di `anon` su `profiles`. Nessuna pagina pubblica legge il
profilo di un altro (il nome che vede il ristoratore arriva dagli RPC
`verify_*` o da `discount_redemptions.user_name`).

### C2 — PIN di tutti i ristoratori leggibili da qualunque utente registrato
Residuo A1 del 09/06, ancora aperto: `authenticated` aveva il SELECT di
tabella su `restaurants` → `verify_pin` (16 su 16), `partner_email`,
`magic_token`. Col PIN si entra in `/verify`: riscatto QR, statistiche,
cambio PIN ed email del locale.
**Fix:** RPC `admin_restaurant_secrets()` guardata da `is_admin()` (A,
applicata); il pannello admin legge PIN ed email da lì
(`src/lib/restaurantColumns.js`); `RestaurantDrawer`, `EditRestaurant`,
`SavedPage`, `DesktopSavedPage` chiedono colonne esplicite invece di `*`;
revoca delle colonne segrete ad `authenticated` (B, dopo il deploy).

### C3 — Login ristoratori indovinabile a raffica
`verify_login(p_pin)` cerca il PIN fra **tutti** i locali, senza freno lato
server (il blocco dopo 5 errori stava nel `localStorage`). ~27 PIN validi su
900.000: in media ~33.000 chiamate dirette a PostgREST, pochi minuti.
**Fix (A, applicato):** tentativi falliti contati in `private.verify_login_failures`
— max 8 per IP in 15 min e 40 in totale per ora (contro chi ruota gli IP);
poi `too_many_attempts`, che `VerifyPage` mostra come blocco. Tolto anche il
`magic_token` dalla risposta. Chiuso `register_verified_device` (vecchio login
per singolo locale, nessun freno, non più usato).

### C4 — Chiunque registrato poteva cancellare o sostituire tutte le foto
Le policy del bucket `photos` chiedevano solo `authenticated`: upload,
sovrascrittura e cancellazione di qualunque file. In più nessun limite di
tipo: un HTML/SVG caricato lì veniva servito da `/api/img` **dal dominio
chiamamibi.com** (XSS memorizzato).
**Fix:** policy di scrittura solo `is_admin()` e bucket limitati a immagini
(A, applicato); `/api/img` rifiuta tutto ciò che non è un'immagine raster e
aggiunge `CSP: sandbox` + `nosniff` (codice).

## 🟠 Alte

### A1 — Drop esauribili da un solo utente
Ogni INSERT in `discount_redemptions` fa +1 a `total_redeemed`, da cui si
calcola "esaurito". Un utente poteva inserire/cancellare il proprio riscatto
in ciclo (la DELETE gli era concessa) e far risultare esaurito qualunque drop;
poteva anche inserire un riscatto già `redeemed` o per uno sconto spento.
**Fix (A, applicato):** DELETE solo admin; trigger `guard_redemption_insert`:
un riscatto per utente e sconto, nasce sempre `generated`, sconto attivo, non
scaduto, non esaurito. L'app già riusava il riscatto esistente: nessun cambio
per chi usa il sito.

### A2 — `/api/send-email` come relay di spam col nostro mittente
`confirmation` e `partner-application-confirmation` spedivano a **qualsiasi
indirizzo** un testo in parte scelto da chi chiamava, senza captcha; `user`
(benvenuto) idem, verso qualunque indirizzo.
**Fix:** le due conferme non hanno più un invio pubblico — le manda il server
dopo il captcha (`internal-notify` e `/api/partner-application`); il benvenuto
parte solo verso un account creato nelle ultime 24h e una volta sola (prima,
tra l'altro, ne partivano due). `discount-used` non scrive per riscatti vecchi
di oltre 2 ore.

### A3 — `/api/resolve-maps` aperto a tutti
La ricerca per nome consuma la chiave Google Places a pagamento, senza
autenticazione né rate limit. **Fix:** solo admin + rate limit; il ramo reel
non segue più i redirect fuori da Instagram.

### A4 — Dipendenze
`npm audit`: 7 vulnerabilità (5 alte) → **0**. `react-router`, `vite`,
`postcss`, `nanoid`, `fflate` (fix compatibili) e `sharp` 0.34 → 0.35.4
(libvips/libheif; provate resize, crop, jpeg, webp, avif).

## 🟡 Medie / basse (sistemate)

- PIN ristoratore e OTP di recupero generati con `Math.random` → `crypto.randomInt`;
  OTP confrontato a tempo costante; `failed_attempts` azzerato a ogni nuovo codice;
  `action` validata; password 6–72 caratteri (come nel resto dell'app) e email validate al reset.
- Trigger anti-escalation `is_admin` esteso all'INSERT del profilo.
- `partner_applications`: tolta la policy INSERT pubblica che saltava captcha e rate limit.
- `ai.js`: `current_moment` accettato solo fra i valori noti (finiva nei metadati
  salvati); messaggi d'errore interni non più rimandati al client.
- `admin-actions.js`: niente `err.message`/`action` riflessi nelle risposte, limiti di lunghezza.
- CORS: solo le anteprime `chiamami-bi-*.vercel.app`, non qualunque `*.vercel.app`.
- Turnstile: IP preso da `x-real-ip` (Vercel) invece del primo `x-forwarded-for`;
  errore rumoroso nei log se il secret manca in produzione.
- Linter Supabase: revocato EXECUTE sulle funzioni-trigger (i trigger continuano
  a funzionare, verificato), `search_path` fissato su 4 funzioni.

## Da fare (non in questa PR)

- **Eseguire la parte B** dopo il deploy.
- **Supabase → Auth → "Leaked password protection"**: attivarla (impostazione del
  dashboard, non SQL).
- **Verificare che `TURNSTILE_SECRET_KEY` sia impostata su Vercel in produzione**
  (non avevo i permessi per leggerlo). Se manca, captcha e form sono senza difese
  — i log ora lo dicono.
- `SettingsPage` chiama `/api/recovery-otp` senza `captcha_token`: se Turnstile è
  attivo, "cambia email via recupero" dalle impostazioni fallisce (bug funzionale
  preesistente).
- `total_redeemed` conta due volte lo stesso sconto (+1 alla presa, +1 alla
  scansione): un drop da 10 risulta esaurito dopo 5 usi. Non è sicurezza, ma
  va sistemato.
- Rate limit ancora in memoria per istanza (`_rate-limit.js`): per i form
  pubblici conta il captcha; a lungo termine Upstash/KV.
- CSP con `'unsafe-inline' 'unsafe-eval'` negli script: stringerla richiede di
  provare Mapbox e Turnstile in browser.
- `profiles.email` resta modificabile dall'utente (serve a chi entra con Google):
  il recupero account la usa per trovare il profilo, quindi un utente che si
  mette la stessa email di un altro gli blocca il recupero (non glielo ruba:
  il codice va sempre alla `recovery_email` del proprietario). Il recupero
  andrebbe cercato su `auth.users`.
