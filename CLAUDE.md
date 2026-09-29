# ChiamamiBi — Progetto Recap

## ⚠️ LEGGI PRIMA: stato v4 corrente
**Prima di iniziare qualsiasi lavoro sui v4 track leggi `docs/v4-status.md`** —
contiene lo stato esatto di PR, SQL eseguiti, env vars, e prossimi step.
Aggiornalo quando completi un passaggio.

## Cos'è
App web per scoprire ristoranti a Torino (e altre città italiane). Mappa interattiva, schede ristorante, recensioni utenti, sconti con QR code, pannello admin completo.
**Sito live**: chiamamibi.com | **Deploy**: Vercel | **DB**: Supabase

## Stack
- React 19 + Vite 8 + React Router 7
- Tailwind CSS 4 + Framer Motion
- Supabase (PostgreSQL, Auth, Storage, RLS)
- Mapbox GL (mappa), Recharts (grafici admin)
- i18next (5 lingue: it, en, fr, es, de)
- QR code per sconti, push notifications, service worker

## Struttura principale
```
src/
  pages/public/    → HomePage (mappa), RestaurantPage, ListView, DealsPage, LoginPage, ProfilePage, ecc.
  pages/admin/     → AdminDashboard, RestaurantForm, DiscountManager, ecc.
  components/      → Restaurant/, Discount/, Map/, Layout/, UI/, SEO/, Newsletter/
  lib/hooks/       → useAuth, useRestaurants, useDiscounts, useSavedRestaurants, ecc.
  lib/supabase.js  → Client Supabase
  lib/i18n.js      → Config i18next
api/
  resolve-maps.js  → Serverless function Vercel per risolvere link Google Maps
supabase/
  ESEGUI-TUTTO.sql → Schema DB completo (tutte le tabelle + RLS policies)
```

## BACKUP STABILE — NON TOCCARE SENZA MOTIVO
- **Tag**: `backup-working-2026-03-24`
- **Commit**: `9f3c9f6`
- **Ripristino**: `git checkout backup-working-2026-03-24 -- <file>`

### File critici che funzionano — testati e verificati:
1. **`api/resolve-maps.js`** — Risolve link Google Maps e compila automaticamente il form ristorante
   - Funziona con: `maps.app.goo.gl`, `share.google`, `goo.gl`, link completi `/place/...`
   - Link CID (`?cid=`) dall'app Maps iPhone: vengono risolti tramite redirect chain (CID → ?q=NomePosto)
   - Strategie ricerca in ordine: `/place/Name/` URL → `?q=` parametro URL → titolo pagina HTML
   - `followRedirects()`: usa mobile User-Agent (necessario per redirect HTTP 302 da goo.gl)
   - Consent cookies inviati SOLO a domini `google.com/maps` (non a goo.gl, rompe i redirect)
   - `isGenericQuery()` filtra: nomi città, CAP, query generiche Google
   - `extractFromHtml()`: estrae nome da title/og:title/og:description della pagina

2. **`src/pages/admin/RestaurantForm.jsx`** — Form creazione/modifica ristorante
   - Autofill da Google Maps con bottone "Compila automaticamente"
   - Rileva link CID e mostra messaggio utente appropriato
   - Gestisce: nome, indirizzo, coordinate, telefono, sito web, foto, categorie, sconti

3. **`supabase/ESEGUI-TUTTO.sql`** — Schema DB completo
   - Tabelle: profiles, restaurants, restaurant_photos, categories, discounts, discount_redemptions, restaurant_partners, user_reviews, user_review_photos, saved_restaurants, translations, newsletter_subscribers, partner_applications, push_subscriptions
   - `is_admin()` function con SECURITY DEFINER (evita ricorsione RLS su profiles)
   - Trigger `handle_new_user()` per creare profilo automatico alla registrazione

4. **`supabase/fix-profiles-recursion.sql`** — Fix per errore "infinite recursion in policy for profiles"

5. **`vercel.json`** — Config Vercel con `maxDuration: 30` per resolve-maps

