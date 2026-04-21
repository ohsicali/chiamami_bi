# PR0 — Discovery Report
**Data**: 2026-04-21
**Branch**: `claude/chiamamibi-discovery-audit-OwINl`
**Metodo**: Lettura locale del repo + grep su `src/`, `locales/`, `api/`, `supabase-schema.sql`

---

## 1. Risposta alle 5 Domande Aperte

### D1 — Gli utenti finali loggano con email+password?

**SÌ — LoginPage è viva e attiva.**

- `src/App.jsx:130`: `<Route path="/login" element={<LoginPage />} />` — nessun flag, nessun guard, accessibile a tutti
- `src/pages/public/LoginPage.jsx` — implementazione completa con:
  - Login email+password (`signIn`)
  - Registrazione (`signUp`)
  - Google OAuth (`signInWithGoogle`)
  - Reset password via email
  - Flow recupero account via OTP
- `src/pages/public/VerifyPage.jsx` — separato, solo per ristoratori (PIN 6 cifre, cookie `verify_device_token`)

**Conclusione PR3/PR11**: `LoginPage.jsx` va **mantenuta** per gli utenti finali. `/verify` è il flow ristoratore. Nessuna sovrapposizione. Niente da rimuovere.

---

### D2 — Esiste una tabella `reviews`/`ratings` nel DB?

**NO tabella separata. Solo colonna `our_rating` interna.**

- `supabase-schema.sql:20`: `our_rating float4 DEFAULT 4.0` — colonna nella tabella `restaurants`, campo editoriale di Bi
- `supabase-schema.sql:21`: `our_review text` — testo editoriale "Secondo Bi"
- Nessuna tabella `user_reviews`, `ratings`, `stars` nel file schema
- Nessuna cartella `supabase/migrations/` (non esiste)
- `grep from('reviews')` e `from('ratings')` in `src/` → **nessun risultato**

**Uso di `our_rating` nel frontend:**
- `src/lib/hooks/useDiscounts.js:209` — inclusa nel join select (`.select('..., our_rating, ...')`)
- `src/lib/hooks/useRestaurants.js:26,55,84,...` — mock fallback data con `our_rating` come dato interno
- **Mai renderizzata visivamente agli utenti** — nessun `restaurant.our_rating` in JSX frontend

**Conclusione PR3**: Nessuna tabella da droppare. La colonna `our_rating` è interna e non visibile. Nessuna migration SQL necessaria. L'unica azione è la pulizia dei label admin (vedi §3).

---

### D3 — ProfilePage.jsx ha una stats row? Che metriche mostra?

**SÌ, ha stats. Sono già CONFORMI — zero "Recensioni".**

**Layout mobile v4** (`src/pages/public/ProfilePage.jsx:157-183`):
```
Salvati  |  Sconti usati  |  Visitati
```
- `stats.savedCount` — ristoranti salvati
- `stats.redemptionsCount` — sconti usati
- `stats.visitedCount` — locali distinti visitati tramite sconti

**Layout desktop** (`ProfilePage.jsx:424-436`):
```
Salvati  |  Sconti usati
```
(2 colonne, senza "Visitati")

**Frase Caveat** (`ProfilePage.jsx:194`): `"Bi sceglie i posti come li sceglierei io: per come si mangia, non per quante stelle hanno."` — è citazione editoriale che *nega* le stelle. **OK, conforme.**

**Conclusione PR3/PR10**: ProfilePage è già conforme ai non-negoziabili. PR10 (reskin) può procedere senza cleanup compliance.

---

### D4 — HomeFeedV4.jsx è attivo in App.jsx?

**SÌ — è la home attiva per la route `/`.**

`src/App.jsx:127`:
```jsx
<Route path="/" element={<HomeFeedV4 />} />
```

- `HomePage.jsx` è montata separatamente per `/esplora` (mappa) — `App.jsx:119`: `{isEsplora && <HomePage />}`
- `HomeFeedV4.jsx` e `HomePage.jsx` coesistono: la mappa è solo su `/esplora`, il feed v4 è su `/`

**Conclusione PR6**: PR6 (reskin home) si concentra su **stile e contenuto** di `HomeFeedV4.jsx`, non su routing. Il routing è già corretto.

---

### D5 — Uso di `.glass-pill-v4` e `.glass-pill-v4-dark`?

