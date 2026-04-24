# HANDOFF-PR19 · Esplora redesign (mobile + desktop)

**Target:** branch nuovo `claude/esplora-redesign-v4` → PR su `main`
**Scope:** ridisegna completa della pagina Esplora (mobile + desktop) con pattern Neotaste-adattato stile Bi. Filter sheet unificato con tutte le opzioni dentro. Mini-card preservate. Pin mappa rotondi come live.
**Stima:** ~15 commit, Opus per CP1+foundation, Sonnet per il resto.

**Mockup canonici (committati in `docs/mockups/`):**
- `v4-mobile-esplora-redesign.html` (3 frame: mappa · lista · filter sheet aperto)
- `v4-desktop-esplora-redesign.html` (split 540px + mappa, header floating)

Leggi **per intero** entrambi i mockup prima di codare. Sono la fonte canonica. Qualsiasi ambiguità in questo doc → guarda il mockup.

---

## Contesto

Dopo PR17 (home contestuale) e PR18 (mobile fixes), tocca all'Esplora. Oggi è una pagina mappa-centric con filtri disorganizzati (scroll-x categoria solo, niente prezzo/orario, toggle lista minuscolo). Nuovo pattern = Neotaste adattato: header floating desktop + search in lista + 3 pill filtro (Filtri/Categorie/Sconti) + filter sheet grande con tutto dentro.