## Problemi risolti (per riferimento futuro)
- **goo.gl non risolveva**: serviva mobile User-Agent per redirect HTTP 302
- **Consent cookies rompevano goo.gl**: inviarli solo a google.com/maps
- **CID URL (dall'app Maps iPhone)**: non risolvibili direttamente, ma il redirect chain li porta a `?q=NomePosto` che funziona
- **searchQuery era CAP invece di nome locale**: riordinato strategie, `?q=` ora ha priorità su titolo HTML
- **Profiles 500 (ricorsione RLS)**: rimossa policy "Admin read all profiles" ricorsiva, `is_admin()` con SECURITY DEFINER
- **Colonne mancanti DB**: `recommended_for`, `tiktok_url`, `instagram_reel` aggiunte con ALTER TABLE
- **Google CAPTCHA/sorry page**: rilevata e gestita con messaggio errore

## Email — leggi prima di toccarle
Il sistema sta in `api/_email/` e il riferimento è **`docs/email-sistema.md`**
(design, regole per aggiungerne una, e cosa le tiene fuori dallo spam).
`docs/EMAIL-FLOWS.md` dice invece *cosa parte quando*.
Due regole che non si saltano: l'HTML di un'email non si scrive dentro un
endpoint (si compone con i blocchi in `_email/blocks.js`) e nessuno chiama
Resend per conto proprio (si passa da `_email/send.js`). È così che erano nate
tre testate diverse e tre email senza versione a solo testo.
Anteprima: `node scripts/email-preview.mjs` → `docs/email-preview/index.html`.

Dalla revisione v11 (21/09) se ne aggiunge una terza, ed è quella che si
sbaglia più facilmente: **il colore dice il tipo di sconto**. Corallo pieno
`#E8453C` solo per i **drop** — scadono, i posti finiscono, e l'email ha la
card con la barra e il countdown. Le **convenzioni** (`is_drop = false`) hanno
il blocco crema con il filetto d'oro, il chip che dice quando vale ("valido
solo a cena", "valido a pranzo e a cena" — mai un "sempre valido" fisso, che
contraddiceva i giorni scritti accanto), e **niente**
barra, countdown o conteggio posti. Vestire da drop uno sconto permanente
brucia l'urgenza anche sui drop veri. Il bottone invece resta corallo in tutti
e due: è il colore dell'azione, non quello dello sconto.

Le formattazioni non si fanno nei template: taglio del testo di Bi (su frase
intera, mai a metà parola), prezzo in `€€`, indirizzo, countdown e la regola
che evita di dire lo sconto due volte stanno in `_email/content.js`.

**Chi le riceve (deciso il 21/09):** chi ha un account. Non c'è niente a cui
iscriversi — il trigger `on_auth_user_created_email_prefs` crea la riga in
`email_preferences` con tutti gli interruttori a `true`, e `recipientsFor()`
legge di lì. L'unica scelta è smettere, e sta in fondo al messaggio: link
"Scegli cosa ricevere" più l'intestazione `List-Unsubscribe` a un clic. Non
aggiungere caselle di iscrizione e non togliere la pagina delle preferenze:
è quella che fa spegnere un tipo di email invece di premere "segnala come
spam", che è il colpo peggiore che il dominio possa prendere. L'interruttore
"Newsletter" di Impostazioni e Profilo e la spunta alla registrazione agiscono
su `email_preferences` (`src/lib/emailPrefs.js`); `newsletter_subscribers` è
la lista vecchia e non decide più niente. E se tocchi `render.js` o `blocks.js`, rilancia
`node supabase/email-templates/build.mjs`.

**Modificare uno sconto non manda email (28/09):** l'annuncio a tutti parte
solo quando lo sconto si **crea** (casella "Manda l'email a tutti gli utenti"
nel form). "Salva modifiche" aggiorna e basta; il server rifiuta l'annuncio
automatico (`onCreate`) per uno sconto con più di 15 minuti. Il megafono sulla
card chiede sempre conferma. Non rimettere un invio sul salvataggio.

