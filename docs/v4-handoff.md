# Chiamami Bi — v4 Handoff

**Per lo sviluppo.** Doc unico di riferimento per costruire chiamamibi.com v4 partendo dai mockup HTML.

- **Cliente:** Augusto · "La Guida di Bi"
- **Target:** Torino — curatela ristoranti + sconti ristoratori convenzionati
- **Direzione:** reskin Neotaste-aligned (sottrazione, coerenza brand, meno chrome)
- **Data:** 2026-04-19 · v1.0

---

## 1. File inventory

Tutti i mockup stanno in `/Chiamami_Bi/`. 9 file HTML + 1 sitemap. Tutti autosufficienti (CSS inline, font da CDN).

| File | Cosa contiene | Schermi | Viewport |
|---|---|---|---|
| `v4-index.html` | Hub navigabile · principi · link a tutti i file | — | responsive |
| `v4-mobile-home.html` | Home feed — hero ristorante + carousel + mappa + CTA | 1 | 390×844 |
| `v4-mobile-pagine.html` | Esplora · Sconti · Salvati · Profilo | 4 | 390×844 |
| `v4-mobile-scheda.html` | Scheda locale mobile + scheda con sconto (sticky) | 2 | 390×844 |
| `v4-mobile-auth.html` | Login · Signup · Suggerisci un locale | 3 | 390×844 |
| `v4-mobile-admin.html` | Admin Augusto mobile — dashboard · edit scheda | 2 | 390×844 |
| `v4-desktop-home.html` | Home desktop con hero + carousel | 1 | 1440×900 |
| `v4-desktop-pagine.html` | Esplora · Sconti · Salvati · Profilo · Scheda (con sticky) | 6 | 1440×900 |
| `v4-desktop-admin.html` | Admin Augusto desktop | 3 | 1440×900 |
| `v4-verify.html` | Area ristoratori — login PIN + dashboard redemption | 2 | responsive |
| `v4-sitemap-reskin.md` | Mappa route → file → note | — | — |

**Totale: 9 HTML · 23 schermi · 1 sitemap · 1 handoff.**

---

## 2. Design tokens canonici

CSS custom properties. **Non inventare hex nuovi.** Se serve una variante, usa `color-mix()` o derivati dai token.

```css
:root{
  /* Brand */
  --ink:            #22181C;   /* testo principale, wordmark */
  --ink-70:         rgba(34,24,28,.7);
  --ink-55:         rgba(34,24,28,.55);
  --ink-15:         rgba(34,24,28,.15);
  --ink-05:         rgba(34,24,28,.06);

  --corallo:        #E8453C;   /* CTA principale, hero, drop sconto */
  --corallo-soft:   #F6B7B1;
  --corallo-ink:    #C53A33;

  --oro:            #B08954;   /* accento editoriale "Cosa prendere" */
  --oro-deep:       #8E6B3E;

  /* Superfici */
  --page:           #FAF7F2;   /* background */
  --cream:          #F5F0E4;
  --cream-deep:     #F1EBE0;
  --line:           #EAE3D7;

  /* Verde sconto (unico token grafico non-brand, usato solo per sconti) */
  --green-a:        #A3E635;
  --green-b:        #4ADE80;
  --green-grad:     linear-gradient(135deg,#A3E635,#4ADE80);
}
```

### Regole d'uso
- **Corallo** → hero, primary CTA, drop carousel sconti. Mai diffuso.
- **Verde 135°** → solo sconti (banner, pill, dot). Mai altro.
- **Oro** → solo blocco editoriale "Cosa prendere". Mai bottoni.
- **Cream/page** → background. Cream-deep è l'alternanza delle sezioni.
- **Ink** → testo base. Mai grigio puro (`#888` etc.). Usa alpha su `--ink`.

---

## 3. Typography

### Font stack
```css
/* UI, nomi locali, body */
font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Wordmark + PIN digits solo */
font-family: 'Alfa Slab One', serif;

/* Editorial (tip, quote, signature) solo */
font-family: 'Caveat', cursive;
```

