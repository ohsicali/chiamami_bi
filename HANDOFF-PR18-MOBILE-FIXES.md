# HANDOFF-PR18 · Mobile fixes home live

**Target:** branch nuovo `claude/mobile-fixes-home` → PR su `main`
**Scope:** 6 fix chirurgici + 1 bonus copy alla home mobile live. Nessuna nuova feature, nessuna migration DB, nessun nuovo endpoint. Solo CSS + micro-copy.
**Stima:** ~6 commit atomici, mergiabile in 1-2h Sonnet.

**Mockup canonico:** `docs/mockups/v4-mobile-home-fixes-preview.html` — before/after affiancato su viewport 430×932 iPhone Pro.

**Contesto:** dopo PR17 (home contestuale redesign, commit `8a061d6`) + PR #101 (askBiChat divider) la home mobile ha ancora 6 polish mancanti rilevati durante audit manuale. Sono tutti fix indipendenti tra loro, mergiabili separatamente se vuoi.

---

## CP1 · Discovery veloce (D1-D6)

**D1.** Home mobile attuale: qual è il nome del file componente principale? (Probabilmente `HomeFeedV4.tsx` o simile dopo PR17.) Dove vivono le sezioni: drop banner, category pills, orologio+momenti, Ultimi aggiunti, sponsor banner, chat "Chiedi a Bi", "Conosci un posto che manca", footer?

**D2.** Drop banner: attualmente è 2-col grid (testo sinistra + foto destra 150-170px). La foto lazy-load può fallire → colonna destra resta nera. File del componente? Dove viene fetchata la `cover_image_url`?

**D3.** Card row "Ultimi aggiunti": qual è il `flex-basis` attuale delle card? (Per sapere il delta verso 82%.) Snap scroll attivo?

**D4.** Ricerca CSS inconsistency padding left: grep per `padding: 0 16px` / `padding-left: 8px` / `padding-inline: 16px` nei componenti della home. Probabilmente serve uno script search/replace o un refactor dei component boundaries.

**D5.** Avatar Bi nella chat "Chiedi a Bi": attualmente quale dimensione? Dove il componente? Probabilmente in `AskBiChat.tsx` (post-PR17).

**D6.** Footer: componente condiviso? Legge i link da config o hardcoded? Styling corrente left-aligned o già centered?

Se qualcosa è bloccante (file non trovato, pattern diverso da quello atteso) → fermati e chiedi ad Augusto.

---

## CP2 · Implementation (6 fix + bonus)

### Fix 0.1 · Drop banner · foto fallback + countdown pill

**Problema attuale:** grid 2-col. Se foto non carica, colonna destra nera. Countdown ("0/10 · scadrà 30 apr") è sovrapposto alla foto e si taglia.

**Fix:**
- Cambia layout da grid 2-col a **stack verticale** (foto sopra 156px, body sotto).
- Foto fallback: se `cover_image_url` è `null` o img `onerror`, applica gradient `linear-gradient(135deg, #C48745, #3C2312)` (brand brown).
- Label "Drop live" in alto-sinistra della foto: pill scura con backdrop-blur, dot pulsante bianco animato.
- **Countdown** → pill in alto-destra della foto (`padding: 6px 11px`, `background: rgba(255,255,255,.15)`, `backdrop-filter: blur(10px)`), testo formattato `0 / 10 · 2g 14h`.
- Categoria in basso-sinistra della foto: `🥩 Barbecue · San Salvario` (emoji categoria da DB).
- Body sotto: `-20%` Poppins 900 42px, "da Al Brasà" Poppins 900 24px opacity .95, indirizzo + condizioni + **progress bar visiva** (riscatti/posti totali) + 2 CTA (Vai al drop ink + Scopri outline).

Vedi `v4-mobile-home-fixes-preview.html` riga ~520 per HTML/CSS di riferimento.

**Commit:** `fix(home): drop banner foto fallback + countdown pill + progress bar`

### Fix 0.2 · Ultimi aggiunti · peek 2ª card

**Problema:** card con `flex-basis: ~95%` → seconda card completamente tagliata.

**Fix:**
- Cambia `flex: 0 0 82%` sulle `.rc` nella row "Ultimi aggiunti" → peek del 18% della seconda card.
- Aggiungi `scroll-snap-type: x mandatory` sul container row e `scroll-snap-align: start` sulle card.
- Padding row `0 20px 16px` (sinistra uniformato a 20px).

**Commit:** `fix(home): ultimi aggiunti peek 2nd card + scroll snap`

### Fix 0.3 · Padding sinistro uniformato a 20px

**Problema:** inconsistenza padding left tra sezioni (alcune a 8px, altre 16px, altre 20px).

**Fix:**
- Audit dei componenti della home → imposta baseline **`padding: 0 20px`** su tutti i section header, first-element delle righe scroll, e wrapper di blocchi.
- Eccezione: content dentro card che hanno padding interno proprio (es. sponsor card body) mantengono il loro interno.
- Se possibile, estrai una CSS variable `--home-gutter: 20px` in tema globale.

**Commit:** `fix(home): uniforma padding orizzontale a 20px`

### Fix 0.4 · Category pills · bubble +8px + fade gradient

**Problema:** bubble 50px, gap 6px, nessun hint di scroll → pill strette e sembrano tutto quello che c'è.

**Fix:**
- Bubble emoji da 50px a **58px**, `font-size: 26px`.
- Gap da 6px a **10px**.
- Padding row `6px 20px 20px`.
- Wrapper `.cats-wrap` con `::after` pseudo `position: absolute; right: 0; width: 48px; background: linear-gradient(90deg, transparent, var(--page) 90%); pointer-events: none` → fade gradient a destra.
- Label font-size 11px Poppins 700.

