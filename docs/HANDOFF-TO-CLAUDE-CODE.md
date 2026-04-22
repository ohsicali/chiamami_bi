# HANDOFF v4 → Claude Code

> Questo è l'**unico file** da cui partire. Orchestra tutto il resto.
>
> Stato di partenza: **chiamamibi.com è live in produzione e 100% funzionante**. Il redesign v4 è un **reskin visivo + 2 feature** (Google orari, email Resend) + **compliance cleanup** (niente più recensioni utente). Niente riscritture, niente refactor.

---

## Come si esegue (spiegazione per Augusto)

Il redesign è **grande ma ordinato**. Non va fatto in un'unica sessione Claude Code — si perderebbe pezzi.
La strategia è: **una PR per task**, ognuna con un **prompt auto-contenuto** da incollare nel prompt input di Claude Code (VS Code extension o CLI).

Flusso per ogni PR:
1. Apri Claude Code sul repo `ohsicali/chiamami_bi` branch `claude/chiamamibi-app-xf7qn`
2. Incolla il prompt della PR che ti interessa (li trovi qui sotto, sezione "Prompt pronti")
3. Claude Code fa STEP 0 (Discovery) la prima volta, poi propone un plan, aspetta OK, fa la PR
4. Tu controlli la PR (screenshot mockup vs build — vedi v4-PLAN.md sezione "Verifica vs mockup")
5. Merge, passa alla PR successiva

**Ordine delle PR** (tassativo per le prime 5, poi parallelizzabile):

| # | PR | Track | Dipende da | Mockup reference |
|---|----|-------|------------|------------------|
| 0 | Discovery + docs sync | — | — | (nessuno) |
| 1 | Safari iOS viewport-aware | Chrome fix | 0 | `v4-safari-chrome-preview.html` |
| 2 | Typography Satoshi → Poppins | Chrome fix | 0 | tutti i v4-*.html |
| 3 | Compliance: cleanup recensioni | Track A | 0 | — (non visivo) |
| 4 | Design tokens v4 | Track B | 2 | `v4-index.html` |
| 5 | Bottom nav liquid glass | Track B | 1, 2, 4 | `v4-mobile-home.html` |
| 6 | Reskin home | Track B | 4, 5 | `v4-mobile-home.html`, `v4-desktop-home.html` |
| 7 | Reskin scheda locale | Track B | 4, 5 | `v4-mobile-scheda.html`, `v4-desktop-pagine.html` righe 1115-1290 (blocco "Scheda ristorante") |
| 8 | Reskin pagine (Esplora/Sconti/Salvati/Profilo) | Track B | 4, 5 | `v4-mobile-pagine.html`, `v4-desktop-pagine.html` righe 622-1117 (Esplora 622-782, Sconti 783-935, Salvati 936-1012, Profilo 1013-1117) |
| 9 | Reskin /verify (solo CSS) | Track B | 4 | `v4-verify.html`, `v4-mobile-auth.html` |
| 10 | Reskin admin | Track B | 4 | `v4-mobile-admin.html`, `v4-desktop-admin.html` |
| 11 | Feature — orari Google Places | Track C | 4, 7 | `v4-ops-google-places.md` |
| 12 | Feature — email Resend setup | Track C | — | `v4-ops-resend.md`, `v4-email-manifesto.md` |
| 13 | Feature — email "Benvenuto ristoratore" | Track C | 12 | `v4-email-manifesto.md` template #1 |
| 14 | Feature — email "Conferma suggerimento" | Track C | 12 | `v4-email-manifesto.md` template #2 |
| 15 | Feature — email "Notifica interna" | Track C | 12 | `v4-email-manifesto.md` template #3 |

Track A (3) e Track B (4-10) sono **parallelizzabili** se ti fa comodo: apri due sessioni Claude Code su branch diversi. Track C (11+) richiede Track B completa perché tocca UI già reskinnata.

---

