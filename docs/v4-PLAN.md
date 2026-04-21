# v4 — PLAN operativo per Claude Code

> Questo è il file che ti tiene in carreggiata. Non sostituisce `v4-CLAUDE.md` (contratto) né `v4-dev-brief.md` (scope). È il **playbook step-by-step**: cosa fare, in che ordine, quando fermarti.

---

## Come usare questo file

1. Leggi **prima** `docs/v4-CLAUDE.md` (contratto). Poi `docs/v4-pre-handoff.md` (mappa). Poi torna qui.
2. Esegui i task **nell'ordine indicato**, uno alla volta.
3. **Dopo ogni task** scrivi a Augusto: cosa hai fatto, link al PR, checklist done. Aspetta conferma prima del prossimo.
4. Se trovi qualcosa che non torna fra i doc e il codice reale → **vince il codice reale**, ma scrivi a Augusto cosa hai trovato di diverso.
5. I doc nei `docs/v4-*.md` sono stati scritti **senza leggere il codebase**. Aspettati discrepanze (nomi componenti, path, env vars). Non inventare: cerca, leggi, chiedi.

---

## Regole STOP (non negoziabili — se le violi, rollback)

- ❌ Nessuna recensione utente, stellina, rating medio. Da nessuna parte.
- ❌ No email+password ristoratore. Solo PIN-only su `/verify`.
- ❌ No `noi` / `il team` / `Gentile` / `Cordiali saluti`. Voce Bi prima persona singolare.
- ❌ No font Caveat fuori dai blocchi editoriali. Mai in nav, bottoni, form, admin.
- ❌ No TAN Songbird. Nomi locali in Poppins bold.
- ❌ Non cancellare dati storici (recensioni vecchie, utenti). Solo disabilitare scrittura/lettura.
- ❌ No nuove librerie senza chiedere a Augusto.
- ❌ No commit su `main` o sul branch attivo `claude/chiamamibi-app-xf7qn` direttamente. Solo PR.
- ❌ No deploy production senza approvazione esplicita.
- ❌ **Non inventare layout, spaziature, colori, tipografia.** I mockup in `docs/mockups/` sono la **source of truth visiva**. Se devi deviare, chiedi prima.
- ❌ Non chiudere un task di reskin senza aver fatto il **confronto mockup vs implementazione** (vedi sezione "Verifica vs mockup").

---

## Gates (devi fermarti e chiedere a Augusto prima di...)

- 🚦 Modificare schema DB Supabase (CREATE/ALTER/DROP table o column)
- 🚦 Modificare RLS Supabase
- 🚦 Modificare Privacy Policy o Termini
- 🚦 Aggiungere/rimuovere env vars
- 🚦 Cambiare struttura cartelle `src/`
- 🚦 Aggiungere dipendenze npm
- 🚦 Toccare il flow PIN-auth esistente (è già in prod, funziona)
- 🚦 Deploy o promozione su `main`

---

## STEP 0 — Discovery (obbligatorio, prima di proporre il plan)

**Obiettivo:** capire cosa c'è davvero nel repo, non quello che immagini.

Esegui in ordine:

1. `git log --oneline -20` — capisci storia recente
2. `ls src/` e `ls src/**/` — mappa struttura
3. Trova i punti d'ingresso delle 3 tracce:
   - **Track A:** cerca componenti recensioni → `grep -ri "recensione\|review\|rating\|stelle" src/`
   - **Track B:** cerca dove sono usate font + colori attuali → `grep -ri "TAN Songbird\|Caveat\|var(--" src/`
   - **Track C:** cerca scheda locale → `grep -ri "RestaurantDetail\|SchedaLocale\|place_id" src/`
4. Verifica env vars in Vercel: chiedi a Augusto quali sono già impostate (lista nel `v4-dev-brief.md` ma da confermare)
5. Apri 3-4 mockup in `docs/mockups/` per capire la direzione visiva

**Output Step 0:** scrivi a Augusto un messaggio così:
- Branch su cui lavori
- Struttura cartelle principali (3 righe)
- File/componenti chiave per ogni traccia (path reali trovati)
- Discrepanze fra doc e codice (se ce ne sono)
- Plan proposto con ordine e dipendenze
- Stima in giorni per ogni task

**Aspetta conferma prima di toccare codice.**