**Commit:** `fix(home): category pills bubble 58px + fade gradient hint scroll`

### Fix 0.5 · Chat "Chiedi a Bi" · card arricchita

**Problema:** avatar Bi 38px, textarea bassa 56px, chip minimal, CTA piccolo → sembra un footer form invece che un protagonista.

**Fix:**
- Avatar Bi da 38px a **48px**, `background: linear-gradient(135deg, var(--corallo), var(--corallo-ink))`, `box-shadow: 0 6px 16px rgba(232,69,60,.35)`.
- Aggiungi **spark oro** animato: dentro `.ai-bi-av`, `<span class="spark">` con `position: absolute; top: 3px; right: 3px; width: 10px; height: 10px; background: var(--oro); border-radius: 50%; border: 2px solid #fff`.
- Card wrapper con glow radiale: `.ai-card::before { top: -60px; right: -60px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(232,69,60,.1), transparent 60%); border-radius: 50% }` + `.ai-card::after` simile in bottom-left con oro soft.
- Textarea min-height da ~56px a **80px**, `background: var(--cream)`, `border: 1px solid var(--ink-15)`, padding 14px 16px.
- Chip suggeriti: `padding: 7px 12px`, `background: var(--corallo-wash)`, `color: var(--corallo-ink)`, `border: 1px solid rgba(232,69,60,.18)`, font-size 11px Poppins 700.
- CTA submit "Chiedi a Bi": `padding: 11px 18px`, `background: var(--ink)`, font-size 13px Poppins 800, `box-shadow: 0 6px 14px rgba(34,24,28,.2)`.

**Commit:** `fix(home): chiedi a bi card arricchita (avatar 48px + spark + glow + textarea)`

### Fix 0.6 · Footer · centrato + respiro

**Problema:** wordmark Poppins 20px top-left schiacciato, links left-aligned, zero respiro.

**Fix:**
- Wordmark "LA GUIDA DI BI" → **Alfa Slab One 28px centrato**, `color: var(--ink)`, `letter-spacing: .01em`.
- Sottotitolo "BY CHIAMAMI BI" sotto: font-size 10px Poppins 700 `letter-spacing: .2em` uppercase, `color: var(--ink-40)`, margin-top 4px.
- Links (Su di me, Come scelgo, Per i locali, Privacy, Termini): flex center, gap 14px, font-size 12px Poppins 700, `color: var(--ink-70)`, nessuna underline.
- Copyright "© 2026 Chiamami Bi · Torino, Italia" → centrato, font-size 11px `color: var(--ink-40)`.
- Padding footer: `30px 20px 100px` (100 bottom per non nascondere dietro nav liquid glass).
- `text-align: center` sul wrapper.

**Commit:** `fix(home): footer centrato + wordmark Alfa Slab One 28px + respiro`

### Bonus · "Scrivici" → "Scrivimi"

Nel block "Conosci un posto che manca?" (component probabilmente `SuggestCallout.tsx` o simile), il sottotitolo attuale dice **"Scrivici nome + zona"**. Cambia a **"Scrivimi nome + zona. Se è buono, entra."**

Motivazione: tutta la home è voce Bi prima persona (vedi `docs/v4-email-manifesto.md`). "Scrivici" è plurale-team → inconsistente con la voce.

**Commit:** `fix(home): copy suggerisci block (scrivici → scrivimi) per voce Bi`

---

## CP3 · QA checklist

Testa su viewport mobile (iPhone 14 Pro in DevTools, 390×844, o iPhone 15 Pro, 430×932):

- [ ] Drop banner: foto carica correttamente OR mostra fallback gradient OR immagine broken → mai rettangolo nero vuoto
- [ ] Countdown leggibile in tutti i casi (pill in alto-destra della foto)
- [ ] Progress bar visiva nel body del drop banner
- [ ] Ultimi aggiunti: si vede peek della 2ª card a destra
- [ ] Scroll fluido con snap
- [ ] Padding left: misura con righello DevTools → tutti i blocchi a 20px dal bordo viewport
- [ ] Category pills: fade gradient visibile a destra, bubble 58px
- [ ] Chat Chiedi a Bi: avatar 48px con spark oro, glow corallo/oro nella card, textarea alta
- [ ] Footer: wordmark Alfa Slab One grande centrato, links in riga centrata
- [ ] "Conosci un posto che manca?": copy "Scrivimi" (non "Scrivici")
- [ ] Deploy Vercel preview verde
- [ ] Nessuna regressione visiva desktop

---

## Vincoli

- **Nessuna nuova /api/\*.js** — siamo al cap Hobby 12
- **Nessuna migration DB** — tutto frontend
- **Voce Bi prima persona** rispettata nel copy fix
- **Tokens v4** — Poppins + Alfa Slab One + corallo + ink (`docs/EMAIL-FLOWS.md` è unrelated, ma stesso tokens reference)

---

## Prompt da dare a Claude Code

```
Leggi HANDOFF-PR18-MOBILE-FIXES.md nella root + il mockup canonico
docs/mockups/v4-mobile-home-fixes-preview.html (side-by-side before/after).

Esegui CP1 Discovery (D1-D6) poi procedi con i 6 fix + bonus copy.
Ogni fix è un commit atomico e indipendente.
Modello: Sonnet (è tutto CSS + micro-copy, niente architettura).

Target viewport di verifica: 390×844 iPhone 14 Pro + 430×932 iPhone 15 Pro.
Nessuna migration DB, nessun endpoint nuovo, nessuna dipendenza aggiunta.
Deploy preview verde prima del merge.
```

---

*v1.0 · 24 aprile 2026 · Mobile polish pass post-PR17.*