**Definite in `globals.css`, usate in 2 punti distinti.**

**`.glass-pill-v4`** (light, bianco traslucido):
- `src/components/Layout/MobileTabBar.jsx:65`:
  ```jsx
  <nav className="fixed md:hidden glass-pill-v4" ...>
  ```
  → **È l'intera bottom nav.** Questo è il target principale di PR5.

**`.glass-pill-v4-dark`** (scuro, ink traslucido):
- `src/pages/public/HomePage.jsx:664`:
  ```jsx
  <button className="glass-pill-v4-dark" ...>Vedi la mappa</button>
  ```
  → Bottone floating "Vedi la mappa" sopra la mappa in `/esplora`. **NON è la bottom nav.** NON è target di PR5.

**Struttura attuale del bottom nav** (`MobileTabBar.jsx`):
- 5 voci: Home · Esplora · Sconti · Salvati · Profilo ✅ (struttura già corretta per v4)
- Icone: outline SVG (non filled) — da aggiornare in PR5 a icone nere piene
- Active state: solo `color: var(--color-ink)` vs `rgba(34,24,28,.4)` — nessuna pill grigia attiva attuale
- Manca: active pill `rgba(0,0,0,.05)` + liquid glass WebGL

**Conclusione PR5**: Swap `MobileTabBar.jsx` da `glass-pill-v4` a liquid glass WebGL. Lasciare intatto il bottone "Vedi la mappa" in `HomePage.jsx` (usa `.glass-pill-v4-dark`, non toccare in PR5).

---

## 2. Grep Compliance — Classificazione

Comando eseguito:
```bash
grep -rniE "review|rating|recension|stelle|stellina|⭐|stars" src/ locales/ api/
```

### src/ — TUTTO OK o note minori

| File | Riga | Stringa | Classificazione |
|------|------|---------|----------------|
| `RestaurantSheet.jsx` | 279 | `reviewText = restaurant.our_review` | ✅ Editoriale Bi ("Secondo Bi") — OK |
| `NearbySection.jsx` | 35-39 | `our_review` per snippet scheda nearby | ✅ Editoriale Bi — OK |
| `RestaurantCard.jsx` | 220 | Commento: `(no stars per §5.2)` | ✅ Commento informativo, nessuna stella renderizzata — OK |
| `LoadingSpinner.jsx` | 19 | Commento: `{/* Rating row */}` nel `SkeletonCard` | ⚠️ Skeleton ha 2 box grigi vuoti etichettati "Rating row". Nessun valore reale mostrato ma la forma suggerisce rating. **Da rinominare in PR3** (commento → `{/* Tagline row */}`) |
| `DiscountBanner.jsx` | 18,65,78,189,194 | `generating` / `setGenerating` | ✅ Stato loading per generazione QR — non rating |
| `useDiscounts.js` | 209 | `our_rating` nel `.select()` | ✅ Colonna editoriale interna, non renderizzata — OK per ora |
| `useTranslatedContent.js` | 6 | JSDoc: "reviews, tips, etc." | ✅ Commento documentation — OK |
| `useTranslation.js` | 16 | `['our_review', 'our_tip']` | ✅ Campi editoriali Bi — OK |
| `useRestaurants.js` | 26,55,84,… | `our_rating`, `our_review` nei mock | ✅ Dati fallback interni, non visibili agli utenti — OK |
| `useRestaurants.js` | 274 | `our_review`: "Stellato Michelin e lo merita..." | ✅ Testo editoriale Bi che menziona stella Michelin esternamente — OK |
| `SuggestionsManager.jsx` | 10 | `reviewed: { label: 'Visto' }` | ✅ Status interno admin per suggerimenti — non rating utente |
| `RestaurantForm.jsx` | 2018-2019 | Sezione "**Recensione Bi**" / "**La nostra recensione**" | 🔴 **DA CORREGGERE in PR3**: rinominare in "Secondo Bi" / "Il testo di Bi" per allineamento con non-negoziabile #4 |
| `RestaurantForm.jsx` | 1049 | `context: field === 'our_review' ? 'restaurant review'` | ⚠️ Stringa interna API, non visibile agli utenti — bassa priorità, correggere in PR3 |

### locales/ — CHIAVI ORFANE DA RIMUOVERE

