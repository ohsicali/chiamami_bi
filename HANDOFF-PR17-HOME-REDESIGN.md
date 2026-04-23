# HANDOFF-PR17 · Home redesign contestuale + Chiedi a Bi AI

**Target:** branch nuovo `claude/home-redesign-v4` → PR su `main`
**Scope:** ridisegna completa della home (mobile + desktop), refactor filtri Esplora per coerenza, introduzione chat AI "Chiedi a Bi"
**Mockup canonici (committati in `docs/mockups/`):**
- `v4-mobile-home-redesign.html` (frame mobile principale + variant banner)
- `v4-desktop-home-redesign.html` (layout desktop 1440×900)
- `v4-index.html` (indice aggiornato, cards "proposta · 24/04" in evidenza)

**Vincolo hard:** Vercel Hobby cap 12 functions. Se aggiungi endpoint, verifica il conteggio totale e consolida dentro file esistenti se possibile.

---

## Contesto (leggi prima di partire)

La home attuale (`chiamamibi.com`) è statica: stessi blocchi sempre. Augusto vuole renderla **contestuale**: cambia in base all'ora, al momento della giornata, alla voglia dell'utente.

Leggi **per intero** i 2 mockup in `docs/mockups/v4-*-home-redesign.html` — sono la fonte canonica di verità per il design. Qualsiasi ambiguità in questo handoff è risolta guardando il mockup.

### Cosa cambia rispetto alla home attuale

1. **Banner sponsor** v2 con 3 variant (ristorante+sconto, ristorante senza sconto, brand non-food)
2. **Orologio contestuale** grande Alfa Slab One + domanda che cambia per fascia oraria
3. **5 pill momento** (Colazione · Pranzo · Aperitivo · Cena · Dopo cena)
4. **Griglia risultati** filtrata per momento, con card "+" finale che porta a mappa
5. **Chat AI "Chiedi a Bi"** — nuova sezione che sostituisce "Questa settimana vai da..."
6. **Filtri Esplora** riorganizzati per coerenza con la home (Categoria + Momento + Prezzo)

### Voce
Tutta la home è voce Bi prima persona (utenti finali). Non confondere con la voce team professionale (quella è solo per `/partner` form email).

---

## CP1 · Discovery (OBBLIGATORIO — rispondere a D1-D12 prima di codare)

**D1.** Home attuale: nome file componente principale (probabilmente `HomeFeedV4.tsx` o simile). Quali sezioni ha oggi? Identifica il blocco "Questa settimana vai da..." che dovrà essere sostituito dalla chat AI.

**D2.** Routing: quale route monta la home? È condivisa tra mobile e desktop o ci sono 2 componenti?

**D3.** Tabelle Supabase rilevanti per la home:
- `restaurants` — verifica se esistono colonne `opening_hours` (json, per fasce momento), `category`, `price_tier`, `zone`. Se `opening_hours` manca o non è structured-queryable, flagga.
- `discounts` / `drops` — per il banner sponsor con sconto
- `sponsored_placements` — esiste una tabella dedicata agli "annunci sponsorizzati" (brand + ristoranti)? Se no, serve una migration.
- `newsletter_subscribers` — dovrebbe avere già la colonna `subscribed` (vedi PR16)
- `ai_conversations` / `ai_messages` — nuove tabelle per la chat history

**D4.** Stack AI: cosa è già installato nel progetto?
- Verifica `package.json` per `@anthropic-ai/sdk` o simili
- Vercel env var `ANTHROPIC_API_KEY` — se non c'è, serve setup da Augusto
- Esiste già `api/admin-actions.js` con endpoint per AI text correction — verifica se è riutilizzabile come base per il nuovo endpoint chat

**D5.** Esplora attuale: quale componente, quali filtri oggi? Come sono implementati (query params URL? state React)? Il refactor dei filtri tocca anche la mappa — verifica dove è il componente mappa (Mapbox) e come consuma i filtri.

**D6.** Geolocalizzazione: oggi in home c'è un geo-btn? Se sì, va **rimosso** (Augusto ha deciso che in home non serve, resta solo nella mappa Esplora).

**D7.** Top bar mobile attuale: come è composta? City-pill Torino già esiste? Avatar utente è già presente? Se sì, verifica che lo stile sia quello del mockup (avatar 42px con gradient corallo + shadow + border 2px bianco; city-pill con dot pulsante + chevron ▾).

**D8.** Top bar desktop attuale: nav links, search, city-pill. Stesso check di D7 ma per desktop. Il mockup desktop usa layout `logo + nav-links + search + city + avatar` in una unica top bar sticky.