---

## TRACK A — Compliance & cleanup (P0, blocca legalmente)

> Obiettivo: il sito non deve più accettare né mostrare recensioni utente / foto utenti, e la Privacy Policy deve riflettere questo.

### A1 — Audit punti d'ingresso recensioni
- Trova nel codice: form scrittura recensioni, bottoni "scrivi recensione", upload foto, route API che li serve
- **Output:** mappa scritta in PR description (file + linee)
- **Done quando:** Augusto conferma la mappa è completa
- **Branch:** `v4/track-a-audit`

### A2 — Disabilitare scrittura recensioni a livello backend
- Disabilita endpoint API + RLS Supabase per scrittura `reviews`/`photos` (o come si chiamano)
- **NON** droppare tabelle, **NON** cancellare dati. Solo `revoke insert/update`.
- **Gate:** chiedi a Augusto prima di toccare RLS
- **Done quando:** test con utente loggato → POST recensione fallisce con 403/permission denied
- **Branch:** `v4/track-a-disable-write`

### A3 — Rimuovere UI recensioni utente
- Form recensione, bottone "scrivi recensione", upload foto, sezione "le tue recensioni" su profilo
- **NON** rimuovere visualizzazione recensioni storiche (vedi A5)
- **Done quando:** nessun entry point UI per scrivere/caricare
- **Branch:** `v4/track-a-remove-ui-write`

### A4 — Pulire admin
- Rimuovere sezione "Moderazione recensioni"
- Bottom-nav admin: rimuovere "Mod" o sostituire con "Segnalazioni" (errori orari/chiusura/telefono)
- Rimuovere pill "IA premium" se presente
- Niente font Caveat in admin
- **Branch:** `v4/track-a-admin-cleanup`

### A5 — Decisione lettura recensioni storiche
- **CHIEDI a Augusto:** vogliamo nascondere anche la VISUALIZZAZIONE delle recensioni storiche, o lasciarle visibili (read-only) finché non si decide?
- Se nascondi: feature flag `SHOW_LEGACY_REVIEWS=false`, default off
- **Gate:** decisione di Augusto prima di procedere

### A6 — Privacy Policy
- Identifica file Privacy Policy nel repo (probabile route `/privacy`)
- Proponi diff: rimuovere paragrafi su "recensioni utente" e "foto caricate dagli utenti"
- **NON** modificare direttamente. Mostra diff a Augusto, aspetta approvazione testo finale.
- **Branch:** `v4/track-a-privacy` (commit solo dopo OK testo)

**Track A done quando:** A1-A6 chiusi, PR mergiate, Augusto conferma su prod che le recensioni non si possono più scrivere.

---

## TRACK B — Reskin v4 (P1 visuale)

> Obiettivo: applicare design v4 al sito live. Mockup in `docs/mockups/` sono reference, non codice da portare 1:1.

### B1 — Setup design tokens
- Crea/aggiorna CSS vars (o Tailwind config, o file theme — verifica cosa usa già il repo):
  ```css
  --ink: #22181C;
  --corallo: #E8453C;
  --page: #FAF7F2;
  --cream: #F5F0E4;
  --oro-deep: #8E6B3E;
  ```
- Verifica font caricati: Alfa Slab One (wordmark), Caveat (editoriale), Poppins (body)
- **Rimuovi** TAN Songbird se ancora caricato
- **Done quando:** preview locale mostra colori v4 sulla home, anche se layout vecchio
- **Branch:** `v4/track-b-tokens`

### B2 — Wordmark + nav + footer
- Aggiorna wordmark con corallo
- Nav coerente con mockup `v4-index.html` / `v4-mobile-home.html`
- Footer con `--oro-deep`
- **Branch:** `v4/track-b-chrome`

### B3 — Reskin home (mobile + desktop)
- Reference: `docs/mockups/v4-mobile-home.html`, `docs/mockups/v4-desktop-home.html`
- Mappa + cards esplora
- Nomi locali in **Poppins bold** (non TAN Songbird italic)
- Pin esplora con emoji categoria (come live, non lettera)
- Sconti drop + statici (disponibili vs i miei) — vedi `v4-mobile-home.html`
- **Done quando:** home in dev branch combacia visivamente al mockup (margine 5%)
- **Branch:** `v4/track-b-home`