### Cosa cambia rispetto al live
1. **Header minimale** (logo + Torino + geo) presente sempre
2. **Search bar** solo in vista Lista (in Mappa non c'è per lasciare più spazio)
3. **3 pill filtro** coerenti: ⚙ Filtri (badge) · Categorie ▾ · % Sconti (toggle)
4. **Riga count + Azzera** sopra mappa/lista (sempre in alto sotto pill, stesso posto per coerenza)
5. **Filter sheet** unico e grande (stile Neotaste): Categorie bubble tonde · Fascia d'orario · Dieta e stile · Fascia prezzo · Area di ricerca
6. **Pin mappa rotondi** come live (non teardrop)
7. **Toggle Mappa/Lista** pill ink floating: in mappa sopra le mini-card dice "☰ Lista", in lista dice "🗺 Mappa"
8. **Mini-card stile live preservate** (foto 96px + nome + sub + tag + prezzo)
9. **Desktop:** header floating pill stile home (signature Bi) + layout split 540px left-col + mappa right
10. **Icone premium SVG Lucide-style** in tutti i filter pill (sliders · grid · tag · mappa · lista · search)

### Voce
Tutta Esplora è voce Bi neutra (è una pagina utility, non editoriale). No handwriting Caveat. Solo Poppins + Alfa Slab One per wordmark.

---

## CP1 · Discovery (OBBLIGATORIO — D1-D10)

**D1.** Componente Esplora attuale: nome file. Probabilmente `src/pages/public/Esplora.tsx` o `ExploreFeed.tsx`. Come gestisce oggi la mappa (Mapbox GL)? Quali componenti: FilterBar · MapView · CardStack · ToggleMapList?

**D2.** Mapbox setup: `VITE_MAPBOX_TOKEN` presente? Stile mappa live (streets-v12? custom?). Come sono renderizzati i pin oggi (HTMLMarker? layer simbolico?)?

**D3.** Tabella `restaurants` su Supabase: verifica colonne rilevanti per i filtri:
- `category` (text o FK a categories)
- `price_tier` (enum 1-4)
- `opening_hours` (json con fasce orarie?)
- `has_discount` (bool)
- `location` (lat/lng per distanza)
- `tags_dietary` (array: vegan, vegetarian, healthy, gluten_free)

Se manca qualcosa (es. `tags_dietary`) serve migration o va fuori scope.

**D4.** Distanza utente-locale: come è calcolata oggi? PostGIS `ST_Distance` server-side o haversine client? Il sort "per distanza" richiede geolocation user.

**D5.** Vista lista attuale: esiste già come toggle o solo mappa? Se esiste, quale componente.

**D6.** Filter state: dove vive oggi lo state dei filtri? React context, URL query params, global store? Pattern target = URL query params (`/esplora?cat=aperitivo&price=2&moment=aperitivo&disc=1`) così deep-link da home funzionano.

**D7.** Card cliccabile: la mini-card nel live apre scheda ristorante? Qual è il routing.

**D8.** Header stile home (floating pill): esiste già come componente condiviso post-PR17? Se sì riutilizzare. Se no, estrarre in `<AppHeader variant="floating" />` per usare in Home + Esplora + future pagine.

**D9.** Bottom nav mobile: già renderizza "Esplora" come tab active su questa route?

**D10.** Bottom sheet/modal library già installata? (`vaul`, `radix-ui/react-dialog`, custom?). Serve per il filter sheet full-screen mobile.

**Blocker** → fermati e chiedi ad Augusto.

---

## CP2 · Implementation (ordine commit)

### Step 1 — Shared components

**`<FilterPill>`**: pill con icona SVG + label + badge opzionale + chevron opzionale. Varianti: `default` / `on` (badge attivo) / `active-highlight` (border corallo + wash bg, vedi pill "Sconti" attiva in lista).

**`<CategoryBubble>`**: bubble rotondo 64-82px con emoji grande + label sotto. Grid 4-col nel filter sheet.

**`<MiniCard>`**: foto 96px (mobile) / 132px (desktop) + body (name + sub + meta chips). Preservare layout del live attuale. Props: `rank`, `discountPct`, `distance`, `openUntil`.

**Commit:** `feat(esplora): shared FilterPill, CategoryBubble, MiniCard components`

### Step 2 — SVG icon set premium

Crea `src/components/icons/` con Lucide-style icons:
- `<IconSliders>` (3 righe + nodi) → Filtri
- `<IconGrid>` (4 quadrati) → Categorie
- `<IconTag>` (etichetta) → Sconti
- `<IconList>` (3 righe orizzontali) → Toggle Lista
- `<IconMap>` (mappa 3 sezioni piegate) → Toggle Mappa
- `<IconSearch>` (lente) → Search
- `<IconGeo>` (crosshair) → User location

Tutte stroke 2, 15×15 default (`currentColor`). Scalabili via `className`.

**Commit:** `feat(icons): Lucide-style SVG icon set (sliders/grid/tag/list/map/search/geo)`

### Step 3 — Filter state → URL query params

Refactor dello state dei filtri per vivere in URL query params:
- `cat` (string) — categoria slug (italiana, piemontese, fine-dining, ecc)
- `price` (1-4) — fascia prezzo
- `moment` (colazione | pranzo | aperitivo | cena | dopocena)
- `diet` (comma-separated: vegan,vegetarian,healthy,gluten-free)
- `disc` (1 | 0) — toggle sconti
- `area` (km) — raggio ricerca
- `view` (map | list) — default map mobile, no view param desktop

Hook `useEsploraFilters()` che leggi/scrivi questi params. Deep-link supportato (es. home card "+" passa `?moment=aperitivo`).

**Commit:** `refactor(esplora): filter state in URL query params + useEsploraFilters hook`

### Step 4 — Mobile Map view

`src/pages/public/Esplora/EsploraMobile.tsx` (o struttura equivalente):

```
<Header />                          // logo + Torino + geo (no search)
<FilterPillsRow>
  <FilterPill icon={Sliders} badge={activeCount} onClick={openFilterSheet}>Filtri</FilterPill>
  <FilterPill icon={Grid} onClick={openCategoriesSheet}>Categorie</FilterPill>
  <FilterPill icon={Tag} active={disc} onClick={toggleDisc}>Sconti</FilterPill>
</FilterPillsRow>
<CountBar>
  <span>{count} locali · {activeCount} filtri attivi</span>
  <ResetLink onClick={resetFilters}>Azzera</ResetLink>
</CountBar>
<MapView>
  <MapboxMap pins={results} />
  <GeoFab onClick={centerOnUser} />
  <FloatingToggle icon={List} to="?view=list">Lista</FloatingToggle>
  <CardStack horizontal>
    {topResults.slice(0, 5).map(r => <MiniCard key={r.id} {...r} />)}
  </CardStack>
</MapView>
<BottomNav />
```

Pin rotondi Mapbox HTMLMarker 44px, colori per categoria (corallo/viola/arancio/blu). Cluster bianco rotondo 46px con numero. User location dot blu pulsante.

CardStack horizontal: scroll-x con snap, 84% viewport per card (peek della successiva).

**Commit:** `feat(esplora): mobile map view con pin rotondi + card stack + floating toggle`

### Step 5 — Mobile List view

Stessa struttura sopra ma:
- **Search bar** sotto header (non in map view)
- Vista lista con `<ListCountBar>` + `<MiniCardList>` verticale
- Group header "Aperto ora" / "Oltre i 500 metri" per ordinamento per distanza
- Floating toggle pill in basso "🗺 Mappa"

**Commit:** `feat(esplora): mobile list view + search bar + group headers`

### Step 6 — Filter sheet mobile (Neotaste-style)

`<FilterSheet>` full-height 90% viewport modal con handle draggable. Sezioni:

1. **Categoria** — grid 4-col di `<CategoryBubble>` rotondi tonde (Italiana, Piemontese, Fine dining, Pizza, Asiatico, Pesce, Carne, Burger, Tramezzini, Cocktail bar, Caffè, BBQ). Multi-select.
2. **Fascia d'orario** — 5 pill chip (Colazione 🥐 · Pranzo 🍝 · Aperitivo 🥂 · Cena 🍷 · Dopo cena 🍸). Single-select.
3. **Dieta e stile** — 4 pill (Vegano 🥦 · Vegetariano 🫑 · Salutare 🥗 · Senza glutine 🌾). Multi-select.
4. **Fascia prezzo** — 4 pill (€ · €€ · €€€ · €€€€). Multi-select.
5. **Area di ricerca** — slider 200m–senza limite, default 1.2km. Legge geolocation user.

CTA sticky bottom:
- **"Mostra N locali"** corallo fat — applica filtri e chiude
- **"Azzera filtri"** outline sotto — reset

Tap su icona ✕ in alto a destra chiude senza applicare.

**Commit:** `feat(esplora): filter sheet mobile con 5 sezioni + CTA applica/azzera`

### Step 7 — Desktop · header floating + split

`src/pages/public/Esplora/EsploraDesktop.tsx`:

```
<AppHeaderFloating />        // absolute top 20px, centered, backdrop-blur pill
<Split>
  <LeftCol width={540}>
    <FiltersBar>
      <FilterPills />
      <CountRow>
        <span>{count} locali</span>
        <ResetLink>Azzera</ResetLink>
        <SortDropdown>Distanza</SortDropdown>
      </CountRow>
    </FiltersBar>
    <ListArea scrollable>
      {groups.map(g => <GroupHeader>{g.label}</GroupHeader><MiniCardList cards={g.items} />)}
    </ListArea>
  </LeftCol>
  <RightCol>
    <MapboxMap pins={results} bigger />  // pin 52px, cluster 56px
    <MapControls>
      <ZoomPlus /><ZoomMinus />
    </MapControls>
    <GeoFab />
    {selectedPin && <HoverCard restaurant={selectedPin} />}
  </RightCol>
</Split>
```

Click list-card → `setSelectedPin(card.id)` → apre hover-card su mappa + zoom lieve.
Click pin → `setSelectedPin(pin.id)` → evidenzia card in lista (scroll-to).

**AppHeaderFloating** = estrai il pattern della home (PR17) in componente riutilizzabile con varianti: `floating` (home, esplora) / `solid` (altre pagine). Tutto il sito desktop usa floating per coerenza brand Bi.

**Commit:** `feat(esplora): desktop split layout + AppHeaderFloating shared component`

### Step 8 — Filter sheet desktop (dropdown overlay)

Su desktop il filter sheet non è fullscreen ma un **dropdown overlay 420px** sotto la pill Filtri. Stesse 5 sezioni, stesso pattern CTA. Usa `radix-ui/react-popover` o simile.

**Commit:** `feat(esplora): filter overlay desktop (popover 420px)`

### Step 9 — Categorie shortcut popover

Click su pill `Categorie ▾` (mobile + desktop) = apre popover/sheet SOLO con la sezione Categoria bubble. Shortcut, non il sheet completo. Se vuoi usare anche Orario/Prezzo come shortcut separati, decidi in CP1 D6.

**Commit:** `feat(esplora): categorie shortcut popover`

### Step 10 — Sconti toggle

Click su `Sconti` = toggle binario. Pill diventa corallo-wash + bordo corallo. Query param `?disc=1`. Applica filtro `WHERE has_discount = true`.

**Commit:** `feat(esplora): toggle sconti binario`

### Step 11 — Group headers + sort distance

Quando `view=list` e geolocation attiva:
- Group 1: "Aperto ora" (o il momento selezionato) — locali a < 500m aperti adesso
- Group 2: "Oltre i 500 metri" — il resto ordinato per distanza crescente
Copy del divider: **"Oltre i 500 metri"** (non "Poco più in là" che è troppo vago).

**Commit:** `feat(esplora): group headers per distanza (sotto/sopra 500m)`

### Step 12 — Empty state

Se 0 risultati con filtri attivi: mostra empty state gentile:
- Titolo: "Nessun posto con questi filtri"
- Sub: "Prova a togliere una categoria o ad allargare la fascia prezzo."
- CTA: "Azzera filtri" corallo

**Commit:** `feat(esplora): empty state quando 0 risultati`

---

## CP3 · QA checklist

Testa su mobile 430×932 + desktop 1440×900:

**Mobile · mappa**
- [ ] Header logo + Torino + geo presenti in cima
- [ ] NO search bar in vista mappa
- [ ] 3 pill Filtri · Categorie · Sconti + Azzera sopra la mappa
- [ ] Count "17 locali · N filtri" sotto le pill (stesso pattern della lista)
- [ ] Pin mappa rotondi colorati + cluster rotondi bianchi
- [ ] Pill "Lista" floating sopra le mini-card
- [ ] Mini-card stack horizontal scroll con snap

**Mobile · lista**
- [ ] Header + search bar sotto + 3 pill + count/azzera + lista verticale
- [ ] Group headers "Aperto ora" / "Oltre i 500 metri"
- [ ] Pill "Mappa" floating in basso

**Mobile · filter sheet**
- [ ] Tap Filtri apre sheet 90% viewport con handle
- [ ] 5 sezioni presenti e scrollabili
- [ ] CTA "Mostra N locali" aggiorna il count live mentre selezioni
- [ ] "Azzera filtri" reset tutto
- [ ] Tap ✕ o fuori sheet chiude senza applicare

**Desktop**
- [ ] Header floating pill centrato in alto (stile home)
- [ ] Split 540px lista + mappa
- [ ] Card NON tagliate: nome + sub + meta wrappano puliti
- [ ] Click card → highlight pin in mappa + hover card
- [ ] Click pin → scroll-to card in lista

**Sistema**
- [ ] Deploy Vercel preview verde
- [ ] Function count ≤ 12 (Hobby cap)
- [ ] Deep link da home `?moment=aperitivo` funziona
- [ ] Bottom nav active Esplora su entrambi mobile+desktop

---

## Vincoli

1. **Pin mappa rotondi** (no teardrop, come live)
2. **Mini-card stile live** preservato (non cambiare foto 96px + body)
3. **Icone SVG Lucide** uniforme in tutte le pill filtro
4. **Header floating** come componente shared (da usare in tutto il sito desktop)
5. **No sort by dropdown** sul mobile (desktop sì, inline al count)
6. **Vercel Hobby cap 12** functions
7. **URL query params** per tutti i filtri (deep-link friendly)

---

## Prompt da dare a Claude Code

```
Leggi HANDOFF-PR19-ESPLORA-REDESIGN.md nella root + i 2 mockup canonici:
docs/mockups/v4-mobile-esplora-redesign.html (3 frame)
docs/mockups/v4-desktop-esplora-redesign.html (split + header floating)

Esegui CP1 Discovery (D1-D10) poi CP2 step-by-step.

Modello: Opus per CP1 + Step 1-2-3 (architecture shared components + URL
state refactor), Sonnet per il resto (Step 4-12 sono CSS/layout/wiring).

Vincoli: pin mappa rotondi, mini-card stile live preservato, Hobby cap 12
functions, URL query params per filtri, header floating shared con home.

Mockup = fonte canonica. Ambiguità → guarda i mockup.
```

---

*v1.0 · 24 aprile 2026 · Esplora mobile + desktop redesign · stile Neotaste adattato Bi.*