**D9.** `sponsored_placements` — come è gestito oggi il banner sponsor in home? Esiste una tabella con campi tipo `restaurant_id|brand_id`, `discount_id` (nullable), `start_date`, `end_date`, `active`? Se no, serve migration.

**D10.** Immagini sponsor: come sono uploaded? Supabase Storage `restaurant-photos` bucket? Servirà un'image con rapporto 16/9 per il banner hero desktop.

**D11.** Momento → query filter: come si traducono le fasce orarie in un filtro su `restaurants.opening_hours`? Serve funzione utility `isOpenForMoment(restaurant, moment, timestamp)` che ritorna bool.

**D12.** Se usi Claude AI con function calling, verifica che la function signature sia compatibile con `@anthropic-ai/sdk`. Alternative se `@anthropic-ai/sdk` non è installato: usare `openai` SDK già presente (nota: ci sono altre AI features nel progetto che potrebbero averlo già).

**Se qualcosa è bloccante** (tabelle mancano, API key assente, opening_hours non structured) → **fermati e chiedi ad Augusto**.

---

## Scelte di design già decise (non negoziabili, da mockup)

1. **5 momenti giornata** (non 4): Colazione · Pranzo · Aperitivo · Cena · **Dopo cena** (emoji 🍸). Scroll orizzontale su mobile, inline su desktop.

2. **Fasce orarie contestuali** (per orologio + pill active):
   - 06:30–10:30 colazione
   - 11:30–14:30 pranzo
   - 17:00–20:30 aperitivo
   - 19:30–23:30 cena
   - 22:30–02:00 dopo cena / cocktail
   - Fasce grigie (es. 15:00): pill active = momento successivo più vicino, domanda = "Dove ti porto adesso?"

3. **Domanda contestuale** (cambia in base al momento, in voce Bi):
   - Colazione: "È l'ora della colazione. Ce l'hai un posto in mente?"
   - Pranzo: "È l'ora del pranzo. Ce l'hai un posto in mente?"
   - Aperitivo: "È l'ora dell'aperitivo. Ce l'hai un posto in mente?"
   - Cena: "È l'ora di cena. Ce l'hai un posto in mente?"
   - Dopo cena: "È l'ora di un cocktail. Ce l'hai un posto in mente?"
   - Fallback: "Dove ti porto adesso?"

4. **Banner sponsor · 3 variant** (all have "Annuncio" label always visible top-left):
   - **Ristorante con sconto**: CTA duale `Attiva sconto -N%` (corallo pieno) + `Scopri` (outline) + heart save
   - **Ristorante senza sconto**: CTA duale `Scopri di più` (bianco) + icona cuore salva (outline)
   - **Brand non-food**: layout compact con logo 72×72 + nome + sottotitolo + CTA singolo `Scopri il brand`

5. **City-pill Torino**: padding 10px 16px, font 14px, border visibile, dot corallo pulsante + chevron ▾
6. **Avatar utente**: 42px, gradient corallo, shadow, border 2px bianco, Alfa Slab One con iniziale
7. **Card "+" finale** dopo l'ultimo locale del carousel momento: ink pieno con + corallo, testo "Vedi gli altri N · Sulla mappa"
8. **No geolocalizzazione in home** — solo in Esplora
9. **Filtri Esplora** riorganizzati: **Categoria · Momento · Prezzo** (zona sparisce da filtro top, resta nella mappa)

---

## Scelte di default (ribaltabili da Augusto in CP1)

**Chat AI chip suggeriti — dinamici per momento giornata**
- Colazione: "✨ cornetto croccante", "✨ brunch in zona", "✨ colazione vista panorama"
- Pranzo: "✨ pranzo veloce in Centro", "✨ sotto i 15€ con colleghi", "✨ pausa salutare"
- Aperitivo: "✨ aperitivo con terrazza", "✨ vini naturali", "✨ tagliere abbondante"
- Cena: "✨ cena romantica", "✨ carne alla brace", "✨ pizzeria gourmet"
- Dopo cena: "✨ cocktail bar autore", "✨ vinile dopo cena", "✨ birra artigianale"

Alternative: statici (3 chip sempre uguali). Se Augusto preferisce statico, semplifica a: "un cinese aperto stasera", "sotto i 20€", "brunch San Salvario".

**Chat AI history — salva per utente autenticato, non per guest**
- Nuova tabella `ai_conversations(id, user_id, created_at, updated_at, title)` + `ai_messages(id, conversation_id, role, content, created_at, metadata)`
- Guest (non autenticati): conversazione effimera, non salvata
- Utente autenticato: salva tutte le conversazioni, raggiungibili da Profile → "Le mie conversazioni con Bi"

