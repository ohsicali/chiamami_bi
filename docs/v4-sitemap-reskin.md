# v4 · Site-map re-skin — Chiamami Bi

> **Regola**: il live ha già tutti gli elementi che servono. v4 è **re-skin 1:1** (colori, font, nav glass, pin B). Unica eccezione: orari da Google Places API sulla scheda ristorante.
>
> Mappatura fatta il 2026-04-17 navigando https://chiamamibi.com (mobile 390×844 + desktop 1280×900, account Cali loggato).

---

## 0 · Asset trasversali (valgono ovunque)

| Elemento | v3 (live) | v4 (re-skin) |
|---|---|---|
| **Sfondo** | `#FAF7F2` crema | `#FAF7F2` crema — **invariato** |
| **Logo wordmark** | "LA GUIDA DI BI / BY CHIAMAMI BI" — font retro serif coral (già del logo) | invariato, solo spostato se serve |
| **City pill** | "Torino" dot verde + caret | dot **corallo** + caret |
| **Geolocation icon top-right** | cerchio bianco + arrow | invariato |
| **Accent color** | `#E8453C` rosso v3 | `#EE5C55` **corallo** |
| **Body font** | DM Sans | **Poppins** (Fontshare) |
| **Titoli ristoranti** | TAN Songbird italic | **TAN Songbird invariato** |
| **Monogramma pin mappa** | vari pin colorati con emoji cucina | pin goccia corallo + "B" in font-mark, statici |
| **Tab bar mobile** | pill espanso, bg crema | **nav glass full-width** pill, `rgba(255,255,255,.66)` + blur(22px) |
| **Top bar desktop** | orizzontale piatta crema | **glass pill** con stesso trattamento (da validare) |

---

## 1 · `/` Esplora (= home)

**Live — mobile (map mode)**
- Top bar: logo + city pill + geolocation
- Mappa full-height con pin cucina colorati + cluster bianchi numerati
- Pill flottante dark centrale "Lista · 46"
- 2 mini card scrollabili orizzontalmente in basso (foto + nome TAN + tag + prezzo + heart)
- Tab bar bottom 4 tab

**Live — mobile (list mode)** → drawer che sale quando tappi "Lista"
- Search bar "Cerca ristoranti…"
- Chip categorie scrollabili: Tutti (attivo dark), Bar, Tramezzini, Piemontese…
- 3 chip secondari: Vicino a me · Scontati (badge) · Filtri
- Card ristorante orizzontali (foto sx + info dx + heart)
- Pill dark flottante "Vedi la mappa" per tornare

**Live — desktop**
- Top bar orizzontale: logo + city pill + tab Esplora/Sconti/Salvati inline + search + avatar
- Split: lista verticale sx (~380px) | mappa dx (full height)

**v4 interventi**
- Tutti i **pin mappa** → goccia corallo + "B" Alfa Slab, statici (niente oscillazione). Cluster = cerchio corallo + numero Poppins 700
- **Pill dark** "Lista · N" e "Vedi la mappa" → diventano **nav glass pill** stesso trattamento della bottom nav (coerenza)
- **Chip categorie**: attivo = pill ink; inattivi = pill white + bordo `ink-15`
- **Card mini bottom**: restano ma con nuova pelle (niente stelle)
- **Nav bottom** → glass full-width pill
- **Desktop**: top tab diventano glass pill centrato in alto (stesso pattern mobile)

---

## 2 · `/deals` Sconti

**Live — mobile (non loggato)**
- Top bar invariato
- Segmented control "Disponibili / I miei" pill
- Banner dark large con lucchetto "Sblocca sconti e drop esclusivi" + CTA corallo "Registrati gratis"
- Section label "SCONTI DISPONIBILI"
- Card sconto: **banner gradient verde** con titolo offerta in alto ("Baozi a 1,50€", "10% sul totale"), foto sx, nome ristorante TAN, tag, prezzo, heart

**Live — mobile (loggato)**
- Banner dark di signup **scompare**
- Card "GIÀ USATO" → badge dark pill + card in grigio/fade

**v4 interventi**
- Banner verde sopra card → **banner gradient coral-soft → corallo** (palette coerente)
- Badge "GIÀ USATO" → pill ink invariato
- Card fade per usati → invariato (già funziona)
- Nota: in memoria c'è il **drop carousel** (red border + progress bar) già deciso v3, lo porteremo nel re-skin con colori corallo. **Conferma da Augusto**: dove vogliamo il carousel drop? Oggi nel live non lo vedo. Qui in /deals in testa? Oppure anche in home?

---

## 3 · `/saved` Salvati (login-gated)

**Live — mobile loggato**
- Stesso top bar
- Stessi chip categorie + filtri (Vicino a me, Scontati, Filtri)
- Lista card orizzontali con heart **pieno corallo-soft/corallo** sui salvati
- Footer sotto

