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

## Uscita programmata di locali e sconti (29/09)
Nel pannello si può dire "esce lunedì alle 18": **Modifica ristorante** (finché
è in bozza) → riquadro **"Quando esce?"** (`PublishSchedule.jsx`), sia in cima
alla pagina sia in Dettagli → Pubblicazione, accanto a "Scheda pubblica" — la
prima versione, due caselline sotto l'intestazione, il proprietario non la
trovava; **form sconti** → "Programma l'uscita" (non
per le prove, né per uno sconto già online). Fino a quell'ora la riga resta
nascosta (`is_published = false` / `is_active = false`) con `publish_at`
pieno; all'ora giusta la mette online il giro
`/api/notify-subscribers?job=scheduled-publish` (**pg_cron ogni 5 minuti**,
`supabase/scheduled-publish-cron-2026-09-29.sql`) e `publish_at` torna NULL.
- All'uscita partono le stesse email della pubblicazione a mano: locale →
  "nuovo in guida" a tutti (se `notify_on_publish`) e il PIN al locale (se ha
  email e PIN); sconto → l'annuncio (se `notify_on_publish`).
- **Uno sconto aspetta il suo locale**: se il locale non è ancora online resta
  programmato e si riprova al giro dopo; programmati alla stessa ora escono
  insieme (prima il locale). Regole in `api/_scheduled-publish.js`, sotto test
  in `tests/scheduled-publish.test.mjs`.
- L'annuncio (registro doppioni, destinatari, template) sta in
  `api/_email/announce.js`, usato sia dal megafono sia dal giro; il PIN al locale
  in `api/_email/partner.js`. Dal 29/09 l'annuncio di uno sconto è rifiutato se
  il suo locale non è pubblicato o se lo sconto è già scaduto.
- Accendere a mano uno sconto programmato (▶ sulla card) chiede conferma e
  annulla l'uscita **senza email**; pubblicare a mano un locale programmato
  ("Salva · pubblica" dopo aver tolto la spunta) manda le email come sempre.
- SQL colonne `supabase/scheduled-publish-2026-09-29.sql` e cron
  `supabase/scheduled-publish-cron-2026-09-29.sql` (**tutti e due eseguiti** il
  29/09; per spegnere il giro: `SELECT cron.unschedule('chiamamibi-scheduled-publish');`). La data si mostra con `formatPublishAt()` (`src/lib/scheduledPublish.js`),
  sempre all'ora di Roma.

## Pannello admin rifatto — locali e sconti (30/09)
Kit grafico unico in `src/components/admin/admin-ui.css` (classi `adm-*`,
variabili `--adm-*`) e pezzi in `src/components/admin/ui.jsx` (`Card`,
`Field`, `ToggleRow`, `Choices`, `Ring`, `Steps`, `Sheet`, `Toast`). Una pagina
nuova o rifatta del pannello usa questi, non stili in linea.
- **Aggiungi un locale** (`NewRestaurant.jsx`): tre passi (Trova → Controlla →
  Crea). La riga in `restaurants` nasce **solo** a "Crea la bozza", con i dati di
  Google Maps (`GoogleMapsImportBlock variant="hero"`, link o nome). Prima la
  pagina creava una bozza vuota appena aperta: in elenco restavano righe
  "Nuovo ristorante —". L'elenco locali le segnala e le elimina ("Eliminale").
- **Scheda locale** (`EditRestaurant.jsx`): intestazione con copertina, stato e
  la lista di cosa manca per uscire (nome e indirizzo, mappa, foto, categoria,
  racconto ≥ 80 caratteri; PIN a parte). "Quando esce?" resta subito sotto.
  Sezioni in una pagina sola con l'indice (a sinistra da computer, chip in alto
  da telefono). **Un solo posto per salvare**: barra in fondo sul telefono,
  bottoni in testa e sotto l'indice da computer. Le pagine di modifica passano
  `focus` ad `AdminLayout`: sul telefono niente barra di navigazione, in alto la
  freccia per tornare.
- **Editor sconti** (`DiscountEditor.jsx`, montato da `DiscountManager`): a tutto
  schermo, sei blocchi (locale, tipo, offerta, regole, durata e posti, come esce)
  con l'**anteprima dal vivo** (`DiscountPreview.jsx`): drop corallo con
  countdown e posti, convenzione crema e oro col chip di `conventionValidity`
  (`api/_email/content.js`, la stessa frase delle email). "Come esce" è una scelta
  sola (subito / programmato / solo prova / in pausa) al posto di tre
  interruttori. Tutta la logica di salvataggio e delle email è ancora
  `handleSave` in `DiscountManager`: modificare non manda email.