**Stack AI — Claude API con function calling**
- Endpoint: `POST /api/ai-search` (nuovo, cap 12 se necessario consolidare in un router)
- Claude definisce function `search_restaurants(filters)` con params: `category`, `moment`, `price_max`, `zone`, `open_now`, `tags[]`
- Server-side: parse intent dal prompt utente → Claude genera tool call → esegue query Supabase → ritorna top 3-5 con motivo handwriting in voce Bi
- Modello: `claude-haiku-4-5-20251001` (veloce ed economico per questo task). Se output non soddisfacente upgrade a `claude-sonnet-4-6`.

Alternative: embeddings + similarity search (più economico, ma peggiore per query strutturate tipo "cinese aperto sotto 20€"). Non consigliato.

**"Vedi gli altri N" card "+"** → apre Esplora pre-filtrato (continuità navigazione, non modal)

**Filtri Esplora riorganizzati** → stessa PR (sennò dissonanza con la home)

---

## CP2 · Implementation (ordine consigliato)

### Step 1 — Migration DB (se D3/D9 segnalano mancanze)

```sql
-- migration: 20260424_sponsored_placements.sql
create table if not exists sponsored_placements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  brand_id uuid,
  discount_id uuid references discounts(id) on delete set null,
  variant text not null check (variant in ('restaurant_discount','restaurant_plain','brand')),
  headline text,
  subtitle text,
  cta_label text,
  cover_image_url text,
  priority int not null default 0,
  start_at timestamptz not null,
  end_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_sponsored_placements_active on sponsored_placements(active, start_at, end_at) where active = true;

-- migration: 20260424_ai_conversations.sql
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete cascade not null,
  role text not null check (role in ('user','assistant','tool')),
  content jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_conv on ai_messages(conversation_id, created_at);

-- RLS: solo l'utente può leggere/scrivere le sue conversazioni
alter table ai_conversations enable row level security;
create policy "conv_owner" on ai_conversations for all using (auth.uid() = user_id);
alter table ai_messages enable row level security;
create policy "msg_owner" on ai_messages for all using (
  auth.uid() = (select user_id from ai_conversations where id = conversation_id)
);
```

Se `restaurants.opening_hours` non è structured query-able, prepara una vista o una utility JS. Serve una function `isOpenForMoment(restaurant_row, moment: 'colazione'|'pranzo'|'aperitivo'|'cena'|'dopocena', timestamp)`.

**Commit:** `feat(db): sponsored_placements + ai_conversations + ai_messages tables`

### Step 2 — Endpoint AI `/api/ai-search`

Nuovo file `api/ai-search.js`:
- Rate limit 10/min per user_id (5/min per guest IP)
- Auth opzionale (Bearer token se loggato, altrimenti guest)
- Body: `{ prompt: string, conversation_id?: uuid, current_moment?: string }`
- Logica:
  1. Se `conversation_id` e utente autenticato → carica storia messaggi
  2. Se no, crea nuova conversazione (solo se auth)
  3. Chiama Claude con tool definition `search_restaurants(filters)`
  4. Esegui la tool call su Supabase
  5. Chiedi a Claude di scrivere motivo handwriting per ogni risultato (prompt: "per ogni ristorante scrivi 1 riga tipo *Per te, stasera.* — voce Bi prima persona, Caveat handwriting style")
  6. Ritorna `{ results: [{ restaurant_id, name, zone, price, open_until, why }], conversation_id? }`
- Se Vercel function count > 12, consolida in `api/admin-actions.js` aggiungendo un sub-route

**Commit:** `feat(api): ai-search endpoint con Claude function calling`

### Step 3 — Home mobile: shell + top bar

`src/pages/HomeFeed.tsx` (o equivalente):
- Top bar mobile: logo + city-pill Torino grande + avatar gradient corallo
- Rimuovi geo-btn se presente
- Stile tokens v4 (Poppins, Alfa Slab One per wordmark, corallo accent)
- Mantieni bottom nav liquid glass esistente

**Commit:** `refactor(home): top bar mobile con city-pill e avatar v4`

### Step 4 — Banner sponsor component

Nuovo componente `<SponsorBanner>` (condiviso mobile+desktop):
- Legge `sponsored_placements` (attivo + in periodo `start_at ≤ now ≤ end_at`)
- Renderizza variant in base a `variant` column
- Tutte le variant hanno label "Annuncio" in alto-sinistra SEMPRE
- Responsive: mobile layout verticale con foto sopra, desktop layout orizzontale 460px foto + body
- CTA dinamico in base a variant

