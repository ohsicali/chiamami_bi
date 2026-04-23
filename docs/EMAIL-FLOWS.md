# Email Flows · ChiamamiBi

**Ultimo aggiornamento:** 24 aprile 2026
**Provider:** [Resend](https://resend.com) (account già configurato pre-v4)
**Dominio mittente:** `chiamamibi.com` (verificato via DKIM + SPF + DMARC dal 23/04/2026)
**Mittente default:** `Bi <ciao@chiamamibi.com>`
**Reply-to default:** `info@chiamamibi.com`

Questo doc descrive **cosa parte quando e perché**. Serve per:
1. Debug quando un cliente dice "non mi è arrivata l'email"
2. QA smoke test post-deploy
3. Capire quali trigger mancano prima di aggiungere nuove feature

---

## Tabella sintetica — tutti i trigger attivi

| # | Quando scatta | A chi arriva | Subject | Endpoint | File client che la chiama |
|---|---|---|---|---|---|
| 1 | Utente fa signup con Google OAuth | Email utente | `Benvenuta su ChiamamiBi, {firstName}! 🍕` | `POST /api/send-email` type=`user` | `src/lib/hooks/useAuth.js` |
| 2 | Admin crea ristoratore (genera PIN) | Email ristoratore | `Ciao, sono Bi — il tuo accesso a ChiamamiBi` | `POST /api/send-email` type=`partner` | `src/components/admin/tabs/CredenzialiTab.jsx` (re-send) · `RestaurantForm.jsx` (dead code, era il trigger iniziale) · **GAP**: il nuovo flow admin potrebbe non inviare più all'inserimento iniziale — vedi §Gaps |
| 3 | Utente compila form "Suggerisci un locale" | Email utente | `Ho ricevuto il tuo suggerimento` | `POST /api/send-email` type=`confirmation` | `src/components/Restaurant/SuggestRestaurantSheet.jsx` |
| 4 | Utente compila form "Suggerisci un locale" | `info@chiamamibi.com` | `[Bi] Nuovo suggerimento: {nome_locale}` | `POST /api/send-email` type=`internal-notify` | `src/components/Restaurant/SuggestRestaurantSheet.jsx` |
| 5 | Ristoratore candida il locale via form pubblico | `info@chiamamibi.com` (reply-to candidato) | `Nuova candidatura partner: {restaurant_name}` | `POST /api/partner-application` | `src/pages/public/PartnerLandingPage.jsx` |
| 6a | Utente chiede cambio email account | Email di recupero utente | `{otp} — Codice di recupero ChiamamiBi` | `POST /api/recovery-otp` | `src/pages/public/SettingsPage.jsx` |
| 6b | Utente chiede reset password (forgot) | Email utente | `{otp} — Codice di recupero ChiamamiBi` | `POST /api/recovery-otp` | `src/pages/public/LoginPage.jsx` |
| 7 | Admin pubblica un nuovo drop | Tutti gli iscritti newsletter (batch) | Variabile (compilato in notify-subscribers.js) | `POST /api/notify-subscribers` type=`drop` | `src/pages/admin/DiscountManager.jsx` |
| 8 | Admin invia newsletter manuale (edge function) | Tutti gli iscritti newsletter | Variabile (passato nel body) | Supabase Edge Function `send-newsletter` | **Non ci sono callsite client attivi** — è un endpoint amministrativo |

### Trigger dormant / gap identificati

| # | Trigger teorico | Stato | Nota |
|---|---|---|---|
| 9 | Admin pubblica nuovo ristorante → notifica iscritti | **Gap** — il callsite `notify-subscribers` type=`restaurant` vive solo in `RestaurantForm.jsx` (dead code) | Dopo PR #89 il nuovo admin NON lo invoca più. Da reinserire nella nuova pagina Nuovo ristorante se Augusto lo vuole riattivare |
| 10 | Admin pubblica sconto statico (non drop) → notifica iscritti | **Potenzialmente gap** — verificare in `DiscountManager.jsx` se il call fa distinzione tra `type=discount` e `type=drop` | notify-subscribers accetta sia `restaurant`, `discount`, `drop` come input validi |
| 11 | Newsletter periodica (template #4 manifesto) | **Non implementato** | Scope fuori da v4 PR corrente. Tracciato in memory `project_resend_live.md` |
| 12 | Reminder scadenza drop ristoratore | **Non implementato** | Feature ipotizzata ma mai schedulata |
| 13 | Reminder scadenza PIN ristoratore (rotation policy) | **Non implementato** | Il `CredenzialiTab` mostra "ultima rotazione" ma non invia reminder automatico |

---

## Dettaglio per trigger

### 1. Welcome utente Google OAuth

- **Quando:** Supabase `SIGNED_IN` event rileva che `provider = 'google'` e l'account è appena stato creato.
- **Dove nel codice:** `src/lib/hooks/useAuth.js` — fire-and-forget fetch dopo l'auth state change.
- **Endpoint:** `POST /api/send-email` body `{ type: 'user', email, name }` — **no auth**, rate-limited 10/min per IP.
- **Mittente:** `Bi <ciao@chiamamibi.com>` · **Reply-to:** `info@chiamamibi.com`
- **Contenuto chiave:** saluto coral-themed con firstName, intro "benvenutǝ nella guida di Bi", CTA alla home.
- **Template:** `buildWelcomeHtml()` in `api/send-email.js` righe 189–251.

### 2. Benvenuto ristoratore (PIN + magic-link)

- **Quando:** Admin crea un nuovo ristoratore dal pannello e genera il PIN 6-cifre, OPPURE quando dal drawer/pagina edit clicca "Invia al locale" nella tab Credenziali (re-send).
- **Dove nel codice:**
  - Re-send: `src/components/admin/tabs/CredenzialiTab.jsx`
  - Initial send: storicamente `RestaurantForm.jsx` (ora dead code). **GAP:** il nuovo flow admin non lo invoca più automaticamente all'inserimento — vedi §Gaps.
- **Endpoint:** `POST /api/send-email` body `{ type: 'partner', to, nomeLocale, pin, restaurantId }` — **auth Bearer admin** (verifica `profiles.is_admin = true`), rate-limited 5/min.
- **Side-effect critico:** prima di inviare, genera un `magic_token` UUID con TTL 24h, lo salva nella row `restaurants.magic_token` + `magic_token_expires_at`. La CTA nell'email porta a `chiamamibi.com/verify?token={magic}&pin={pin}` per auto-login one-shot.
- **Mittente:** `Bi <ciao@chiamamibi.com>` · **Reply-to:** `info@chiamamibi.com`
- **Contenuto chiave:**
  - Saluto "Ciao {nomeLocale}"
  - Paragrafo "Sei nella Guida di Bi"
  - PIN visualizzato grande con spaziatura (Alfa Slab One in PNG wordmark inline)
  - CTA "Apri l'Area Ristoratori" → verify URL
  - Footer con riferimenti supporto
- **Template:** `buildBenvenutoHtml()` + `buildBenvenutoText()` (versione plain-text fallback) in `api/send-email.js`.

### 3. Conferma suggerimento al proponente

- **Quando:** Utente submit del form "Suggerisci un locale" (bottom-sheet nella sezione Scopri).
- **Dove nel codice:** `src/components/Restaurant/SuggestRestaurantSheet.jsx` — `Promise.allSettled([...])` invia in parallelo la conferma all'utente E la notifica interna a Bi (vedi #4).
- **Endpoint:** `POST /api/send-email` body `{ type: 'confirmation', to, nome_locale, nome_utente? }` — **no auth**, rate-limited 5/min.
- **Mittente:** `Bi <ciao@chiamamibi.com>` · **Reply-to:** `info@chiamamibi.com`
- **Header speciale:** `List-Unsubscribe: <mailto:info@chiamamibi.com?subject=unsubscribe>` (buona practice anti-spam).
- **Contenuto chiave:** "Grazie per avermi suggerito {nome_locale}. Ci vado al più presto". Voce Bi, prima persona, chiusura "A presto, Bi".
- **Template:** `buildConfirmationHtml()` in `api/send-email.js` righe 482+.

### 4. Notifica interna a Bi — nuovo suggerimento

- **Quando:** stesso trigger di #3 (submit form Suggerisci), inviata in parallelo.
- **Endpoint:** `POST /api/send-email` body `{ type: 'internal-notify', nome_locale, address?, tags?, description?, nome_utente?, email_utente, id? }` — **no auth**, rate-limited 10/min.
- **Destinatario fisso:** `info@chiamamibi.com`
- **Mittente:** `Bi <ciao@chiamamibi.com>` · **No reply-to** (non serve)
- **Contenuto chiave:** tabella coi campi del suggerimento (locale, zona, categoria, nota utente, contatti proponente) + link "Apri in admin" → `/admin/suggestions`.
- **Nota:** non c'è una route di dettaglio singolo suggerimento, il link porta alla lista filtrabile.
- **Template:** `buildInternalNotifyHtml()` in `api/send-email.js` righe 580+.

### 5. Candidatura ristoratore dal form pubblico

- **Quando:** Ristoratore submit del form sulla landing `/partner`.
- **Dove nel codice:** `src/pages/public/PartnerLandingPage.jsx`.
- **Endpoint:** `POST /api/partner-application` — **no auth**, rate-limited.
- **Destinatario:** `NOTIFY_EMAIL` (costante nel file, presumibilmente `info@chiamamibi.com`)
- **Mittente:** `Bi <ciao@chiamamibi.com>` · **Reply-to:** l'email del candidato
- **Subject:** `Nuova candidatura partner: {restaurant_name}`
- **Contenuto chiave:** tabella coi dati del candidato (nome locale, referente, email, telefono, zona, descrizione).
- **Nota:** **nessuna email di conferma al candidato** — il candidato non riceve niente. Potenziale gap UX se Augusto vuole una conferma soft "Abbiamo ricevuto la tua candidatura, Bi ci darà un'occhiata".

### 6. OTP di recupero (email change + password reset)

- **Quando (6a):** utente nel pannello Settings clicca "Cambia email" → riceve OTP sull'email di recupero configurata.
- **Quando (6b):** utente nel login clicca "Password dimenticata" → riceve OTP sull'email primaria.
- **Endpoint:** `POST /api/recovery-otp` body `{ email, action: 'verify_recovery' | 'reset_password' }` — **no auth**, rate-limited 5/min.
- **OTP:** 6 cifre random, TTL 10 minuti (generato con `Math.floor(100000 + Math.random() * 900000)` — **nota sicurezza:** `Math.random` non è cryptographically secure; acceptable per OTP 6-digit con TTL corto ma da upgradare a `crypto.randomInt` in una futura hardening pass).
- **Mittente:** `Bi <ciao@chiamamibi.com>` · **Reply-to:** `info@chiamamibi.com`
- **Subject:** OTP anche nel subject (`{otp} — Codice di recupero ChiamamiBi`) per preview mobile rapido — pratica comune tipo GitHub/Stripe.
- **Endpoint verifica:** `POST /api/verify-recovery-otp` con `{ email, otp, new_email }` — completa l'operazione.

### 7. Notifica iscritti newsletter — nuovo drop

- **Quando:** Admin pubblica un drop dalla `DiscountManager` e preme "Invia notifica iscritti".
- **Dove nel codice:** `src/pages/admin/DiscountManager.jsx` riga ~574.
- **Endpoint:** `POST /api/notify-subscribers` body `{ type: 'drop', id: <drop_uuid>, force?: bool }` — **auth Bearer admin**, rate-limited 10/min.
- **Implementazione:**
  - Carica la row target (`restaurants` | `discounts` | `drops`) da Supabase.
  - Compone HTML usando template inline dentro `notify-subscribers.js`.
  - Batch via Resend `POST /emails/batch` (max 100 messaggi per chiamata, quindi pagina a 100 alla volta se gli iscritti sono di più).
  - Scrive log in `email_notifications_log` con `type + id + sent_at + sent_count` per dedup.
  - Se chiami senza `force: true` e la combinazione type+id è già stata notificata, restituisce errore → serve a evitare doppi invii per errore.
- **Mittente:** `Bi <ciao@chiamamibi.com>` · **Reply-to:** `info@chiamamibi.com`

### 8. Newsletter standalone (edge function Supabase)

- **Quando:** attualmente nessun client UI la invoca. È un endpoint ops che Augusto può chiamare via curl/Supabase Studio per mandare una newsletter manuale.
- **Dove:** `supabase/functions/send-newsletter/index.ts`
- **Body:** `{ subject, template, variables? }` — il template è HTML, `variables` sono sostituibili con handlebar-like.
- **Vantaggio vs notify-subscribers:** non conta nel cap Vercel Hobby (12 functions), è deployato su Supabase. Utile se in futuro la newsletter diventa periodica e Vercel è pieno.
- **Tabella iscritti:** `newsletter_subscribers` (stessa di notify-subscribers).

---

## Variabili d'ambiente richieste

Tutte in Vercel Production (e Preview per smoke test) + Supabase Functions env:

| Var | Dove serve | Note |
|---|---|---|
| `RESEND_API_KEY` | Tutti gli endpoint `/api/*-email` e la edge function | Chiave configurata prima di v4, valida |
| `RESEND_FROM` | Override opzionale mittente (default `Bi <ciao@chiamamibi.com>`) | Usare sempre il root domain, mai subdomain `send.chiamamibi.com` |
| `RESEND_REPLY_TO` | Override opzionale reply-to (default `info@chiamamibi.com`) | |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Admin auth check in partner + notify-subscribers | |
| `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Verifica token utente | |
| `SUPABASE_SERVICE_ROLE_KEY` | Update `magic_token` su restaurants + write `email_notifications_log` + fetch `newsletter_subscribers` | **Mai esporre client-side** |

---

## DNS configurati per deliverability

Impostati il 23/04/2026 sul dominio `chiamamibi.com`:

- **SPF TXT:** `v=spf1 include:_spf.google.com include:_spf.resend.com ~all`
- **DMARC TXT:** `_dmarc` con `v=DMARC1; p=none; rua=mailto:info@chiamamibi.com`
- **DKIM:** `resend._domainkey` (era pre-esistente dall'onboarding Resend)

Senza questi record le email finivano in spam di Gmail (bug risolto nel periodo PR12-14 del 23/04).

---

## Gaps identificati — da decidere se sistemare

### Gap A — Manca l'invio automatico partner welcome quando admin crea un ristoratore

Il vecchio `RestaurantForm.jsx` inviava automaticamente l'email benvenuto (type=`partner`) a fine wizard di creazione. Dopo la migrazione al nuovo admin (PR #89 / #94 con sub-step PR15a-h), il file è stato marcato `@deprecated` e non è più importato.

**Conseguenza potenziale:** se il nuovo admin non ha re-implementato il send automatico, dopo aver creato un nuovo ristoratore Augusto deve andare manualmente nella tab Credenziali del drawer/pagina edit e cliccare "Invia al locale".

**Verifica:** aprire il flow Nuovo ristorante nel preview della PR #89 e provare. Se non parte automaticamente, decidere:
- **A1.** Aggiungere send automatico dentro il wizard (consigliato, match del comportamento legacy)
- **A2.** Lasciare manuale e documentare in onboarding Augusto

### Gap B — Notify iscritti quando si pubblica un nuovo ristorante

Stesso pattern: `notify-subscribers` type=`restaurant` esiste come endpoint ma non è chiamato da nessun componente live (solo dal dead code). Se Augusto vuole che un nuovo ristorante triggeri una mail agli iscritti, serve ri-aggancio.

### Gap C — Candidato partner non riceve conferma

Il form su `/partner` manda solo la notifica interna a Bi. Il candidato non riceve "Abbiamo ricevuto la tua candidatura, ti rispondo io". Per un candidato è silenzio dopo il submit — UX meno calda. Da valutare se aggiungere un template type=`partner-application-confirmation` o simile.

### Gap D — `Math.random()` per OTP

Non è cryptographically secure. Basso rischio perché OTP 6-digit + TTL 10min + rate-limit 5/min, ma una futura hardening pass può swappare a `crypto.randomInt(100000, 1000000)` in `api/recovery-otp.js`.

### Gap E — Newsletter periodica

Template #4 del manifesto email (`docs/v4-email-manifesto.md`) non ancora implementato. La edge function `send-newsletter` esiste ma manca il frontend per comporre/schedulare una newsletter + meccanismo double opt-in per gli iscritti.

---

## Come testare ogni flow (smoke checklist)

Per ogni trigger, il test "happy path" da casella Gmail esterna:

- [ ] **#1 Welcome utente:** fai signup Google con un'email nuova. Email arriva entro 30s in inbox (no spam).
- [ ] **#2 Partner welcome:** admin crea un ristorante test con tuo email. Email arriva. Clicca CTA → auto-login su `/verify` funziona. Controlla che PIN sia corretto e readable.
- [ ] **#3+#4 Form suggerisci:** compila form come utente normale. Tua email riceve conferma (#3). `info@chiamamibi.com` riceve notifica interna (#4).
- [ ] **#5 Partner application:** vai su `/partner`, compila form. `info@chiamamibi.com` riceve email con reply-to = email che hai inserito nel form.
- [ ] **#6a Email change:** Settings → cambia email → OTP arriva sull'email di recupero. Inserisci OTP → email cambiata.
- [ ] **#6b Password reset:** login → forgot password → OTP arriva sull'email primaria. Inserisci → reset password funziona.
- [ ] **#7 Drop notify:** crea iscritto test in `newsletter_subscribers`. Admin pubblica drop + clicca notify. Email batch arriva.

### Debug quando un'email non arriva

1. **Resend Dashboard** ([resend.com/emails](https://resend.com/emails)): vedi se la chiamata è arrivata ma bounced/complaint
2. **Vercel Logs** (`vercel logs --follow`): cerca l'endpoint `/api/send-email` e vedi l'errore
3. **Check headers email** ricevuta: `Authentication-Results` deve avere `spf=pass` + `dkim=pass` + `dmarc=pass`. Se no → DNS non propagato o record sbagliato.
4. **Rate limit** (`_rate-limit.js`): se stai testando troppo rapido, aspetta 60s (cap per chiave varia 5-10/min).
5. **Se tutto ok ma finisce in spam:** warm-up del dominio. Resend manda un consiglio "invia a indirizzi diversi con contenuti diversi per 2-3 settimane" — il dominio è nuovo in termini di reputazione.

---

## Ultimi cambiamenti rilevanti

| Data | PR | Cosa è cambiato |
|---|---|---|
| 23/04/2026 | PR12b | Merge dei 3 endpoint `welcome-email.js` + `benvenuto-ristoratore.js` in unico `send-email.js` con router `type` — per rientrare nel cap Vercel Hobby 12 functions |
| 23/04/2026 | PR12c | Polish template benvenuto: wordmark PNG (Alfa Slab One non renderizzabile affidabilmente cross-client), PIN con spazi giusti, magic-link auto-verify |
| 23/04/2026 | PR13 | Aggiunto handler `type=confirmation` per conferma suggerimento utente |
| 23/04/2026 | PR14 | Aggiunto handler `type=internal-notify` per notifica interna suggerimento |
| 23/04/2026 | DNS | Aggiunti SPF + DMARC (DKIM già esistente) — risolve spam folder Gmail |
| 24/04/2026 | PR #89 (PR15a-h) | Admin big reskin. `RestaurantForm.jsx` marcato `@deprecated` ma preservato come file fisico. Possibili gap A, B da verificare |

---

*File auto-generato da audit manuale sorgente `main` HEAD `7e6f406`. Aggiornare quando si toccano gli endpoint `/api/send-email`, `/api/partner-application`, `/api/recovery-otp`, `/api/notify-subscribers`, o la edge function `send-newsletter`.*