**v4 interventi**
- Heart pieno → `fill: var(--corallo)` + background `var(--corallo-soft)` perfetto
- Resto: re-skin pelle

---

## 4 · `/profile` Profilo (login-gated)

**Live — mobile loggato**
- Hero card coral gradient full-width: avatar cerchio white "C" + nome "Cali" + email + pill "Amico di Bi" + "da marzo 2026" + cog
- Dentro hero: "**0€** risparmiati con gli sconti di Bi" (big number TAN Songbird)
- 3 stat tile white (Salvati 2 / Sconti usati 2 / Recensioni 1) — numeri TAN
- Banner dark large "INVITA UN AMICO · Condividi La Guida di Bi" + CTA white pill
- Row "Newsletter" con toggle
- Grid 2×2 tile: Impostazioni · Chi è Bi · Ristoratori · **Consiglia un ristorante** (tile corallo CTA)
- 2 social tile: TikTok (dark) · Instagram (light)
- Tile "Esci dall'account"
- Footer: Privacy · Termini · v1.0

**Live — desktop**
- Hero coral full-width uguale
- Sotto: 2 colonne — sx "LE TUE STATISTICHE" (3 tile + banner dark) | dx "AZIONI RAPIDE" (grid 2×2 + socials + esci)

**v4 interventi**
- Gradient hero coral → `--corallo` flat o leggero gradient `corallo → corallo-ink`
- Tutti i numeri big (0€, 2, 1) → TAN Songbird invariato
- Tile "Consiglia un ristorante" → corallo pieno, CTA al bottom sheet 3-step (già in v3 memoria)
- Bottom sheet suggerimento (name/address → tag → foto opt → success) → re-skin con corallo, invariato nel flow

---

## 5 · `/restaurant/[slug]` Scheda ristorante

**Live — mobile**
- Hero foto 1:1 con top bar flottante: back tondo + share tondo + heart tondo
- Badge contatore foto bottom-right "1 / 6"
- White panel sottostante con:
  - Nome ristorante XL in TAN Songbird
  - Indirizzo
  - Chip categoria + chip prezzo (€/€€/€€€)
  - "Prezzo accessibile"
- Row 3 quick-action: Indicazioni · Chiama · Sito
- Descrizione long-form Poppins weight 700
- **Card oro "Cosa prendere"** (bg `--oro`, testo white, coltello-forchetta emoji, suggerimento di Bi)
- Card outline "Ho fatto un video in questo posto, guardalo!" con bottoni Reel / TikTok
- Author card "Ciao, sono Bi · La tua guida a Torino"
- "Ristoranti vicini" carousel (3+ card)
- Footer con wordmark CHIAMAMI BI + socials + link Chi è Bi · Sconti · Per i ristoratori · Area ristoratori · Privacy · Termini

**Sticky header on scroll**: back + titolo ristorante + share + heart

