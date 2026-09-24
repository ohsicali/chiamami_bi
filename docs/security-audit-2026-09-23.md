# Audit sicurezza — 23/09/2026

Attacco a tutto il sito (endpoint `/api`, DB Supabase live, storage, frontend,
dipendenze), cercando cosa può fare un estraneo con quello che trova nel
bundle JS pubblico — cioè la chiave anon — più, al massimo, un account
registrato da sé (la registrazione è aperta). Segue l'audit del 09/06
(`docs/security-audit-2026-06-09.md`) e ne chiude i residui.

Ogni falla del DB è stata **provata sul DB live** con `set local role
anon/authenticated` in una transazione annullata, prima e dopo il fix.

## Stato dei fix — tutto applicato il 23/09

| | Dove | Stato |
|---|---|---|
| SQL parte A | `supabase/security-audit-2026-09-23.sql` | ✅ applicata sul DB live (migration `security_audit_2026_09_23_part_a`) |
| Codice | PR #293 (`api/`, `src/`) | ✅ mergiata (`8d699b6`) e in produzione (deploy `dpl_FKEL77Lnrb2jNEKfpZ4dbCahNN8j`) |
| SQL parte B | `supabase/security-audit-2026-09-23-part-b.sql` | ✅ applicata sul DB live dopo il deploy (migration `security_audit_2026_09_23_part_b`) |

La parte B andava per forza dopo il deploy perché toglie colonne ad
`authenticated`: il frontend vecchio chiedeva `select=*` su `restaurants`
(pannello admin, pagine Salvati) e con i grant di colonna quella richiesta
fallisce intera. Il frontend nuovo funziona con e senza la parte B.

**Nota sul rilascio:** al momento del merge il progetto Vercel era in pausa
(pagina "This deployment is temporarily paused" su chiamamibi.com), quindi il
deploy automatico del merge non è partito. Dopo la riattivazione il deploy di
produzione è stato lanciato a mano dal commit `8d699b6`, e solo dopo averlo
visto servire il codice nuovo è stata applicata la parte B.

### Verifiche fatte dopo il rilascio (23/09 sera)

- **Permessi DB** (simulati come `anon` / utente qualsiasi / admin, in
  transazioni annullate): l'admin legge 107 locali e i 16 PIN via
  `admin_restaurant_secrets`; un utente legge i 98 pubblicati e nessuna
  colonna segreta (`verify_pin`, `magic_token`, `partner_email`); `anon`
  idem; un utente vede solo il proprio profilo (0 email altrui).
- **Login ristoratori**: `verify_login` col PIN giusto dà il `device_token` e
  la risposta non contiene più PIN né `magic_token`; col PIN sbagliato
  `invalid_pin`, e il tentativo viene contato.
- **Produzione**: `/api/public` (ristoranti, categorie, sconti, banner),
  anteprime social di `/restaurant/:slug`, `sitemap.xml`,
  `/api/places-details`, `/api/img` rispondono come prima;
  `/api/resolve-maps` senza login → 401; le conferme email pubbliche non
  spediscono più (`skipped: sent-by-server`); il bundle contiene
  `restaurantColumns` con l'RPC admin.
- **Log**: nessun errore di permesso nei log Postgres/API dopo le due parti.
  Unico 400 ricorrente: l'upsert su `newsletter_subscribers` alla
  registrazione (`useAuth.js`), che fallisce da prima dell'audit (c'era già il
  22/09) — la lista newsletter è legacy, le email partono da
  `email_preferences`.
- **Linter Supabase**: restano solo le funzioni pubbliche per scelta (RPC
  `verify_*` guardate dal `device_token`, preferenze email via token,
  `is_admin`) e "Leaked password protection" da attivare a mano.
