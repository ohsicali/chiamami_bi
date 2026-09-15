# v4 — Stato Track

Ultima modifica: 2026-09-14 ("carica altri locali" in fondo alla lista Esplora)

File di memoria per Claude: leggi questo a inizio sessione per sapere
dove siamo. Aggiorna a ogni step importante.

## Stato corrente

| Track | PR | Stato | Note |
|-------|----|----|----|
| PR11 — UI block orari scheda | — | 🚧 In progress | Branch: `claude/add-hours-block-ui-4Ixcu`. Front-end only: legge `hours_cache` da DB, `getHoursStatus` in `src/lib/hours.js`, `HoursPill` in `src/components/HoursPill.jsx`. |
| A — Disable user reviews | #64 | ✅ Merged (02a1f99) | SQL eseguito, code live |
| A5 — Hide legacy reviews UI | #69 | ✅ Done (36c11bc) | Decisione Augusto 2026-04-20: nascondere. UI già senza ref a `user_reviews` dopo #64; rimosso "recensioni" da testo delete-account. DB rows preservate. |
| A6 — Terms rewrite §4 | #69 | ✅ Done | Sostituito "Contenuti degli utenti" con "Segnalazioni" → redazione-only + info@chiamamibi.com per errori. PrivacyPage già pulita. |
| C1 — Google Places hours | #65 | ✅ Merged (bf538f8) | Env + SQL + backfill fatti in sessioni precedenti |
| C2 — Email notifications | #66 | ✅ Merged (7c4f05b) | Env + SQL + test consegna email fatti |
| B — Reskin | — | 🚧 Next | Vedi docs/v4-sitemap-reskin.md, docs/mockups/ |
| C3 — (TBD) | — | ⏳ Not started | |
| HANDOFF v10 — Blocchi 0-10 | #212 | 🚧 In review | Branch: `claude/sito-backup-before-changes-ga8zbe`. Backup pre-lavori: branch `backup-pre-v10-2026-09-08` (commit `3256ddb`). Vedi sezione "HANDOFF v10" sotto. |
| Pubblicità — circuito banner | #211 | 🚧 In review | Branch: `claude/banner-ad-dimensions-uqazb1`. 3 posizioni (`home_hero` hero in home, `list_inline` elenco locali mobile + colonna mappa desktop, `deals_mid` pagina sconti), rotazione pesata tra più clienti, metriche impression/click/CTR, admin `/admin/placements` rifatto. Slot definiti in `src/lib/adSlots.js`. |

## HANDOFF v10 — stato per blocco (PR #212)

| Blocco | Stato | Note |
|---|---|---|
| 0 — Bi Club mostra tutti gli sconti | ✅ | Filtro città rimosso. Definizione unica in `src/lib/discounts.js`, usata da admin e sito pubblico. Test di regressione in `tests/discounts.test.mjs` (16 test). |
| 1 — DropCard in 3 taglie | ✅ | `src/components/Discount/DropCard.jsx` + `.css`. Struttura v5. |
| 2 — Home mobile | ✅ | Resta la v10 sotto i 1024px. Sequenza momento → aperti ora → drop → altri sconti → categorie → ultimi aggiunti. |
| 3 — Home desktop | ↩️ Annullato | Da 1024px in su si usa la home di prima del rifacimento. Vedi "Home — due home, una per misura" sotto. |
| 4 — Bi Club adattivo | ✅ | 1/2/3+ drop, paginazione da 6, mai carosello su mobile, convenzioni come righe. |
| 5 — Gating registrazione | ♻️ Rifatto al contrario il 14/09 | Il gate non sta più all'ingresso ma sul gesto: catalogo e chat aperti a tutti, riquadro al click su "Sblocca" / all'invio del messaggio. Vedi "14/09 — il gate si sposta sul gesto" in fondo. |
| 6 — Salvati per liste | ✅ | Tabelle `saved_lists` + `saved_list_items`. Striscia liste condivisa fra telefono e desktop (`src/components/Restaurant/SavedListsStrip.jsx`), rinomina/elimina, scelta emoji, e da PR #214 il riquadro "Aggiungi lista" in cima alla striscia. **Note personali: scartate** — vedi sotto. **Persistenza verificata sul DB il 14/09** (vedi sotto): la lista è una riga in `saved_lists`, resta dopo il logout e nessun altro utente la vede. **Non ancora provato a schermo con un account vero.** |
| 7 — Chiedi a Bi | ⚠️ Parziale | Fatti i bug: troncamento `max_tokens` e stato dinamico in header. **Non fatto**: redesign schermata iniziale mobile, card locali dentro le risposte, chip di continuazione. |
| 8 — Admin | ✅ | Riga sconto responsive 768-1100px, barra avviso sconti irraggiungibili, KPI con denominatore, niente flash di zeri. **Non verificato a schermo** (serve login admin). |
| 9 — Ristoratore | ✅ | Condizione e ora nella schermata verde, saluto col nome, indirizzo ripulito, contatto non più attaccato. Il resto risultava già fatto da PR23. **Non verificato a schermo** (serve PIN). |
| 10 — Pubblicità | ✅ | Quarta posizione su scheda ristorante + barra inventario. Tracking IntersectionObserver e anteprima live erano già in PR #211. |

## Home — due home, una per misura (14/09)

Augusto, in due passaggi: prima *"la home da desktop non mi piace, preferivo
come era prima del redesign"*, poi *"da mobile invece teniamo quello nuovo,
solo da desktop torniamo indietro"*.

Quindi adesso:

| misura | quale home | file |
|---|---|---|
| < 1024px (telefono, tablet) | la v10 **com'era al deploy `31805ab`** | `src/pages/public/HomeFeedV4.jsx` |
| ≥ 1024px (computer) | quella di prima del rifacimento | `src/pages/public/HomeDesktopClassic.jsx` |

Lo switch è in `App.jsx`, una media query a 1024px sulla route `/`, e ognuna
delle due arriva col suo `lazy`: da telefono il codice della home desktop non
viene nemmeno scaricato.

**Perché due file e non due rami dentro lo stesso componente**: le due home non
condividono la struttura. Una apre col drop in evidenza e il momento scende
sotto, l'altra apre con l'orologio e la fascia del momento. Non è una
differenza di margini, è un altro ordine di blocchi con altri componenti
dentro; tenerle nello stesso file avrebbe voluto dire due alberi JSX interi
montati insieme e nascosti a vicenda col CSS.

Stessa ragione per i due gemelli: `TimeContextHeroClassic.jsx` e
`MomentResultsGridClassic.jsx`, usati solo dalla home desktop.

Sulla home del telefono Augusto ha chiesto di tornare esattamente al deploy
`31805ab`, e poi ha segnalato di nuovo il buco bianco nelle card di "Ultimi
aggiunti". Ci sono girato intorno due volte prima di capire da dove veniva:
non dall'indirizzo, ma dal fatto che in una riga tutte le card prendono
l'altezza della più alta. Basta un locale in fondo alla riga con nome lungo
e tagline lunga e tutte le altre si ritrovano dello spazio da riempire.
`margin-top: auto` lo mandava in mezzo (buco), toglierlo lo mandava in fondo
(card frastagliate, indirizzi a altezze diverse): due modi di subire lo
stesso problema.

Risolto togliendolo di mezzo: nome e tagline si prendono due righe ciascuno
SEMPRE, anche quando ne riempiono una sola o nessuna. Le card vengono alte
uguali per costruzione — misurate: tutt'e nove a 325px con 1px di scarto —
quindi non c'è niente da allungare. Costa una riga d'aria sotto ai nomi
corti, che si legge come impaginazione perché è sempre la stessa.

La home del computer non è stata toccata: lì le card stanno in griglia, il
difetto non si presentava e Augusto non l'ha segnalato.

I blocchi `@media (min-width: 1024px)` dentro `HomeFeedV4.jsx` sono ormai
codice morto — da 1024 in su monta l'altro componente. Lasciati apposta, con
un avviso in cima: servono se un domani si torna a una home sola.

**Il prezzo, detto chiaro: una modifica alla home ora va fatta due volte.**
Se un domani una delle due versioni viene abbandonata, i suoi file vanno
cancellati e non lasciati lì.

La home desktop parte da `42d0dcb` (il commit prima di `dba1fc6`) ma NON è un
ritorno cieco: porta con sé i bug già segnalati e già sistemati, che riportare
indietro sarebbe stato un passo indietro vero — `fetchPriority` con la
maiuscola, il cuore che non è più un `<button>` dentro un altro, "Sblocca
sconto" che sblocca davvero, il cuore da sloggato che apre la porta a vetri, e
la barra mobile che sparisce già da 768px (a 1024 su un iPad in verticale si
vedevano due intestazioni sovrapposte).

`DropCard.jsx` e `DropCard.css` non sono tornati indietro: li usa anche il Bi
Club, e la home desktop non li importa affatto.

Tutto il resto del lavoro resta: liste dei salvati, email, registrazione col
codice, gate, correzioni sparse.

Lint: da 144 a 147 problemi. I tre in più sono copie di errori già presenti,
arrivate coi file duplicati (`Date.now()` dentro un memo, setState in un
effetto del countdown, il falso positivo su `motion` usato in JSX).

## Registrazione — sistemata la sera del 13/09

**L'SMTP di Supabase era rotto** (535) e bloccava ogni registrazione: l'utente
ha messo Resend (smtp.resend.com:465, utente `resend`, password = API key) e
adesso funziona. Verificato: `POST /auth/v1/signup` non risponde più 500.