## Architettura dei file handoff (cosa legge Claude Code)

Tutti i file devono essere nel repo sotto `docs/` (o `docs/mockups/` per gli HTML). Claude Code li legge in questo ordine:

```
docs/
├── v4-CLAUDE.md               ← CONTRATTO: regole permanenti (non-negoziabili, stack, tokens)
├── v4-PLAN.md                 ← PLAYBOOK: Track A/B/C step-by-step con acceptance criteria
├── v4-dev-brief.md            ← SCOPE: env vars, tre tracce, priorità
├── v4-pre-handoff.md          ← GAP ANALYSIS: rischi, legacy da gestire
├── v4-sitemap-reskin.md       ← SITEMAP: tutte le route e cosa va reskinnato su ciascuna
├── v4-ops-google-places.md    ← OPS: come integrare Google Places orari
├── v4-ops-resend.md           ← OPS: come integrare Resend per email
├── v4-email-manifesto.md      ← COPY: 4 template email in voce Bi
├── UPLOAD-ISTRUZIONI.md       ← SPECS tecniche PR1/PR2/PR3 (Safari, Poppins, liquid glass nav)
└── mockups/
    ├── v4-mobile-home.html        ← HOME mobile (con liquid glass WebGL funzionante)
    ├── v4-mobile-scheda.html      ← scheda locale mobile
    ├── v4-mobile-pagine.html      ← 5 phone side-by-side: Esplora/Sconti/Sconti-preso/Salvati/Profilo
    ├── v4-mobile-auth.html        ← onboarding mobile
    ├── v4-mobile-admin.html       ← admin mobile
    ├── v4-desktop-home.html       ← home desktop (standalone)
    ├── v4-desktop-pagine.html     ← CUMULATIVO: Home(~507-621), Esplora(622-782), Sconti(783-935), Salvati(936-1012), Profilo(1013-1117), SCHEDA RISTORANTE(1118-1290)
    ├── v4-desktop-admin.html      ← admin desktop
    ├── v4-verify.html             ← login ristoratore (PIN-only)
    ├── v4-index.html              ← indice navigabile di tutti i mockup
    ├── v4-safari-chrome-preview.html  ← 3 confronti before/after viewport Safari iOS
    └── neotaste-v4-moodboard.html ← moodboard riferimento visivo
```

**Regola d'oro**: i mockup HTML sono **reference visivo**, non codice da portare 1:1. Claude Code deve reimplementare in React/JSX rispettando i tokens, le icone SVG inline, e le spec CSS — ma integrandoli nel codice esistente.

---

## Prompt pronti da incollare in Claude Code

Ogni prompt è **auto-contenuto**. Lo puoi incollare in una sessione Claude Code nuova, senza altro contesto.

### PR 0 — Sync docs + Discovery

```
Ho caricato una cartella docs/ nel repo con il nuovo handoff v4. Prima di qualsiasi task di codice:

1. Leggi nell'ordine: docs/v4-CLAUDE.md, docs/v4-PLAN.md, docs/v4-dev-brief.md, docs/v4-pre-handoff.md, docs/HANDOFF-TO-CLAUDE-CODE.md.

2. Esegui Step 0 (Discovery) come descritto in v4-PLAN.md:
   - git log --oneline -20
   - ls src/ e mappa struttura
   - Trova punti d'ingresso per Track A (recensioni), Track B (fonts+colori), Track C (scheda locale place_id)
   - Verifica quali env vars esistono già in Vercel
   - Apri 3-4 mockup in docs/mockups/ per farti un'idea visiva

3. Scrivi un report in chat:
   - Struttura cartelle principali
   - File/componenti chiave per ogni traccia (path reali)
   - Discrepanze fra docs/ e codice (normali: i doc sono stati scritti senza leggere il codebase)
   - Plan proposto: ordine PR, dipendenze, stima giorni

Non toccare codice. Aspetta OK prima di iniziare PR1.
```