### B4 — Reskin scheda locale (mobile + desktop)
- Reference: `docs/mockups/v4-mobile-scheda.html`, `docs/mockups/v4-desktop-scheda.html` (se esiste, altrimenti deriva da mobile)
- Blocco editoriale "Secondo Bi" in Caveat (NON "Recensione")
- Niente stelline, niente rating
- Tip in Caveat, signature in Caveat
- **Branch:** `v4/track-b-scheda`

### B5 — Reskin pagine utente
- Reference: `docs/mockups/v4-mobile-pagine.html`, `docs/mockups/v4-desktop-pagine.html`
- Esplora, Sconti, Salvati, Profilo
- **Branch:** `v4/track-b-pagine`

### B6 — Reskin /verify (solo restyle)
- Reference: `docs/mockups/v4-verify.html`, `docs/mockups/v4-mobile-auth.html`
- **NON toccare** la logica PIN-auth — funziona, è in prod
- Solo CSS / componenti visivi
- **Branch:** `v4/track-b-verify`

### B7 — Reskin admin
- Reference: `docs/mockups/v4-mobile-admin.html`, `docs/mockups/v4-desktop-admin.html`
- Niente Caveat
- Layout pulito post-cleanup A4
- **Branch:** `v4/track-b-admin`

**Track B done quando:** B1-B7 mergiate, screenshot mobile + desktop di ogni schermata in PR description, **confronto mockup vs build allegato al PR (vedi sezione sotto)**, Augusto approva visualmente.

---

## Verifica vs mockup (obbligatoria prima di chiudere ogni task B)

> I mockup sono in `docs/mockups/v4-*.html`. Sono **la reference visiva**. Se quello che hai implementato non gli assomiglia, hai sbagliato, non avevi "un'idea migliore".

Per **ogni** PR della Track B devi fare:

1. **Apri il mockup di riferimento** in browser (es. `docs/mockups/v4-mobile-home.html`)
2. **Apri la build locale** nella stessa viewport (mobile: 390×844; desktop: 1440×900)
3. **Screenshot affiancati** (mockup | build) — mettili nel PR description
4. **Checklist di confronto**, per ogni elemento principale della schermata:
   - [ ] Palette colori (ink, corallo, page, cream, oro-deep) — matcha?
   - [ ] Font family (Alfa Slab per wordmark, Poppins per body + nomi locali, Caveat **solo** blocchi editoriali) — matcha?
   - [ ] Gerarchia tipografica (size, weight, line-height) — matcha?
   - [ ] Spaziature (padding, gap, margin) — matcha entro ~4px?
   - [ ] Componenti presenti (pin, card, pill, drop sconto, blocco "Secondo Bi", ecc.) — ci sono tutti?
   - [ ] Componenti assenti (stelline, rating, "scrivi recensione", Caveat in nav/admin) — sono davvero assenti?
   - [ ] Stati (hover, active, disabled) coerenti con brand v4
   - [ ] Responsive: breakpoint mobile↔desktop gestito come nei due mockup
5. **Se qualcosa diverge dal mockup:**
   - Se è una **scelta** tua → rollback e allinea al mockup, **oppure** scrivi ad Augusto spiegando _perché_ hai deviato e aspetta OK
   - Se è un **bug** del mockup (es. mockup mostra stelline → viola regola STOP) → vince la regola STOP, scrivi nel PR che hai deviato dal mockup e perché
6. **Non mergire** senza questa checklist visibile nel PR.

**Regola d'oro:** se ti viene voglia di "migliorare" il design mentre implementi, **fermati**. Il design v4 è già stato approvato. Il tuo lavoro è portarlo fedele, non ridisegnarlo.

---

## TRACK C — Feature nuove (P1/P2)

### C1 — Orari Google Places (P1)
- **Gate DB:** chiedi a Augusto prima di aggiungere `place_id` a tabella `restaurants` (schema change)
- Crea Supabase edge function `get-opening-hours(place_id)` che chiama Google Places API
- Cache 24-48h nel DB per evitare rate limit
- UI block sulla scheda: "Aperto ora · chiude alle 23:00" (verde) / "Chiuso · apre domani alle 19:00" (grigio)
- Edge case: locali senza `place_id` → non mostrare il blocco (no errore)
- Env var: `VITE_GOOGLE_PLACES_KEY` (referrer-restricted, safe nel bundle)
- **Branch:** `v4/track-c-orari`