**Commit:** `feat(home): SponsorBanner component con 3 variant`

### Step 5 — Time contextual hero + moment tabs

Nuovo componente `<TimeContextHero>`:
- Legge ora corrente client-side (`new Date()`)
- Determina momento attivo con funzione helper
- Renderizza orologio grande Alfa Slab One + tag momento con pulse + domanda contestuale
- Nuovo componente `<MomentTabs>`: 5 pill. Mobile scroll-x, desktop inline.

**Commit:** `feat(home): time hero + moment tabs contestuali`

### Step 6 — Results grid filtrata + card "+"

`<MomentResultsGrid>`:
- Query Supabase per ristoranti aperti nel momento selezionato (utility `isOpenForMoment`)
- Mobile: scroll orizzontale 2.5 card visibili + card "+" alla fine
- Desktop: grid 4-col con card "+" come quarta cella
- Card "+" link a `/esplora?moment={active}`
- Ogni card mostra "Aperto ora · fino XX:XX" calcolato da opening_hours

**Commit:** `feat(home): results grid filtrata per momento + card see-more`

### Step 7 — Map CTA

Componente `<MapCta>`:
- Green gradient card con pin + count + arrow corallo
- Link a `/esplora?moment={active}` (stessa destinazione della card "+")

**Commit:** `feat(home): map CTA verso Esplora pre-filtrato`

### Step 8 — Chat AI "Chiedi a Bi"

`<AskBiChat>`:
- Mobile: inline dopo results
- Desktop: sticky in right column (360px)
- Avatar Bi gradient corallo 52px con spark oro
- Chip dinamici per momento (vedi default sopra)
- Textarea + bottone "Chiedi a Bi"
- Output inline: bubble con testo Bi + 2-3 risultati card con "why" handwriting corallo + link "Scrivi a Bi per altri"

Chiamata client:
```js
const resp = await fetch('/api/ai-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token && {Authorization: `Bearer ${token}`}) },
  body: JSON.stringify({ prompt: userInput, conversation_id, current_moment })
})
```

**Commit:** `feat(home): AskBiChat con endpoint AI search`

### Step 9 — Secondo Bi editorial (preserva)

Il blocco "Secondo Bi" settimanale esistente resta identico. Solo verificare che lo stile sia allineato al mockup (gradient cream, av-bi, kicker oro, title Poppins 900, body Caveat handwriting).

**Commit:** `refactor(home): allinea Secondo Bi ai tokens v4`

### Step 10 — Refactor Esplora filtri

Esplora riorganizzata:
- Filtri top: **Categoria · Momento · Prezzo** (zona solo nella mappa)
- Query params URL: `?category=...&moment=...&price=...`
- Card "+" dalla home passa `?moment={active}` → Esplora pre-filtrato funziona
- Usa gli stessi componenti `<MomentTabs>` della home per coerenza

**Commit:** `refactor(explore): filtri riorganizzati (categoria + momento + prezzo)`

### Step 11 — Desktop layout

`<HomeDesktop>` separato o responsive breakpoint:
- Top bar con nav links + search + city + avatar
- Sponsor hero full-width 1440px
- Layout 2-col: main content + sticky right (chat AI + Secondo Bi)
- Grid results 4-col

Scelta stack: se il progetto usa Tailwind responsive, fai 1 componente con breakpoints. Se no, 2 componenti separati `<HomeMobile>` + `<HomeDesktop>`.

**Commit:** `feat(home): desktop layout 2-col con chat AI sticky`

### Step 12 — Admin placement manager

Pagina admin `/admin/placements` per gestire `sponsored_placements`:
- Lista attivi + in scadenza + scaduti
- Form create/edit con variant selector (restaurant+discount, restaurant_plain, brand)
- Upload immagine cover (per variant "brand" non serve)
- Schedule (start_at, end_at)
- Anteprima rendering del banner come apparirà in home

Aggiungi la voce nav admin in `AdminLayout.tsx` — gruppo BUSINESS accanto a Partner.

**Commit:** `feat(admin): sponsored placements CRUD`

---

## CP3 · QA checklist

Prima di aprire la PR:

**Home mobile**
- [ ] Top bar: logo + city-pill Torino grande + avatar corallo (no geo)
- [ ] Banner sponsor mostra variant corretto (se sponsored_placements ha riga attiva)
- [ ] Orologio mostra ora corrente, aggiornato ogni minuto
- [ ] Tag momento e domanda cambiano in base all'ora
- [ ] 5 pill momento visibili (scroll x)
- [ ] Tap su pill → results filtrati + URL cambia con query param
- [ ] Card "+" in fondo → apre /esplora?moment=...
- [ ] Chat AI: prompt + response + 2-3 result card + handwriting motivo
- [ ] Secondo Bi in fondo