### PR 1 — Safari iOS viewport-aware

```
Apri PR1 su branch v4/fix-safari-viewport.

Leggi prima docs/mockups/v4-safari-chrome-preview.html e docs/UPLOAD-ISTRUZIONI.md sezione "PR 1 — Safari iOS viewport-aware" (ha lo snippet CSS completo e i 3 confronti before/after).

Il task è piccolo: applicare viewport-fit=cover e le env(safe-area-inset-*) per far respirare l'UI dentro Safari iOS (~52px top bar + ~84px bottom tab bar).

Acceptance: il sito testato su iPhone 16 Pro Max e iPhone SE non va più sotto la URL bar né sotto la tab bar. Screenshot allegati al PR.

Branch: v4/fix-safari-viewport. Una PR sola.
```

### PR 2 — Typography Poppins

```
Apri PR2 su branch v4/typography-poppins.

Leggi docs/UPLOAD-ISTRUZIONI.md sezione "PR 2 — Typography swap: Satoshi → Poppins".

Task: sostituire OGNI riferimento a Satoshi con Poppins (Google Fonts pesi 400;500;600;700;800;900). Caveat resta per blocchi editoriali "Secondo Bi". Alfa Slab One resta per il wordmark.

NON toccare layout. Solo font-family, @font-face, link Google Fonts, e le CSS vars tipografiche.

Acceptance: nessun file del repo contiene più la stringa "Satoshi". Screenshot home + scheda confermano il nuovo font renderizzato.

Branch: v4/typography-poppins. Una PR sola.
```

### PR 3 — Compliance cleanup recensioni (Track A)

```
Apri Track A (compliance) come descritto in docs/v4-PLAN.md sezioni A1-A6.

Esegui A1 → A2 → A3 → A4 in 4 PR separate, aspettando conferma Augusto fra una e l'altra. A5 e A6 richiedono input da Augusto prima di procedere.

Non-negoziabile: non cancellare dati storici. Solo disabilitare scrittura e rimuovere UI di scrittura/caricamento. I record restano in DB in read-only.

Branch pattern: v4/track-a-audit, v4/track-a-disable-write, v4/track-a-remove-ui-write, v4/track-a-admin-cleanup.
```

### PR 4 — Design tokens v4

```
Apri PR4 su branch v4/track-b-tokens.

Leggi docs/v4-CLAUDE.md sezione "Design tokens v4" e docs/v4-PLAN.md sezione B1.

Crea/aggiorna le CSS vars (o Tailwind config — verifica cosa usa il repo):
  --ink: #22181C
  --corallo: #E8453C
  --page: #FAF7F2
  --cream: #F5F0E4
  --oro-deep: #8E6B3E

Verifica che Alfa Slab One (wordmark), Caveat (editoriale), Poppins (body) siano caricati. Rimuovi TAN Songbird se ancora presente.

Acceptance: preview locale mostra i colori v4 sulla home (anche se il layout è ancora vecchio).

Branch: v4/track-b-tokens. Una PR sola.
```

### PR 5 — Bottom nav liquid glass WebGL

