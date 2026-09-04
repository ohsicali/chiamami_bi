# v4 — Stato Track

Ultima modifica: 2026-04-20

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

### 🟡 Blocco C — parziale
Fatti: C3 convenzioni 3 col · C4 card Esplora ("● Aperto" reale, sconto pill,
4:3) · C6 admin (fasce spente 0.25, thumbnail con fallback).
**Rimandati** (redesign visivi, richiedono verifica a schermo): C1 scheda
(mosaico 1+4, 2 col, sidebar sticky, banner singolo/B6) · C2 drop home
Variante B · C3 drop hero adattivo 1-vs-N · C5 Chiedi a Bi (card + chips).

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
(ListView), `MiniCard` (HomePage), `NearbyCard`, `Rcard`/`Lcard`
(HomeFeedV4 + MomentResultsGrid — copia-incolla identici, ma sono Home:
da fare con verifica visiva).

### Prossimi passi consigliati
1. Completare la migrazione delle card rimanenti (vedi sopra).
2. Unificare le 4 coppie di pagine gemelle desktop/mobile rimaste (~5.100
   righe): HomePage/DesktopExplorePage, RestaurantSheet/Desktop…,
   ProfilePage/Desktop…, SavedPage/Desktop….
3. Poi i redesign C1/C2/C3/C5, costruiti sulle primitive.
4. Tema scuro: quasi gratis una volta che i colori passano dai token.
