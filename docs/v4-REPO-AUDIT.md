# v4 Repo Audit — chiamami_bi

**Data audit**: 2026-04-21
**Branch auditato**: `claude/chiamamibi-app-xf7qn`
**Metodo**: Lettura remota del repo GitHub (ohsicali/chiamami_bi)
**Scopo**: Dare a Claude Code una base concreta di partenza — cosa esiste, cosa cambiare, cosa rimuovere.

---

## 1. COSA C'È NEL REPO (struttura accertata)

### Root
```
chiamami_bi/
├── .agents/          .claude/         .github/
├── api/              docs/            locales/
├── public/           src/             supabase/
├── tests/
├── .env.example      .gitignore       CLAUDE.md       README.md
├── eslint.config.js  index.html       package.json    package-lock.json
├── playwright.config.js  skills-lock.json  supabase-schema.sql
├── vercel.json       vite.config.js
│
├── mockup-cards-v2.html       ⚠️ vecchio mockup a root
├── mockup-cards-v3.html       ⚠️ vecchio mockup a root
├── mockup-homepage-v2.html    ⚠️ vecchio mockup a root
├── mockup-homepage.html       ⚠️ vecchio mockup a root
├── mockup-mappa.html          ⚠️ vecchio mockup a root
└── mockup-sconti.html         ⚠️ vecchio mockup a root
```

### src/
```
src/
├── App.jsx
├── main.jsx
├── components/
│   ├── Discount/        Layout/        Map/
│   ├── Newsletter/      Restaurant/    SEO/        UI/
│   └── MaintenanceGate.jsx
├── components/Restaurant/
│   ├── NearbySection.jsx
│   ├── OrariLocale.jsx           ✅ già esiste (PR13 Google orari va qui dentro)
│   ├── PhotoCarousel.jsx
│   ├── RestaurantCard.jsx        ✅ COMPLIANT (no review/rating)
│   ├── RestaurantSheet.jsx       ✅ COMPLIANT (ha "Secondo Bi", no stelle)
│   ├── SaveButton.jsx
│   └── SuggestRestaurantSheet.jsx
├── lib/
├── pages/admin/
│   ├── AdminDashboard.jsx     AdminLogin.jsx    AdminRestaurants.jsx
│   ├── AdminSettings.jsx      AdminUsers.jsx    AnalyticsPage.jsx
│   ├── ApplicationManager.jsx CategoryManager.jsx DiscountManager.jsx
│   ├── NewsletterManager.jsx  PartnerManager.jsx RestaurantForm.jsx
│   └── SuggestionsManager.jsx
├── pages/public/
│   ├── AboutPage.jsx          AuthCallback.jsx    DealsPage.jsx
│   ├── HomeFeedV4.jsx         ✅ v4 home feed già esiste
│   ├── HomePage.jsx           ListView.jsx        LoginPage.jsx
│   ├── PartnerLandingPage.jsx PrivacyPage.jsx     ProfilePage.jsx
│   ├── ResetPasswordPage.jsx  RestaurantPage.jsx  SavedPage.jsx
│   ├── SettingsPage.jsx       TermsPage.jsx
│   ├── VerifyPage.jsx         ✅ PIN flow ristoratore già esiste
│   └── VerifyPage.css
└── styles/
    └── globals.css
```

### package.json (dipendenze)
```
@supabase/supabase-js    @tailwindcss/vite      @tanstack/react-virtual
@use-gesture/react       @vercel/analytics      framer-motion
i18next                  i18next-browser-languagedetector
mapbox-gl                qr-scanner             qrcode
react (19.2.4)           react-cookie-consent   react-dom
react-i18next            react-router-dom       recharts
supercluster             tailwindcss
```
Nessuna dipendenza recensioni/rating. Clean.

---

## 2. COSA CAMBIARE — ordinato per PR

### 🔧 PR1 — Safari iOS (viewport-fit già OK)
**Status**: ✅ `index.html` ha già `viewport-fit=cover` nel meta viewport (riga 3). Niente da cambiare su index.html.
**Fare solo**: aggiungere `env(safe-area-inset-*)` a `globals.css` dove serve (bottom nav, header). Vedi `v4-COMPONENT-SPECS.md` → sezione Safari iOS.