**Home desktop**
- [ ] Top bar nav: Home/Esplora/Sconti/Salvati + search + city + avatar
- [ ] Sponsor hero full-width con CTA triplo (sconto + scopri + save heart)
- [ ] Layout 2-col: main + sticky right con chat AI
- [ ] Grid 4-col con card "+" come quarta cella
- [ ] Orologio 88px + 5 pill inline

**Chat AI funzionale**
- [ ] Guest: chat funziona, non salva storia, nessun conversation_id ritorna
- [ ] User loggato: chat salva in ai_conversations, Profile → "Le mie conversazioni con Bi" mostra storia
- [ ] Prompt "cinese aperto stasera" → Claude chiama tool → restituisce 2-3 ristoranti cinesi aperti ora con motivo
- [ ] Prompt vago "un posto bello stasera" → risposta sensata
- [ ] Prompt impossibile "ristorante marziano" → risposta "non trovo niente che corrisponda, vuoi aiutarmi?"
- [ ] Rate limit: 11° richiesta in 1 min → 429
- [ ] Rate limit guest: 6° richiesta da IP → 429

**Esplora**
- [ ] 3 filtri top: Categoria · Momento · Prezzo (zona sparita dal top)
- [ ] Query params URL funzionano
- [ ] Link dalla home (`/esplora?moment=aperitivo`) → filtro aperitivo già attivo
- [ ] Mappa Mapbox rispetta i filtri

**Admin placements**
- [ ] Pagina `/admin/placements` lista attivi + scadenza
- [ ] Form create nuovo placement con variant selector
- [ ] Preview banner come apparirà in home

**Sistema**
- [ ] Function count Vercel ≤ 12 (controlla `ls api/*.js | wc -l`)
- [ ] Deploy preview verde
- [ ] `ANTHROPIC_API_KEY` env var presente in Vercel
- [ ] Migration SQL idempotenti
- [ ] RLS policies testati: user A non vede conversazioni di user B

---

## Vincoli hard

1. **Label "Annuncio" SEMPRE visibile** su banner sponsor — richiesta legal/trust
2. **Voce Bi prima persona** in tutti i testi verso utenti finali
3. **No stelle, no recensioni** — guida curata, niente rating
4. **Poppins unica famiglia UI** · Alfa Slab One solo wordmark + orologio
5. **Active pill momento** = ink pieno con shadow (coerente con navbar)
6. **Chat AI history privata** (RLS Supabase) — nessun cross-user leak
7. **Rate limit rigoroso su AI** — Claude API costa. Max 10/min auth, 5/min guest
8. **No geolocalizzazione in home** — solo in Esplora

---

## Prompt da dare a Claude Code

```
Leggi HANDOFF-PR17-HOME-REDESIGN.md nella root del progetto e i 2 mockup
canonici in docs/mockups/v4-mobile-home-redesign.html + 
v4-desktop-home-redesign.html.

Esegui CP1 Discovery rispondendo a D1-D12, poi chiedi conferma ad Augusto
prima di iniziare CP2.

Obiettivo: home contestuale (orologio + 5 momenti + 3 variant banner
sponsor + chat AI Chiedi a Bi) + refactor filtri Esplora per coerenza.

Vincolo: Vercel Hobby cap 12 functions. Nuovi endpoint /api/* solo se
necessario; preferisci consolidare in router esistenti.

Stack AI: Claude API con function calling (claude-haiku-4-5-20251001).
Chat history per utente autenticato (ai_conversations + ai_messages +
RLS). Guest = effimero.

Modello da usare per coding: Opus (prima PR CP1-6 che richiede
architecture decisions), poi Sonnet per CP7-12.

Mockup = fonte canonica. Ambiguità in handoff → guarda i mockup.
```

---

## Ordine suggerito commit → PR (come spezzarla se troppo grossa)

Se la PR diventa troppo grossa:

- **PR17a**: Migration DB + admin placements CRUD (CP1-2 + Step 12)
- **PR17b**: Home mobile + banner + time hero + momento tabs + results (CP3-7)
- **PR17c**: Chat AI endpoint + UI mobile (Step 8)
- **PR17d**: Home desktop layout (Step 11)
- **PR17e**: Refactor Esplora filtri (Step 10)

Ogni sub-PR deve essere mergiabile indipendentemente (con feature flag se serve).

---

*v1.0 · 24 aprile 2026 · Home redesign contestuale · dopo PR#89 admin + PR16 email wiring.*
