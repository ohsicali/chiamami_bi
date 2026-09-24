# Email Flows · ChiamamiBi

> **15/09/2026 — revisione completa.** Design, contenuti, oggetti e
> deliverability sono stati rifatti: vedi **`docs/email-sistema.md`**, che è
> adesso il riferimento per *com'è fatta* un'email e per *cosa la tiene fuori
> dallo spam*. Questo file resta il riferimento per *cosa parte quando*.
> Le parti qui sotto marcate ~~così~~ non valgono più.
>
> In breve, cosa è cambiato rispetto a quello che leggi sotto:
> - l'HTML non sta più dentro gli endpoint: tutte le email (queste **più**
>   benvenuto ristoratore, conferma suggerimento, notifica interna,
>   candidatura partner e codice di recupero) le costruisce
>   `api/_email/templates.js`;
> - `api/partner-application.js` e `api/recovery-otp.js` non chiamano più
>   Resend da soli, passano da `api/_email/send.js`;
> - gli oggetti sono cambiati tutti (tabella in `email-sistema.md` §4);
> - `List-Unsubscribe` punta a `/api/send-email?unsub=<token>`, non più alla
>   pagina delle preferenze — la POST di Gmail adesso disiscrive davvero;
> - l'oggetto della notifica interna di candidatura è passato da
>   `Nuova candidatura partner: X` a `[Bi] Nuova candidatura: X`: **se hai un
>   filtro in Gmail su quella dicitura, aggiornalo.**

**Ultimo aggiornamento:** 24 aprile 2026 (impianto) · 15 settembre 2026 (revisione) · 21 settembre 2026 (v11: veste e contenuti)
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
| 1 | Utente fa signup con Google OAuth | Email utente | ~~`Benvenuta su ChiamamiBi, {firstName}! 🍕`~~ → `{Nome}, da adesso sei nel Bi Club` | `POST /api/send-email` type=`user` | `src/lib/hooks/useAuth.js` |
| 2 | Admin crea ristoratore (genera PIN) | Email ristoratore | ~~`Ciao, sono Bi — il tuo accesso a ChiamamiBi`~~ → `{Locale} è nella Guida di Bi: ecco il tuo PIN` | `POST /api/send-email` type=`partner` | `src/components/admin/tabs/CredenzialiTab.jsx` (re-send) · `RestaurantForm.jsx` (dead code, era il trigger iniziale) · **GAP**: il nuovo flow admin potrebbe non inviare più all'inserimento iniziale — vedi §Gaps |
| 3 | Utente compila form "Suggerisci un locale" | Email utente | ~~`Ho ricevuto il tuo suggerimento`~~ → `Ho preso nota di {Locale}` | `POST /api/send-email` type=`confirmation` | `src/components/Restaurant/SuggestRestaurantSheet.jsx` |
| 4 | Utente compila form "Suggerisci un locale" | `info@chiamamibi.com` | `[Bi] Nuovo suggerimento: {nome_locale}` | `POST /api/send-email` type=`internal-notify` | `src/components/Restaurant/SuggestRestaurantSheet.jsx` |
| 5 | Ristoratore candida il locale via form pubblico | `info@chiamamibi.com` (reply-to candidato) | ~~`Nuova candidatura partner: {restaurant_name}`~~ → `[Bi] Nuova candidatura: {restaurant_name}` | `POST /api/partner-application` | `src/pages/public/PartnerLandingPage.jsx` |
| 6a | Utente chiede cambio email account | Email di recupero utente | ~~`{otp} — Codice di recupero ChiamamiBi`~~ → `{otp} è il tuo codice ChiamamiBi` | `POST /api/recovery-otp` | `src/pages/public/SettingsPage.jsx` |
| 6b | Utente chiede reset password (forgot) | Email utente | ~~`{otp} — Codice di recupero ChiamamiBi`~~ → `{otp} è il tuo codice ChiamamiBi` | `POST /api/recovery-otp` | `src/pages/public/LoginPage.jsx` |
| 7 | Admin pubblica un nuovo drop | Iscritti agli avvisi sconti (batch) | `Ho acceso un drop da {Locale}` | `POST /api/notify-subscribers` type=`drop` | `src/pages/admin/DiscountManager.jsx` |
| 7b | Admin pubblica una convenzione (sconto non-drop) | Iscritti agli avvisi sconti | `Da oggi hai il {valore} da {Locale}` | `POST /api/notify-subscribers` type=`discount` | `src/pages/admin/DiscountManager.jsx` |
| 7c | Ogni giorno alle ~11 (cron Vercel): sconti presi da ≥48 ore e mai usati | Chi li ha presi, se ha "I miei sconti" acceso | `Il tuo sconto da {Locale} ti aspetta` · drop: `Il tuo drop da {Locale} scade tra {X}` | `GET /api/notify-subscribers?job=discount-reminders` (Bearer `CRON_SECRET`) | nessuno — parte da sola (`vercel.json` → `crons`) |
| ~~8~~ | ~~Newsletter manuale (edge function)~~ | — | — | ~~Edge Function `send-newsletter`~~ | **Rimossa il 21/09/2026** — vedi §"Chi riceve le email" |