### Pesi Poppins
- **500** — micro-labels, chip, footer secondario
- **700** — body, metadati
- **800** — subtitles, CTA
- **900** — nomi locali, H1, hero title

### Scale tipografica
| Elemento | Desktop | Mobile |
|---|---|---|
| Hero title (nome locale) | 68px / -.035em | 44px / -.03em |
| H1 scheda | 52px / -.03em | 34px / -.025em |
| H2 sezione | 26px | 20px |
| Body | 15px | 14.5px |
| Chip / metadata | 12px / .04em uppercase | 11.5px |
| Micro | 10.5px / .06em | 10px |

### Regole hard
1. **Alfa Slab One** → SOLO wordmark "CHIAMAMI BI" e le 6 cifre del PIN. **Mai** titoli.
2. **Caveat** → SOLO nei blocchi editoriali: tip "Cosa prendere", signature "Bi", quote dentro "Secondo Bi". **Mai** in chrome (nav, button, label).
3. **TAN Songbird** (italic decorativo) → **RIMOSSO completamente**. Se lo vedi in qualche file è un bug.
4. Nomi locali **sempre** Poppins 800/900 ultra-tight, mai corsivi.

---

## 4. Component patterns (riusabili)

### 4.1 Glass nav pill (mobile bottom + desktop top)
```css
.nav-pill{
  position:fixed;  /* mobile: bottom; desktop: top */
  background:rgba(255,255,255,.72);
  backdrop-filter:saturate(140%) blur(22px);
  border:1px solid var(--ink-05);
  border-radius:999px;
  box-shadow:0 10px 40px rgba(34,24,28,.08),
             0 2px 6px rgba(34,24,28,.04);
}
```
- Mobile: 5 tab (Home · Esplora · Sconti · Salvati · Profilo) — icona + label 10.5px
- Desktop: logo sx, tab centrali, search/città/avatar dx
- Tab attiva: icona corallo + label bold + indicator dot 3px corallo

### 4.2 Hero ristorante (home + scheda)
```html
<div class="hero">
  <img class="cover" src="..." alt="" />
  <div class="overlay">
    <span class="chip-new">NUOVO</span> <!-- opzionale, con blink -->
    <h1 class="name">Consorzio</h1>
    <div class="meta">Piemontese · $$ · Centro</div>
    <div class="cta-row">
      <a class="cta-primary">Prenota</a>
      <a class="cta-ghost">Indicazioni</a>
    </div>
  </div>
</div>
```
- `.cover` 520px desktop / 420px mobile
- `.name` Poppins 900 ultra-tight
- `.chip-new` glass bianca con puntino corallo pulsante

### 4.3 Sticky pill sconto (mobile scheda + desktop scheda)
Il pattern canonico quando la scheda ha uno sconto attivo. **Floating bottom-center, glass.**
```css
.sticky-disc{
  position:absolute;  /* child di .screen flex-column */
  left:50%;bottom:22px;transform:translateX(-50%);
  z-index:12;
  min-width:460px;max-width:640px;  /* desktop */
  background:rgba(250,247,242,.9);
  backdrop-filter:saturate(140%) blur(14px);
  border:1px solid var(--ink-05);
  border-radius:999px;
  padding:8px 10px 8px 22px;
  display:flex;align-items:center;gap:18px;
  box-shadow:0 10px 40px rgba(34,24,28,.14),
             0 2px 8px rgba(34,24,28,.06);
}
.sticky-disc .dot{
  width:9px;height:9px;border-radius:50%;
  background:var(--green-grad);
  box-shadow:0 0 0 3px rgba(163,230,53,.18);
}
.sticky-disc .cta{
  background:var(--ink);color:#fff;
  height:42px;padding:0 20px;border-radius:999px;
  font-weight:800;
}
```
Mobile: full-width con `env(safe-area-inset-bottom)` per iOS. Padding del contenuto scroll ≥ 110px per non essere coperto.