**v4 interventi (unica pagina dove c'è elemento AGGIUNTIVO)**
- ☝ **NUOVO: orari Google Places API** — sync automatico dagli orari Google. Fallback: link "Apri in Google Maps". Placement: sotto la row quick-action o dentro una nuova card "Orari" con pallino verde/corallo "Aperto ora" o grigio "Chiuso"
- Card oro "Cosa prendere" → **invariata** (oro resta come tip-card)
- Hero e restante → re-skin (heart pieno corallo quando salvato, share/back con bordo ink-15)
- Footer wordmark CHIAMAMI BI corallo → invariato

---

## 6 · `/login` Login

**Live**
- Top bar logo + link "Esplora la mappa"
- Titolo "Ciao di nuovo!" TAN Songbird XL
- Subtitle Poppins
- Bottone white "Continua con Google"
- Divider "oppure"
- Input email/password con bordo ink-15
- Link corallo "Password dimenticata?"
- CTA corallo large "Accedi"
- "Non hai un account? **Registrati**" (link corallo)
- Divider "SCOPRI BI"
- 2 tile outline: Ristoratori · Chi è Bi

**v4 interventi**
- Re-skin con corallo invariato (già così) + font stack Poppins + ink-15 borders

---

## 7 · `/admin` Admin panel (solo Augusto)

**Live — desktop**
- Sidebar fissa 220px: logo "LA GUIDA DI BI / ADMIN PANEL" + nav
  - Dashboard · Analytics
  - **GESTIONE**: Ristoranti (badge 71) · Sconti & Drop · Categorie
  - **COMMUNITY**: Utenti · Recensioni · Suggerimenti (dot corallo)
  - **BUSINESS**: Candidature · Partner · Newsletter
  - Footer sidebar: avatar A + email + cog
- Main content:
  - Titolo "Dashboard · Panoramica della guida"
  - CTA corallo "+ Nuovo ristorante" top-right + inline "+ Nuovo ristorante" / "+ Nuovo sconto"
  - Stat card "RISTORANTI · 71 · 71 pubblicati"
  - Section "DA GESTIRE": 3 row (suggerimenti utenti / candidature partner / recensioni da moderare)
  - Section "ULTIMI AGGIUNTI" + link "Tutti →" + 3 row ristoranti recenti con pill verde "Live"

**v4 interventi**
- Attivo sidebar → pill `--corallo-soft` (già così)
- CTA + "Nuovo X" → corallo (già così)
- Font → Poppins
- Pill "Live" → resta verde o → corallo? **da decidere**
- Resto pelle invariata

---

## 8 · `/verify` Verifica ristoratore (ristoratori)

**Live — desktop**
- Top bar stessa dell'utente (logo + city + tab + search + avatar)
- Sub-header: foto ristorante tonda + nome TAN ("Mo Sarpi Torino") + categoria/indirizzo + pill verde "NELLA GUIDA" + bottone outline "Esci"
- Tab switcher: **Verifica QR** / **Dashboard** (underline corallo sull'attivo)

**Tab Verifica QR**
- "Inquadra il QR code mostrato dal cliente"
- Finestra scanner camera dark (se bloccata: stato "Fotocamera bloccata · Autorizza…")
- Bottone outline "Inserisci il codice manualmente"
- Helper text small

**Tab Dashboard (ristoratore)**
- Segmented control "7 giorni / **30 giorni** / 12 mesi" + icona calendario
- 4 stat card con icone: **Visualizzazioni** (occhio viola) · **Salvati** (heart rosa) · **Sconti generati** (sparkles corallo) · **Sconti usati** (check verde)
- Card dark "SCONTO ATTIVO" con dot corallo: nome drop + "X usati · Scade in Y gg"
- Card "ATTIVITÀ RECENTE": lista eventi (Validato/Generato sconto + cliente + drop + data/ora)
- Card "ANDAMENTO — ULTIMI 30 GIORNI": 4 bar orizzontali (Visualizzazioni / Salvati / Sconti generati / Sconti usati)

**v4 interventi**
- Underline tab attivo → corallo (già così)
- Stat icons → mantenere i colori diversi (pattern semantico utile) ma adattare il viola/rosa a varianti più vicine alla palette v4
- Card "SCONTO ATTIVO" dark → resta dark ma dot corallo (già così)
- Font → Poppins
- CTA "Inserisci codice manualmente" outline → ink-15 border

---

## 9 · Altre pagine (secondarie, da confermare)

- **`/chi-e-bi`** → pagina autore/about (linkata dal profilo e dalla scheda)
- **`/per-i-ristoratori`** → landing partner (linkata dal footer)
- **`/area-ristoratori`** → probabile login ristoratori
- **`/signup`** → registrazione (sorella di `/login`)
- **`/privacy`** + **`/termini`** → legali

Queste **non le ho visitate** — chiedo ad Augusto se esistono e se vanno re-skinnate nel sistema v4 o restano come sono.

---

## Road map aggiornata v4

| # | Deliverable | File |
|---|---|---|
| 0 ✅ | Moodboard + design system + nav glass demo | `neotaste-v4-moodboard.html` |
| 0.5 ✅ | Site-map re-skin (questo file) | `v4-sitemap-reskin.md` |
| 1 | Esplora mobile (map + drawer lista) | `v4-mobile-esplora.html` |
| 2 | Esplora desktop (split lista + mappa) | `v4-desktop-esplora.html` |
| 3 | Sconti mobile + drop carousel logic | `v4-mobile-sconti.html` |
| 4 | Scheda ristorante mobile + orari Google | `v4-mobile-scheda.html` |
| 5 | Salvati + Profilo mobile | `v4-mobile-profilo.html` (+ salvati incluso) |
| 6 | Login/signup | `v4-mobile-login.html` |
| 7 | Admin panel desktop | `v4-desktop-admin.html` |
| 8 | Verify ristoratore (mobile + desktop) | `v4-verify.html` |
| 9 | Handoff completo v3 → v4 | aggiornamento `design-handoff-v3.md` → v4 |

---

## Domande aperte per Augusto

1. **Drop carousel**: dove vive? Nel live non lo vedo. Solo in `/deals` top, o anche in home come banner?
2. **Nav glass desktop**: glass pill top centrato, o conservare top bar piatta con solo il trattamento glass?
3. **Orari Google Places**: placement sulla scheda — card separata "Orari" con "Aperto ora" oppure row semplice sotto quick-action?
4. **Pill "Live" in admin**: verde (semantica standard "pubblicato/online") o coralizzata?
5. **Pagine statiche secondarie** (Chi è Bi, Per i ristoratori…): esistono? vanno nel re-skin?