```
Apri PR5 su branch v4/track-b-nav-liquid-glass.

Leggi docs/UPLOAD-ISTRUZIONI.md sezione "PR 3 — Bottom nav liquid glass WebGL" (è la più dettagliata di tutte: ha CSS, JSX con SVG inline completi di tutte e 5 le icone, init params liquidGL, TypeScript declaration).

Reference visivo: docs/mockups/v4-mobile-home.html (ha l'integrazione completa WebGL funzionante) e docs/mockups/v4-mobile-pagine.html (mostra l'active state in 5 posizioni diverse).

Punti chiave da NON sbagliare:
- Vendorizza html2canvas + liquidGL sotto /public/vendor/ — niente CDN
- Icone NERE PIENE (fill: currentColor, stroke: none). Eccezione % Sconti: stroke 2.4.
- Pin Esplora: teardrop con puntino bianco dentro (non magnifying glass)
- Icona Sconti: percent-style (2 cerchi pieni + linea diagonale, NON ticket)
- Active pill: grigio rgba(0,0,0,.05) + inset box-shadow rgba(0,0,0,.08). MAI corallo.
- Bordo nav = bordo active pill = stesso rgba(0,0,0,.08) (si "inseguono" quando Home/Profilo sono attive)
- Label sempre visibili su TUTTE e 5 le voci
- data-liquid-ignore sulla nav (esclude dallo snapshot liquidGL)

Acceptance: funziona su Chrome, Safari iOS, Firefox. Se WebGL non parte, fallback CSS visibile (nav pill trasparente). Screenshot iPhone SE + iPhone 16 Pro Max allegati al PR.

Branch: v4/track-b-nav-liquid-glass. Una PR sola.
```

### PR 6 — Reskin home

```
Apri PR6 su branch v4/track-b-home.

Reference: docs/mockups/v4-mobile-home.html (mobile) e docs/mockups/v4-desktop-home.html (desktop).

Task: applicare layout + componenti della home v4 al codice esistente. La mappa Mapbox resta (non riscriverla). I pin Esplora usano emoji categoria — NON la lettera iniziale (regola esplicita di Augusto, vedi docs/v4-CLAUDE.md).

Sezioni da coprire (guarda il mockup):
- Hero con saluto Bi
- Mappa con pin emoji
- Carousel ristoranti hero
- Blocco "Drop sconto live" (se attivo)
- Blocco "Secondo Bi" (editoriale Caveat)
- Footer

Non-negoziabili: niente recensioni, niente stelline, niente rating medio. Nomi locali in Poppins bold (NON TAN Songbird italic — deve essere già sparito dopo PR2).

Verifica vs mockup: screenshot affiancati (mockup | build) nel PR description, checklist dalla sezione "Verifica vs mockup" di v4-PLAN.md.

Branch: v4/track-b-home. Una PR sola.
```

### PR 7 — Reskin scheda locale

```
Apri PR7 su branch v4/track-b-scheda.

Reference:
- **Mobile**: docs/mockups/v4-mobile-scheda.html (intero)
- **Desktop**: docs/mockups/v4-desktop-pagine.html **righe 1115-1290** (blocco "Scheda ristorante"). NON USARE redesign-v3-desktop-scheda.html (TAN Songbird, obsoleto).

Sezioni della scheda (guarda il mockup):
- Header con nome locale in Poppins bold + categoria + distanza
- Carousel foto
- Blocco "Secondo Bi" (testo editoriale in Caveat, signature in Caveat)
- Tip in Caveat (dentro box color cream)
- Info pratiche: indirizzo, telefono, orari (orari arrivano dopo via PR11)
- CTA: "Chiama" (tel:), "Indicazioni" (maps), "Salva"
- Nessun blocco "Scrivi recensione". Nessuna stella. Nessun rating.

**Desktop (righe 1115-1290 del file pagine)**:
- Hero 520px fullwidth, nome in Poppins 900 52px dentro hero
- Sotto: 2 colonne 1.4/1 (NO mappa a destra — quella è nella pagina Esplora)
- Left: chip row, CTA "Indicazioni" beige + 2 tondi (chiama/sito), banner sconto verde 135° inline, "Secondo Bi", blocco oro "Cosa prendere", eventuale blocco video Reel/TikTok
- Right sidebar: card "Orari" (Google Places), "Ciao sono Bi" coral, carosello "Ristoranti vicini"
- Sticky pill sconto floating bottom-center (glass + blur, min-w 460 max-w 640)
- Footer con wmark "CHIAMAMI BI"

Non-negoziabili: il titolo del blocco editoriale è "Secondo Bi", MAI "Recensione" (vedi docs/v4-CLAUDE.md).

Verifica vs mockup come PR6.

Branch: v4/track-b-scheda. Una PR sola.
```