### 🔧 PR2 — Satoshi → Poppins swap
**File `index.html`** (riga 22-25):
```html
<!-- RIMUOVERE queste 2 righe -->
<link rel="preconnect" href="https://api.fontshare.com" crossorigin />
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap" rel="stylesheet" />

<!-- E rimuovere anche DM Sans (è vestigio v3) -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

<!-- SOSTITUIRE con -->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Alfa+Slab+One&family=Caveat:wght@500;600;700&display=swap" rel="stylesheet" />
```
Nota: Alfa Slab One + Caveat vanno consolidati nella stessa querystring Google Fonts.

**File `src/styles/globals.css`** — dentro `@theme`:
```diff
- --font-sans: Satoshi, Inter, system-ui, ...;
+ --font-sans: 'Poppins', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```
Mantieni `--font-mark: 'Alfa Slab One'` e `--font-hand: 'Caveat'` (già OK).

**Grep aggiuntivo che Claude Code deve fare**: `grep -rn "Satoshi\|font-satoshi\|DM Sans\|font-dm" src/` — qualsiasi occorrenza va sostituita con `Poppins`.

### 🔧 PR2 (aggiunta) — theme-color
**File `index.html`** (riga 14): `#FF5757` è il vecchio coral. Va sostituito con `#E8453C` (token `--corallo`).
```diff
- <meta name="theme-color" content="#FF5757" />
+ <meta name="theme-color" content="#E8453C" />
```

### 🔧 PR3 — Compliance (niente recensioni/stelle)
**Già verificati lato codice React**: `RestaurantCard.jsx` e `RestaurantSheet.jsx` sono COMPLIANT (zero occorrenze di review/rating/stars/stelle/⭐).

**Da controllare (Claude Code in PR0 Discovery)**:
1. `ProfilePage.jsx` — la stats row NON deve avere "Recensioni". Deve avere `Ristoranti salvati · Drop presi · Condivisioni` (o 3 metriche safe equivalenti).
2. `supabase-schema.sql` — qualsiasi tabella `reviews`, `ratings`, colonna `stars`/`rating`/`score` va identificata. Se viene usata dal frontend, rimuovere uso + dropparla dalla DB (migration esplicita). Se NON è usata, basta una migration `DROP TABLE`.
3. `locales/` (i18n) — chiavi di traduzione con `review`, `rating`, `stelle`, `recensione` da rimuovere.
4. `admin/RestaurantForm.jsx` — non deve avere campo per rating medio, solo `our_review` (text) e `our_tip` (text).

### 🔧 PR4-PR10 — Reskin v4 (consumano v4-COMPONENT-SPECS.md)
- `globals.css` → sostituire `.glass-pill-v4` + `.glass-pill-v4-dark` (vecchia nav) con i token v4 della nav grigia (PR5).
- `Layout/` (bottom nav) → liquid glass nav con 5 voci: Home · **Esplora** (pin teardrop) · **Sconti** (% icon) · Salvati · Profilo, active pill grigia `rgba(0,0,0,.05)` con outline `rgba(0,0,0,.08)`.
- `HomeFeedV4.jsx` → check se è già conforme al mockup `v4-mobile-home.html`. Se no, refactor.
- `RestaurantPage.jsx` / `RestaurantSheet.jsx` → allineare a mockup `v4-mobile-scheda.html` (il blocco "Secondo Bi" ESISTE GIÀ, da mantenere e stilare v4).
- `DealsPage.jsx` → tabs "Disponibili" / "I miei" per sconti Drop vs Statici (PR8).
- `SavedPage.jsx` → tabs cartelle + grid + Caveat sv-note (PR9).
- `ProfilePage.jsx` → stats 3-col senza recensioni (PR10).