**Promemoria degli sconti non usati (24/09):** un cron Vercel al giorno
(`/api/notify-subscribers?job=discount-reminders`) ricorda uno sconto preso da
almeno 48 ore e mai usato — **un locale per email, al massimo una al giorno,
ogni 3 giorni, 4 in un mese**, perché chi prende dieci sconti li prende in due
minuti. Le regole stanno tutte in `REMINDER_RULES` (`api/_email/reminders.js`)
e sono sotto test: se le cambi, cambia il test, non aggiungere eccezioni
altrove. Parte a chi ha "I miei sconti" (`my_discounts`) acceso. Dettagli in
`docs/EMAIL-FLOWS.md` §7c.

## Convenzioni contenuti sconti (per riferimento futuro)
- **Offerte "paghi X prendi Y"** (es. 3 al posto di 2): scrivere sempre in formato `AxB` (es. `3x2`, `2x1`), mai per esteso ("Paghi 2 prendi 3 Veneziane"). Vale per `title` e `discount_value` del record in `discounts`.
- **Sticker/badge sconto** (percentuale o importo fisso su foto/card): devono sempre avere il segno meno davanti al valore, es. `-20%`, `-1€`. Gestito centralmente da `formatDiscountBadge()` / `formatDiscountBadgeShort()` in `src/lib/utils/discountFormat.js` — quando si aggiunge un nuovo punto che mostra uno sticker sconto, usare sempre queste funzioni (mai `formatDiscountValue()` da solo, che non mette il segno).

## Drop esaurito — sparisce, al suo posto lo sconto fisso del locale (28/09, PR #309)
Fino al 28/09 un drop esaurito restava in vetrina (home e Bi Club) con la
card "sold out" e il bottone spento. Deciso dal proprietario: **un drop
esaurito non si mostra più**, né per chi l'ha preso (lo ritrova in "I miei
vantaggi") né per gli altri. Il caso che l'ha fatto nascere: Shoro −30%
(12 presi su 10) al posto del quale ora c'è Shoro −20%.
- **Home** (tutte e due, `HomeFeedV4` e `HomeDesktopClassic`): lo sconto in
  evidenza lo sceglie `pickFeaturedDeal()` in `src/lib/discounts.js` —
  drop attivo → se il drop è esaurito, lo sconto fisso **dello stesso
  locale** → altrimenti lo sconto fisso che scade prima. Attenzione: se il
  drop esaurito viene *disattivato* dall'admin, la regola 2 non scatta più
  e in vetrina va lo sconto che scade prima (non per forza lo stesso locale).
- **Home da computer**: quando in vetrina c'è uno sconto fisso la card è
  scura con "SCONTO BI CLUB", niente corallo/countdown/barra posti (regola
  del colore, vedi Email).
- **Bi Club** (`SconteRedesignPage`): la lista drop usa `filterActiveDrops`
  (prima `filterVisibleDrops`, che teneva gli esauriti).
- Test in `tests/discounts.test.mjs`. **Per tornare indietro** (drop
  esauriti di nuovo visibili col "sold out"): revert della PR #309.