### PR 8 — Reskin pagine (Esplora / Sconti / Salvati / Profilo)

```
Apri PR8 su branch v4/track-b-pagine.

Reference:
- **Mobile**: docs/mockups/v4-mobile-pagine.html (5 phone side-by-side, copre tutti gli stati)
- **Desktop**: docs/mockups/v4-desktop-pagine.html con range precisi: Esplora righe 622-782, Sconti righe 783-935, Salvati righe 936-1012, Profilo righe 1013-1117. (La SCHEDA righe 1115-1290 NON va qui, è fatta in PR7. La HOME righe 507-621 è fatta in PR6 dal file home standalone.)

Quattro route da reskinnare:

1. /esplora — mappa fullscreen con pin teardrop categoria (emoji dentro), bottom sheet con lista locali
2. /sconti — tab "Disponibili" (drop live + statici) vs "I miei" (da utilizzare / utilizzati). Vedi docs/v4-CLAUDE.md per le regole drop vs statici.
3. /salvati — liste/cartelle custom dell'utente (es. "Cene con Chiara", "Aperitivi sola"). L'utente può creare cartelle.
4. /profilo — impostazioni account, preferenze, logout

Non-negoziabili: niente recensioni personali su /profilo. Niente rating sui salvati.

Verifica vs mockup come PR6.

Branch: v4/track-b-pagine. Una PR sola (con sotto-commit per route se preferisci).
```

### PR 9 — Reskin /verify (restyle-only)

```
Apri PR9 su branch v4/track-b-verify.

Reference: docs/mockups/v4-verify.html e docs/mockups/v4-mobile-auth.html.

ATTENZIONE: il flow PIN-auth è GIÀ IN PRODUZIONE e funziona. NON toccare:
- Logica invio PIN a Supabase
- Cookie verify_device_token
- Route /verify e relativi endpoint

Tocca SOLO:
- CSS / layout visivo
- Input 6 cifre con stile v4 (big input corallo)
- Eventuali animazioni
- Messaggi di errore in voce Bi (vedi docs/v4-email-manifesto.md per tono)

Branch: v4/track-b-verify. Una PR sola.
```

### PR 10 — Reskin admin

```
Apri PR10 su branch v4/track-b-admin.

Reference: docs/mockups/v4-mobile-admin.html (mobile) e docs/mockups/v4-desktop-admin.html (desktop).

Non-negoziabili admin:
- NIENTE font Caveat (Caveat è solo per editoriale Bi lato utente)
- Niente pill "IA premium" se presente
- Niente sezione "Moderazione recensioni" (deve essere già sparita dopo PR3 / Track A4)
- Bottom nav admin: "Segnalazioni" se conservata (errori orari/chiusura/telefono), non più "Mod"

Branch: v4/track-b-admin. Una PR sola.
```

### PR 11 — Feature: orari Google Places

```
Apri PR11 su branch v4/track-c-orari.

Leggi docs/v4-ops-google-places.md (spec completa) e docs/v4-PLAN.md sezione C1.

Task: aggiungere blocco "Aperto ora · chiude alle 23:00" (verde) / "Chiuso · apre domani alle 19:00" (grigio) sulla scheda locale.

Gate DB: CHIEDI A AUGUSTO prima di aggiungere place_id alla tabella restaurants (schema change).

Implementazione:
- Supabase edge function get-opening-hours(place_id) → cache 24-48h in DB
- UI block sulla scheda (fra nome locale e CTA)
- Edge case: locale senza place_id → non mostrare il blocco, no errore
- Env var: VITE_GOOGLE_PLACES_KEY (referrer-restricted)

Branch: v4/track-c-orari. Una PR sola.
```

### PR 12-15 — Email Resend