- Link diretti: `/admin/discounts?new=1` (bottone **Crea**),
  `?new=1&restaurant=ID` (dalla scheda del locale), `?edit=ID` (dalla lista
  sconti del locale, sezione 04).
- Anteprime per controllare il disegno senza Supabase: vedi la PR (Playwright con
  le chiamate intercettate).

## Video di Bea nella scheda del locale (30/09)
Riquadro "Ho fatto un video in questo posto" con **un bottone per piattaforma**:
«Guarda il video su Instagram» e/o «Guarda il video su TikTok»; senza link il
riquadro non c'è. I link li legge `restaurantVideos()` (`src/lib/restaurantVideos.js`,
test in `tests/restaurant-videos.test.mjs`): Instagram da `instagram_url` (il
campo "Video Instagram" del pannello, dove li mette Bea) e se vuoto dal vecchio
`instagram_reel`; TikTok da `tiktok_url` (campo "Video TikTok"). Fino al 30/09 la
scheda leggeva solo `instagram_reel` e i reel messi dal pannello nuovo non si vedevano.

## Convenzioni contenuti sconti (per riferimento futuro)
- **Offerte "paghi X prendi Y"** (es. 3 al posto di 2): scrivere sempre in formato `AxB` (es. `3x2`, `2x1`), mai per esteso ("Paghi 2 prendi 3 Veneziane"). Vale per `title` e `discount_value` del record in `discounts`.
- **Sticker/badge sconto** (percentuale o importo fisso su foto/card): devono sempre avere il segno meno davanti al valore, es. `-20%`, `-1€`. Gestito centralmente da `formatDiscountBadge()` / `formatDiscountBadgeShort()` in `src/lib/utils/discountFormat.js` — quando si aggiunge un nuovo punto che mostra uno sticker sconto, usare sempre queste funzioni (mai `formatDiscountValue()` da solo, che non mette il segno).

## Drop esaurito — resta in vetrina col "sold out" (30/09)
Dal 28/09 (PR #309) un drop esaurito spariva da home e Bi Club e al suo posto
andava lo sconto fisso del locale. **Il 30/09 il proprietario l'ha voluto di
nuovo visibile**: un drop esaurito resta con la scritta "sold out" e il
bottone "Esaurito" spento. **Ne resta uno solo, l'ultimo uscito**
(`filterShownDrops`, per `drop_starts_at`): il 30/09 Gelateria Borghese sì,
Shoro −30% (esaurito dal 22/09) no — deciso dal proprietario. Quando va
esaurito un drop più nuovo prende lui il posto. Sparisce anche se scade o
viene disattivato.
- **Home** (tutte e due, `HomeFeedV4` e `HomeDesktopClassic`): lo sconto in
  evidenza lo sceglie `pickFeaturedDeal()` / `chooseFeaturedDeal()` in
  `src/lib/discounts.js`. **Vince l'ultima cosa successa** (deciso il 30/09):
  l'**ultimo drop uscito** (attivo o esaurito; quando ne esce uno nuovo prende
  il posto del precedente, che resta valido per chi l'ha preso e, se ha
  ancora posti, resta tra gli altri sconti e nel Bi Club) **oppure lo sconto
  scelto a mano** dal pannello, se la scelta è più recente dell'uscita
  dell'ultimo drop. Senza nessuno dei due, lo sconto fisso che scade prima.
  Sul telefono il "sold out" lo disegna `DropCard`; da computer `HeroPromo`
  (chip "SOLD OUT · SCONTO ESAURITO" senza pallino, timbro sulla foto, posti
  fermi al totale).
- **Scelta a mano della vetrina** (30/09): nel pannello sconti il bottone 🏠
  sulla card mette lo sconto nella card grande della home al posto del drop
  (colonna `discounts.home_featured_at` = quando è stato scelto, SQL
  `supabase/home-featured-2026-09-30.sql`, **già eseguito**). Uno solo alla
  volta; il riquadro "In vetrina in home adesso" in cima al pannello dice
  cosa c'è e perché, con "Torna all'ultimo drop". Solo la home: il Bi Club
  non la guarda. Si può scegliere solo uno sconto online (non in prova, in
  pausa, scaduto; esaurito solo se è un drop). Un drop programmato conta dal
  suo `drop_starts_at` (o dalla creazione, se più tarda).
- **Home da computer**: quando in vetrina c'è uno sconto fisso la card è
  scura con "SCONTO BI CLUB", niente corallo/countdown/barra posti (regola
  del colore, vedi Email).