Attenzione per chi riprende: **per provare il signup non usare indirizzi
`@example.com`**. È un dominio riservato senza MX, Resend lo rifiuta, e
Supabase restituisce lo stesso `500 "Error sending confirmation email"` che dà
quando le credenziali sono sbagliate. I due casi da fuori sono
indistinguibili, e questo ha già fatto perdere un giro di diagnosi.

Sopra a quello, quattro lavori:

| Cosa | Stato | Note |
|---|---|---|
| Logo e font nelle email | ✅ | Il logo non era quello del sito: stessa scritta, carattere diverso (grazie squadrate contro lettere tonde). Rigenerato da `public/logo-guida-bi.png`. Georgia sostituito da Poppins, self-hosted in `public/fonts` (8KB a peso). Su Gmail e Outlook i webfont non si caricano e resta un sans di sistema: non è aggirabile. |
| Conferma password | ✅ | Secondo campo che compare dopo la prima, con riscontro dal vivo. Stato separato da `confirmPassword`, che appartiene al recupero. |
| Codice a 6 cifre | ⚠️ Serve un passaggio manuale | `verifySignupOtp` / `resendSignupOtp` in `useAuth`, modalità `confirm_signup` in LoginPage. **Il template "Confirm signup" su Supabase deve mandare `{{ .Token }}` e non il link** — finché non è fatto arriva ancora il link e la schermata del codice non serve a niente. |
| Animazione di conferma | ✅ | `RegistrationDone` in fondo a LoginPage.jsx. Dura quanto il rimando (1,6s). Rispetta "riduci animazioni". |

Perché il codice e non il link: sul telefono il link apre un browser diverso da
quello della registrazione e si finisce confermati ma sloggati; gli scanner di
posta pre-caricano i link e confermano l'account senza che una persona abbia
fatto niente; e il sito già usava il codice per il recupero password.