```
Apri Track C email come descritto in docs/v4-PLAN.md sezioni C2-C5.

Leggi docs/v4-ops-resend.md (setup) e docs/v4-email-manifesto.md (4 template + voce Bi).

PR 12 (setup): wrapper edge function, dominio chiamamibi.com già verified EU-west-1, From: Bi <ciao@chiamamibi.com>, Reply-to: info@chiamamibi.com. Template HTML base con tokens v4.

PR 13 (benvenuto ristoratore + PIN): trigger quando admin aggiunge nuovo locale. Template #1.

PR 14 (conferma suggerimento utente): trigger form "Suggerisci un locale". Template #2.

PR 15 (notifica interna Augusto): trigger su nuovo suggerimento, destinatario info@chiamamibi.com. Template #3.

4 PR separate, in sequenza, branch v4/track-c-email-{setup|benvenuto|conferma|notifica}.
```

---

## Cosa dire a Claude Code se si perde

Se Claude Code:
- **Inventa nomi di componente** → "Non inventare. Leggi il codice reale, cerca il componente con grep, chiedi se non trovi."
- **Propone di riscrivere un'area "per farla più pulita"** → "Niente refactor fuori scope. Solo il task della PR corrente."
- **Vuole aggiungere una libreria** → "No. Chiedi a Augusto prima."
- **Dice 'il mockup è sbagliato, meglio fare così'** → "Il mockup è la reference. Se diverge da un non-negoziabile (stelle, recensioni), vince il non-negoziabile. Altrimenti vince il mockup."
- **Ti chiede di approvare una modifica che tocca DB schema, RLS, Privacy Policy, env vars, deploy prod** → ferma, leggi tu la proposta, rispondi solo dopo aver capito.

---

## Files da avere nel repo PRIMA di partire

Assicurati che questi file siano committati in `docs/` (o `docs/mockups/` per gli HTML):

- [ ] `docs/HANDOFF-TO-CLAUDE-CODE.md` — questo file
- [ ] `docs/v4-CLAUDE.md`
- [ ] `docs/v4-PLAN.md`
- [ ] `docs/v4-dev-brief.md`
- [ ] `docs/v4-pre-handoff.md`
- [ ] `docs/v4-sitemap-reskin.md`
- [ ] `docs/v4-ops-google-places.md`
- [ ] `docs/v4-ops-resend.md`
- [ ] `docs/v4-email-manifesto.md`
- [ ] `docs/UPLOAD-ISTRUZIONI.md`
- [ ] `docs/mockups/*.html` (tutti i v4-*.html + redesign-v3-*.html)
- [ ] `docs/mockups/vendor/html2canvas.min.js` (solo come backup — in produzione va sotto /public/vendor/)
- [ ] `docs/mockups/vendor/liquidGL.js` (idem)

Comando rapido per uploadare tutto (se stai lavorando dalla cartella locale di Augusto):

```bash
cd ~/path/al/repo/chiamami_bi
mkdir -p docs/mockups docs/mockups/vendor
cp /path/locale/Chiamami_Bi/*.md docs/
cp /path/locale/Chiamami_Bi/*.html docs/mockups/
cp /path/locale/Chiamami_Bi/vendor/*.js docs/mockups/vendor/
git add docs/
git commit -m "v4: full handoff pack (PLAN + mockups + liquid glass vendor)"
git push
```

---

## Quando hai finito tutte le PR

Track A + Track B + Track C completi → il sito è in v4 full.

Ultimi passaggi:
1. Smoke test end-to-end su staging (iPhone SE, iPhone 16 Pro Max, desktop 1440, Safari iOS, Chrome Android)
2. Aggiorna CHANGELOG con tutte le PR chiuse
3. Deploy su prod via Vercel (approvazione Augusto)
4. Monitora errori Sentry/logs per 24h
5. Chiudi branch `claude/chiamamibi-app-xf7qn`, il default del repo resta `main`

---

*v1.0 · 21 aprile 2026 · Entry point handoff v4 per Claude Code. Se ti perdi, torna qui.*