### 4.4 Card Esplora (lista sx desktop · card mobile)
```css
.lcard{
  display:grid;grid-template-columns:118px 1fr;gap:14px;
  padding:12px;background:#fff;
  border:1px solid var(--ink-05);border-radius:16px;
  cursor:pointer;position:relative;
  transition:transform .18s, box-shadow .2s, border-color .18s;
}
.lcard:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(34,24,28,.07)}
.lcard.active{
  border-color:var(--corallo);
  box-shadow:0 0 0 3px rgba(232,69,60,.12),0 10px 22px rgba(34,24,28,.07);
}
.lcard .heart-overlay{
  position:absolute;top:6px;right:6px;
  width:30px;height:30px;border-radius:50%;
  background:rgba(255,255,255,.94);
  backdrop-filter:saturate(140%) blur(6px);
}
```
Struttura: foto 118×118 sx · cuore overlay glass top-right · tags row (categoria + prezzo + distanza con SVG pin) · nome Poppins 800 · indirizzo con SVG.

### 4.5 Blocco editoriale "Secondo Bi"
```html
<section class="editorial">
  <h2 class="eyebrow">SECONDO BI</h2>
  <div class="body">
    <p>Testo curato in Poppins 700, 16px, line-height 1.6...</p>
    <p class="tip">
      <span class="cav">Prova gli agnolotti del plin, sono la specialità della casa.</span>
      <span class="sig">— Bi</span>
    </p>
  </div>
</section>
```
- **Eyebrow** "SECONDO BI" (mai "Recensione di Bi" o "La mia recensione")
- **Body** sempre Poppins
- `.cav` e `.sig` **solo** in Caveat

### 4.6 Blocco oro "Cosa prendere"
```css
.cosa-prendere{
  background:linear-gradient(180deg,#FAF3E4,#F5EBD6);
  border:1px solid rgba(176,137,84,.25);
  border-radius:18px;padding:22px;
}
.cosa-prendere h3{color:var(--oro-deep);font-weight:900}
.cosa-prendere .tip{font-family:'Caveat';font-size:20px;color:var(--oro-deep)}
```

### 4.7 Banner sconto verde 135°
```css
.disc-banner{
  background:var(--green-grad);
  color:var(--ink);
  border-radius:14px;padding:16px 20px;
  font-weight:900;
}
```

### 4.8 Pin mappa per categoria
Cerchi colorati + emoji categoria all'interno. **No drop/goccia, no lettera Neotaste.**
- Piemontese · 🍷 corallo
- Pizza · 🍕 oro
- Asiatico · 🍜 verde
- Dolce · 🍰 rosa
- Aperitivo · 🥂 blu
- Default · 🍽️ ink

Cluster: cerchi bianchi bordati con numero al centro.

---

## 5. Regole hard (non violare mai)

### 5.1 Auth — PIN-only
- **Utente user:** no account, no login. Naviga liberamente, salva in localStorage.
- **Ristoratore:** login con **solo PIN 6 cifre** assegnato manualmente da Augusto. No email + password, no signup, no reset-via-email.
  - PIN renderizzato in **Alfa Slab One** 44px con 6 box individuali
  - 5 tentativi, poi lockout 10min
  - PIN case-insensitive (solo numeri)
- **Admin (Augusto):** login separato `admin.chiamamibi.com` con 2FA (TBD, fuori da v4).

### 5.2 No recensioni, no stelle
- **Mai** rating utente (no 4.5★, no "87% consigliano", no "12 recensioni").
- **Mai** stelle visualizzate da nessuna parte, inclusi Google/Tripadvisor embed.
- La selezione di Augusto **è** il giudizio. "Tutti validi perché li ha scelti Bi."
- Se serve autorità: chip "NUOVO", "TOP DI BI", "PICK DELLA SETTIMANA" (curati, non calcolati).

### 5.3 Naming editoriale
- Blocco recensione → **"Secondo Bi"** (MAI "Recensione di Bi")
- Tip cibo → **"Cosa prendere"** (MAI "Consigli")
- Vicini → **"Ristoranti vicini"** (MAI "Potrebbe piacerti")
- Suggerisci → **"Suggerisci un locale"** (MAI "Aggiungi")