Tutte le chiavi seguenti esistono in **tutti e 5 i file** (`it.json`, `en.json`, `fr.json`, `es.json`, `de.json`). **Nessun componente React le chiama** (verificato: nessun `t('restaurant.writeReview')` o simili in `src/`):

| Chiave i18n | Classificazione |
|-------------|----------------|
| `restaurant.reviewByBi` | ✅ Editoriale — **MANTENERE** (è "Secondo Bi" in i18n) |
| `restaurant.communityReviews` | 🔴 **RIMUOVERE** — dead code, feature utente rimossa |
| `restaurant.reviews` | 🔴 **RIMUOVERE** — dead code |
| `restaurant.review` | 🔴 **RIMUOVERE** — dead code |
| `restaurant.writeReview` | 🔴 **RIMUOVERE** — dead code |
| `restaurant.editReview` | 🔴 **RIMUOVERE** — dead code |
| `restaurant.registerToReview` | 🔴 **RIMUOVERE** — dead code |
| `restaurant.noReviews` | 🔴 **RIMUOVERE** — dead code |
| `restaurant.reviewPublished` | 🔴 **RIMUOVERE** — dead code |
| `restaurant.reviewUpdated` | 🔴 **RIMUOVERE** — dead code |

**Chiave con menzione mista** (solo `it.json`):

| File | Riga | Contenuto | Classificazione |
|------|------|-----------|----------------|
| `locales/it.json` | 106 | `"loginSubtitle": "Accedi per salvare ristoranti, sbloccare sconti e **lasciare recensioni**"` | 🔴 **DA CORREGGERE in PR3**: rimuovere "lasciare recensioni" — suggerito: "Accedi per salvare ristoranti e sbloccare sconti esclusivi" |

### api/ — PULITA

Nessuna occorrenza di review/rating/stelline in `api/`.

---

## 3. Font Check

### index.html (riga 20-32)

```html
<!-- Attuale -->
<meta name="theme-color" content="#FF5757" />           <!-- ⚠️ vecchio corallo -->

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<!-- ⚠️ DM Sans: vestigio v3, da rimuovere in PR2 -->

<link rel="preconnect" href="https://api.fontshare.com" crossorigin />
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap" rel="stylesheet" />
<!-- ⚠️ Satoshi: font attuale del body, da swappare con Poppins in PR2 -->

<link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Caveat:wght@500;600;700&display=swap" rel="stylesheet" />
<!-- ✅ Alfa Slab One + Caveat: già caricati e corretti -->
```

**Stato attuale:**
| Font | Stato | Azione PR2 |
|------|-------|-----------|
| DM Sans | ⚠️ Vestigio v3, caricato ma inutilizzato | Rimuovere `<link>` da `index.html` |
| Satoshi | ⚠️ Font body attuale — NON è Poppins | Rimuovere `<link>` fontshare + sostituire con Poppins |
| Alfa Slab One | ✅ OK — wordmark | Mantenere, consolidare in unica querystring Google Fonts |
| Caveat | ✅ OK — editoriale Bi | Mantenere, consolidare in unica querystring Google Fonts |
| **Poppins** | 🔴 **Non caricato** | Aggiungere in PR2 |

### globals.css (riga 40-45)

```css
/* Font attuale body: */
--font-sans: 'Satoshi', 'Inter', -apple-system, system-ui, sans-serif;   /* ⚠️ da cambiare */
--font-display: 'Satoshi', 'Inter', sans-serif;                          /* ⚠️ da cambiare */
--font-mark: 'Alfa Slab One', Georgia, serif;                            /* ✅ OK */
--font-hand: 'Caveat', cursive;                                          /* ✅ OK */
```

Classi utility che referenziano Satoshi esplicitamente:
- `globals.css:211-216` — `.font-display`, `.font-editorial`: `font-family: 'Satoshi', 'Inter', sans-serif` → **da aggiornare in PR2**
- `globals.css:218-223` — `.font-restaurant`: `font-family: 'Satoshi', 'Inter', sans-serif` → **da aggiornare in PR2**

**theme-color**: `index.html:20` → `#FF5757` (vecchio coral) — aggiornare a `#E8453C` in PR2.