### Da fare prima del merge
- **Incollare il template della mail di conferma su Supabase** (vedi sopra).
- Provare il flusso liste con un account vero (Blocco 6) — il 14/09 provato a
  schermo con un browser reale e rete simulata (vedi "Liste: 'metti in una
  lista' provato a schermo" in fondo al file): il codice funziona. Manca
  ancora la prova con un account vero sul sito live.
- Aprire /admin/sconti su un iPad vero (Blocco 8).
- Fare una scansione QR vera per vedere la schermata verde (Blocco 9).
- Provare la registrazione intera con un indirizzo vero: codice, conferma, animazione, benvenuto.
- Nota nota a parte: a 768px l'intestazione della home appare due volte
  (barra desktop + logo mobile). È così anche su `main`, non è una
  regressione di questa PR.

## Liste: persistenza verificata (14/09)

Domanda: la lista che un utente si crea resta lì anche dopo il logout?
Controllato sul progetto `Chiamami_bi` col connettore Supabase, non sul codice:

- `saved_lists` e `saved_list_items` esistono, RLS attiva, una policy per
  tabella (`Owner manages own lists`, `Owner manages own list items`).
- Simulando il ruolo `authenticated` con il JWT di un utente vero — la stessa
  strada che fa il sito — la creazione della lista e l'aggiunta di un locale
  passano, e l'utente si rilegge la sua lista.
- Con il JWT di un secondo utente la stessa lista non si vede: 0 righe.
- Le prove giravano dentro una transazione con `ROLLBACK`: sul database non è
  rimasto niente.

Quindi la lista vive in Postgres, legata a `user_id`: il logout non la tocca e
al rientro viene riletta da `useSavedLists`. Niente localStorage, a differenza
dei salvataggi singoli, che lo usano come copia locale.

Al 14/09 le liste create sul sito sono **0**: nessuno ne aveva mai fatta una.
Coerente col motivo di PR #214 — fino a ieri una lista si poteva creare in un
posto solo, dentro il foglio che si apre quando salvi un locale.

## SQL eseguiti in questa sessione

- `supabase/saved-lists-2026-09-08.sql` ✅ eseguito via connettore Supabase il
  2026-09-08 (tabelle `saved_lists`, `saved_list_items`, RLS + grant).
- `supabase/saved-restaurants-withcheck-2026-09-13.sql` ✅ eseguito via
  connettore Supabase il 2026-09-13 (policy "Users manage own saves" rifatta
  con `WITH CHECK`; senza, un UPDATE su una riga propria poteva riscriverne
  lo `user_id`).
- `supabase/fix-email-preferences-fk-2026-09-14.sql` ✅ eseguito via
  connettore Supabase il 2026-09-14 — vedi "14/09 — email di sconto/drop
  mai partite" sotto e `docs/EMAIL-FLOWS.md`.

### Note personali sui salvati — scartate, non riproporle

Il 2026-09-13 erano state fatte: colonna `note` su `saved_restaurants`,
componente `SavedNote.jsx`, foglio di scrittura, test. **L'utente ha deciso di
non metterle** e sono state tolte per intero — codice, test e colonna (era
vuota, zero righe).

Erano nate non da una richiesta ma da una promessa già scritta nel sito
("Liste salvate con le tue note personali" nella pagina di accesso, e la
stessa frase nell'email di benvenuto): le note non esistevano e la frase
prometteva che sì. Adesso la frase è stata corretta in due punti
(`src/pages/public/LoginPage.jsx`, `api/_email/templates.js`) e dice quello
che le liste fanno davvero.

**Attenzione**: i mockup `docs/mockups/v4-mobile-auth.html` e
`v4-mobile-pagine.html` contengono ancora la vecchia frase sulle note. Sono
documenti storici, non copia viva — non ricopiarla da lì.

## Env vars Vercel — già configurate

- `RESEND_API_KEY` ✓ (funzionante dopo rigenerazione 2026-04-19)
- `RESEND_FROM` = `Bi <ciao@chiamamibi.com>` ⚠️ aggiornare su Vercel (era `ChiamamiBi <noreply@chiamamibi.com>`)
- `RESEND_REPLY_TO` = `info@chiamamibi.com` ⚠️ nuovo, impostare su Vercel (fallback codice `info@chiamamibi.com`)
- `GOOGLE_PLACES_KEY` ✓ (server-only, no VITE_ prefix)
- `SUPABASE_SERVICE_ROLE_KEY` ✓ (All environments)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ✓
- `VITE_GOOGLE_PLACES_KEY` — separato per client (se usato)

## SQL migrations eseguite

- `supabase/disable-user-reviews-2026-04-19.sql` ✓ (Track A)
- `supabase/add-google-places-fields-2026-04-19.sql` ✓ (Track C1)
- `supabase/add-email-notifications-log-2026-04-19.sql` ✓ (Track C2)

- `supabase/ads-network-2026-09-07.sql` ✓ (Pubblicità) — verificata sul DB il
  2026-09-07: colonne `slot`/`weight`/`link_type` e vincoli presenti.
- `supabase/ad-events-2026-09-07.sql` ✓ (Pubblicità · metriche) — eseguita via
  connettore Supabase il 2026-09-07.

## Pubblicità — note operative

- **`ad_events` non è scrivibile dal browser**, come `page_views`: le righe le
  inserisce `api/track.js` (ramo `kind: 'ad_event'`) con il service role. Serve
  `SUPABASE_SERVICE_ROLE_KEY` su Vercel (già configurata).
  Motivo: su impression e click si fattura, e un contatore gonfiabile dal
  browser renderebbe inutile il report al cliente.
- Le posizioni sono definite in `src/lib/adSlots.js`, non in DB.
- `?demo=ads` su qualsiasi pagina mostra campagne finte senza toccare il
  database — preview e produzione condividono lo stesso DB.

## Resend

- Dominio `chiamamibi.com` verificato (DKIM + SPF)
- Test delivery OK: ristorante, sconto, drop (iPhone Mail)

## Note importanti

- **Base branch**: tutti i v4 track → `claude/chiamamibi-app-xf7qn` (non `main`)
- **Design email C2**: rimandato a Track B (reskin) — per ora template funzionale OK
- **Backfill Places**: cleanup post-finish rimuovere `api/admin-backfill-places.js`,
  `src/pages/admin/BackfillPlaces.jsx`, rotta in `App.jsx`

## ⚠️ LEZIONE — sessione 2026-04-20

Il primo pass di reskin (commit 2f1eae1…1d1e566) ha fatto solo un
**color swap cosmetico** (Satoshi + corallo + glass pill + accent globale).
Augusto ha giustamente segnalato che è distante dai mockup.

**Fonts corrette da mockup**:
- UI body: **Satoshi** (400-900)
- Wordmark: **Alfa Slab One** (logo "CHIAMAMI BI", pin mark)
- Handwriting: **Caveat** (flourish di Bi)
- Display/headings: **Satoshi 900** con `letter-spacing:-0.02em` (NON TAN Songbird)

**Palette corretta da mockup**:
- `--corallo: #EE5C55` (da moodboard — il sitemap dice #E8453C ma la direzione è corallo)
- `--corallo-ink: #C7443E`
- `--corallo-soft: #FDEBEA`
- `--ink-05: rgba(34,24,28,.05)` (non .08)
- `--oro: #B08954` (non #C4A265)
- `--cream-deep: #F1EBE0`, `--line: #EAE3D7`

**Layout che mancano completamente nel codice e servono**:
- Hero promo card corallo full-width in home (con foto + CTA ink)
- Categorie a bolle circolari (emoji + label sotto)
- Card ristorante verticali scroll-snap (70% width, aspect 16:11, heart top-right glass)
- Sponsor banner ink con immagine + CTA corallo
- Blocco "Cosa ti consiglio" oro gradient con voce Bi
- Section heads Satoshi 900 22px

**Approccio corretto**: leggere ogni mockup prima di toccare il componente
corrispondente. NON fare color swap globali. Ogni componente va ricostruito
sulle spec del mockup specifico.

## Deviazioni dal brief v4 originale (scelte Augusto)

- **Pin mappa**: `docs/v4-sitemap-reskin.md` §0 dice "pin goccia corallo + B".
  **Augusto ha scelto**: mantenere i pin v3 (cerchio colorato per cucina + emoji),
  senza animazione bounce iniziale e con fix transform-transition (stanno fermi sulla mappa).
  → NON reintrodurre teardrop+B nei prossimi refactor.

- **Gate pagina**: invece della landing "Torniamo presto" (prima bozza),
  mostra form login inline. Admin-only via `VITE_MAINTENANCE_MODE=true`.

## Track B — progressione componenti

PR: #69 (draft). Branch: `v4/track-b-reskin`.

**Documenti di riferimento (in ordine di priorità)**:
1. `docs/v4-handoff.md` — spec canonica (tokens, patterns, regole hard)
2. `docs/mockups/v4-mobile-*.html` / `v4-desktop-*.html` — visuali esatte
3. `docs/v4-sitemap-reskin.md` — mappatura route → file

### Componenti shared da costruire / raffinare

- [ ] **Nav pill glass** mobile (bottom) + desktop (top) con logo + tab
- [ ] **Wordmark logo** Alfa Slab One + subtitle
- [ ] **City pill** con dot corallo
- [ ] **Pin mappa** categoria (cerchio + emoji) + cluster bianco
- [ ] **Card locale `.lcard`** (desktop lista): 118×118 + heart glass top-right
- [ ] **Card locale mobile** scroll-snap 70% width aspect 16/11
- [ ] **Hero promo corallo** (home)
- [ ] **Categorie bubble** (home)
- [ ] **Sponsor banner ink** (home)
- [ ] **Sticky pill sconto** glass (scheda)
- [ ] **Blocco editoriale "Secondo Bi"** (Caveat tip + sig)
- [ ] **Blocco oro "Cosa prendere"**
- [ ] **Banner sconto verde 135°**
- [ ] **Chip/tag system** (Satoshi 700 uppercase)

### Pagine da rifare (in questo ordine)

1. [ ] Home mobile (`v4-mobile-home.html`) — priorità massima, più visibile
2. [ ] Home desktop (`v4-desktop-home.html`)
3. [ ] Scheda locale mobile (`v4-mobile-scheda.html`) incluso sticky sconto
4. [ ] Scheda locale desktop (`v4-desktop-pagine.html` screen scheda)
5. [ ] Sconti mobile + desktop
6. [ ] Salvati mobile + desktop
7. [ ] Profilo mobile + desktop
8. [ ] Login/Signup/Suggerisci (`v4-mobile-auth.html`)
9. [ ] Verify ristoratori (`v4-verify.html`)
10. [ ] Admin mobile + desktop (`v4-mobile-admin.html`, `v4-desktop-admin.html`)

### Regole hard (da v4-handoff §3)

- Alfa Slab One SOLO per wordmark "CHIAMAMI BI" + 6 cifre PIN
- Caveat SOLO in editoriale (tip, signature, quote dentro "Secondo Bi")
- TAN Songbird RIMOSSO completamente (se lo vedo è un bug)
- Nomi locali Satoshi 800/900 ultra-tight
- Verde gradient 135° solo per sconti
- Oro solo per "Cosa prendere"
- Corallo = CTA + hero + drop. Mai diffuso

### Progresso (commit → cosa)

- `2f1eae1` design system tokens (primo pass, poi corretto)
- `105f088` MobileTabBar glass pill + DesktopNavbar corallo
- `1231056` revert pin teardrop → cerchio + emoji originale
- `a1f375b` **fix pin anchor bug** (transform transition toglie scivolamento)
- `2dd4bb0` docs: decisioni (pin v3, gate login)
- `46c868e` HomePage pills glass (Lista·N, Vedi la mappa)
- `2f1cc2a` RestaurantSheet top buttons + SaveButton heart
- `1d1e566` primo pass (poi revertito su gradient sconto)
- `56afa59` design tokens full + Alfa Slab + Caveat
- `67e7551` **allineamento canonico v4-handoff.md** — corallo #E8453C + verde gradient sconto
- `f25a264` docs: progress tracker
- `367e995` **HomeFeedV4 primo pass** — preview su /v4 (topbar + hero promo + bolle + Ultimi aggiunti + Suggest)
- ✅ **Full v4 reskin pass** (sessione notturna 2026-04-20):
  - HomeFeedV4 completato: sponsor banner, time-based section, "Cosa ti consiglio" oro block
  - MobileTabBar: 5 tab, glass pill, corallo-soft active state, deals badge
  - DesktopNavbar: glass pill, centered links, avatar/login
  - RestaurantSheet: Satoshi 900 names, v4 action row, "Secondo Bi" + "Cosa prendere" blocks
  - Footer: Alfa Slab One wordmark
  - All fonts migrated: TAN Songbird → Satoshi, DM Sans → var(--font-sans)
  - SavedPage, ProfilePage, LoginPage: full v4 token reskin
  - DealsPage: v4 header + token cleanup
  - Remaining pages (About, Privacy, Terms, Settings, Reset, Verify, Partner): v4 tokens
  - Admin pages: DM Sans → Satoshi
  - **Routing swap**: `/` = HomeFeedV4 (feed), `/esplora` = mappa
  - Duplicate fontWeight fixes across all files
  - All `'Satoshi', sans-serif` literals → `var(--font-sans)`
  - Georgia serif → var(--font-sans) in MaintenanceGate

### Stato componenti shared (checklist da v4-handoff §4)

- [x] Nav pill glass mobile (bottom) + desktop (top)
- [x] Wordmark logo Alfa Slab One + subtitle
- [ ] City pill con dot corallo (parziale — esiste ma non aggiornata)
- [x] Card locale mobile scroll-snap 70% width (HomeFeedV4)
- [x] Hero promo corallo (HomeFeedV4)
- [x] Categorie bubble (HomeFeedV4)
- [x] Sponsor banner ink (HomeFeedV4)
- [x] Blocco editoriale "Secondo Bi" (RestaurantSheet)
- [x] Blocco oro "Cosa prendere" (RestaurantSheet)
- [ ] Sticky pill sconto glass (scheda) — DA FARE
- [ ] Card locale desktop `.lcard` 118×118 + heart — DA FARE (desktop split view)
- [ ] Pin mappa categoria — invariati (decisione Augusto: mantiene pin v3)
- [x] Chip/tag system (FilterChips → Satoshi)

### Pagine — stato reskin

1. [x] Home mobile (HomeFeedV4) — `/`
2. [x] Home desktop (HomeFeedV4) — `/`
3. [x] Scheda locale mobile (RestaurantSheet)
4. [ ] Scheda locale desktop — parziale (layout base ok, sticky pill sconto mancante)
5. [x] Sconti mobile + desktop (DealsPage)
6. [x] Salvati mobile + desktop (SavedPage)
7. [x] Profilo mobile + desktop (ProfilePage)
8. [x] Login/Signup (LoginPage)
9. [x] About, Privacy, Terms, Settings, Reset, Partner (token reskin)
10. [x] Verify ristoratori (VerifyPage) — token reskin
11. [x] Admin pages — ink token normalizzato (`#1a1a1f` → `var(--color-ink)`, 14 file), sidebar wordmark Alfa Slab One (+ "Admin" subtitle) allineato a mockup v4-desktop-admin.html §295

### Cosa resta (per Augusto)

- **Verifica visiva** su device reale (iPhone, desktop Chrome)
- Deploy su Vercel e test live
- **SW offline base** (attualmente sw.js gestisce solo push — no fetch cache)
- **Lighthouse ≥ 90** (Performance/A11y/BestPractices/SEO) — da misurare live
- (opzionale) Route rename `/deals`→`/sconti`, `/saved`→`/salvati`, ecc. —
  SEO-risky, rimandato

### ✅ Completato — sessione pomeriggio 2026-04-20 (continuazione)

Commit range: `67160e4…7987496`

- **PIN digits** ora in Alfa Slab One (handoff §3 rule 1: SOLO wordmark
  + 6 PIN). Font fallback: Georgia, serif.
- **Secondo Bi**: rimosso sottotitolo hardcoded "La mia opinione".
  Ora è solo eyebrow corallo-ink + paragrafo + firma Caveat.
- **Service Worker offline base** (`public/sw.js`): precache shell,
  network-first navigation con fallback cache, cache-first `/assets/`,
  SWR immagini/font. Bypass `/api/` e cross-origin. Push notifications
  invariate.
- **DiscountManager**: rimosso char ★ da badge "Evidenza" e
  "In evidenza" (hard rule §5.2).
- **RestaurantSheet**: 2 star SVG icons in "Sconto esclusivo da Bi"
  sostituiti con dot verde + glow.
- **LoginPage "Scopri Bi"**: ricostruito grid 2-col con emoji + title
  + subtitle secondo `v4-mobile-auth.html` lines 225-238.
- **AdminDashboard**: `#1a1a1f` → `var(--color-ink)`; `rgba(196,162,101,*)`
  → `rgba(176,137,84,*)`.
- **Bulk sweep** `rgba(196,162,101,*)` → `rgba(176,137,84,*)` su
  globals.css (keyframes hero-pulse), RestaurantCard, AdminRestaurants,
  AboutPage, DealsPage, HomePage, PartnerLandingPage.

### ✅ Completato — sessione mattutina 2026-04-20

Commit range: `72a556f…e2114bb…` (PR #69)

- **Sticky pill sconto** riscritto per §4.3: cream glass pill, punto verde
  gradient 135° con glow, CTA ink 42px 800, centered bottom safe-area
- **RestaurantSheet scroll** padding-bottom 120px + safe-area (no copertura)
- **`.lcard` desktop** (≥768px): 118×118 foto, radius 16, border ink-05,
  hover translate + shadow, active corallo ring (§4.4)
- **Stelle/rating rimosse** da ListView (§5.2): StarIcon eliminato,
  "Consigliato da Bi" → "Top di Bi" chip corallo, our_rating non renderizzato
- **OrariLocale footer** → "Fonte: Google Places" (§5.7)
- **City pill dot** #4ade80 → var(--color-corallo) su Navbar
- **Color normalization**: `#C4A265` (vecchio oro) → `#B08954` (--oro canonico)
  su tutti i file pubblici e admin (§2). MaintenanceGate `#E8604C` → `#E8453C`
- **PIN lockout** 5 tentativi / 10 min (§5.1): localStorage-backed, timer
  countdown visibile su button, reset a successo, sia mobile che desktop

---

## PR24 — Polish design + upgrade design system (2026-06 → 09)

Branch: `claude/awesome-pasteur-stj12x` · PR #202 (draft)
Documento sorgente: `HANDOFF-PR24-POLISH-DESIGN.md`

### ✅ Blocco A — dati & immagini
- `src/components/UI/SmartImage.jsx` — helper condiviso: `SmartImage` (box con
  skeleton) + `PhotoOrEmoji` (single-element per container CSS-driven).
  Skeleton shimmer + fallback emoji categoria su gradiente caldo su onError.
  Riusa `proxyImg` → `/api/img` (NON il render-transform Supabase).
- Colonna `neighborhood` + cattura `address_components` in `resolve-maps.js`.
- `formatAddress()` → "Via Bonafous 7 · Vanchiglia"; `CityBadge` + ordinamento
  città-attiva-first; header "N locali · la guida di Bi".

⚠️ **LEZIONE — grant a livello di colonna.** Il ruolo `anon` ha GRANT SELECT
per COLONNA su `restaurants` (hardening PIN #201). Una colonna nuova NON
eredita il grant: senza `GRANT SELECT (neighborhood) TO anon` ogni query
pubblica falliva con 42501 e **la lista locali si svuotava**. Vale per
qualsiasi colonna futura. Vedi `supabase/add-neighborhood-2026-06-17.sql`.

### ✅ Blocco B — bug minori
B4 orari 7×Chiuso → "Orari non disponibili · chiama"; B5 rimosso "[DEMO]" da 6
sconti (DB prod); B7 padding tab bar safe-area; B8 riga "€" orfana; B10 About
720px + fade rapidi; B-Chiedi `max_tokens` 1500→2048; B-Admin skeleton KPI.

### ✅ Blocco C — completo
- **C1 scheda** — desktop: hero a **mosaico 1+4** + lightbox (Esc/←/→), "Qui
  vicino" full-width con `RestaurantCard variant="tile"`. Mobile: badge sconto
  sulla gallery. **B6 risolto su entrambe**: desktop = solo banner inline,
  mobile = solo sticky bar (prima comparivano insieme su tutte e due).
- **C2 drop Home mobile → Variante B**: foto piena in alto, % come badge menta
  sulla foto, nome locale come titolo, vantaggio in Poppins bold bianco.
- **C3 Bi Club**: convenzioni 3 col + **drop hero adattivo** — con un solo drop
  la card diventa hero orizzontale full-width (prima restava a 1/3 di larghezza
  con metà schermo vuota). Con N drop resta la griglia da 3.
- **C4 card Esplora**: "● Aperto" reale, sconto come pill, foto 4:3.
- **C5 Chiedi a Bi**: le card dei locali nella risposta **c'erano già**;
  aggiunti quick-reply chips (derivati lato client, nessun endpoint nuovo),
  stato "● Aperto", fallback foto e micro-copy attesa onesta.
- **C6 admin**: fasce spente a 0.25 (restano emoji), thumbnail con fallback.

**Non fatto di proposito**: con N drop, "hero solo per il drop in evidenza +
gli altri come card convenzione" — la griglia da 3 non soffre del vuoto, quindi
non era il problema segnalato.

### ✅ Upgrade design system (da audit misurato su 114 file / 46.617 righe)
Adesione ai token PRIMA: colore 38%, raggi 11%, ombre 18%, tipografia 0%.

- **Step 1** — `:focus-visible` globale (prima 0 regole), `prefers-reduced-motion`
  globale (prima 3 guardie su 305 animazioni), pinch-zoom sbloccato.
  Rimosse **4.680 righe morte**: `DealsPage.jsx`, `DesktopDiscountsPage.jsx`,
  `RestaurantForm.jsx` (in `App.jsx` `DealsPage` è un *alias* di
  `SconteRedesignPage`: il file omonimo non lo importava nessuno).
- **Step 2** — token nuovi in `@theme`: `--color-cta` (#C53A33), semantici
  danger/ok/warn, `--color-ink-64`, scala tipografica `--fs-xs…--fs-3xl`
  (nome `--fs-*` per non collidere con le utility `text-*` di Tailwind).
  `Button`/`Badge` riscritti sui token v4 (erano fermi a `#FF5757` pre-v4:
  ecco perché nessuno li importava).
- **Step 3** — 21 CTA con testo bianco migrati a `var(--color-cta)`.
  I corallo **decorativi** (pallini, cerchi icona, logo) restano brillanti.

**Regola da tenere:** `#E8453C` = superficie/brand; `--color-cta` #C53A33 =
qualunque fill che porti testo bianco (3.93:1 → 5.21:1).

### 🚧 Step 4 — card unica (in corso)
`RestaurantCard` è ora il componente unico con 3 varianti:
`default` (row) · `tile` (foto 4:3 in alto, con flag `dense` per griglie
strette) · `hero`. Il tile usa SmartImage, i token raggio/ombra, la scala
`--fs-*`, CityBadge, `formatAddress` e la pill sconto in `--color-cta`.

Migrate finora (2 di ~19): `DesktopSavedPage` (aveva una card locale chiamata
anch'essa `RestaurantCard` — collisione di nome) e `SavedPage` mobile (era una
arrow function inline nel JSX). Salvati desktop e mobile ora rendono la stessa
card. −125 righe di duplicato.

**Da migrare ancora**: `LCard` (DesktopExplorePage), `HorizontalCard`/`HeroCard`
(ListView), `MiniCard` (HomePage).

⚠️ **Due candidati verificati e scartati** (l'audit li dava per duplicati, il
codice dice altro — non rifare l'analisi da zero):
- `NearbyCard` mostra anche un estratto di `our_review`: migrarla al tile
  generico **perderebbe contenuto**. È una card con un ruolo diverso, non un
  duplicato. Usa già SmartImage e i token.
- `Rcard` (HomeFeedV4) e `Lcard` (MomentResultsGrid): condividono geometria e
  commento, ma i corpi sono **divergenti** (uno ha pill sconto + SaveButton,
  l'altro l'orario e un `<a href>`): 135 righe di differenza. Unificarli non è
  a costo zero, e sono in Home.

### ✅ Step 4c/4d — duplicazioni di logica
- `src/lib/utils/price.js` → `formatPrice()`. Il prezzo era riscritto in 8
  file (11 punti) con 3 guardie diverse; una (`price_range || 2`) **inventava
  "€€" per i locali senza prezzo**. Ora ritorna null e la UI non lo rende.
- `src/lib/utils/slug.js` → `slugify(name, fallback)`. Era in 12 file e
  **7 copie non avevano guardia sul null** (TypeError se il nome mancava).
  Migrati i 10 usi pubblici. La variante admin (NFD + troncamento) resta
  separata di proposito: *genera* lo slug salvato nel DB.

### ✅ Prestazioni — peso scaricato dal telefono

Due interventi **misurati**, non stimati. Entrambi verificati con Chromium reale
e dati veri, e con diff pixel-per-pixel degli screenshot: **0 pixel diversi**.

**1. I gemelli desktop non pesano più sui telefoni**
Le 4 pagine con una versione desktop separata la importavano staticamente, così
chi apriva il sito dal telefono scaricava anche il codice desktop:

| rotta | prima (gzip) | dopo, da mobile |
|---|---|---|
| RestaurantPage | 18,53 kB | 13,06 kB (−29%) |
| HomePage | 8,46 kB | 5,88 kB (−31%) |
| ProfilePage | 8,71 kB | 6,90 kB (−21%) |
| SavedPage | 5,80 kB | 5,30 kB (−9%) |

Ora sono `lazy()` con `<Suspense>` esplicito. Su desktop i byte totali sono gli
stessi, in due richieste invece di una. `useIsDesktop` legge `matchMedia` in
modo sincrono al primo render, quindi il ramo è deciso subito: niente
sfarfallio.

**2. Niente Mapbox sulle schede locale aperte da un link — 456 kB gzip**
`App.jsx` teneva la mappa montata sotto la scheda di un locale **sempre**, per
conservarne posizione e zoom al ritorno. Ma chi arriva dritto su
`/restaurant/...` (Google, link condiviso, Bi Club) non ha stato da conservare
e si scaricava 1,67 MB di Mapbox per una mappa che la scheda copre del tutto.
Ora la mappa si monta lì solo se `/esplora` è stata visitata nella sessione.

> ⚠️ **`isEsplora` non va toccato** per ottenere questo: governa anche il blocco
> `<Routes>`, e `/restaurant/:slug` non ha una Route propria — cambiarlo lo
> farebbe cadere sul redirect `"*"` verso la home. La condizione `showMap` è
> separata apposta.

> ⚠️ `mapWasVisited` è **state, non ref**: il valore decide cosa renderizzare, e
> un ref aggiornato non fa ri-renderizzare (`eslint react-hooks/refs`).

**Come rifare le misure** (il sandbox resetta i tunnel TLS del browser, ma curl
passa): servire `npm run build` con `vite preview`, e in Playwright intercettare
`**://*.supabase.co/**` inoltrando la richiesta con `curl -D header -o body`
(con un proxy, `curl -i` antepone anche il blocco "Connection established" e
rompe i parser a blocco unico). Il token Mapbox in locale non c'è: la mappa non
renderizza, ed è normale — non è una regressione.

### Prossimi passi consigliati
1. Completare la migrazione delle card rimanenti (vedi sopra). **Nota: è
   pulizia, non prestazioni** — quelle card stanno già in chunk lazy per rotta,
   e la migrazione comporta un rischio visivo. Da fare con revisione a schermo.
2. Unificare le 4 coppie di pagine gemelle desktop/mobile rimaste (~5.100
   righe): HomePage/DesktopExplorePage, RestaurantSheet/Desktop…,
   ProfilePage/Desktop…, SavedPage/Desktop…. Il beneficio di *peso* è già stato
   incassato con il `lazy()` qui sopra: quel che resta è manutenibilità.
3. Tema scuro: quasi gratis una volta che i colori passano dai token.
4. Backfill `neighborhood` sui 73 locali esistenti (oggi tutti NULL: il campo si
   popola solo al prossimo sync Places, quindi il quartiere non si vede ancora).


---

## Chiedi a Bi — fix chat (2026-09-05)

Branch: `claude/chiedi-a-bi-chat-fix-sx4pa5`

### Il sintomo
Dai log in `ai_messages`: da metà giugno **quasi ogni risposta era una bolla
vuota con zero card** ("pizza in centro", "piemontese in centro", "sono in
quadrilatero…", "pesce in centro"). Il client mostrava il fallback "Eccomi.".

### La causa
`streamFinalRound` eseguiva **solo la prima** `search_restaurants`. Nel round
streamato Claude ne chiede spesso una seconda (rilassa i filtri quando il primo
giro rende poco): quel `tool_use` non veniva mai eseguito, il turno finiva senza
testo e senza `present_picks` → messaggio vuoto, `results: []`, riga vuota
persistita in DB.

Ora c'è **un solo motore** (`runConversation`) per streaming e non-streaming, e
ogni tool call viene eseguita fino a `MAX_TOOL_ITERATIONS`.

### Gli altri bug trovati strada facendo
| | Bug | Effetto |
|--|--|--|
| Città | nessun filtro su `city` | 94 locali in **28 città** (Marsala, Ibiza, Milano…): Bi consigliava un pesce a Marsala a chi guardava Torino. Ora filtro sulla città attiva + cintura torinese, con `out_of_city` sui candidati fuori. |
| History | `order(ascending: true).limit(10)` | prendeva i **primi** 10 messaggi, non gli ultimi: nelle chat lunghe Claude non vedeva mai i turni recenti. |
| History | nessuna normalizzazione | poteva iniziare con un turno `assistant` (l'API vuole `user`) e lasciare turni appaiati dopo aver scartato i vuoti. |
| `open_now` | guardia `r.open_now \|\| r.closes_at == null` | per un locale **chiuso** `closes_at` è null → passava lo stesso: "aperto adesso" non filtrava nulla. Ora `open_now !== false` (null = orari ignoti). |
| Retry | ricorsione che rilassava solo zone/open_now/prezzo | "agnolotti a pranzo" tornava zero anche con locali validi. Ora scalini espliciti fino a mollare testo e città, e `dropped: [...]` dice a Bi cosa ha lasciato cadere così può essere onesta. |
| Query | `.limit(40)` **senza ORDER BY** su 94 righe | sottoinsieme arbitrario e non deterministico, poi filtrato client-side. Ora ordine editoriale (`our_rating desc`) e cap a 10 candidati scelti, non a caso. |
| Tool call | un solo `tool_result` per turno | se Claude chiamava due tool in parallelo, la richiesta dopo veniva rifiutata. |
| Client | `current_moment` e `city` mai inviati | l'endpoint li supportava: Bi ragionava sempre "Torino, ora imprecisata". |
| Client | pill "● Aperto" su `closes_at` | compariva sbagliata; ora su `open_now === true`. |
| Client | chip "Allarga la zona"/"Solo con sconto" | mostrate anche con zero risultati, dove non hanno senso. |
| Testo | `cleanupText` tagliava a 600 char | il client vedeva tutto lo stream ma il DB salvava troncato: ricaricando `/chiedi/:id` il messaggio cambiava. Ora 1600. |
| Copy | "Sono ~200 ristoranti" / prompt "circa 70 a Torino" | i locali sono 94, 58 a Torino. Allineati entrambi. |

### Test
`npm test` → `tests/ai-engine.test.mjs` (node --test, nessuna dipendenza nuova).
Anthropic e Supabase sono stubbati, quindi gira offline. Copre il doppio
`search_restaurants` in streaming, il "mai una bolla vuota", il filtro città,
`open_now`, gli scalini di rilassamento e la history.

### Da verificare in produzione
- `ANTHROPIC_API_KEY` è l'unica env var necessaria e c'era già.
- Le righe `ai_messages` con testo vuoto restano in DB: `normalizeHistory` le
  scarta, ma se si vuole ripulire →
  `delete from ai_messages where role='assistant' and coalesce(content->>'text','')='';`


## Chiedi a Bi — secondo giro: tono, velocità, foto (2026-09-05)

Feedback Augusto dopo il test sul preview: risposte poco naturali, lente, e
niente foto sulle card. Testando davvero la ricerca contro il DB di produzione
sono usciti tre bug che dalla UI non si vedevano.

### Le foto — `PhotoOrEmoji` si congelava al primo render
`const [failed, setFailed] = useState(!src)` si inizializzava una volta sola.
Le card della chat nascono **senza** foto (i picks arrivano dallo stream, la
query foto dopo), quindi `failed` restava `true` per sempre e l'immagine non
compariva mai, nemmeno quando l'URL arrivava. Altrove nell'app la foto è nella
stessa query del locale, ecco perché si rompeva solo qui.
Ora lo stato tiene *quale URL* ha fallito, non un booleano: un `src` nuovo
riparte pulito. Stesso difetto e stessa cura in `SmartImage`.
In più `/api/ai` manda `photo_url` dentro il pick: la card nasce completa,
senza il secondo giro di rete.

### La zona non ha MAI filtrato — `PGRST100` ingoiato in silenzio
L'alias `'via po,'` di "centro" contiene una virgola. La lista `or=` di
PostgREST è separata da virgole → `failed to parse logic tree`, query morta.
L'errore non veniva letto: sembrava "nessun risultato" e si cadeva sullo stage
rilassato. Misurato prima/dopo sui dati veri:

| domanda | prima | dopo |
|---|---|---|
| pizza in centro | 6 candidati, zona rilassata, 2 fuori Torino | **3 pizzerie in centro**, zona rispettata |
| piemontese in centro | 7, zona rilassata | **6 in centro**, zona rispettata |

Ora i pattern sono ripuliti e gli errori di stage vengono loggati.

### Gli agnolotti — full-text in AND + rilassamento che buttava il piatto
`websearch_to_tsquery` mette i termini in AND: "agnolotti del plin" → 0
documenti (ma "agnolotti" → 1, "plin" → 2). Il vecchio rilassamento mollava del
tutto `search_text` e Bi si ritrovava **63 locali a caso**: consigliava un
africano a chi chiedeva gli agnolotti.
Ora: prima si riprova lo stesso testo in OR (`agnolotti | del | plin` → 3 piole
piemontesi vere), e il testo si molla solo se resta la categoria a dare senso al
risultato. Senza categoria si torna zero e Bi lo dice.

### Gli sconti — tre colonne inesistenti
La query usava `discount_percent`, `starts_at`, `ends_at`. La tabella ha
`discount_value` + `discount_type` e `valid_from` / `valid_until`. Falliva
sempre, e l'errore non veniva letto: il badge "−X%" non è mai comparso e
`discount_only` (il prompt "Sconti attivi stasera" in home) tornava sempre zero.
"Attivo" ora usa la stessa definizione del resto dell'app (`is_active` +
`valid_until` futuro).

> ⚠️ **Contenuto, non codice**: in `discounts` c'è **una sola riga**, disattivata
> e scaduta il 24/05/2026. Finché non ci sono sconti attivi, "Sconti attivi
> stasera" resta legittimamente vuoto ovunque, chat compresa.

### Velocità
- Modello: `claude-sonnet-5` (era `claude-sonnet-4-6`), con fallback automatico
  al precedente se l'account non ce l'ha — la chat non si rompe.
- Ricerca: **da ~950-2100 ms a ~280-720 ms** (misurato su 8 domande reali).
  Foto e sconti si caricano una volta sola, sullo stage vincente e solo sui
  candidati che Claude vedrà, e in parallelo. Prima due query per ogni stage
  scartato.
- Meno token in ingresso: a Claude va una proiezione snella del candidato
  (niente slug, foto, flag interni), excerpt 280 → 200 caratteri.
- `max_tokens` 2048 → 1024.
- L'attesa ora si vede: evento SSE `status` ("Sto guardando tra i miei
  locali…") dentro la bolla. Prima i puntini **non comparivano mai** — la
  bolla assistant esiste già in streaming, quindi si vedeva solo un cursore
  lampeggiante nel vuoto.

### Tono
Regole nuove nel system prompt, con esempi di cosa NON scrivere presi dalle
risposte vere del preview: max 2 frasi sotto le 35 parole; mai chiedere il
permesso di cercare ancora ("se vuoi posso…", "dimmi tu…"); mai raccontare il
proprio processo o i candidati scartati ("il candidato da Collegno lo salto");
niente punti esclamativi; non ripetere nel testo categorie e zone che stanno
già nelle card.

### Come ho testato
`npm test` → 22 test (node --test, offline, Anthropic e Supabase stubbati).
In più uno script usa e getta che ha eseguito la **vera** `executeSearch` contro
il DB di produzione con la chiave anon, su 8 domande reali: è così che sono
saltati fuori zona, full-text e sconti. Non riproducibile in CI (serve la rete),
ma ripetibile: bastano `executeSearch` + un client anon.


## Chiedi a Bi — terzo giro: provata sul serio con la chiave API (2026-09-05)

Con `ANTHROPIC_API_KEY` ho eseguito il loop vero (`runConversation`) contro il
DB di produzione, sulle domande della screenshot e dei log. Non piu solo test
stubbati: risposte vere, tempi veri.

### Modello: pianificatore rapido, voce sul modello grosso

Il primo giro non parla all'utente — legge la domanda e sceglie i filtri. Ora lo
fa **Haiku 4.5** (`CLAUDE_MODEL_PLANNER`), la risposta resta a **Sonnet 5**.

⚠️ Il primo tentativo, col rapido lasciato libero, ha **peggiorato la qualita**:
su "dove mangio un gelato" Haiku ha risposto di suo senza cercare, inventando
*"non ho gelaterie in archivio"* — ne ho due — in 42 parole e chiudendo con
"Vuoi che ti dica dove?". Risolto alla radice con
`tool_choice: {type:'tool', name:'search_restaurants'}` sul primo giro: il
pianificatore **non puo** parlare, puo solo cercare. Qualunque parola rivolta
all'utente nasce da Sonnet 5 dopo aver visto i candidati veri.

Override senza deploy: `AI_MODEL` e `AI_MODEL_FAST` (vuoto = tutto sul grosso).

### Tempi misurati (stesse 7 domande)

| domanda | prima (tutto Sonnet 5) | dopo | 1° token |
|---|---|---|---|
| pizza napoletana in centro | 7351 ms | **5643 ms** | 5648 → 4011 |
| pizza in centro | 5889 ms | **4945 ms** | 3195 → 2462 |
| aperitivo a Vanchiglia | 6736 ms | 7000 ms | 2961 → 2052 |
| agnolotti del plin | 5704 ms | **4489 ms** | 2734 → 1955 |
| quadrilatero all'aperto | 13811 ms | **5921 ms** | 8799 → 2885 |
| gelato | 5791 ms | **4296 ms** | 3637 → 2118 |
| miglior pesce | 7827 ms | **5486 ms** | 3317 → 2109 |

Primo giro da 1,5-3,8 s a 0,8-1,4 s. `MAX_CANDIDATES` 10 → 6 (round 2 legge meno).
Timeline per richiesta nei log Vercel: `[ai] round1(...) Xms · search(N) Yms · round2(...) Zms · picks N`.

### Tono: verificato sulle risposte vere
Tutte fra 14 e 25 parole (limite 35), 1-2 frasi, nessun "se vuoi posso…",
nessun punto esclamativo, nessun racconto di cosa e stato scartato. I casi
limite reggono: *"consigliami qualcosa"* chiede cosa vuoi **senza card**, *"il
miglior pesce"* rifiuta la classifica, la napoletana dichiara che e a Rivoli.
Foto presenti su tutte le card di tutte le prove.

> La chiave API e stata usata solo in sessione, mai scritta su file. Va revocata.

---

## 14/09 — verde sconti, scroll all'apertura, cuore da sloggato, accesso bloccato

Quattro segnalazioni di Augusto in un colpo solo, quattro cose separate.

### 1. Un solo verde per gli sconti

Lo stesso "−15%" usciva di tre colori diversi a seconda di dove lo incontravi:
lime→verde sulle card dei locali e sulla mappa, **menta** sul badge del drop
nel Bi Club, **corallo** sul badge grande della scheda dello sconto. Tre colori
per la stessa identica informazione.

Adesso il verde è uno, definito una volta in `globals.css`:

| token | valore | cos'è |
|---|---|---|
| `--color-sconto-a` | `#A3E635` | lime, inizio sfumatura |
| `--color-sconto-b` | `#4ADE80` | verde, fine sfumatura |
| `--color-sconto-ink` | `#1A4731` | il testo dentro la pillola |
| `--gradient-sconto` | `linear-gradient(135deg, a, b)` | già pronta |

Il gradiente sta in `:root` e non in `@theme` perché Tailwind, con un
`--color-*` che contiene un gradiente, genererebbe utility `bg-*`/`text-*`
senza senso.

Toccati: `RestaurantCard`, `RestaurantSheet`, `DesktopRestaurantSheet`,
`MapView` (il pin), `ListView`, `HomePage`, `HomeFeedV4`, `HomeDesktopClassic`,
`DesktopExplorePage`, `SconteRedesignPage.css`, `DropCard.css`. I `--dc-mint*`
del drop sono diventati `--dc-verde*` e puntano ai token. Verificato a schermo:
telefono e computer restituiscono lo stesso `rgb(163,230,53) → rgb(74,222,128)`
con testo `rgb(26,71,49)`.

Fuori campo di proposito: `HoursPill` (aperto/chiuso) e l'admin — stesso colore
ma non sono elementi di sconto.

### 2. La pagina si apriva già scrollata (telefono)

Mancava `history.scrollRestoration = 'manual'`. Il browser si ricorda lo scroll
e lo rimette quando la pagina ha ripreso la sua altezza — e qui l'altezza
arriva tardi (guscio → chunk della route → locali da Supabase). Lo
`scrollTo(0, 0)` di `App.jsx` parte molto prima di quel momento, quindi il
ripristino del browser arriva per ultimo e vince: si apriva la home in mezzo al
feed. Una riga in `src/main.jsx`. Misurato: scroll a 1176px → ricarica → 0.

Non perdiamo niente, la navigazione interna non ci contava già.

### 3. Il cuore da sloggato

Il popup c'era solo sulle due home. Altrove il cuore o buttava su `/login`
(perdendo mappa, filtri e ricerca) o non faceva proprio niente.

Estratti `src/lib/hooks/useSaveGate.js` + `src/components/Restaurant/SaveAuthGate.jsx`
(testo del gate in un posto solo), e collegati a: `RestaurantPage`, `ListView`,
`HomePage` (mappa + carosello), `DesktopExplorePage`. Le due home ora passano
dagli stessi due file invece di avere la loro copia.

Il locale toccato resta in `sessionStorage` e viene salvato da solo al rientro
(`addSave`, non `toggleSave`: chi ha toccato il cuore voleva salvare, e un
toggle su un locale già salvato lo toglierebbe).

### 4. «Clicco Accedi, il bottone scompare e non succede niente»

Riprodotto: se la richiesta di accesso parte e la risposta non torna mai
(rete mobile che cade, scheda messa in pausa da iOS mentre si prende la
password dal gestore), la promessa di `signInWithPassword` **non si risolve e
non fallisce**. Il bottone restava nello stato "in corso" per sempre. Due cose
lo rendevano indistinguibile da un bottone rotto:

- lo stato in corso era `background: ink-15` + tre puntini grigi — su fondo
  crema il bottone *spariva alla vista*, da cui «scompare»;
- non c'era nessun tempo massimo, quindi nessun messaggio e nessun modo di
  riprovare se non ricaricare.

Fatto:
- `withTimeout(..., 20s)` in `useAuth` su accesso, registrazione, verifica
  codice, rinvio codice e recupero password; nuovo messaggio in `authErrors.js`.
- Il bottone resta corallo, gira una rotella e dice cosa sta facendo
  ("Accedo…", "Creo l'account…", …).
- `autocomplete` sui campi (`email`, `current-password` su accedi,
  `new-password` su registrati): i gestori password ora propongono la cosa
  giusta.
- Le chiamate Supabase dentro `onAuthStateChange` rinviate con `setTimeout(0)`.
  La callback gira mentre il client di autenticazione tiene il lucchetto su
  `navigator.locks`: una query fatta da lì dentro richiede lo stesso lucchetto e
  aspetta sé stessa. È la raccomandazione di Supabase; lo facevamo al contrario.

Misurato col caso che si blocca: a 20s il bottone torna premibile con
«Ci sta mettendo troppo: la rete non risponde. Riprova fra qualche secondo.»
Prima: fermo all'infinito, nessun messaggio.

> **Non verificato contro il Supabase vero**: da questa sessione il browser non
> raggiunge `supabase.co` (il proxy blocca la POST; da `curl` risponde 400
> regolare). Percorso di successo e percorso di errore provati con le risposte
> simulate, il blocco con una richiesta che non torna mai. Se dopo il deploy
> l'accesso non va ancora, adesso almeno **si vede** dove si ferma: o compare
> un messaggio, o si sa che la richiesta non parte proprio.

## 14/09 — "Ultimi aggiunti" → /list allineata a /esplora

Augusto: la sezione "Ultimi aggiunti" in fondo alla home rimanda a una lista
con "tutt'altro aspetto". Causa: `/list` (`ListView.jsx`) aveva una sua
`HeroCard`/`HorizontalCard` scritte da zero, mai migrate al componente
unico — era già segnalato in "Step 4 — card unica" qui sopra come lavoro
da fare ("Da migrare ancora: ... HorizontalCard/HeroCard (ListView)").

Fatto: `ListView.jsx` ora usa `RestaurantCard`, la stessa card di
`/esplora` — variante `hero` per il locale in evidenza (esisteva già nel
componente, non la usava nessuna pagina), variante `default` per il resto
della lista virtualizzata. −340 righe di markup duplicato. PR #219.

Non verificato a schermo in questa sessione (nessun ambiente con browser).

## 14/09 — il gate si sposta sul gesto (ribaltato il Blocco 5)

Augusto: *«il pop up registrati per… salvare, sconto, chat deve apparire quando
stai per fare l'azione. Non come adesso che impedisce in principio di svolgere
le attività, secondo me è meglio così, uno ha più fomo.»*

È il contrario di come era stato deciso nel Blocco 5, quindi vale la pena
scriverlo: **prima** si mostrava la porta chiusa all'ingresso (catalogo
sfocato, barra della chat sostituita da un invito), **adesso** si lascia
entrare e la registrazione si chiede nell'istante in cui si preme il bottone.
Il modello è il cuore dei salvati, che funzionava già così: si tocca, esce il
riquadro, e al rientro dal login il locale si salva da solo.

Cosa cambia, pezzo per pezzo:

| dove | prima | adesso |
|---|---|---|
| Bi Club `/sconti` | catalogo sfocato + pannello "🔒 6 sconti ti aspettano" sopra | catalogo a fuoco e scorribile per tutti; il riquadro esce premendo "Sblocca sconto" su uno sconto preciso |
| Chiedi a Bi `/chiedi` | anteprima sfocata di una risposta finta al posto della schermata iniziale, e invito al posto della barra di scrittura | schermata iniziale e barra vere per tutti: si scrive, si preme invia, e lì esce il riquadro |
| Scheda locale (telefono e computer) | "Sblocca sconto" saltava su `/login` | esce `SconteAuthGate` sopra la scheda, che resta aperta dietro |
| `DiscountBanner` | bottone diverso per lo sloggato ("🔒 Registrati per sbloccare") | stesso bottone per tutti ("🔓 Sblocca sconto"), riquadro al click |

Niente si perde per strada, in nessuno dei tre casi:

- la domanda scritta resta nell'input se il riquadro viene chiuso, e viaggia
  come `initialMessage` fino al login: al rientro parte da sola;
- lo sconto scelto va in `sessionStorage` (`pendingDiscountId`) e viene preso
  da solo al rientro sul Bi Club;
- il locale del cuore va in `sessionStorage` (`pendingSaveId`), come già era.

File toccati: `SconteRedesignPage.jsx/.css` (via `ClubGate` e `.is-blurred`),
`ChiediPage.jsx/.css` (via `ChatGate` e `ChatGatePreview`),
`RestaurantSheet.jsx`, `DesktopRestaurantSheet.jsx`, `DiscountBanner.jsx`.

Il testo del riquadro di Chiedi a Bi adesso parla del gesto appena fatto
("La tua domanda è pronta"), non dell'accesso in astratto, e ha per primo
"Registrati gratis" invece di "Accedi": chi arriva lì un account non ce l'ha.

Preso al volo strada facendo: `SconteRedesignPage.jsx` usava `supabase` senza
importarlo (`sendClaimReceipt`, l'email col codice appena preso). La chiamata
moriva dentro il `try` e l'email non partiva mai, in silenzio. Una riga
d'import.

Restano volutamente com'erano le voci di menu "Salvati" e "Profilo" (telefono e
computer) e le pagine che ne dipendono: lì dietro non c'è niente da far vedere
a chi non è registrato, quindi il salto a `/login` è il gesto stesso, non un
muro davanti a un contenuto.

Verificato a schermo (browser, sloggato, build di produzione): su `/chiedi` la
barra c'è, scrivendo e premendo invio esce il riquadro e il testo resta
nell'input; su `/sconti` non c'è più né sfocatura né pannello. Nessun errore in
console. `npm test` 94/94, build a posto, lint invariato (gli stessi 16 errori
di prima meno quello dell'import mancante).

---

## 14/09 — due bug segnalati da Augusto: card di Esplora e sconti non eliminati

Segnalazione: *"quando clicco in esplora nella lista da mobile le card dei
ristoranti non si aprono e quando elimino da admin gli sconti non si
eliminano"*. Sono due cose scollegate, entrambe con una causa precisa.

### 1. Le card della lista di Esplora non si aprivano dal telefono

`src/pages/public/HomePage.jsx`. La sheet che contiene l'elenco è avvolta da un
`useDrag` di use-gesture (`contentBind`) che serve solo a una cosa: tirarla giù
dall'alto per chiuderla. Era configurato con `filterTaps: true`, e lì sta il
guaio — con quell'opzione use-gesture registra un listener `click` in fase di
cattura e, se il tocco si è mosso più di `tapsThreshold` (3px di default),
chiama `preventDefault()` e `stopPropagation()`.

Tre pixel sono niente. Safari su iPhone manda i `touchmove` anche per uno
scarto di due o tre pixel, mentre Chrome li trattiene dentro la propria soglia
di tap: per questo il bug si vedeva dal telefono e non riproducendolo dal
computer. Un tap appena storto — quelli che facciamo tutti — contava come
trascinamento, e il click non arrivava mai al bottone `.rcard-hit` della card.

Cosa è stato fatto: via `filterTaps`, e al suo posto `threshold:
SHEET_DRAG_SLOP` (3px, la stessa sensibilità di prima per il trascinamento). Il
click ora lo filtriamo noi, con `onClickCapture` sul contenitore, e solo se la
sheet si è mossa davvero (`didDragSheet`) — così il click involontario dopo un
trascinamento vero resta bloccato, ma un tap storto passa.

Provato a schermo con Chromium in emulazione iPhone 13, su build di produzione:
tap pulito ✅, tap con 12px di scarto ✅, trascinamento giù che chiude la sheet
senza navigare ✅.

**Da guardare, stessa famiglia**: `PhotoCarousel.jsx` ha anche lui `filterTaps:
true` e dentro ci sono le frecce e i pallini cliccabili. Non l'ho toccato
perché non era nella segnalazione, ma su iPhone potrebbe fare lo stesso scherzo.

### 2. Gli sconti eliminati dall'admin tornavano al ricarico

`src/pages/admin/DiscountManager.jsx`. Due problemi sovrapposti.

Il primo, quello che rendeva tutto invisibile: `handleDelete` faceva
`await supabase.from('discounts').delete().eq('id', id)` **senza mai leggere
l'errore**, e poi toglieva la riga dallo stato locale. Qualunque cosa
succedesse al DB, l'admin vedeva la riga sparire. Al ricarico della pagina
tornava.

Il secondo, la causa vera per gli sconti in vetrina: un banner pubblicitario di
tipo `restaurant_discount` (tabella `sponsored_placements`) punta allo sconto
con una foreign key `ON DELETE SET NULL`, ma il vincolo `sp_variant_coherence`
pretende che per quella variante `discount_id` non sia mai nullo. Risultato:
Postgres rifiuta la cancellazione con `23514 — new row for relation
"sponsored_placements" violates check constraint`. Verificato sul DB di
produzione impersonando il ruolo `authenticated` con l'uid admin, dentro una
transazione annullata.

Cosa è stato fatto, tutto lato app — **nessuna migrazione, lo schema non è
stato toccato**:

- si caricano all'avvio i `sponsored_placements` che puntano a uno sconto;
- la modale di conferma dice quanti banner verranno eliminati insieme;
- alla conferma si cancellano prima i banner, poi lo sconto;
- l'errore viene letto e mostrato nell'avviso in cima all'elenco;
- `delete({ count: 'exact' })` con controllo `count === 0` copre anche il caso
  muto della RLS (sessione scaduta / non più admin): niente errore ma nessuna
  riga toccata, e prima passava per riuscita.

`npm test` 94/94, build a posto, lint invariato (stessi 15 problemi di prima).


## Liste: "metti in una lista" provato a schermo (14/09)

Augusto ha segnalato che "metti in una lista" nella pagina Salvati non
funziona. Prima di toccare codice, verificato il giro completo — non solo sul
database (già fatto l'8/09, vedi "Liste: persistenza verificata" sopra), ma il
click vero sul bottone, dentro un browser reale (Chromium via Playwright,
build di produzione servita con `vite preview`, non il dev server).

**Metodo**: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` puntati a un dominio
finto, con `page.route()` a intercettare ogni chiamata REST e rispondere da un
piccolo database in memoria (righe vere per `restaurants`, `saved_restaurants`,
`saved_lists`, `saved_list_items`), e una sessione Supabase finta seminata in
`localStorage` con la chiave `sb-<ref>-auth-token`. Non è un account vero sul
sito in produzione — quello resta da fare — ma è il codice vero del client
(React + `useSavedLists` + `SaveToListSheet`) che gira per davvero in un
browser, non uno stub.

**Risultato**: il tocco su "Metti in una lista" apre il foglio, il tocco su un
suggerimento ("Da provare") lo crea in `saved_lists`, aggiunge la riga in
`saved_list_items`, e un secondo tocco la toglie di nuovo — provato sia da
schermo desktop (`DesktopSavedPage`) sia da schermo telefono (`SavedPage`
mobile), zero errori in console. **Il codice del blocco 6 funziona.**

Due cose fuorvianti scoperte per strada, per chi riprende questo lavoro:
- Un sospetto iniziale su `useSavedLists.js` (`?.` messo nel posto sbagliato
  prima di `.includes`) si è rivelato falso: l'optional chaining in JS
  interrompe **tutta** la catena che segue, non solo il passo successivo —
  quella riga non lancia mai un TypeError. Non toccarla per questo motivo.
- Testando dentro il dev server (`vite dev`, non `vite preview`) e scattando
  screenshot a pagina intera, la pagina Salvati sembrava rimontarsi da sola
  ogni 1-4 secondi, perdendo lo stato e chiudendo il foglio appena aperto —
  sembrava un bug serio. Era un artefatto degli strumenti: il binario
  Chromium installato in questa sandbox (1194) non combacia con la versione
  del pacchetto `playwright` (1.58, che si aspetta 1208), e la combinazione
  andava in tilt su `page.screenshot({ fullPage: true })` con l'innerWidth
  della pagina che crollava a 1px e tornava su. Con viewport fissato
  esplicitamente e senza screenshot a pagina intera il problema è sparito
  del tutto. Se ricapita in una sessione futura, sospettare prima gli
  strumenti che il codice.

**Cosa è stato cambiato davvero**: nessun bug da correggere nella logica, ma
il riscontro visivo al tocco era minimo — un cambio di colore del bordo e uno
scambio "+"/"✓" di 16px, facile da non notare. È verosimilmente questo che ha
fatto sembrare la funzione "rotta": il locale finiva davvero nella lista, ma
niente lo diceva con chiarezza. `SaveToListSheet.jsx` ora anima quello scambio
con una molla (framer-motion, gli stessi token di `src/lib/motion.js`:
`SPRING_SNAP`) — il segno entra con uno scatto invece di cambiare di colpo, ed
è la conferma visiva che mancava.

**Resta da fare**: provare con un account vero sul sito live (non solo la
simulazione qui sopra), per chiudere davvero la riga "Da fare prima del
merge" con un riscontro umano.


## 14/09 — email di sconto/drop mai partite dal 13/09

Augusto: pubblicato un drop, nessuna mail arrivata al suo account registrato
sul sito.

**Causa**: `email_preferences.user_id` (tabella creata il giorno prima,
`supabase/email-preferences-2026-09-13.sql`) aveva la FK verso `auth.users`
invece che verso `public.profiles`, a differenza di ogni altra tabella
utente dello schema (`saved_restaurants`, `saved_lists`, ecc.).
`recipientsFor()` in `api/_email/send.js` legge i destinatari con un embed
PostgREST `profiles!inner(email, full_name)`: PostgREST espone solo lo
schema `public` e costruisce l'embed seguendo le FK dirette, quindi senza
una FK verso `public.profiles` non trovava nessuna relazione e la query
falliva ad ogni chiamata — sia quella automatica alla pubblicazione, sia il
bottone "Notifica" in `/admin/sconti`. Il fallimento è silenzioso lato
admin (lo sconto si salva comunque, resta solo un avviso discreto poco
visibile), e infatti `email_notifications_log` non aveva **nessuna** riga di
tipo `discount`/`drop` da quando la tabella esiste — solo `restaurant`
(trigger diverso, non passa da `email_preferences`).

**Fix**: `supabase/fix-email-preferences-fk-2026-09-14.sql`, eseguito via
connettore Supabase — FK spostata su `public.profiles(id)` +
`notify pgrst, 'reload schema'`. Corretto anche il file sorgente
`email-preferences-2026-09-13.sql` per chi lo rilancia da zero.

**Da fare**: rimandare la notifica per il drop del 14/09
(`96afd9e4-6bc8-4753-b21c-8b77e551c827`, "50% di sconto") col bottone
"Notifica" — non riparte da sola.

## 14/09 — "carica altri locali" in fondo alla lista Esplora

Segnalazione: in fondo alle liste con le card dei locali, in particolare
nella lista di /esplora, non c'era modo di caricare altri locali una volta
arrivati in fondo.

**Causa**: la sheet "Lista" di `/esplora` (mobile, `HomePage.jsx`) non
pagina davvero i risultati — mostra `viewportRestaurants`, cioè
`displayedRestaurants` filtrati a un raggio fisso di 5km dal centro mappa
(`WIDE_RADIUS_KM`), aggiornato a ogni `moveend`. Chi non sposta la mappa
vede solo i locali entro 5km da dove il centro è caduto al caricamento, e
arrivato in fondo alla lista non ha modo di vedere il resto della città (o
altre città). Il carosello orizzontale sotto la mappa aveva già un "+ Altro"
(`carouselLimit`/`CAROUSEL_STEP`), ma pesca dallo stesso pool limitato a
5km — non risolveva il problema.

**Fix**: aggiunto `remainingRestaurants` (i locali di `displayedRestaurants`
esclusi da `viewportRestaurants`, ordinati per distanza dal centro mappa) e
uno stato `sheetShowAll` che, quando attivato, li accoda alla lista della
sheet. Bottone "Carica altri N locali" in fondo alla lista, visibile solo
se `remainingRestaurants.length > 0`; si resetta quando cambiano filtri o
sconti-only. `DesktopExplorePage` e `/list` (`ListView.jsx`) non avevano
questo limite — mostrano già tutti i locali filtrati — quindi non
toccati.

PR: #228. Branch: `claude/stoic-ritchie-fm9ajh`.

**Da fare**: verifica a schermo su un telefono vero (aprire /esplora,
toccare "Lista", scorrere in fondo).

## 15/09 — revisione completa del sistema email

Segnalazione, con tre screenshot di un drop arrivato in posta: «le mail sono
bruttissime, lavorerei sul design che deve sembrare premium, sui contenuti e
sull'oggetto […] la foto copre troppo spazio […] non devono finire in spam
mentre ora mi sono finite in spam».

Riferimento completo: **`docs/email-sistema.md`** (com'è fatta un'email, cosa
la tiene fuori dallo spam, cosa resta da fare ad Augusto).
**`docs/EMAIL-FLOWS.md`** resta il riferimento per cosa parte quando.

**Cosa c'era**

- `heroPhoto` stampava la foto con le proporzioni native — un fotogramma
  verticale di un video, bande nere comprese: due schermate di telefono prima
  di una parola. E partiva da `thumb_url` (400px) dentro una colonna da 600,
  quindi anche sgranata.
- Il blocco dell'offerta era un rettangolo corallo pieno a tutta larghezza:
  volantino, non guida.
- Cinque email su nove avevano l'HTML scritto a mano dentro l'endpoint —
  tre testate diverse, due piè di pagina, due coralli (`#E8453C` e `#FF5757`
  nell'email del codice di recupero).
- Tre email partivano senza versione a solo testo; il benvenuto senza
  `List-Unsubscribe`; nessuna diceva chi manda e perché.
- **Il peggiore**: `List-Unsubscribe` puntava a `/preferenze-email?t=…`, una
  pagina React. La disiscrizione a un clic (RFC 8058) è una POST che si
  aspetta il lavoro fatto dal server: la pagina rispondeva 200 con l'HTML del
  sito, Gmail segnava "disiscritto", la persona continuava a ricevere le email
  e al giro dopo premeva "segnala come spam".

**Cosa è stato fatto**

- Sistema grafico rifatto (`_email/theme.js`, `blocks.js`, `render.js`):
  una testata sola, corallo come accento, blocchi importanti sull'inchiostro
  con il filo d'oro (`--color-oro`, che c'era nei token del sito e nelle email
  non era mai arrivato), piè di pagina con motivo dell'invio e indirizzo.
- Foto ritagliata dal server: `/api/img` accetta `h`, `fit=cover` (crop
  "attention", che butta via le bande nere) e `fm=jpg`. Fascia 600×250.
- Nove email portate dentro `_email/templates.js` (le cinque che c'erano più
  benvenuto ristoratore, conferma suggerimento, notifica interna, conferma
  candidatura, codice di recupero) + le due interne. `send-email.js` da 982 a
  ~540 righe; `partner-application.js` e `recovery-otp.js` non chiamano più
  Resend da soli.
- Oggetti riscritti tutti (tabella in `email-sistema.md` §4).
- Nuova rotta `POST /api/send-email?unsub=<token>`: disiscrizione a un clic
  vera, via `set_email_prefs_by_token`. Il `GET` reindirizza alle preferenze.
- `X-Entity-Ref-ID` per messaggio, mezzo secondo fra un blocco e l'altro,
  versione testo garantita in `sendEmail`.
- `node scripts/email-preview.mjs` → `docs/email-preview/index.html`, tutte e
  dodici le email una accanto all'altra con oggetto e riga d'anteprima.
- Template Supabase rigenerati (**vanno reincollati nel dashboard Supabase**).

**Da fare — non è codice, lo fa Augusto** (dettagli in `email-sistema.md` §5)

1. ~~Resend → Domains → chiamamibi.com → spegnere Click tracking~~ —
   **verificato il 15/09, non serve**: nell'interfaccia attuale il
   tracciamento è opt-in (tab *Configuration* → "Enable tracking metrics",
   richiede di configurare un sottodominio dedicato) e su `chiamamibi.com`
   quel sottodominio non è mai stato creato. Da non fare: cliccare
   "Configure" e attivarlo.
2. Iscrivere il dominio a **Google Postmaster Tools**.
3. Vercel: `RESEND_FROM` = `Bi di ChiamamiBi <ciao@chiamamibi.com>`,
   e aggiungere `EMAIL_POSTAL_ADDRESS` con l'indirizzo vero.
4. Foto profilo su `ciao@chiamamibi.com` (Google Workspace): Gmail la mostra
   accanto al mittente.
5. DMARC a `p=quarantine` fra due settimane, dopo aver letto i rapporti.