### 🔧 PR11-PR15 — Feature nuove
- PR11: Auth ristoratore PIN-only — `VerifyPage.jsx` esiste già, vedere se `LoginPage.jsx` (email+password) serve ancora per utenti normali o se è dead code. **Domanda aperta**: gli utenti finali loggano con email+password? Se sì, Login rimane ma il flow ristoratore va solo su VerifyPage.
- PR12: Resend email backend (nuovo — niente da rimuovere)
- PR13: `OrariLocale.jsx` integrazione Google Places (il componente esiste già, vedere se è Google-aware o se serve integrazione da zero)
- PR14: admin Drop form con countdown (`DiscountManager.jsx` esiste, refactor)
- PR15: QR scanner ristoratore (`qr-scanner` + `qrcode` dipendenze già installate — solo UI)

---

## 3. FILE DA RIMUOVERE (vecchi mockup a root)

Questi 6 file sono v2/v3 obsoleti, sostituiti dai `v4-*.html` in `docs/mockups/`:
```
mockup-cards-v2.html
mockup-cards-v3.html
mockup-homepage-v2.html
mockup-homepage.html
mockup-mappa.html
mockup-sconti.html
```
Commit dedicato: `chore: remove obsolete v2/v3 root mockups`
(Se vuoi archiviarli, sposta in `docs/archive/` invece di cancellarli.)

---

## 4. FILE CHE GIÀ VANNO BENE — nessun lavoro

- ✅ `src/components/Restaurant/RestaurantCard.jsx` — clean, nessuna stella/rating
- ✅ `src/components/Restaurant/RestaurantSheet.jsx` — ha già "Secondo Bi" con `restaurant.our_review` + `our_tip`. Va solo stilato v4 in PR6/PR7.
- ✅ `VerifyPage.jsx` + `VerifyPage.css` — PIN flow ristoratore già implementato
- ✅ `HomeFeedV4.jsx` — esiste già (da verificare aderenza al mockup)
- ✅ `package.json` — dipendenze pulite, nessuna lib recensioni
- ✅ `OrariLocale.jsx` — componente già presente (PR13 lo estende con Google Places)
- ✅ `qr-scanner` + `qrcode` — già installate (PR15 le userà)
- ✅ Struttura i18n con `locales/` + `react-i18next` — OK per IT/EN

---

## 5. DOMANDE APERTE (Claude Code PR0 Discovery deve rispondere)

1. Gli **utenti finali** (non ristoratori) loggano con email+password? Se sì, `LoginPage.jsx` rimane; se no, va rimosso.
2. Esiste una tabella `reviews` / `ratings` in `supabase-schema.sql` o in migration? Se sì, è referenziata da qualche componente React?
3. `ProfilePage.jsx` ha attualmente una stats row? Che metriche mostra?
4. `HomeFeedV4.jsx` è già attivo in `App.jsx` come route, o è dormiente?
5. `globals.css` ha definizioni di `.glass-pill-v4` / `.glass-pill-v4-dark` — sono usate nel bottom nav attualmente? Claude Code deve capire cosa tocca la vecchia nav prima di swappare.

---

## 6. RACCOMANDAZIONE EXECUTION

Esegui in questo ordine, 1 commit per ognuno:

1. **Commit dedicato di cleanup** (senza modifiche codice):
   ```bash
   git rm mockup-cards-v2.html mockup-cards-v3.html mockup-homepage-v2.html \
          mockup-homepage.html mockup-mappa.html mockup-sconti.html
   git commit -m "chore: remove obsolete v2/v3 root mockups"
   ```
2. **Upload docs + mockups v4** (usa `_upload/` già preparata):
   ```bash
   git add docs/ src/assets/brand/
   git commit -m "docs: add v4 redesign package (specs + mockups + logos)"
   ```
3. **Push branch**:
   ```bash
   git push
   ```
4. Apri **Claude Code** sul branch, incolla prompt **PR0 Discovery** da `docs/HANDOFF-TO-CLAUDE-CODE.md`. Claude Code leggerà `v4-REPO-AUDIT.md` (questo file) + `v4-CLAUDE.md` + `v4-COMPONENT-SPECS.md` e risponderà alle 5 domande aperte sopra prima di attaccare PR1.

---

## Fine audit

Se PR0 scopre qualcosa di inatteso (es. tabella reviews nascosta, componente che non ho visto), aggiorna questo file con un `## 7. AGGIORNAMENTI POST-DISCOVERY` prima di passare a PR1.