### 5.4 Caveat (handwriting) — usage
Caveat vive **solo** in 8 punti editoriali:
1. Tip "Cosa prendere" nel blocco oro
2. Signature "— Bi" sotto Secondo Bi
3. Quote inline dentro Secondo Bi (opzionale)
4. Nota sulla lista salvati (post-it)
5. Signature login screen "Bi"
6. Welcome admin "Ciao Augusto"
7. Tagline hero index "la guida vera di Torino"
8. Footer index "fatta con cura"

**MAI** in: nav, CTA, button, chip, label form, email, microcopy errori.

### 5.5 Sconti — drop vs statici
- **Drop carousel** (top Sconti): card corallo bordata con progress "X su Y sbloccati" + countdown. Evento a tempo.
- **Griglia convenzioni** (sotto): card statiche banner verde 135°. Sempre disponibili.
- **Tab "Disponibili / I miei"** stile iOS segmented.

### 5.6 No membership tiers
- No livelli "bronze/silver/gold". Tutti sono "Amico di Bi".
- No contatore risparmi ("hai risparmiato X€").
- No gamification (punti, streak, badge).

### 5.7 Inventario minimo
- **No prezzi pre-definiti** sulle schede. `$` · `$$` · `$$$` range, basta.
- **Orari da Google Places** (unica eccezione al "tutto curato"): badge "Aperto ora" + lista 7gg. Footer "Fonte: Google Places".
- **Telefono + indicazioni** linkati al telefono del locale / Maps nativo.

---

## 6. Routing

| URL | File mockup | Note |
|---|---|---|
| `/` | `v4-mobile-home.html` / `v4-desktop-home.html` | Home feed |
| `/esplora` | `v4-*-pagine.html` (tab 1) | Lista + mappa |
| `/sconti` | `v4-*-pagine.html` (tab 2) | Drop + griglia |
| `/salvati` | `v4-*-pagine.html` (tab 3) | Liste utente (localStorage) |
| `/profilo` | `v4-*-pagine.html` (tab 4) | Hero + stat |
| `/locale/[slug]` | `v4-*-scheda.html` | Scheda completa |
| `/suggerisci` | `v4-mobile-auth.html` (pag 3) | Form aperto |
| `/ristoratori` | `v4-verify.html` | Landing + login PIN |
| `/ristoratori/dashboard` | `v4-verify.html` (pag 2) | Post-login |
| `/admin` | `v4-*-admin.html` | Subdomain o path protected |

---

## 7. Responsive breakpoints

```css
/* Mobile first */
/* base: 390px design reference */

@media (min-width:768px){
  /* tablet: carousel 2 card visibili, lista 2 col */
}

@media (min-width:1024px){
  /* laptop: nav top, hero 520px, 2 col scheda 1.4/1 */
}

@media (min-width:1440px){
  /* desktop canonico: design di riferimento */
}
```

### Gotcha
- Sticky pill sconto cambia posizionamento (fixed bottom full-width mobile → absolute floating centered desktop). Due CSS separati.
- Mappa: su mobile occupa ~70vh con lista sotto; desktop è split 440sx + resto dx.
- Hero height: mobile 420 / desktop 520.

---

## 8. Accessibilità (WCAG 2.1 AA target)

- **Contrasto** ink su page = 15:1 ✅. Corallo su bianco = 4.8:1 ✅. Verde 135° su ink: verificare (problema potenziale).
- **Focus visible** su tutti i tap target — ring `2px solid var(--corallo)` + `outline-offset:2px`.
- **Touch target** min 44×44px (mobile nav OK, heart overlay 30px al limite: aumentare a 36 se serve).
- **Alt text** obbligatorio su foto ristorante → usa il nome del locale + categoria.
- **ARIA** sui tab (`role="tablist"`, `aria-selected`), sugli sheet modali (`role="dialog"`, `aria-labelledby`).
- **Keyboard nav** da chiudere in dev: carousel arrow keys, esc su modal, tab order sensato.
- **Prefers-reduced-motion** → disabilita blink NUOVO, hover lift, e transizioni pill.

---

## 9. Interazioni chiave