### Trigger dormant / gap identificati

| # | Trigger teorico | Stato | Nota |
|---|---|---|---|
| 9 | Admin pubblica nuovo ristorante → notifica iscritti | **Gap** — il callsite `notify-subscribers` type=`restaurant` vive solo in `RestaurantForm.jsx` (dead code) | Dopo PR #89 il nuovo admin NON lo invoca più. Da reinserire nella nuova pagina Nuovo ristorante se Augusto lo vuole riattivare |
| 10 | Admin pubblica sconto statico (non drop) → notifica iscritti | **Potenzialmente gap** — verificare in `DiscountManager.jsx` se il call fa distinzione tra `type=discount` e `type=drop` | notify-subscribers accetta sia `restaurant`, `discount`, `drop` come input validi |
| 11 | Newsletter periodica (template #4 manifesto) | **Non implementato** | Scope fuori da v4 PR corrente. Tracciato in memory `project_resend_live.md` |
| 12 | Reminder scadenza drop ristoratore | **Non implementato** | Feature ipotizzata ma mai schedulata. (Il promemoria *all'utente* per gli sconti presi e non usati invece c'è dal 24/09: vedi #7c.) |
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

### 7c. Promemoria — sconto preso e non ancora usato (24/09/2026)

- **Perché:** il 24/09 i riscatti erano 192 e solo 4 usati. Chi prende uno
  sconto spesso se ne dimentica.
- **Quando:** un giro al giorno, cron Vercel `0 9 * * *` (11:00 d'estate,
  10:00 d'inverno; sul piano Hobby parte "entro l'ora"). Una volta al giorno
  è il massimo che Hobby concede, ed è anche il ritmo giusto.
- **Endpoint:** `GET /api/notify-subscribers?job=discount-reminders` con
  `Authorization: Bearer $CRON_SECRET` (lo mette Vercel da sé). Senza
  `CRON_SECRET` impostata risponde 401 e non spedisce niente. A mano, da
  admin: `POST /api/notify-subscribers` `{ type: 'discount-reminders',
  dryRun: true }` dice chi riceverebbe cosa senza spedire.
- **Regole** (`api/_email/reminders.js`, `REMINDER_RULES`, sotto test in
  `tests/discount-reminders.test.mjs`):
  - uno sconto si ricorda solo dopo **48 ore** da quando è stato preso, e
    non oltre **30 giorni**; **una volta sola** per riscatto;
  - **un promemoria al giorno** per persona, **un locale per email**;
  - fra due promemoria alla stessa persona almeno **3 giorni**, e al massimo
    **4 in 30 giorni** — chi prende dieci sconti in due minuti (succede: è
    il caso normale) li riceve uno alla volta, e in fondo a ogni email c'è
    "hai altri N sconti presi e non ancora usati";
  - se nelle ultime **20 ore** le abbiamo già scritto per altro (codice di
    uno sconto appena preso, sconto usato, benvenuto) si aspetta domani;
  - l'ordine: prima un **drop che scade entro 48 ore** (l'unico che può
    saltare l'attesa dei 3 giorni, non quella del giorno), poi uno sconto
    che **vale oggi** (`valid_days`), poi il **più vecchio**;
  - niente promemoria per sconti spenti, scaduti, di locali non pubblicati,
    o già usati con un altro codice.
- **Chi:** chi ha `email_preferences.my_discounts = true` — l'interruttore
  "I miei sconti", che nella pagina preferenze diceva già "Promemoria sugli
  sconti che hai preso e non ancora usato". È un annuncio, non una
  ricevuta: porta "Scegli cosa ricevere" e `List-Unsubscribe`.
- **Registro:** `email_sent_log` con `kind = 'discount-reminder'` e `ref_id`
  = il riscatto. La riga si scrive **prima** dell'invio (due giri insieme →
  il secondo trova l'indice unico e salta); se Resend rifiuta, torna
  `ok = false` e il giorno dopo si riprova. Nessuna tabella nuova, nessun SQL.
- **Template:** `discountReminderEmail()` — convenzione crema col chip di
  quando vale, drop con la card corallo e il countdown (senza barra dei
  posti: il codice ce l'ha già). Bottone "Apri il QR" →
  `/sconti?tab=miei&open=<discount_id>`, che apre direttamente il QR; sotto,
  il codice a sei caratteri da dettare.
- **Il primo giro** trova l'arretrato: stimati ~100 destinatari (un'email a
  testa), poi il resto si distribuisce nei giorni seguenti.

### ~~8. Newsletter standalone (edge function Supabase)~~ · RIMOSSA il 21/09/2026

`supabase/functions/send-newsletter/index.ts` non esiste più. Perché, in
ordine di gravità:

- **non era deployata**: sul progetto live le edge function attive sono
  `resolve-maps` e `moderate-review`, non c'era;
- **mandava a una lista quasi vuota**: leggeva `newsletter_subscribers`, che
  è un'iscrizione a parte e spenta di default — un iscritto su sette
  registrati. Gli annunci veri partono da `email_preferences`, dove tutti
  sono dentro per impostazione predefinita;
- **i link erano su `chiamamibi.it`**, che non è il nostro dominio, e il
  mittente era `noreply@chiamamibi.it`: senza DKIM/SPF su quel dominio ogni
  messaggio sarebbe finito in spam o tornato indietro;
- **saltava tutte le protezioni**: niente versione a solo testo, niente
  `List-Unsubscribe`, niente disiscrizione a un clic, corallo `#FF5757`
  invece di `#E8453C`. Cioè esattamente le cose per cui esiste
  `api/_email/send.js`.

Se e quando serve una newsletter, si fa **dove si fanno le altre**: un
`type` in più in `api/notify-subscribers.js`, che già ha i destinatari
giusti (`recipientsFor`), il registro anti-doppio-invio, l'invio a blocchi e
la disiscrizione a un clic. Non serve una funzione nuova e non si tocca il
cap Vercel.

Il codice rimosso resta nella storia di git se dovesse servire come
riferimento.

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
| `CRON_SECRET` | Il cron dei promemoria (#7c) e `places-details` | Già presente su Vercel. Senza, il giro dei promemoria non parte |

---

## DNS configurati per deliverability

Impostati il 23/04/2026 sul dominio `chiamamibi.com`:

- **SPF TXT:** `v=spf1 include:_spf.google.com include:_spf.resend.com ~all`
- **DMARC TXT:** `_dmarc` con `v=DMARC1; p=none; rua=mailto:info@chiamamibi.com`
- **DKIM:** `resend._domainkey` (era pre-esistente dall'onboarding Resend)

Senza questi record le email finivano in spam di Gmail (bug risolto nel periodo PR12-14 del 23/04).

---

## Bug risolti

### 2026-09-14 — Nessuna email di sconto/drop partiva dal 13/09

`email_preferences.user_id` (creata il 2026-09-13, vedi
`supabase/email-preferences-2026-09-13.sql`) puntava con FK a `auth.users`
invece che a `public.profiles`, diversamente da ogni altra tabella utente
dello schema. `recipientsFor()` in `api/_email/send.js` fa un embed
PostgREST `profiles!inner(...)` da `email_preferences`: senza una FK diretta
verso `public.profiles` (schema esposto), PostgREST non trova la relazione e
la query falliva sempre con un errore silenzioso lato admin (lo sconto si
salva comunque, resta solo un avviso discreto "l'annuncio non è partito").

Risultato: dal 13/09 nessuna notifica di nuovo sconto o drop è mai arrivata a
nessun iscritto, incluso il caso segnalato il 14/09 (drop pubblicato, nessuna
mail all'utente registrato). `email_notifications_log` non aveva infatti
nessuna riga di tipo `discount`/`drop`, solo `restaurant` (trigger diverso,
non passa da `email_preferences`).

**Fix** (`supabase/fix-email-preferences-fk-2026-09-14.sql`, eseguito via
connettore Supabase): FK di `email_preferences.user_id` spostata su
`public.profiles(id)`, più `notify pgrst, 'reload schema'` per non aspettare
la scadenza naturale della cache. File sorgente `email-preferences-2026-09-13.sql`
corretto per chi lo rilancia da zero altrove.

**Da fare:** rimandare la notifica per il drop pubblicato il 14/09
(`96afd9e4-6bc8-4753-b21c-8b77e551c827`) col bottone "Notifica" in
`/admin/sconti` — ora dovrebbe funzionare.

## Gaps identificati — da decidere se sistemare

### Gap A — Manca l'invio automatico partner welcome quando admin crea un ristoratore

Il vecchio `RestaurantForm.jsx` inviava automaticamente l'email benvenuto (type=`partner`) a fine wizard di creazione. Dopo la migrazione al nuovo admin (PR #89 / #94 con sub-step PR15a-h), il file è stato marcato `@deprecated` e non è più importato.

**Conseguenza potenziale:** se il nuovo admin non ha re-implementato il send automatico, dopo aver creato un nuovo ristoratore Augusto deve andare manualmente nella tab Credenziali del drawer/pagina edit e cliccare "Invia al locale".

**Verifica:** aprire il flow Nuovo ristorante nel preview della PR #89 e provare. Se non parte automaticamente, decidere:
- **A1.** Aggiungere send automatico dentro il wizard (consigliato, match del comportamento legacy)
- **A2.** Lasciare manuale e documentare in onboarding Augusto

### Gap B — Notify iscritti quando si pubblica un nuovo ristorante

Stesso pattern: `notify-subscribers` type=`restaurant` esiste come endpoint ma non è chiamato da nessun componente live (solo dal dead code). Se Augusto vuole che un nuovo ristorante triggeri una mail agli iscritti, serve ri-aggancio.

### ~~Gap C — Candidato partner non riceve conferma~~ · CHIUSO

Esiste `type='partner-application-confirmation'` in `send-email.js`, chiamato
in coda da `api/partner-application.js`. Testo sotto per storia.

### Gap C (storico) — Candidato partner non riceve conferma

Il form su `/partner` manda solo la notifica interna a Bi. Il candidato non riceve "Abbiamo ricevuto la tua candidatura, ti rispondo io". Per un candidato è silenzio dopo il submit — UX meno calda. Da valutare se aggiungere un template type=`partner-application-confirmation` o simile.

### Gap D — `Math.random()` per OTP

Non è cryptographically secure. Basso rischio perché OTP 6-digit + TTL 10min + rate-limit 5/min, ma una futura hardening pass può swappare a `crypto.randomInt(100000, 1000000)` in `api/recovery-otp.js`.

### Gap E — Newsletter periodica

Template #4 del manifesto email (`docs/v4-email-manifesto.md`) non ancora
implementato. La edge function `send-newsletter` **è stata rimossa** il
21/09 (vedi sopra): quando la newsletter servirà davvero, si aggiunge come
`type` in `api/notify-subscribers.js`.

**Niente double opt-in**, e non è una dimenticanza: la regola decisa il
21/09 è che chi ha un account riceve gli aggiornamenti, e l'unica scelta che
gli si chiede è quella di smettere. Vedi la sezione qui sotto.

---

## Chi riceve le email, e come si smette (decisione del 21/09/2026)

**La regola:** chi ha un account su ChiamamiBi riceve gli aggiornamenti.
Non c'è niente a cui iscriversi. L'unica scelta è smettere, e sta in fondo a
ogni messaggio.

**Com'è garantita.** Il trigger `on_auth_user_created_email_prefs` su
`auth.users` crea una riga in `email_preferences` a ogni registrazione, e le
tre colonne (`new_discounts`, `new_places`, `my_discounts`) hanno
`default true`. Verificato sul progetto live: 7 profili, 7 righe, zero
scoperti. Non è fortuna, è il database. `recipientsFor()` in
`api/_email/send.js` legge di lì, quindi nessun punto d'invio può
dimenticarsi di applicare il filtro — ma nemmeno può escludere qualcuno che
non ha mai toccato niente.

**Cosa è stato tolto il 21/09:** l'interruttore "Newsletter" nella pagina
profilo (mobile e desktop). Era un'iscrizione separata, **spenta di
default**, su una tabella diversa (`newsletter_subscribers`): prometteva una
lista che in pratica non esisteva — un iscritto su sette — e contraddiceva
la regola. Tolto anche `NewsletterForm.jsx`, che non era importato da
nessuna parte.

**Cosa resta, e deve restare:**

- il **link in fondo a ogni annuncio** ("Scegli cosa ricevere" →
  `/preferenze-email`);
- l'intestazione **`List-Unsubscribe` con `One-Click`**, che fa comparire
  "Annulla iscrizione" accanto al mittente in Gmail e Apple Mail e che dal
  2024 è obbligatoria per chi manda a molti indirizzi;
- la **pagina delle preferenze** con gli interruttori separati. Non è in
  contraddizione con "tutti iscritti": lì non ci si iscrive, ci si toglie.
  Ed è quella che tiene basse le segnalazioni di spam — chi non vuole più un
  tipo di email lo spegne invece di premere "segnala come spam", che è il
  colpo peggiore che un dominio possa prendere. Toglierla farebbe salire le
  segnalazioni, cioè esattamente il contrario di quello che serve.

**La tabella `newsletter_subscribers` resta** — la scrive `useAuth.js` alla
registrazione, la legge l'admin per l'export CSV, e `delete-account.js` la
ripulisce. Non è più una porta d'ingresso: è un registro.

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

## 15/09 — revisione design + deliverability

Vedi `docs/email-sistema.md`. In sintesi, quello che tocca questo file:

- **Tutti gli endpoint passano da `_email/send.js`.** `partner-application.js`
  e `recovery-otp.js` non chiamano più Resend per conto proprio, quindi da
  adesso anche loro hanno versione a solo testo, `X-Entity-Ref-ID` e mittente
  coerente.
- **Il trigger #7 (notifica iscritti) manda anche `our_review`** del locale
  dentro l'email dello sconto, e usa `photo_url` invece di `thumb_url`.
- **Nuova rotta:** `POST /api/send-email?unsub=<token>` — disiscrizione a un
  clic, chiamata da Gmail, non dal sito. `GET` sullo stesso indirizzo
  reindirizza a `/preferenze-email`.
- **Anteprima:** `node scripts/email-preview.mjs` genera `docs/email-preview/`
  con tutte e dodici le email; il pannello admin adesso ne può mandare dodici
  di prova invece di cinque.

---

## 21/09 — revisione v11: dove vivono i template

Censimento richiesto dall'handoff, cioè **dove si compone l'HTML prima della
chiamata a Resend**. Non c'è più nessun HTML dentro un endpoint: tutto passa
da `api/_email/`.

| Cosa | File | Funzione |
|---|---|---|
| Guscio (testata, card, piè di pagina, preheader) | `api/_email/render.js` | `emailHeader`, `emailFooter`, `renderEmail` |
| Mattoni (mosaico, card drop, blocco convenzione, bottone, testi) | `api/_email/blocks.js` | una funzione per blocco |
| Colori, misure, claim | `api/_email/theme.js` | `COLORS`, `MOSAIC`, `DROP_PHOTO`, `CLAIM` |
| Regole di contenuto (taglio, prezzo, indirizzo, countdown) | `api/_email/content.js` | `clipSentences`, `priceSymbols`, `metaFor`, `countdownWords` |
| Le quattordici email | `api/_email/templates.js` | una funzione per email |
| Invio (Resend, intestazioni, batch, destinatari) | `api/_email/send.js` | `sendEmail`, `sendBatch`, `recipientsFor` |
| Le due di Supabase | `supabase/email-templates/build.mjs` | generate dagli stessi blocchi |

**Rifatti in questo giro (blocco centrale nuovo):** nuovo in guida (#9), drop
(#7), convenzione (#7b), benvenuto Bi Club (#1).

**Guscio nuovo, blocco centrale ancora quello di settembre** — da allineare
subito dopo, vedi `docs/email-sistema.md` §8: sconto preso (#5 della tabella
in email-sistema), sconto usato, benvenuto ristoratore (#2), conferma
suggerimento (#3), conferma candidatura, codice di recupero (#6a/#6b), le due
interne (#4, #5), e le due di Supabase.

**Non toccato:** trigger, condizioni d'invio, destinatari, dedup su
`email_notifications_log`, intestazioni `List-Unsubscribe`, batch Resend.

---

*File auto-generato da audit manuale sorgente `main` HEAD `7e6f406`. Aggiornare quando si toccano gli endpoint `/api/send-email`, `/api/partner-application`, `/api/recovery-otp`, `/api/notify-subscribers`, o la edge function `send-newsletter`.*