**Grep `Satoshi` in src/**: da eseguire in PR2 (`grep -rn "Satoshi\|font-satoshi\|DM Sans\|font-dm" src/`) per trovare eventuali occorrenze inline.

---

## 4. Matrice PR-readiness

| PR | Blocchi trovati | Stato |
|----|----------------|-------|
| PR1 — Safari viewport | `viewport-fit=cover` già in `index.html:5` ✅ | Solo aggiungere `env(safe-area-inset-*)` a `globals.css` |
| PR2 — Poppins | Satoshi in `index.html`, `globals.css:42-43`, `.font-display`, `.font-restaurant` | Interventi chiari, nessuna sorpresa |
| PR3 — Compliance | Solo label admin + chiavi i18n orfane (nessuna tabella DB da droppare) | Scope ridotto rispetto alle aspettative |
| PR4 — Tokens v4 | Token già quasi tutti in `globals.css` (`--color-ink`, `--color-corallo`, ecc.) | Verifica allineamento nomi; poco da fare |
| PR5 — Bottom nav | `MobileTabBar.jsx` usa `glass-pill-v4`, struttura 5 voci già corretta | Swap liquid glass + icone filled + active pill |
| PR6 — Reskin home | `HomeFeedV4.jsx` è già la home attiva | Solo reskin visivo |

---

## 5. Scoperte inattese (aggiornamento §7 di v4-REPO-AUDIT.md)

### 5a. `our_rating` nel DB — NON è una "ratings table" ma va monitorato

La colonna `our_rating float4 DEFAULT 4.0` esiste in `restaurants` e viene selezionata da `useDiscounts.js:209`. Non è mai renderizzata frontend. L'admin form (`RestaurantForm.jsx`) non ha nemmeno un campo per modificarla — è essenzialmente un campo fantasma rimasto dal passato. Non interferisce con i non-negoziabili ma va notato.

**Azione consigliata (bassa priorità, non in PR3)**: decidere se mantenere o deprecare il campo. Se mantenuto, aggiungere un campo admin per gestirlo; se deprecato, ALTER TABLE DROP COLUMN (richiede approvazione Augusto per schema change).

### 5b. `SkeletonCard` ha una "Rating row" nel loading state

`src/components/UI/LoadingSpinner.jsx:19-22` — Il componente `SkeletonCard` (usato in `ListView.jsx` e `HomePage.jsx`) ha una riga scheletro etichettata `{/* Rating row */}` che renderizza due placeholder grigi. Non mostra valori reali ma la forma del card suggerisce un rating row che non esiste nel card reale (`RestaurantCard`). Minore incoerenza.

**Azione consigliata in PR3**: cambiare commento in `{/* Tagline row */}` o rimuovere la riga skeleton.

### 5c. Locales contengono user-review keys orfane in TUTTE le 5 lingue

10 chiavi i18n per le recensioni utente esistono in `it.json`, `en.json`, `fr.json`, `es.json`, `de.json` senza che nessun componente le usi (`t('restaurant.writeReview')` ecc. non appaiono in `src/`). Sono dead code completo — non comportano rischio ma vanno rimossi in PR3.

### 5d. `HomeFeedV4` e `HomePage` coesistono intenzionalmente

Non è un bug: `HomeFeedV4` è il feed (`/`), `HomePage` è la mappa (`/esplora`). L'audit esterno ipotizzava che `HomeFeedV4` potesse essere dormiente — è invece attivo. `HomePage.jsx` non va rimossa, gestisce tutta la logica mappa Mapbox.

---

## 6. Riepilogo azioni PR3

Scope effettivo di PR3 (più leggero del previsto — nessun DROP TABLE):

1. **`src/pages/admin/RestaurantForm.jsx:2018-2019`** — Rinominare sezione "Recensione Bi" → "Secondo Bi" e label "La nostra recensione" → "Il testo di Bi"
2. **`locales/{it,en,fr,es,de}.json`** — Rimuovere 9 chiavi orfane: `communityReviews`, `reviews`, `review`, `writeReview`, `editReview`, `registerToReview`, `noReviews`, `reviewPublished`, `reviewUpdated`
3. **`locales/it.json:106`** — `loginSubtitle`: rimuovere "lasciare recensioni"
4. **`src/components/UI/LoadingSpinner.jsx:19`** — Rinominare commento `{/* Rating row */}` → `{/* Tagline row */}`
5. **Nessuna migration SQL necessaria** — nessuna tabella utente-review da droppare

---

*Fine PR0 Discovery — generato da Claude Code il 2026-04-21*