## Tutorial di benvenuto (28/09)
Sette schermate che partono **una volta sola** a chi ha appena creato l'account:
benvenuto (tutto corallo, logo e cibo in orbita), Esplora, **gli sconti in quattro
passi** (drop e convenzioni → «Sblocca sconto» e lo ritrovi in «I miei vantaggi»
→ su cosa, in che giorni e a pranzo/cena vale → alla cassa mostri il QR o detti il
codice e lo sconto è sullo scontrino), Salvati. In fondo un'animazione di chiusura
e si va alla **home**; "Salta" in alto (o Esc) chiude e lascia dove si era.
**Parte appena l'account è confermato** (codice accettato in LoginPage, link
della mail o primo accesso Google in AuthCallback): la spunta "Ci sei" resta un
secondo, poi il suo cerchio corallo si allarga fino a diventare la prima
schermata (`openWelcomeTour({ source: 'signup', origin })`), e la pagina sotto
cambia solo quando il tutorial copre tutto (`whenTourCovers`, con ripiego a
3,5 s) — mai a tempo fisso, o su rete lenta la home lampeggia in mezzo. Il
chunk si scarica mentre si scrive il codice (`preloadWelcomeTour`).
Attenzione: il nostro client Supabase usa il flusso **implicit** (default,
nessun `flowType`), quindi Google e i link della mail tornano su
`/auth/callback` con la sessione nell'hash, **senza `?code=`**. Ogni strada di
AuthCallback passa da `finishSignIn()`: un controllo messo solo nel ramo
`code` non scatta mai per Google (era il bug del 28/09: "Accesso effettuato!"
e tutorial solo dopo, sulla home).
Regole in `src/lib/welcomeTour.js` (sotto test in `tests/welcome-tour.test.mjs`):
account nato da meno di 24 h (`created_at`, così vale sia per email+codice sia per
Google, e un vecchio utente che entra con Google non lo vede) e non ancora visto
su quel browser (`localStorage`). Mai sopra login, admin, `/verify`, `/partner` e
Chiedi a Bi. Montato da `WelcomeTourGate` in `App.jsx`; il tutorial sta in un
chunk a parte (`src/components/Onboarding/`). Si rivede da Impostazioni →
"Rivedi il tutorial". Eventi PostHog: `onboarding_shown`, `onboarding_completed`,
`onboarding_skipped` (con `step`). Le illustrazioni seguono le regole del sito:
corallo + countdown solo sul drop, convenzione crema e oro, badge verde da
`formatDiscountBadge`. La schermata "Chiedi a Bi" compare da sola quando
`CHAT_MAINTENANCE` torna `false`. **Se cambia una funzione dell'app raccontata
qui (nomi dei bottoni, «I miei vantaggi», come si usa il QR), aggiorna anche il
testo in `WelcomeTour.jsx`.**