- **Bi Club** (`SconteRedesignPage`): la lista drop usa `filterShownDrops`
  (gli attivi più l'ultimo esaurito); il conteggio "N attivi" e il badge del
  tab restano sugli attivi.
- Test in `tests/discounts.test.mjs`.

## Avvisi agli admin su Telegram (30/09)
Nel gruppo Telegram degli admin arriva un messaggio quando: ✅ un locale
**convalida uno sconto** (locale, sconto, drop "usati X su N" o convenzione,
nome di battesimo, ora, quanti oggi), ⭐ arriva una **recensione** (quando il
modulo è mandato, `completed_at`: stelle, cosa è piaciuto, commento — non al
solo tocco sulle stelle, così è un messaggio per recensione), 💡 un
**suggerimento** di locale, 🤝 una **candidatura**. Sconti di prova col
prefisso "🧪 PROVA".
- **Tutto nel DB**: trigger `tr_telegram_*` → `private.telegram_admin_send()`
  → `pg_net` verso l'API di Telegram. Nessun endpoint Vercel. SQL
  `supabase/admin-telegram-2026-09-30.sql` (**già eseguito** il 30/09).
- Token del bot e id del gruppo nel **Vault** (`telegram_bot_token`,
  `telegram_admin_chat_id`); senza, non parte niente. Per spegnere: cancellare
  `telegram_admin_chat_id` dal Vault. Istruzioni in testa al file SQL.
  Configurato il 30/09: bot **@LaGuidaDiBi_bot**, gruppo **"La Guida di Bi"**.
  Se il gruppo diventa supergruppo (Telegram lo fa da solo, per esempio quando
  si rende visibile la cronologia) l'id cambia in `-100…` e gli avvisi si
  fermano: rifare `getUpdates` e aggiornare `telegram_admin_chat_id`.
- **Un avviso non fa mai fallire quello che lo ha fatto partire**: ogni trigger
  ha il suo `EXCEPTION WHEN OTHERS` → solo un WARNING (provato: con l'invio in
  errore la convalida passa lo stesso). Non toglierlo.
- I suggerimenti li può mandare anche chi non ha un account: oltre 20 in
  un'ora gli avvisi si fermano. Email e telefono dei candidati non vanno su
  Telegram (restano nell'email a info@ e nel pannello).
- Le etichette della recensione ricopiano `src/lib/redemptionFeedback.js`: se
  cambiano lì, aggiornale nel trigger.

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
saluta coi cuori**. Chi salta riceve le email a ~30 min e ~1 giorno; chi
manda la recensione riceve, qualche minuto dopo, l'email di **grazie** con le
sue stelle e le sue parole (`docs/EMAIL-FLOWS.md` §7d, regole in
`FEEDBACK_RULES` e `planFeedbackThanks`, sotto test). Le illustrazioni delle
email (`public/email-assets/bi-cartoon.png`, `bi-grazie.png`,
`bi-grazie-basso.png`) sono scatti di `BiCharacter`: se cambia il disegno
vanno rifatte.
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
  dalle foto di Bi mandate dal proprietario il 29/09 (capelli rame vivo con la
  riga in mezzo, eyeliner a codina, lentiggini, orecchini d'oro, collanina di
  perline colorate, giacca nera sulla maglia a righe blu e gialla, forchetta
  con gli spaghetti). `mood` cambia la faccia col voto (sad/meh/ok/smile/love),
  `wave` saluta, `hearts` fa salire i cuori; animazioni CSS spente con "riduci
  animazioni". La faccina per le email è `public/email-assets/bi-cartoon.png`,
  generata dallo stesso SVG: se cambi il disegno, rigenerala.
- Regole in `src/lib/redemptionFeedback.js` (sotto test in
  `tests/feedback-asks.test.mjs`): si apre entro 3 ore dalla convalida, solo
  senza stelle; la festa solo nei primi 5 minuti; mai su login, admin, /verify.
- **Niente si perde**: le stelle partono al tocco con `navigator.sendBeacon`
  (`rateFeedbackNow` in `src/lib/feedbackApi.js`), e se chi scrive il modulo
  chiude l'app o cambia scheda senza premere "Manda a Bi" il modulo si manda
  da solo (`submitFeedbackNow`, evento PostHog `feedback_autosaved`). Beacon
  e non `fetch keepalive`: la fetch con le intestazioni di Supabase fa prima
  la verifica CORS e, chiudendo nello stesso istante, non arrivava (provato
  il 29/09); il beacon è un modulo form-urlencoded con `?apikey=`
  nell'indirizzo e parte in un giro solo. L'ultimo voto si rimanda anche su
  "Avanti" e quando la pagina si nasconde.
- **I ristoratori vedono le recensioni** in /verify, scheda **Recensioni** e
  riquadro in dashboard (`src/components/Verify/VerifyReviews.jsx`, RPC
  `verify_feedback_list` col device token, solo il proprio locale, del
  cliente solo il nome di battesimo — SQL `supabase/verify-feedback-list-2026-09-29.sql`,
  già eseguito). Chi lascia il feedback lo sa: la schermata delle stelle e il
  modulo dicono che lo vede anche il locale. Non togliere quelle due righe.
- Admin: `/admin/feedback` (stelle, messaggi, media per locale). PostHog:
  `feedback_shown`, `feedback_rated`, `feedback_submitted`, `feedback_skipped`.
- Il giro delle email parte da **pg_cron** (`supabase/redemption-feedback-cron-2026-09-29.sql`),
  non da `vercel.json`: sul piano Hobby i cron Vercel sono uno al giorno.

## Drop preso — "Ce l'hai fatta, sei il numero X su 20" (30/09)
Chi sblocca un **drop** (primo sblocco, mai quando riapre il QR) vede prima del
QR una schermata corallo a tutto schermo: **Bi che applaude** (`clap` in
`BiCharacter`), coriandoli, il numero che sale fino al proprio posto, un
pallino per posto col proprio che si accende in oro, "Goditelo!". Sotto,
**"Scopri come usare lo sconto"** (apre **"Come si usa lo sconto"**, quattro
schermate nello stile del tutorial ma solo sui passi da qui alla cassa:
«I miei vantaggi» → giorni, orari e «Info sconto» → al locale «Apri QR» in
cassa (o il codice) → il locale convalida e la promozione è sullo scontrino;
`openWelcomeTour({ topic: 'use' })`, `buildUseSlides` in `WelcomeTour.jsx`,
niente animazione finale, si resta sulla pagina, non segna il benvenuto come
visto. Non riaprire il tutorial di benvenuto: racconta tutto il sito, non
l'uso dello sconto — deciso dal proprietario il 30/09) e **"Chiudi"** (nel Bi
Club poi il toast "Salvato in «I miei vantaggi»"). **Il QR non si apre dopo la
festa** (deciso dal proprietario il 30/09: chi ha appena preso il drop non è
alla cassa); chi sblocca riceve `{ shown, action }` e con `shown` non apre il
QR, il popup si chiude. Primo e ultimo posto hanno la loro frase; mai "21 su 20".
- Lo lancia `celebrateClaim()` (`src/lib/dropWin.js`, test in
  `tests/drop-win.test.mjs`) da tutti i punti che creano un riscatto (Bi Club
  `claimDeal`/`claimFromPopup`, `useUserRedemption`): la promessa si risolve
  quando la festa si chiude, così il QR si apre dopo. La mostra `DropWinGate`
  in `App.jsx` (chunk a parte `DropWin.jsx`). Un punto nuovo che sblocca uno
  sconto deve chiamarla anche lui, e con `shown` non aprire il QR.
- **Primo sconto sbloccato (30/09)**: a chi sblocca il suo **primo** sconto in
  assoluto — drop o convenzione — parte "Come si usa lo sconto"; a chi ne ha
  già sbloccati altri no. Lo decide `DropWinGate` contando i propri riscatti
  (`isFirstClaim` in `dropWin.js`: esattamente 1 contando quello appena fatto)
  e segnandolo in `localStorage` (`chiamamibi:first-claim-tour:<id>`).
  Convenzione: prima il tutorial, poi il QR come sempre (`openUseTour` aspetta
  che si chiuda). Drop: la festa mostra solo "Scopri come usare lo sconto"
  (niente "Chiudi"), poi il tutorial. PostHog `first_claim_tour`.
- Il posto lo dice il DB: RPC `my_claim_rank(redemption_id)` (solo il proprio
  riscatto). Nello stesso SQL (`supabase/drop-claim-rank-2026-09-30.sql`,
  **già eseguito** il 30/09) `guard_redemption_insert` prende un lucchetto
  **per sconto**: prima due sblocchi nello stesso istante sull'ultimo posto
  passavano tutti e due. Se il DB non risponde in 2,5 s la festa parte senza
  numero. PostHog: `drop_win_shown` (`rank`, `total`, `rank_failed`),
  `drop_win_closed` (`action`: tutorial/close); il tutorial così aperto manda
  gli `onboarding_*` con `source: 'drop_win'`, `topic: 'use'`.

## Data di nascita (29/09)
Dal 29/09 la registrazione con email chiede la **data di nascita** (obbligatoria,
tre tendine giorno/mese/anno — `BirthDateInput`, non il calendario nativo). Viaggia
nei metadati di `signUp` e il trigger `handle_new_user` la copia in
`profiles.birth_date`. Chi l'account ce l'aveva già (e chi entra con Google, che il
modulo non lo vede) la trova chiesta da un **popup** (`BirthDateGate` in
`App.jsx`): **una volta per visita** (sessionStorage) finché non la mette;
"Più tardi" lo chiude fino alla prossima apertura del sito. Mai sopra login, admin,
/verify, /partner, /feedback, pagine legali, il tutorial di benvenuto (Google: prima
il tutorial) o un'altra finestra aperta (`aria-modal`). Si corregge da Impostazioni;
l'admin vede età, età media e quanti l'hanno messa in /admin/users.
- **Almeno 16 anni** (come i Termini): stessa regola in `src/lib/birthDate.js` e nel
  DB (`private.valid_birth_date` + trigger `check_profile_birth_date`, SQL
  `supabase/profiles-birth-date-2026-09-29.sql`, **già eseguito**). Test in
  `tests/birth-date.test.mjs` controlla che non divergano.
- `profiles` ha **solo grant di colonna**: una colonna nuova senza `GRANT SELECT`
  ad `authenticated` fa fallire il `select('*')` del profilo di tutti.
- PostHog: `birthdate_asked`, `birthdate_saved` (`source`: signup/popup/settings),
  `birthdate_later`.

## Sconti di prova — non vanno online (29/09)
Per provare uno sconto col locale prima di pubblicarlo (primo caso: Gelateria
Borghese con l'account beatrice.rigato@gmail.com). Nel form sconti: casella
**"Sconto di prova"** + le email di chi lo vede. Lo sconto è vero (si
sblocca, QR e codice, il locale lo convalida in /verify, festa e stelle) ma
lo vedono **solo gli admin e le email invitate**; nessuna email di annuncio
(il form non la offre, il megafono è spento, `notify-subscribers` lo rifiuta).
- **Lo nasconde il DB**, non l'app: `discounts.is_test` + tabella
  `discount_testers` + policy di lettura su `discounts` (SQL
  `supabase/discount-test-mode-2026-09-29.sql`, **già eseguito**). Così la
  cache CDN (`api/public.js`, chiave anon) non lo riceve mai, e
  `guard_redemption_insert` rifiuta il riscatto a chi non è invitato.
- In app lo porta `fetchMyTestDiscounts` (`useDiscounts.js`): chiede solo le
  prove a cui è invitata **la propria email** (anche un admin non vede quelle
  degli altri sul sito), non le scrive in localStorage, e se non ce ne sono
  non richiede per 5 minuti. Sul foglio del QR c'è l'etichetta "Prova".
- Le letture con **service role** vedono tutto: una nuova query sugli sconti
  lato server (email, Chiedi a Bi, conteggi) vuole `.eq('is_test', false)`.
- **Pubblicare** = togliere la spunta e salvare: da lì è uno sconto normale.
  Il form propone di cancellare i riscatti fatti durante la prova (contatori
  e posti ripartono da zero). L'email a tutti non parte: c'è il megafono.

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

## Sezioni del sito su Google — sitelink (30/09)
Per far uscire sotto il risultato di ChiamamiBi i link alle sezioni
("Promozioni ristoranti Torino" → /sconti, "I migliori ristoranti di Torino"
→ /esplora) ogni sezione deve essere per Google una pagina a sé. Prima
/sconti, /esplora e /list arrivavano col titolo della home e il canonical
verso "/": doppioni della home.
- Titoli e descrizioni in **`src/lib/seoPages.js`** (una fonte sola): li usa
  MetaTags nelle pagine (`seoMeta('/sconti')`) e `scripts/seo-pages.mjs`, che
  dopo `vite build` scrive `dist/seo/<sezione>.html` con il `<head>` giusto e
  le briciole di pane. Le rewrite in `vercel.json` servono quel file per
  /esplora, /sconti, /list, /about, /partner (prima del catch-all). Test in
  `tests/seo-pages.test.mjs`. Una sezione nuova: aggiungila in tutti e tre.
- /esplora non ha una Route: il suo MetaTags sta in `App.jsx`.
- I link interni vanno a **/sconti**, non a /deals (che fa redirect 301).
- La tab bar del telefono è fatta di `<a href>`, non di bottoni: Google
  guarda il sito da telefono e segue solo i link. Non rimettere `<button>`.
- I sitelink li sceglie Google da solo e non si possono imporre; quelli dello
  screenshot di TheFork erano un annuncio Google Ads (estensioni sitelink).

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