- **Non provato in un browser** (il browser automatico non si fida del proxy
  dell'ambiente di lavoro): pannello admin con PIN/credenziali, pagina
  Salvati da utente loggato, `/verify`. Le loro query sono state provate sul
  DB con gli stessi ruoli.

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
**Fix (A + B, applicati):** RPC `admin_restaurant_secrets()` guardata da `is_admin()`; il pannello admin legge PIN ed email da lì
(`src/lib/restaurantColumns.js`); `RestaurantDrawer`, `EditRestaurant`,
`SavedPage`, `DesktopSavedPage` chiedono colonne esplicite invece di `*`;
revoca delle colonne segrete ad `authenticated` (B).

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
**Fix (applicato):** policy di scrittura solo `is_admin()` e bucket limitati a immagini; `/api/img` rifiuta tutto ciò che non è un'immagine raster e
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

## 24/09 — bug trovati dopo l'audit, sistemati

Cercati nei log di Supabase e Vercel e confrontando ogni query del sito con
lo schema reale del DB (script usa-e-getta: select/filtri/insert contro le
colonne esistenti, e ogni `.rpc()` contro le funzioni e i loro parametri).
SQL in `supabase/fix-verify-and-counters-2026-09-24.sql` (applicata).

- **Dashboard ristoratori: impostazioni e cambio PIN non hanno mai
  funzionato.** Le RPC volevano il device_token come `uuid`, ma verify_login
  crea token da 64 caratteri: Postgres rifiutava la chiamata. In più il
  salvataggio scriveva in `restaurants.email` (non esiste: è
  `partner_email`) e la pagina leggeva quella colonna con una select diretta
  (400). Ora RPC con token `text` e `verify_get_restaurant_meta` per leggere.
- **Sconti contati due volte**: +1 alla presa (trigger) e +1 alla scansione
  (verify_redeem_qr), più un +1 dal browser per gli admin. Ora
  `total_redeemed` = prese, alzato solo dal trigger; i contatori esistenti
  ricalcolati sui riscatti reali.
- **Interruttore "Newsletter" finto** in Impostazioni e Profilo desktop:
  leggeva/scriveva `newsletter_subscribers` (lista vecchia, SELECT solo admin,
  scrittura in 400) mentre le email partono da `email_preferences`. Chi lo
  spegneva continuava a ricevere gli annunci. Ora agisce su
  `email_preferences` (`src/lib/emailPrefs.js`); anche la spunta alla
  registrazione. Tolta l'iscrizione automatica alla lista vecchia che
  rispondeva 400 a ogni registrazione.
- **Suggerimenti senza account rifiutati**: l'insert chiedeva la riga
  indietro (`.select('id')`) ma chi non ha account non può rileggerla → 401.
  Ora l'id lo genera il browser.
- **Cambio email dalle Impostazioni** respinto dal captcha (la pagina non lo
  ha): ora `/api/recovery-otp` salta il captcha se la richiesta porta la
  sessione dell'account stesso.

Non sono bug del codice, ma si vedono nei log: timeout di `/api/track` e
`/api/img` quando Supabase è lento (il 22/09 soprattutto), e l'avviso
`DEP0169 url.parse()` che viene da una dipendenza del runtime Vercel.

## Da fare

- Su Vercel `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`,
  `CRON_SECRET` sono salvate come "Config" (leggibili in chiaro dal pannello):
  ricrearle come **Sensitive**. (Fatti il 24/09: Leaked password protection
  attiva in Supabase; `TURNSTILE_SECRET_KEY` presente in produzione.)
- Rate limit ancora in memoria per istanza (`_rate-limit.js`): per i form
  pubblici conta il captcha; a lungo termine Upstash/KV.
- CSP con `'unsafe-inline' 'unsafe-eval'` negli script: stringerla richiede di
  provare Mapbox e Turnstile in browser.
- `profiles.email` resta modificabile dall'utente (serve a chi entra con Google):
  il recupero account la usa per trovare il profilo, quindi un utente che si
  mette la stessa email di un altro gli blocca il recupero (non glielo ruba:
  il codice va sempre alla `recovery_email` del proprietario). Il recupero
  andrebbe cercato su `auth.users`.