## Feedback dopo la convalida — festa, stelle, Bi che ringrazia (29/09)
Quando il locale convalida il codice (/verify), sul telefono di chi l'ha usato:
**festa** a tutto corallo ("Sconto convalidato!", spunta, coriandoli) →
**stelle da 1 a 5, che NON si saltano** (niente X, niente Salta, Esc non
chiude: deciso dal proprietario) → **modulo per Bi**, saltabile (cosa è
piaciuto, com'è andato lo sconto, ci torneresti, due righe) → **Bi che
saluta coi cuori**. Chi salta riceve le email a ~30 min e ~1 giorno
(`docs/EMAIL-FLOWS.md` §7d, regole in `FEEDBACK_RULES`, sotto test).
- **DB**: `redemption_feedback`, una riga per convalida creata dal trigger
  `tr_redemption_feedback_on_redeem`. Il browser non ci scrive mai: legge la
  propria riga e passa dalle RPC `feedback_get/rate/submit` col `token` della
  riga — lo stesso che sta nei link delle email (`/feedback?t=…&stelle=N`),
  così dall'email non serve accedere. SQL `supabase/redemption-feedback-2026-09-29.sql`.
- **Come se ne accorge l'app** (`RedemptionFeedbackGate` in `App.jsx`): il
  realtime dei riscatti è acceso **solo mentre un QR è aperto** (`QRPassSheet`
  lo annuncia con `QR_PASS_EVENT`, e si chiude da solo alla convalida), più un
  controllo ogni pochi secondi dello stato di quel riscatto, più un controllo
  all'apertura/rientro nell'app. Non accendere un canale realtime per tutti
  gli utenti per tutta la visita: con il lancio Supabase era già saturo.
- **Bi disegnata**: `src/components/Feedback/BiCharacter.jsx`, SVG vettoriale
  dalla foto `public/bi-photo.webp` (capelli rame, lentiggini, orecchini d'oro,
  felpa nera, il bao). `mood` cambia la faccia col voto (sad/meh/ok/smile/love),
  `wave` saluta, `hearts` fa salire i cuori; animazioni CSS spente con "riduci
  animazioni". La faccina per le email è `public/email-assets/bi-cartoon.png`,
  generata dallo stesso SVG: se cambi il disegno, rigenerala.
- Regole in `src/lib/redemptionFeedback.js` (sotto test in
  `tests/feedback-asks.test.mjs`): si apre entro 3 ore dalla convalida, solo
  senza stelle; la festa solo nei primi 5 minuti; mai su login, admin, /verify.
- Admin: `/admin/feedback` (stelle, messaggi, media per locale). PostHog:
  `feedback_shown`, `feedback_rated`, `feedback_submitted`, `feedback_skipped`.
- Il giro delle email parte da **pg_cron** (`supabase/redemption-feedback-cron-2026-09-29.sql`),
  non da `vercel.json`: sul piano Hobby i cron Vercel sono uno al giorno.

## Sblocco sconti — QR e codice a 6 caratteri
Ogni riscatto (`discount_redemptions`) ha due codici: il `qr_code`
(`BiSc-…`, dentro il QR) e lo `short_code` di sei caratteri — una lettera e
cinque cifre, es. `K48213` — che il cliente detta e il ristoratore digita
quando la fotocamera non collabora. Tre regole:
- **lo short code lo genera il DB**, mai il client (trigger
  `trg_redemption_short_code`): i punti che inseriscono un riscatto sono già
  due e nessuno deve poter dimenticare il codice;
- il formato sta in tre posti che devono restare allineati —
  `supabase/short-code-redemptions-2026-09-18.sql` (la verità),
  `src/lib/shortCode.js` (app) e `api/_short-code.js` (PDF ed email).
  `tests/short-code.test.mjs` verifica che non divergano;
- per mostrarlo usa `formatShortCode()` e il componente
  `ShortCodeCard` — mai il codice nudo, mai il `qr_code` scritto per esteso.

**Il QR si mostra in un solo modo (22/09):** `QRPassSheet` in
`src/components/Discount/QRPass.jsx`, variante "A · Selettore" scelta fra
quattro proposte. In testa il locale e la X; una card con badge (e le
regole in piccolo accanto), e dentro un selettore **QR / Codice** che scambia il QR
(SVG, tocco → tutto schermo su bianco con wake lock) e il codice a sei
caratteri (`ShortCodeCard`) nello stesso riquadro ad altezza fissa; sotto due
bottoni uguali, **Info sconto** (pannello dal basso) e **Scarica PDF**. Lo
usano il popup del Bi Club (`DiscountDetailPopup`) e quello della pagina del
locale (`DiscountQuickPopup`); il PDF (`api/discount-pdf.js`) ne ricopia lo
stile. Un nuovo punto che mostra un QR monta questo componente, non un canvas
suo. Il badge è verde (`--gradient-sconto`) come ovunque; accanto, in
piccolo, il vantaggio, i giorni in cui vale (lettere accese/spente, oggi
sottolineato), la fascia o l'orario e la prima condizione. Niente pillola
"Sempre valido"; il corallo compare solo sui drop, col countdown.

Dettagli e ragioni: sezione "18/09 — sbloccare uno sconto digitando il
codice" in `docs/v4-status.md`.

## Sicurezza — tre regole (audit 23/09)
Resoconto completo: `docs/security-audit-2026-09-23.md`.
- **`restaurants` non si legge mai con `select('*')`** dal browser: `verify_pin`,
  `partner_email`, `magic_token` non sono concessi né ad `anon` né ad
  `authenticated`, e con i grant di colonna un `*` fallisce intero. Colonne
  esplicite (`RESTAURANT_READABLE_COLUMNS` in `src/lib/restaurantColumns.js`,
  `RESTAURANT_COLUMNS` in `publicQueries.js`); il PIN l'admin lo legge con
  `fetchRestaurantSecrets()` (RPC `admin_restaurant_secrets`). Una **colonna
  nuova** di `restaurants` va concessa in SQL ad anon *e* authenticated e
  aggiunta a quell'elenco.
- **Nessun endpoint pubblico spedisce email a un indirizzo preso dal corpo
  della richiesta** senza captcha: le conferme dei form le manda il server dopo
  Turnstile. Un endpoint che consuma API a pagamento (Google, Anthropic) vuole
  un utente autenticato — admin se serve solo al pannello.
- **Profili, riscatti e storage**: un utente legge solo il proprio profilo; i
  riscatti li crea il browser ma li segna usati solo il locale (RPC `verify_*`);
  nel bucket `photos` scrive solo l'admin.

## Analisi del sito — PostHog (27/09)
`src/lib/posthog.js`, avviato da `main.jsx` a browser libero (chunk a parte).
La chiave di progetto (pubblica) è nel file e parte solo su chiamamibi.com;
`VITE_POSTHOG_KEY` la sostituisce e la accende anche in locale/anteprima. Gli eventi passano da
`/ingest` (rewrite in `vercel.json` verso i server **US** di PostHog, dove sta
il progetto; se un giorno passa a EU vanno cambiati lì e `ui_host`). Le regole
usano `:path(.*)`, non `:path*`: con `:path*` gli indirizzi con la barra finale
(`/ingest/i/v0/e/`, dove vanno gli eventi) cadevano sul rewrite della SPA e
il POST prendeva 405 — config caricata, zero eventi. Senza "Accetta tutti"
nel banner la persistenza è `memory` (niente cookie): non toglierlo, il banner
promette "non utilizziamo cookie di profilazione". `identify` solo con l'id
Supabase e solo con consenso; `/admin` non si conta. Eventi su misura:
`track('nome_evento', { ... })`. Error tracking: `capture_exceptions` prende gli
errori non gestiti; quelli che React ferma nell'ErrorBoundary passano da
`captureError()` — un nuovo boundary deve chiamarla anche lui.
**Mappe del codice (29/09):** perché PostHog mostri file e riga veri invece
del JS compresso, dopo `vite build` `scripts/posthog-sourcemaps.mjs` carica le
mappe su PostHog e le **cancella da `dist`** (il sorgente non va online). Parte
solo se su Vercel ci sono `POSTHOG_CLI_API_KEY` (chiave personale `phx_…`) e
`POSTHOG_CLI_PROJECT_ID`; senza, niente mappe. Se il caricamento fallisce il
deploy va avanti lo stesso. La CLI non sta nelle dipendenze apposta (il suo
`postinstall` scarica da GitHub e farebbe fallire `npm install`).
Gli errori dei browser dentro le app ("Java object is gone",
`webkit.messageHandlers`, "Script error.") non partono: li filtra
`src/lib/errorNoise.js` in `before_send`. Non sono nostri e coprivano quelli veri.
I chunk spariti dopo un deploy ("Failed to fetch dynamically imported module",
"text/html is not a valid JavaScript MIME type", "Unable to preload CSS") non
sono errori: l'ErrorBoundary ricarica la pagina e manda solo `chunk_reload`.
Parte come errore solo se ricapita entro 30 s (`src/lib/chunkReload.js`).
**Mappa nei replay (27/09):** la mappa è un canvas WebGL e PostHog di suo non
registra i canvas — nei replay Esplora sembrava vuota per tutti. Ora
`session_recording.captureCanvas` è acceso (2 fps, metà risoluzione) e la mappa
ha `preserveDrawingBuffer: true`: **non toglierlo**, perché senza il
registratore fa `clear()` sul canvas a ogni fotogramma e la mappa diventa
bianca davvero, anche sullo schermo di chi la usa. Se la mappa non parte lo
dicono gli eventi `map_loaded` (con `ms`), `map_error`, `map_failed` (niente
WebGL: compare il rimando all'elenco) e `map_context_lost`.
**Mappa pronta prima di Esplora (27/09, rivista il 29/09):** la mappa Mapbox è
**una sola per tutta la visita** (`src/components/Map/mapInstance.js`): nasce in
anticipo in un contenitore nascosto mentre si è sulla home
(`src/lib/prewarmExplore.js`: subito su /esplora; al tocco su "Esplora"; a
browser libero dalle altre pagine; mai con risparmio dati o 2G) e quando si esce
da Esplora non si distrugge, torna nel parcheggio. MapView non crea mappe:
chiede `getMap()` e alla fine `parkMap()` — **mai `map.remove()`**. Primo
ingresso da ~3 s a ~0,4 s, ritorno da ~1,9 s a ~0,25 s. **Esplora istantanea è
voluta** (deciso dal proprietario il 29/09, anche sapendo il costo sotto).
Il costo: crearla sono secondi di processore (pezzi fino a ~1,4 s su un
telefono medio) e un tocco che ci capita in mezzo aspetta — su iPhone l'INP
della *prima* pagina della visita era 1,4 s contro 0,4 s delle successive. Per
questo **dal telefono parte solo dopo 3 s senza tocchi né scroll** (da computer
dopo 1,5 s), e il parcheggio ha la classe `ph-no-capture`: il replay di PostHog
fotografava due volte al secondo anche la mappa nascosta. Se l'INP della prima
pagina resta alto, l'alternativa misurata è creare la mappa solo al tocco su
Esplora (tocco → mappa ~1 s): è una scelta di prodotto, chiedere prima.

## Web Vitals (29/09) — cosa non rimettere
Dati in PostHog → Web analytics → Web vitals (con `$os` si vede iPhone da
Android). Tre regole nate dalle misure:
- **Niente librerie che fotografano la pagina** (html2canvas, liquidGL): la tab
  bar "a vetro liquido" su Android rifaceva uno screenshot dell'intera pagina a
  ogni cambio. Il vetro della tab bar è solo CSS, uguale su tutti i telefoni.
- **Niente `backdrop-filter` sugli sfondi a tutto schermo** delle finestre
  (popup QR, fogli del Bi Club, filtri): su iPhone ritarda il primo disegno dopo
  il tocco. Va bene su elementi piccoli (tab bar, header, pillole).
- **Quello che arriva dopo il primo disegno ha già il suo posto.** In home
  (`.hfv4-skel` in `HomeFeedV4.jsx`) i segnaposto hanno l'altezza delle sezioni
  vere: senza, il CLS della home era 0,76 (ora 0,01). Se cambi l'altezza di una
  sezione della home, aggiorna il suo segnaposto. Nei moduli niente
  contenuto centrato in verticale che cambia altezza da solo (vedi `/login`).
**Liste passate alla mappa: sempre memo.** MapView rifà tutti i pin quando
cambia l'array `restaurants` (per identità) e avvisa la pagina dei locali
visibili; con un filtro attivo HomePage le passava un array nuovo a ogni
render (`discountRestaurantIds` era un `new Set` nel corpo) e il giro
pin → avviso → render girava ~300 volte al secondo, CPU al 100%. Ora
`notifyVisible` avvisa solo se qualcosa cambia, ma una lista derivata va
comunque in `useMemo`.

## Connettori disponibili — USALI SE ATTIVI
- **GitHub** — PR, issues, merge (funziona via `gh` CLI, testato e operativo)
- **Supabase** — se il connettore è attivo, esegui query SQL direttamente. Se non funziona, fornisci SQL all'utente da eseguire nel dashboard Supabase. CLI disponibile (`npx supabase`) ma richiede login/token.
- **Vercel** — se il connettore è attivo, controlla deploy e log. CLI disponibile (`npx vercel`) ma richiede login. Se non funziona, i deploy avvengono automaticamente al push su GitHub.
- **Web** — ricerche web quando serve
- **NOTA**: nella sessione del 24/03/2026 le CLI Supabase e Vercel non erano autenticate. Verificare all'inizio di ogni sessione se i connettori funzionano.

## Credenziali e config
- API key Google Places: env var `VITE_GOOGLE_PLACES_KEY`
- Supabase: env vars `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Admin email: `ale.cali@icloud.com`
- Region Vercel: default (non forzare US, causa CAPTCHA Google)
