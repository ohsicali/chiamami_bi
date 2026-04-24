# v4 — Stato Track

Ultima modifica: 2026-04-24

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
| PR19 — Esplora redesign | draft | 🚧 In progress | Branch: `claude/esplora-redesign-implementation-7oq55`. 12 step completi (CP1+CP2). ⚠️ Migration pending: `tags_dietary` text[] su `restaurants` per abilitare filtro Dieta (oggi no-op). |
| C3 — (TBD) | — | ⏳ Not started | |

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

### Migration PENDING (PR19 Esplora)

- ⚠️ `ALTER TABLE restaurants ADD COLUMN tags_dietary text[] DEFAULT '{}';` —
  serve per abilitare il filtro Dieta (vegan/vegetarian/healthy/gluten-free)
  nel FilterSheet/FilterPopover. Senza questa colonna il filtro è UI-only
  (nessun ristorante matcha).

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

## PR19 — Esplora redesign (24/04/2026)

Branch: `claude/esplora-redesign-implementation-7oq55`. PR #__ (draft).

**Mockup canonici**:
- `docs/mockups/v4-mobile-esplora-redesign.html` (3 frame)
- `docs/mockups/v4-desktop-esplora-redesign.html` (split + header floating)

**Scope ristretto**: SOLO pagina Esplora mobile + desktop + shared components
strettamente necessari. NON toccati: Home, Sconti, Salvati, Profilo, Admin,
MobileTabBar, Navbar mobile (wordmark + city pill + geo btn), DesktopNavbar.

### Step completati (12/12)

1. **Shared components** — `MiniCard` estratto da HomePage (stile live
   invariato, vincolo Augusto), nuovi `FilterPill` (default/on/active-highlight)
   e `CategoryBubble` (64px, grid 4-col).
2. **SVG icon set** — `IconSliders/Grid/Tag/List/Map/Search/Geo/Close`
   Lucide-style stroke 2 currentColor in `src/components/icons/index.jsx`.
3. **Filter state URL** — `useEsploraFilters` hook: cat[], price[], moment,
   diet[], disc, area, view sincronizzati con URL query params. Helpers
   `applyEsploraFilters` + `countMatching` + `applyBulk` per update atomico.
4. **Mobile map view** — `FilterPillsRow` + count bar + `FloatingToggle`
   sopra mappa. Rimosso scroll-x category chips + bottone "Lista" vecchi.
   Pin mappa rotondi invariati (MapView intatto).
5. **Mobile list view** — `EsploraListPanel` full-screen su `?view=list`
   con SearchBar + FilterPillsRow + MiniCard verticale + FloatingToggle
   "Mappa". Rimosso sheet animato mobile (non più necessario).
6. **Filter sheet mobile** — `FilterSheet` 92% viewport con 5 sezioni
   (Categoria bubble grid, Orario, Dieta, Prezzo, Area slider) + CTA
   sticky "Mostra N locali" (live count) e "Azzera filtri". Draft state
   + commit atomico via `applyBulk`.
7. **Desktop split + header** — Grid 540px + mappa. `DesktopExplorePage`
   refactorato con useEsploraFilters + FilterPillsRow + count row + sort
   "Distanza" inline. `AppHeaderFloating.jsx` re-export DesktopNavbar
   (già montato globalmente come shared header).
8. **Filter overlay desktop** — `FilterPopover` 420×max600 sotto la pill
   Filtri con click-outside + Escape + animazione scale-y dall'alto.
   Stesse 5 sezioni + CTA del FilterSheet mobile.
9. **Categorie shortcut** — `focusSection` prop scrolla automaticamente
   alla sezione scelta (categorie/moment/diet/price/area) all'apertura.
10. **Sconti toggle** — già cablato in Step 3+4 (esplora.toggleDisc,
    variant='active-highlight' corallo sulla pill, applyEsploraFilters
    filtra per discountIds quando disc=true).
11. **Group headers** — `groupByDistance()` separa in "Aperto per {moment}
    · ora" (<500m con moment attivo) / "Vicino a te" (<500m senza moment)
    e "Oltre i 500 metri" (>=500m). Cablato mobile list + desktop list.
12. **Empty state** — banner flottante sulla mappa mobile + vista lista
    mobile + list area desktop quando 0 risultati con filtri attivi:
    "Nessun posto con questi filtri" + CTA "Azzera filtri".

### File toccati

**Nuovi**
- `src/components/Restaurant/MiniCard.jsx` (estratto da HomePage)
- `src/components/Esplora/FilterPill.jsx`
- `src/components/Esplora/CategoryBubble.jsx`
- `src/components/Esplora/FilterPillsRow.jsx`
- `src/components/Esplora/FloatingToggle.jsx`
- `src/components/Esplora/EsploraListPanel.jsx`
- `src/components/Esplora/FilterSheet.jsx`
- `src/components/Esplora/FilterPopover.jsx`
- `src/components/icons/index.jsx`
- `src/components/Layout/AppHeaderFloating.jsx` (re-export)
- `src/lib/hooks/useEsploraFilters.js`
- `src/lib/utils/esploraGroups.js`

**Modificati**
- `src/pages/public/HomePage.jsx` (mobile Esplora — shell + mappa + integrazione)
- `src/pages/public/DesktopExplorePage.jsx` (split + pill row + popover)

**NON toccati (vincolo scope)**
- Home (`HomeFeedV4.jsx`), Sconti (`DealsPage.jsx`), Salvati (`SavedPage.jsx`),
  Profilo (`ProfilePage.jsx`), Admin, RestaurantPage, RestaurantSheet,
  DesktopNavbar, Navbar (mobile), MobileTabBar, MapView (pin mappa).

### Blocker / migration

⚠️ **tags_dietary assente nel DB**: il filtro Dieta del FilterSheet è cablato
ma no-op finché Augusto non esegue: `ALTER TABLE restaurants ADD COLUMN
tags_dietary text[] DEFAULT '{}';`. Gli altri filtri funzionano full-stack.

### QA checklist da verificare

Mobile (430×932):
- [ ] Header logo + Torino + geo sempre (NO search in mappa)
- [ ] 3 pill + count+Azzera sopra mappa/lista
- [ ] Pin mappa rotondi (invariati)
- [ ] Floating toggle Lista sopra mini-card in mappa / Mappa in basso in lista
- [ ] Tap Filtri/Categorie apre sheet 92% con 5 sezioni + live count CTA
- [ ] Group headers "Aperto per X · ora" / "Oltre i 500 metri" in lista
- [ ] Empty state banner con Azzera su mappa/lista a 0 risultati

Desktop (1440×900):
- [ ] Header floating pill (DesktopNavbar) centrato
- [ ] Split 540px lista + mappa
- [ ] Tap Filtri apre popover 420×600 sotto la pill
- [ ] Click card → hover popup mappa · click pin → scroll card in lista
- [ ] Group headers in list area

Sistema:
- [ ] Deploy Vercel preview verde (12 function, underscore _rate-limit ignorato)
- [ ] Deep link `/esplora?moment=aperitivo` applicato all'avvio
- [ ] URL `?cat=Pizza,Asiatico&price=1,2&disc=1&area=1.5&view=list` deep-linkable

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