### C2 — Email Resend setup
- Verifica `RESEND_API_KEY` in Vercel (server-side, NON `VITE_`)
- Crea wrapper edge function o API route per inviare email
- Template HTML base con tokens v4, max-width 560px
- From: `Bi <ciao@chiamamibi.com>`, Reply-to: `info@chiamamibi.com`
- Reference voce + template: `docs/v4-email-manifesto.md`
- **Branch:** `v4/track-c-email-setup`

### C3 — Email "Benvenuto ristoratore + PIN"
- Trigger: admin aggiunge nuovo locale + genera PIN
- Template: `v4-email-manifesto.md` template #1
- **Branch:** `v4/track-c-email-benvenuto`

### C4 — Email "Conferma suggerimento utente"
- Trigger: form "Suggerisci un locale" submitted
- Template: `v4-email-manifesto.md` template #2
- **Branch:** `v4/track-c-email-conferma`

### C5 — Email "Notifica interna ad Augusto"
- Trigger: nuovo suggerimento, destinatario `info@chiamamibi.com`
- Template: `v4-email-manifesto.md` template #3
- **Branch:** `v4/track-c-email-notifica`

### C6 — Newsletter (P2 — solo dopo OK Augusto)
- Double opt-in form sul sito
- Gestita via Resend Broadcasts
- **Gate:** chiedi a Augusto prima di iniziare. Bassa priorità.

**Track C done quando:** C1-C5 mergiate e funzionanti su staging. C6 opzionale.

---

## Convenzioni di lavoro

### Branch naming
- `v4/track-a-{nome}`, `v4/track-b-{nome}`, `v4/track-c-{nome}`
- Branch da `claude/chiamamibi-app-xf7qn` (è il branch attivo, NON il default del repo)

### PR
- Una PR per task. Mai un mega-PR.
- Titolo: `track-X: descrizione breve`
- Body: cosa fatto, file toccati, screenshot (se UI), checklist done criteria
- Linka il task ID di questo file (es. "Closes A2")

### Commit
- Messaggi in italiano o inglese, basta che siano chiari
- Niente emoji nei commit
- Niente `Co-Authored-By: Claude` (Augusto preferisce commit puliti)

### Quando ti blocchi
- Se manca un'info, **chiedi a Augusto** prima di assumere
- Se trovi codice legacy che non capisci, **non riscrivere** — chiedi
- Se un mockup confligge con un non-negoziabile (es. mostra stelle), **vince il non-negoziabile**

---

## Ordine consigliato (se non sai da dove iniziare)

1. **Step 0 (Discovery)** — sempre prima
2. **Track A1, A2, A3, A4** — compliance prima di tutto
3. **Track B1 (tokens)** — sblocca tutto il reskin
4. **Track A5, A6** — chiusura compliance dopo decisioni Augusto
5. **Track B2-B7** — reskin schermata per schermata, in ordine di traffico (home > scheda > pagine > verify > admin)
6. **Track C1 (orari)** — feature più visibile
7. **Track C2-C5 (email)** — pacchetto coerente
8. **Track C6 (newsletter)** — solo se Augusto conferma

Track A e B sono **largamente indipendenti** — se vuoi parallelizzare, fai A su un branch e B1 (tokens) su un altro.

---

## Quando hai dubbi

Se ti accorgi che stai per fare una di queste cose, **fermati e chiedi a Augusto**:
- Inventare un nome di componente/file che non hai verificato esistesse
- Riscrivere da zero un'area "perché è più pulita"
- Aggiungere una libreria nuova
- Cambiare l'architettura di stato (Redux, Context, ecc.)
- Refactor opportunistici fuori scope dal task corrente
- Toccare i test esistenti per "farli passare" senza capire perché falliscono
- Modificare CI/CD, GitHub Actions, vercel.json
- Discostarti dal mockup per una "tua idea migliore" (stop: se non è nel mockup e non è un non-negoziabile, non va nel codice senza OK)

---

*v1.0 · 20 aprile 2026 · Questo file vive in `docs/v4-PLAN.md`. Aggiornalo quando una traccia chiude.*