### 9.1 Salva locale
- Cuore overlay su card / hero → toggle, salva in localStorage.
- Non richiede login. Se utente non ha liste → crea automaticamente "I miei preferiti".
- Liste aggiuntive da `/salvati` con nome custom + nota Caveat.

### 9.2 Usa sconto
- Tap "Usa sconto" sulla pill sticky → apre bottom-sheet con:
  - Nome ristorante + sconto attivo
  - Codice monouso QR (generato lato server, 10min validità)
  - "Mostra al cameriere"
- Ristoratore scansiona con `/ristoratori/dashboard` → redeem.

### 9.3 Suggerisci un locale
- Form aperto, no login. 3 step: nome + indirizzo · perché piace · opzionale email se vuoi risposta.
- Entra nella coda admin di Augusto, non pubblicato automaticamente.

### 9.4 Admin edit scheda
- Login Augusto. Lista schede, edit inline (drag immagini, rewrite testo, togli "Secondo Bi" pubblicato).
- Tutti i campi soggetti a review, no auto-publish.

---

## 10. Assets necessari

### Da fornire (Augusto)
- Logo Chiamami Bi (SVG) — wordmark + mark
- Foto ristoranti (1600×1200 min, crop 4:3 e 16:9)
- Copy "Secondo Bi" per ogni scheda
- Tip "Cosa prendere" per ogni scheda
- PIN list ristoratori (CSV: locale → pin6 → sconto%)

### Da generare (dev)
- Favicon stack (16, 32, 180 apple-touch, 192/512 PWA)
- OG image template (1200×630) con wordmark + nome locale
- Icone SVG inline (già nei mockup): pin, heart, search, arrow, nav icons

### Third-party
- **Google Places API** → orari + telefono + indicazioni
- **Font:** Poppins (Fontshare), Alfa Slab One + Caveat (Google Fonts)
- **Map:** Mapbox o MapLibre + tiles custom cream

---

## 11. Stack suggerito

- **Framework:** Astro o Next.js (app router) — static + interactive islands
- **Styling:** CSS custom properties (come nei mockup), no Tailwind nei mockup, scelta libera dev. Se Tailwind: preset da costruire con i token
- **Data:** Supabase o similar (postgres + auth per ristoratori PIN)
- **Map:** Mapbox GL JS
- **Hosting:** Vercel / Netlify

**Non inventare un design system nuovo.** I token sopra sono il design system. Costruisci una libreria componenti (React / Astro) che rispetta 1:1 i pattern elencati in §4.

---

## 12. Checklist QA pre-lancio

- [ ] Nessun TAN Songbird residuo in produzione
- [ ] Nessuna stella / rating visibile
- [ ] "Secondo Bi" mai scritto come "Recensione"
- [ ] Caveat usato solo nei 8 punti editoriali
- [ ] PIN verify funzionante, lockout dopo 5 tentativi
- [ ] Sticky pill sconto mobile non copre contenuto (padding-bottom ≥ 110px)
- [ ] Sticky pill desktop floating centered, glass visibile sopra hero-scroll
- [ ] Tutti i corallo sono `#E8453C` esatto (no `#E74C3C`, `#FF453A`, etc.)
- [ ] Tutti i verdi sconto sono gradient 135° `#A3E635→#4ADE80` esatti
- [ ] Google Places orari con footer "Fonte: Google Places"
- [ ] Cuore overlay salvato → sincronizza tra home/esplora/scheda/salvati
- [ ] PWA installabile (icon + manifest + offline base)
- [ ] Lighthouse ≥ 90 su Performance / A11y / Best Practices / SEO

---

## 13. Contatti

- **Design direction:** Augusto — info@pubblismart.com
- **Questo doc:** `/Chiamami_Bi/v4-handoff.md` — versionare con `git` nel repo del sito
- **Mockup source of truth:** i 9 HTML in `/Chiamami_Bi/`. Se dev e doc divergono, **il mockup vince** (perché è stato approvato visualmente)

---

*v1.0 · 19 aprile 2026 · Bi sottrae, non aggiunge.*
