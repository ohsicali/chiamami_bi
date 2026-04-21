# v4 COMPONENT SPECS — Chiamami Bi Redesign

**Versione**: v4 (21/04/2026)
**Scopo**: Documento master con ogni singolo valore CSS/JSX/markup per replicare il redesign v4 nel sito live React+Vite (chiamamibi.com).
**Come si usa**: Claude Code legge questo file PRIMA di scrivere codice in ogni PR di reskin (PR4-PR10). Ogni sezione è auto-contenuta: tokens, markup, CSS. NESSUNA INVENZIONE.

---

## CONTRATTO NON NEGOZIABILE

Leggi prima `docs/v4-CLAUDE.md` — questo documento NON lo sostituisce, lo COMPLETA con tutti i valori CSS che servono. I vincoli non-negoziabili rimangono:

1. **Nessun Supabase Auth per ristoratori** — accesso SOLO con PIN 6 cifre via cookie `verify_device_token`
2. **NIENTE recensioni, NIENTE stelline, NIENTE rating utenti** in nessuna parte del prodotto
3. **Blocco editoriale = "Secondo Bi"** (mai "Recensione"). Firma Caveat.
4. **Tipografia**: Poppins (UI + heading + body) + Caveat (SOLO editoriale tip/signature/piatti consigliati) + Alfa Slab One (SOLO wordmark e pin B del logo)
5. **Nessuna nuova dipendenza npm** senza permesso esplicito
6. **Non refactorare logic esistente** — solo swap markup/CSS/classi

Se il mockup diverge dal contratto, il contratto VINCE. Se non è chiaro, chiedi.

---

## ORDINE DEI CONTENUTI

1. **Parte 1** — Design tokens + Home Mobile (10 sezioni)
2. **Parte 2** — Home Desktop + Scheda Mobile (parziale)
3. **Parte 3** — Scheda Mobile (continuazione) + Scheda Desktop + Typography + Responsive
4. **Parte 4** — Esplora / Sconti / Salvati / Profilo (mobile + desktop) + Auth + Verify + Admin + Safari + Fonts + liquidGL + SVG Icon Library + Checklist anti-drift

---

---

# PARTE 1 — TOKENS + HOME MOBILE

Ho letto tutti e 4 i file. Ora estraggo le specifiche implementative precise in formato markdown strutturato pronto per Claude Code.

---

# SPECIFICHE IMPLEMENTATIVE REDESIGN V4 CHIAMAMI BI

## VARIABILI CSS GLOBALI

```css
:root {
  /* COLORI */
  --corallo: #E8453C;
  --corallo-ink: #C6372F;
  --corallo-soft: #FDEBEA;
  --ink: #22181C;
  --ink-70: rgba(34,24,28,.7);
  --ink-40: rgba(34,24,28,.4);
  --ink-15: rgba(34,24,28,.12);
  --ink-05: rgba(34,24,28,.05);
  --page: #FAF7F2;
  --cream-deep: #F1EBE0;
  --white: #FFFFFF;
  --oro: #B08954;
  --oro-deep: #8E6B3E;
  --oro-soft: #F4E7CC;
  --green-a: #A3E635;
  --green-b: #4ADE80;
  --green-grad: linear-gradient(135deg,#A3E635,#4ADE80);
  --beige-cta: #F2EDE1;
  --beige-cta-hover: #EADFCB;
  
  /* FONT FAMILIES */
  --ff-ui: 'Poppins',-apple-system,'Helvetica Neue',sans-serif;
  --ff-mark: 'Alfa Slab One',Georgia,serif;
  --ff-hand: 'Caveat',cursive;
  
  /* BORDER RADIUS */
  --r-sm: 10px;
  --r-md: 14px;
  --r-lg: 20px;
  --r-xl: 28px;
  --r-pill: 999px;
  
  /* SHADOWS */
  --shadow-sm: 0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04);
  --shadow-md: 0 8px 24px rgba(34,24,28,.08);
  --shadow-lg: 0 20px 60px rgba(34,24,28,.12);
  
  /* CONTAINER */
  --maxw: 1240px;
}
```

---

## HOME MOBILE (v4-mobile-home.html)

### 1. TOPBAR
**Ruolo**: Wordmark + geo pill + geo button, sticky in alto  
**Markup**:
```jsx
<div class="topbar">
  <div class="logo">
    <span class="l1">LA GUIDA DI BI</span>
    <span class="l2">by Chiamami Bi</span>
  </div>
  <div class="city-pill">
    <span class="dot"></span>Torino
    <svg viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
  </div>
  <button class="geo-btn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2"/></svg>
  </button>
</div>
```

**CSS**:
```css
.topbar {
  padding: 10px 20px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  line-height: .92;
}

.logo .l1 {
  font-family: var(--ff-mark);
  font-size: 15px;
  letter-spacing: .02em;
  color: var(--corallo);
}

.logo .l2 {
  font-family: var(--ff-ui);
  font-weight: 700;
  font-size: 8px;
  letter-spacing: .15em;
  color: var(--ink-40);
  margin-top: 3px;
  text-transform: uppercase;
}

.city-pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  background: var(--ink-05);
  border-radius: var(--r-pill);
  font-weight: 700;
  font-size: 13px;
}

.city-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--corallo);
}

.city-pill svg {
  width: 10px;
  height: 10px;
}

.geo-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ink-05);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  cursor: pointer;
}

.geo-btn svg {
  width: 16px;
  height: 16px;
  color: var(--ink);
}
```

### 2. HERO CARD (Neotaste-style promo)
**Ruolo**: Card corallo con countdown, sconto in titolo, foto sinistra  
**Markup**:
```jsx
<div class="hero">
  <div class="hero-card">
    <div>
      <span class="hero-chip"><span class="blink"></span>DROP LIVE · 2h 14m</span>
      <div class="hero-title">-10%<br>da Orma.</div>
      <div class="hero-sub">Menù fisso serale. Fino alle 20:55, lunedì–giovedì.</div>
      <a class="hero-cta">Vai al drop</a>
    </div>
    <div class="hero-photo">
      <img src="https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&q=80" alt="">
    </div>
  </div>
</div>
```

**CSS**:
```css
.hero {
  padding: 4px 16px 22px;
}

.hero-card {
  position: relative;
  background: var(--corallo);
  border-radius: var(--r-xl);
  padding: 22px 22px 22px;
  display: grid;
  grid-template-columns: 1fr 108px;
  gap: 14px;
  color: #fff;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: rgba(255,255,255,.18);
  backdrop-filter: blur(8px);
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  margin-bottom: 10px;
}

.hero-chip .blink {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  animation: blink 1.4s infinite;
}

@keyframes blink { 50% { opacity: .3; } }

.hero-title {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 30px;
  line-height: 1.02;
  letter-spacing: -.02em;
  color: #fff;
  margin-bottom: 8px;
}

.hero-sub {
  font-size: 13px;
  color: rgba(255,255,255,.85);
  line-height: 1.4;
  margin-bottom: 14px;
  max-width: 180px;
}

.hero-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--ink);
  color: #fff;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  width: fit-content;
}

.hero-cta::after {
  content: "→";
}

.hero-photo {
  border-radius: var(--r-lg);
  overflow: hidden;
  background: #333;
  align-self: stretch;
  min-height: 160px;
}

.hero-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

### 3. CATEGORIE BUBBLE (Carosello emoji)
**Ruolo**: Scroller orizzontale con bubble rotonde (64px), emoji, label. Active = corallo.  
**Markup**:
```jsx
<div class="cats-bubbles">
  <a class="cat-b active"><span class="bubble">🥂</span><span class="lbl">Aperitivo</span></a>
  <a class="cat-b"><span class="bubble">🍝</span><span class="lbl">Piemontese</span></a>
  <a class="cat-b"><span class="bubble">🍕</span><span class="lbl">Pizza</span></a>
  <!-- ... -->
</div>
```

**CSS**:
```css
.cats-bubbles {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 6px 20px 20px;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
}

.cats-bubbles::-webkit-scrollbar {
  display: none;
}

.cat-b {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: inherit;
  scroll-snap-align: start;
}

.cat-b .bubble {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--ink-05);
  display: grid;
  place-items: center;
  font-size: 28px;
}

.cat-b.active .bubble {
  background: var(--corallo);
  box-shadow: 0 6px 16px rgba(232,69,60,.35);
}

.cat-b .lbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink);
  max-width: 72px;
  text-align: center;
  line-height: 1.15;
}

.cat-b.active .lbl {
  color: var(--corallo-ink);
}
```

### 4. SECTION HEAD (Poppins 900)
**Ruolo**: Titolo sezione + freccia "vedi tutti"  
**CSS**:
```css
.sec {
  padding: 8px 0 4px;
}

.sec-head {
  padding: 0 20px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sec-head h2 {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 22px;
  letter-spacing: -.02em;
  line-height: 1.1;
  color: var(--ink);
}

.sec-head .all {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ink-05);
  display: grid;
  place-items: center;
  font-size: 14px;
  color: var(--ink);
  text-decoration: none;
  font-weight: 700;
}
```

### 5. RCARD (Card ristorante mobile)
**Ruolo**: Card compatta 70% larghezza, aspect 16/11, immagine, name Poppins 800, meta, pill categoria  
**Markup**:
```jsx
<div class="crow">
  <a class="rcard">
    <div class="ph">
      <img src="..." alt="">
      <span class="pill-new">NEW</span>
      <button class="heart">♡</button>
    </div>
    <div class="body">
      <div class="name">Kintsugi</div>
      <div class="meta">
        <span class="tag">GIAPPONESE</span>
        <span>Crocetta</span>
        <span class="sep">·</span>
        <span>€€</span>
      </div>
    </div>
  </a>
</div>
```

**CSS**:
```css
.crow {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 20px 12px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.crow::-webkit-scrollbar {
  display: none;
}

.rcard {
  flex: 0 0 70%;
  scroll-snap-align: start;
  background: var(--white);
  border-radius: var(--r-lg);
  overflow: hidden;
  border: 1px solid var(--ink-05);
  text-decoration: none;
  color: inherit;
  box-shadow: var(--shadow-sm);
}

.rcard .ph {
  position: relative;
  width: 100%;
  aspect-ratio: 16/11;
  background: #ddd;
  overflow: hidden;
}

.rcard .ph img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.rcard .ph .pill-new {
  position: absolute;
  top: 10px;
  left: 10px;
  background: var(--ink);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: var(--r-pill);
  letter-spacing: .04em;
}

.rcard .ph .pill-disc {
  position: absolute;
  top: 10px;
  left: 10px;
  background: var(--corallo);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: var(--r-pill);
  letter-spacing: .02em;
}

.rcard .ph .heart {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border: 0;
  cursor: pointer;
}

.rcard .body {
  padding: 10px 14px 14px;
}

.rcard .name {
  font-family: var(--ff-ui);
  font-weight: 800;
  font-size: 16px;
  line-height: 1.2;
  letter-spacing: -.01em;
  color: var(--ink);
}

.rcard .meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink-70);
  margin-top: 4px;
  flex-wrap: wrap;
}

.rcard .meta .sep {
  color: var(--ink-40);
}

.rcard .meta .tag {
  background: var(--corallo-soft);
  color: var(--corallo-ink);
  font-weight: 700;
  font-size: 10px;
  padding: 3px 7px;
  border-radius: var(--r-pill);
  letter-spacing: .02em;
}
```

### 6. SPONSOR BANNER (Inline)
**Ruolo**: Dark card con foto gradient, corpo testo, CTA pill corallo  
**Markup**:
```jsx
<div class="spon-wrap">
  <div class="spon">
    <span class="spon-lbl">Sponsorizzato</span>
    <div class="spon-img" style="background-image:linear-gradient(135deg,#D9A441,#8A5A1F),url('...')"></div>
    <div class="spon-body">
      <div class="spon-kick">Partner · Vini Crosetti</div>
      <div class="spon-title">20% sulle Barbera biologiche</div>
      <div class="spon-sub">Consegna 24h · codice BI20</div>
    </div>
    <a class="spon-cta">Attiva</a>
  </div>
</div>
```

**CSS**:
```css
.spon-wrap {
  padding: 14px 16px 0;
}

.spon {
  position: relative;
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 14px;
  align-items: center;
  background: var(--ink);
  color: #fff;
  border-radius: var(--r-lg);
  padding: 14px 16px;
  overflow: hidden;
}

.spon-lbl {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .14em;
  color: rgba(255,255,255,.5);
  text-transform: uppercase;
}

.spon-img {
  width: 72px;
  height: 72px;
  border-radius: var(--r-sm);
  background-size: cover;
  background-position: center;
}

.spon-kick {
  font-size: 10px;
  font-weight: 700;
  color: var(--oro);
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-bottom: 3px;
}

.spon-title {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 15px;
  line-height: 1.15;
  letter-spacing: -.01em;
  margin-bottom: 3px;
  color: #fff;
}

.spon-sub {
  font-size: 11px;
  color: rgba(255,255,255,.65);
  line-height: 1.3;
}

.spon-cta {
  padding: 8px 12px;
  background: var(--corallo);
  color: #fff;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  align-self: center;
}
```

### 7. TIME-BASED SECTION
**Ruolo**: Tab momento (Colazione/Pranzo/Aperitivo/Cena/Dopo cena), card row con sconto/stato  
**Markup**:
```jsx
<section class="sec" style="padding-top:22px">
  <div class="time-head">
    <div class="time-now"><span class="pulse"></span>Adesso · 18:34</div>
    <h2 class="time-title">Aperitivo a Torino</h2>
    <div class="time-sub">22 locali aperti adesso · filtra per momento</div>
  </div>
  <div class="time-tabs">
    <div class="tab">☕ Colazione <span class="n">8</span></div>
    <div class="tab">🥪 Pranzo <span class="n">14</span></div>
    <div class="tab active">🥂 Aperitivo <span class="n">22</span></div>
    <!-- ... -->
  </div>
  <div class="crow"><!-- rcard --></div>
</section>
```

**CSS**:
```css
.time-head {
  padding: 0 20px 10px;
}

.time-now {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .1em;
  color: var(--corallo-ink);
  text-transform: uppercase;
  margin-bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.time-now .pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--corallo);
  animation: blink 1.4s infinite;
}

.time-title {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 22px;
  letter-spacing: -.02em;
  line-height: 1.1;
  color: var(--ink);
}

.time-sub {
  font-size: 12px;
  color: var(--ink-70);
  margin-top: 4px;
}

.time-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 14px 20px 12px;
  -webkit-overflow-scrolling: touch;
}

.time-tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  flex: 0 0 auto;
  padding: 9px 13px;
  border-radius: var(--r-pill);
  background: var(--ink-05);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-70);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab .n {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-40);
}

.tab.active {
  background: var(--ink);
  color: #fff;
}

.tab.active .n {
  color: rgba(255,255,255,.55);
}
```

### 8. BLOCCO "COSA TI CONSIGLIO" (Oro sfondo)
**Ruolo**: Card oro con avatar B, author info, kicker, heading, nome ristorante grande, lista piatti Caveat 18px numerati  
**Markup**:
```jsx
<div class="consiglio-wrap">
  <div class="consiglio">
    <div class="author">
      <div class="av-bi">B</div>
      <div>
        <div class="author-name">Bi — dalla guida</div>
        <div class="author-role">Selezione della settimana</div>
      </div>
    </div>
    <div class="consiglio-kicker">Cosa ti consiglio di prendere</div>
    <h2 class="consiglio-h">Questa settimana vai da</h2>
    <div class="consiglio-rest">Orma <span class="sm">· Italiana · Quadrilatero</span></div>
    <ul class="consiglio-list">
      <li><div class="num">1</div><div class="txt">Tagliolino al ragù bianco — il piatto firma. Se non c'è, chiedi a Fede.</div></li>
      <li><div class="num">2</div><div class="txt">Tartare di fassona con nocciole, tagliata al coltello.</div></li>
      <li><div class="num">3</div><div class="txt">Bonet, versione con amaretti morbidi. Chiudi così.</div></li>
    </ul>
    <a class="consiglio-cta">Apri la scheda</a>
  </div>
</div>
```

**CSS**:
```css
.consiglio-wrap {
  padding: 24px 16px 4px;
}

.consiglio {
  position: relative;
  overflow: hidden;
  background: linear-gradient(140deg,#FEF6E4 0%,#F4E7CC 100%);
  border: 1px solid rgba(176,137,84,.35);
  border-radius: var(--r-xl);
  padding: 20px 20px 18px;
}

.consiglio::before {
  content: "";
  position: absolute;
  top: -30px;
  right: -30px;
  width: 140px;
  height: 140px;
  background: radial-gradient(circle,rgba(176,137,84,.3) 0%,transparent 70%);
  border-radius: 50%;
}

.consiglio .author {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  position: relative;
}

.av-bi {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ff-mark);
  font-size: 16px;
}

.author-name {
  font-family: var(--ff-ui);
  font-size: 13px;
  font-weight: 700;
}

.author-role {
  font-size: 11px;
  color: var(--ink-70);
}

.consiglio-kicker {
  font-family: var(--ff-ui);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .14em;
  color: var(--oro);
  text-transform: uppercase;
  margin-bottom: 6px;
  position: relative;
}

.consiglio-h {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 22px;
  letter-spacing: -.02em;
  line-height: 1.1;
  margin-bottom: 4px;
  position: relative;
}

.consiglio-rest {
  position: relative;
  margin-bottom: 14px;
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -.02em;
  color: var(--ink);
}

.consiglio-rest .sm {
  display: block;
  font-weight: 600;
  font-size: 12px;
  color: var(--ink-70);
  margin-top: 4px;
  letter-spacing: 0;
}

.consiglio-list {
  position: relative;
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.consiglio-list li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  background: rgba(255,255,255,.65);
  border-radius: var(--r-sm);
  border: 1px solid rgba(176,137,84,.2);
}

.consiglio-list .num {
  flex: 0 0 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  font-family: var(--ff-mark);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.consiglio-list .txt {
  flex: 1;
  font-family: var(--ff-hand);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}

.consiglio-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
  padding: 9px 14px;
  background: rgba(255,255,255,.85);
  border-radius: var(--r-pill);
  border: 1px solid rgba(176,137,84,.3);
}

.consiglio-cta::after {
  content: "→";
  color: var(--corallo);
}
```

### 9. SUGGEST CARD
**Ruolo**: Dark pill con glow corallo, body + CTA pill corallo  
**CSS**:
```css
.suggest-wrap {
  padding: 24px 16px 36px;
}

.suggest {
  position: relative;
  overflow: hidden;
  background: var(--ink);
  color: #fff;
  border-radius: var(--r-xl);
  padding: 22px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  align-items: center;
}

.suggest::before {
  content: "";
  position: absolute;
  top: -40px;
  right: -40px;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle,rgba(232,69,60,.25),transparent 70%);
  border-radius: 50%;
}

.suggest-body {
  position: relative;
  z-index: 1;
}

.suggest-title {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 18px;
  line-height: 1.15;
  letter-spacing: -.01em;
  margin-bottom: 6px;
  max-width: 200px;
}

.suggest-sub {
  font-size: 12px;
  color: rgba(255,255,255,.65);
  line-height: 1.35;
  max-width: 220px;
}

.suggest-cta {
  padding: 11px 14px;
  background: var(--corallo);
  color: #fff;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

.suggest-cta::after {
  content: " →";
}
```

### 10. NAV LIQUID GLASS (WebGL + fallback backdrop)
**Ruolo**: Pill fissa bottom con 5 tab, active cap con label + icona, fallback blur/saturate  
**Markup**:
```jsx
<div class="nav liquidGL" data-liquid-ignore aria-label="Navigazione principale">
  <a class="active" aria-label="Home" title="Home">
    <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z"/></svg>
    <span class="nav-label">Home</span>
  </a>
  <a aria-label="Esplora" title="Esplora">
    <svg viewBox="0 0 24 24"><path d="M12 2c-4 0-7 3-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.4" fill="#fff"/></svg>
    <span class="nav-label">Esplora</span>
  </a>
  <a aria-label="Sconti" title="Sconti">
    <span class="badge"></span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor"/><circle cx="17.5" cy="17.5" r="2.2" fill="currentColor"/></svg>
    <span class="nav-label">Sconti</span>
  </a>
  <a aria-label="Salvati" title="Salvati">
    <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
    <span class="nav-label">Salvati</span>
  </a>
  <a aria-label="Profilo" title="Profilo">
    <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.5-8 6v2h16v-2c0-3.5-3.6-6-8-6z"/></svg>
    <span class="nav-label">Profilo</span>
  </a>
</div>
```

**CSS**:
```css
.nav {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 18px;
  height: 68px;
  border-radius: var(--r-pill);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 6px;
  z-index: 40;
  gap: 2px;
  background: rgba(255,255,255,.55);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(0,0,0,.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.9),
    0 2px 8px rgba(34,24,28,.06),
    0 14px 32px rgba(34,24,28,.14);
}

.nav a {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #141414;
  text-decoration: none;
  padding: 8px 4px;
  border-radius: 28px;
  position: relative;
  z-index: 3;
  transition: background .18s ease, box-shadow .18s ease;
}

.nav a svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
  stroke: none;
}

.nav a .nav-label {
  font-family: var(--ff-ui);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: -.005em;
  line-height: 1;
  white-space: nowrap;
  color: #141414;
}

.nav a.active {
  background: rgba(0,0,0,.05);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.08);
}

.nav a.active .nav-label {
  font-weight: 800;
}

.nav a .badge {
  position: absolute;
  top: 5px;
  right: 10px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--corallo);
  border: 1.5px solid rgba(255,255,255,.95);
  z-index: 4;
}
```

**JS (load liquidGL)**:
```js
<script src="vendor/html2canvas.min.js" defer></script>
<script src="vendor/liquidGL.js" defer></script>
<script>
window.addEventListener('load', () => {
  if (typeof liquidGL === 'undefined') {
    console.warn('[v4] liquidGL non caricato — fallback CSS attivo');
    return;
  }
  try {
    liquidGL({
      target: '.liquidGL',
      snapshot: '.screen',
      resolution: 2.0,
      refraction: 0.025,
      bevelDepth: 0.11,
      bevelWidth: 0.18,
      frost: 2,
      shadow: true,
      specular: true,
      reveal: 'fade',
      magnify: 1,
    });
  } catch (e) { console.warn('[v4] liquidGL init error:', e); }
});
</script>
```

---

## HOME DESKTOP (v4-desktop-home.html)

### 1. NAV TOP (Glass pill sticky)
**Ruolo**: Header sticky con logo, link menu, search, city pill, avatar  
**Markup**:
```jsx
<div class="nav-wrap">
  <nav class="nav">
    <a href="#" class="logo">
      <span class="l1">LA GUIDA DI BI</span>
      <span class="l2">by Chiamami Bi</span>
    </a>
    <div class="nav-links">
      <a href="#" class="active">Home</a>
      <a href="#">Esplora</a>
      <a href="#">Sconti</a>
      <a href="#">Salvati</a>
      <a href="#">Su di me</a>
    </div>
    <div class="nav-cta">
      <button class="nav-search" aria-label="cerca">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      </button>
      <div class="city-pill">
        <span class="dot"></span>Torino
        <svg viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
      </div>
      <div class="account">A</div>
    </div>
  </nav>
</div>
```

**CSS**:
```css
.nav-wrap {
  position: sticky;
  top: 16px;
  z-index: 40;
  padding: 16px 40px 0;
}

.nav {
  max-width: var(--maxw);
  margin: 0 auto;
  height: 68px;
  background: rgba(255,255,255,.66);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border: 1px solid rgba(255,255,255,.5);
  border-radius: var(--r-pill);
  box-shadow: var(--shadow-md);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18px;
  padding: 0 10px 0 22px;
}

.nav .logo {
  display: flex;
  flex-direction: column;
  line-height: .92;
  text-decoration: none;
}

.nav .logo .l1 {
  font-family: var(--ff-mark);
  font-size: 18px;
  letter-spacing: .02em;
  color: var(--corallo);
}

.nav .logo .l2 {
  font-family: var(--ff-ui);
  font-weight: 700;
  font-size: 9px;
  letter-spacing: .18em;
  color: var(--ink-40);
  margin-top: 4px;
  text-transform: uppercase;
}

.nav-links {
  display: flex;
  gap: 2px;
  justify-self: center;
}

.nav-links a {
  padding: 10px 16px;
  border-radius: var(--r-pill);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-70);
  text-decoration: none;
  transition: color .2s, background .2s;
}

.nav-links a:hover {
  color: var(--ink);
  background: var(--ink-05);
}

.nav-links a.active {
  color: var(--ink);
  background: var(--ink-05);
}

.nav-cta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nav-search {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ink-05);
  display: grid;
  place-items: center;
  border: 0;
  cursor: pointer;
}

.nav-search svg {
  width: 16px;
  height: 16px;
  stroke: var(--ink);
  fill: none;
  stroke-width: 2;
}

.city-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  background: var(--ink-05);
  border-radius: var(--r-pill);
  font-weight: 700;
  font-size: 13px;
}

.city-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--corallo);
}

.account {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  display: grid;
  place-items: center;
  font-family: var(--ff-mark);
  font-size: 18px;
  margin-left: 2px;
}
```

### 2. HERO CARD DESKTOP
**Ruolo**: 2-col (body large title sx + foto dx), 380px height, chip live, title 72px, CTA dark + ghost  
**CSS**:
```css
.hero-card {
  position: relative;
  background: var(--corallo);
  border-radius: var(--r-xl);
  overflow: hidden;
  display: grid;
  grid-template-columns: 1.05fr .95fr;
  gap: 0;
  color: #fff;
  box-shadow: var(--shadow-md);
  min-height: 380px;
  margin-bottom: 44px;
}

.hero-body {
  padding: 52px 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  background: rgba(255,255,255,.18);
  backdrop-filter: blur(8px);
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
  width: fit-content;
}

.hero-chip .blink {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  animation: blink 1.4s infinite;
}

.hero-title {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 72px;
  line-height: .98;
  letter-spacing: -.03em;
  color: #fff;
}

.hero-rest-line {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,.9);
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-rest-line .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255,255,255,.6);
}

.hero-sub {
  font-size: 15px;
  color: rgba(255,255,255,.85);
  line-height: 1.5;
  max-width: 340px;
}

.hero-ctas {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.hero-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 13px 22px;
  background: var(--ink);
  color: #fff;
  border-radius: var(--r-pill);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.hero-cta::after {
  content: "→";
}

.hero-cta.g {
  background: rgba(255,255,255,.18);
  backdrop-filter: blur(8px);
  color: #fff;
}

.hero-cta.g::after {
  content: "";
}

.hero-photo {
  position: relative;
  overflow: hidden;
}

.hero-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-meta {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.hero-meta .chip-meta {
  padding: 6px 11px;
  background: rgba(34,24,28,.6);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: var(--r-pill);
  letter-spacing: .04em;
}

.hero-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px;
  background: linear-gradient(0deg,rgba(34,24,28,.7),transparent);
  color: #fff;
}

.hero-progress-bar {
  height: 6px;
  background: rgba(255,255,255,.2);
  border-radius: var(--r-pill);
  overflow: hidden;
}

.hero-progress-bar span {
  display: block;
  height: 100%;
  width: 68%;
  background: #fff;
  border-radius: var(--r-pill);
}

.hero-progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  margin-top: 8px;
  letter-spacing: .04em;
}
```

### 3. CATEGORIE (Grid wrap)
**Ruolo**: Bubble 80px, emoji 36px, label sotto, hover lift, active corallo  
**CSS**:
```css
.cats {
  display: flex;
  gap: 22px;
  padding: 0 4px 38px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.cat-b {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.cat-b .bubble {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--white);
  border: 1px solid var(--ink-05);
  display: grid;
  place-items: center;
  font-size: 36px;
  transition: transform .2s, box-shadow .2s, background .2s, color .2s;
}

.cat-b:hover .bubble {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.cat-b.active .bubble {
  background: var(--corallo);
  box-shadow: 0 10px 24px rgba(232,69,60,.35);
  color: #fff;
}

.cat-b .lbl {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}

.cat-b.active .lbl {
  color: var(--corallo-ink);
}
```

### 4. RCARD GRID (4-col)
**Ruolo**: Grid 4 colonne, card white, hover lift + zoom img, name Poppins 800 18px  
**CSS**:
```css
.cgrid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 18px;
}

.rcard {
  background: var(--white);
  border-radius: var(--r-lg);
  overflow: hidden;
  border: 1px solid var(--ink-05);
  text-decoration: none;
  color: inherit;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  transition: transform .2s, box-shadow .2s;
}

.rcard:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.rcard .ph {
  position: relative;
  width: 100%;
  aspect-ratio: 16/11;
  background: #ddd;
  overflow: hidden;
}

.rcard .ph img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform .4s;
}

.rcard:hover .ph img {
  transform: scale(1.03);
}

.rcard .ph .pill-new {
  position: absolute;
  top: 12px;
  left: 12px;
  background: var(--ink);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: var(--r-pill);
  letter-spacing: .04em;
}

.rcard .ph .heart {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  border: 0;
  cursor: pointer;
}

.rcard .body {
  padding: 12px 16px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rcard .name {
  font-family: var(--ff-ui);
  font-weight: 800;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: -.01em;
  color: var(--ink);
}

.rcard .meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink-70);
  margin-top: 4px;
  flex-wrap: wrap;
}

.rcard .meta .tag {
  background: var(--corallo-soft);
  color: var(--corallo-ink);
  font-weight: 700;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: var(--r-pill);
  letter-spacing: .04em;
}
```

### 5. SECTION HEAD (Kicker + h2 + sub)
**CSS**:
```css
.sec {
  margin-bottom: 44px;
}

.sec-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.sec-head-l {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sec-kick {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
  color: var(--corallo-ink);
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sec-kick .pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--corallo);
  animation: blink 1.4s infinite;
}

.sec-head h2 {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 32px;
  letter-spacing: -.02em;
  line-height: 1.05;
  color: var(--ink);
}

.sec-head .sub {
  font-size: 14px;
  color: var(--ink-70);
  margin-top: 3px;
}

.sec-head .all {
  padding: 10px 16px;
  background: var(--ink-05);
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
  white-space: nowrap;
}

.sec-head .all::after {
  content: "  →";
  color: var(--corallo);
}
```

### 6. TIME-BASED TABS & GRID
**CSS**:
```css
.time-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.tab {
  padding: 10px 16px;
  border-radius: var(--r-pill);
  background: var(--white);
  border: 1px solid var(--ink-05);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-70);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background .15s;
}

.tab .n {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-40);
  padding: 2px 7px;
  background: var(--ink-05);
  border-radius: var(--r-pill);
}

.tab.active {
  background: var(--ink);
  color: #fff;
  border-color: var(--ink);
}

.tab.active .n {
  color: rgba(255,255,255,.7);
  background: rgba(255,255,255,.1);
}

.tab:hover:not(.active) {
  background: var(--ink-05);
}
```

### 7. SPONSOR BANNER (Wide desktop)
**CSS**:
```css
.spon {
  position: relative;
  display: grid;
  grid-template-columns: 108px 1fr auto;
  gap: 24px;
  align-items: center;
  background: var(--ink);
  color: #fff;
  border-radius: var(--r-lg);
  padding: 20px 26px;
  overflow: hidden;
  margin-bottom: 44px;
}

.spon-lbl {
  position: absolute;
  top: 10px;
  right: 16px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .14em;
  color: rgba(255,255,255,.5);
  text-transform: uppercase;
}

.spon-img {
  width: 108px;
  height: 108px;
  border-radius: var(--r-md);
  background-size: cover;
  background-position: center;
}

.spon-kick {
  font-size: 11px;
  font-weight: 700;
  color: var(--oro);
  letter-spacing: .1em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.spon-title {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 22px;
  line-height: 1.15;
  letter-spacing: -.015em;
  margin-bottom: 4px;
  color: #fff;
}

.spon-sub {
  font-size: 13px;
  color: rgba(255,255,255,.65);
  line-height: 1.45;
  max-width: 520px;
}

.spon-cta {
  padding: 12px 20px;
  background: var(--corallo);
  color: #fff;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.spon-cta::after {
  content: "  →";
}
```

### 8. CONSIGLIO DESKTOP (2-col layout)
**Ruolo**: Oro gradient bg, 2 col (left testo, right lista piatti), 48px gap  
**CSS**:
```css
.consiglio-wrap {
  margin-bottom: 44px;
}

.consiglio {
  position: relative;
  overflow: hidden;
  background: linear-gradient(140deg,#FEF6E4 0%,#F4E7CC 100%);
  border: 1px solid rgba(176,137,84,.35);
  border-radius: var(--r-xl);
  padding: 40px 48px;
  display: grid;
  grid-template-columns: 1.1fr .9fr;
  gap: 48px;
  align-items: center;
}

.consiglio::before {
  content: "";
  position: absolute;
  top: -60px;
  right: -60px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle,rgba(176,137,84,.3) 0%,transparent 70%);
  border-radius: 50%;
}

.consiglio-l {
  position: relative;
  z-index: 1;
}

.consiglio .author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.av-bi {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ff-mark);
  font-size: 20px;
}

.author-name {
  font-family: var(--ff-ui);
  font-size: 14px;
  font-weight: 700;
}

.author-role {
  font-size: 12px;
  color: var(--ink-70);
}

.consiglio-kicker {
  font-family: var(--ff-ui);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .16em;
  color: var(--oro);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.consiglio-h {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 34px;
  letter-spacing: -.02em;
  line-height: 1.05;
  margin-bottom: 8px;
}

.consiglio-rest {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 48px;
  line-height: 1;
  letter-spacing: -.03em;
  color: var(--ink);
  margin-bottom: 6px;
}

.consiglio-place {
  font-family: var(--ff-ui);
  font-style: normal;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-70);
  margin-bottom: 20px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.consiglio-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
  padding: 11px 18px;
  background: rgba(255,255,255,.85);
  border-radius: var(--r-pill);
  border: 1px solid rgba(176,137,84,.3);
}

.consiglio-cta::after {
  content: "→";
  color: var(--corallo);
}

.consiglio-r {
  position: relative;
  z-index: 1;
}

.consiglio-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.consiglio-list li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 16px 18px;
  background: rgba(255,255,255,.7);
  border-radius: var(--r-md);
  border: 1px solid rgba(176,137,84,.25);
}

.consiglio-list .num {
  flex: 0 0 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ink);
  color: #fff;
  font-family: var(--ff-mark);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.consiglio-list .txt {
  flex: 1;
  font-family: var(--ff-hand);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--ink);
}
```

### 9. SUGGEST & FOOTER
**CSS**:
```css
.suggest {
  position: relative;
  overflow: hidden;
  background: var(--ink);
  color: #fff;
  border-radius: var(--r-xl);
  padding: 40px 48px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 32px;
  align-items: center;
  margin-bottom: 44px;
}

.suggest::before {
  content: "";
  position: absolute;
  top: -80px;
  right: -40px;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle,rgba(232,69,60,.3),transparent 70%);
  border-radius: 50%;
}

.suggest-body {
  position: relative;
  z-index: 1;
}

.suggest-title {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 30px;
  line-height: 1.05;
  letter-spacing: -.02em;
  margin-bottom: 10px;
  max-width: 500px;
}

.suggest-sub {
  font-size: 15px;
  color: rgba(255,255,255,.72);
  line-height: 1.5;
  max-width: 560px;
}

.suggest-cta {
  padding: 14px 24px;
  background: var(--corallo);
  color: #fff;
  border-radius: var(--r-pill);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

.suggest-cta::after {
  content: "  →";
}

.foot {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 40px 40px 60px;
  border-top: 1px solid var(--ink-05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.foot-l {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.foot-l .mark {
  font-family: var(--ff-mark);
  font-size: 16px;
  color: var(--corallo);
}

.foot-l .tag {
  font-size: 12px;
  color: var(--ink-40);
  letter-spacing: .08em;
  text-transform: uppercase;
}

.foot-r {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: var(--ink-70);
}

.foot-r a {
  color: inherit;
  text-decoration: none;
  font-weight: 600;
}

.foot-r a:hover {
  color: var(--corallo-ink);
}
```

---

## SCHEDA MOBILE (v4-mobile-scheda.html)

### 1. HERO FOTO + TOPBAR OVERLAY
**Ruolo**: Foto full 320px + overlay gradient 180deg, back btn + share + heart on foto  
**Markup**:
```jsx
<div class="hero-wrap">
  <img src="..." alt="Il Mulo">
  <div class="hero-topbar">
    <button class="ico" aria-label="indietro"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div class="spacer"></div>
    <button class="ico" aria-label="condividi"><svg viewBox="0 0 24 24">...</svg></button>
    <button class="ico on" aria-label="salva"><svg viewBox="0 0 24 24" fill="#fff" stroke="#fff">...</svg></button>
  </div>
</div>
```

**CSS**:
```css
.hero-wrap {
  position: relative;
  height: 320px;
  width: 100%;
  overflow: hidden;
  margin-top: -44px;
}

.hero-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-wrap::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 22%,transparent 65%,rgba(0,0,0,.12) 100%);
}

.hero-topbar {
  position: absolute;
  top: 44px;
  left: 0;
  right: 0;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 10;
}

.hero-topbar .ico {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,.9);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  border: 0;
  cursor: pointer;
}

.hero-topbar .ico svg {
  width: 18px;
  height: 18px;
  stroke: var(--ink);
  fill: none;
  stroke-width: 2;
}

.hero-topbar .spacer {
  flex: 1;
}

.hero-topbar .ico.on {
  background: var(--corallo);
  color: #fff;
}

.hero-topbar .ico.on svg {
  stroke: #fff;
  fill: #fff;
}
```

### 2. CARD OVERLAY (Rounded-top centrata)
**Ruolo**: Border-top-radius 24px, grabber handle, nome Poppins 900 centrato, indirizzo, chip, CTA  
**Markup**:
```jsx
<div class="card-overlay">
  <span class="grabber"></span>
  <h1 class="tb-name">Il Mulo</h1>
  <div class="tb-addr">
    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    Via San Anselmo 28, 10125 Torino · San Salvario
  </div>
  <div class="tb-chips">
    <span class="chip cat">🍝 Piemontese</span>
    <span class="chip price">€€</span>
    <span class="chip moment">Cena</span>
    <span class="chip open"><span class="dot"></span>Aperto · chiude 23:30</span>
  </div>
  <div class="tb-ctas">
    <button class="cta-main">
      <svg viewBox="0 0 24 24"><path d="M12 2l10 10-10 10L2 12z"/><path d="M9 15V9h6"/></svg>
      Indicazioni
    </button>
    <button class="cta-ghost" aria-label="chiama"><svg viewBox="0 0 24 24">...</svg></button>
    <button class="cta-ghost" aria-label="sito"><svg viewBox="0 0 24 24">...</svg></button>
  </div>
</div>
```

**CSS**:
```css
.card-overlay {
  position: relative;
  margin-top: -28px;
  z-index: 5;
  background: var(--page);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 22px 22px 4px;
  text-align: center;
}

.card-overlay .grabber {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 99px;
  background: var(--ink-15);
}

.tb-name {
  font-family: var(--ff-ui);
  font-weight: 900;
  font-size: 28px;
  line-height: 1.05;
  letter-spacing: -.025em;
  color: var(--ink);
  margin-top: 6px;
}

.tb-addr {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--ink-70);
  line-height: 1.4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tb-addr svg {
  width: 13px;
  height: 13px;
  stroke: var(--ink-70);
  fill: none;
  stroke-width: 2;
  flex-shrink: 0;
}

.tb-chips {
  margin-top: 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.tb-chips .chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -.01em;
}

.tb-chips .chip.cat {
  border: 1.5px solid var(--corallo);
  color: var(--corallo-ink);
  background: #fff;
}

.tb-chips .chip.price {
  background: var(--ink-05);
  color: var(--ink);
}

.tb-chips .chip.moment {
  background: var(--oro-soft);
  color: var(--oro-deep);
}

.tb-chips .chip.open {
  background: #E5F3EA;
  color: #2E7D5B;
}

.tb-chips .chip.open .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2E7D5B;
}

.tb-ctas {
  margin-top: 16px;
  padding: 0 4px 4px;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

.tb-ctas .cta-main {
  flex: 1;
  max-width: 280px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--beige-cta);
  color: var(--ink);
  padding: 13px 18px;
  border-radius: var(--r-pill);
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  letter-spacing: -.01em;
}

.tb-ctas .cta-main:hover {
  background: var(--beige-cta-hover);
}

.tb-ctas .cta-main svg {
  width: 17px;
  height: 17px;
  stroke: var(--ink);
  fill: none;
  stroke-width: 2;
}

.tb-ctas .cta-ghost {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--white);
  border: 1px solid var(--ink-05);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.tb-ctas .cta-ghost svg {
  width: 18px;
  height: 18px;
  stroke: var(--ink);
  fill: none;
  stroke-width: 2;
}

.tb-ctas .cta-ghost.on {
  background: var(--corallo);
  border-color: var(--corallo);
}

.tb-ctas .cta-ghost.on svg {
  stroke: #fff;
  fill: #fff;
}
```

### 3. SCONTO BANNER (Verde 135° 2-stop)
**Ruolo**: Gradient lime→green, pill period, body testo + CTA chevron  
**CSS**:
```css
.sconto-link {
  margin: 18px 16px 0;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--white);
  border: 1px solid var(--ink-05);
  box-shadow: var(--shadow-sm);
  display: block;
  text-decoration: none;
  color: inherit;
}

.sconto-link .sl-banner {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--green-grad);
  color: var(--ink);
  font-weight: 800;
  font-size: 16px;
  letter-spacing: -.01em;
}

.sconto-link .sl-banner .sl-period {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  background: rgba(255,255,255,.55);
  color: var(--ink);
  padding: 3px 8px;
  border-radius: var(--r-pill);
}

.sconto-link .sl-body {
  padding: 11px 16px 13px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sconto-link .sl-t {
  flex: 1;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: -.01em;
  color: var(--ink);
}

.sconto-link .sl-s {
  display: block;
  font-size: 11px;
  color: var(--ink-70);
  margin-top: 2px;
  font-weight: 500;
}

.sconto-link .sl-go {
  font-size: 14px;
  font-weight: 800;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

### 4. STICKY CTA SCONTO (Bottom pill)
**Ruolo**: Position absolute bottom, backdrop blur, pill verde con testo + sd-go ink button  
**CSS**:
```css
.scr-has-sticky .scroll {
  padding-bottom: 86px;
}

.sticky-disc {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom,14px));
  background: rgba(250,247,242,.92);
  backdrop-filter: saturate(120%) blur(10px);
  -webkit-backdrop-filter: saturate(120%) blur(10px);
  border-top: 1px solid var(--ink-05);
  z-index: 12;
}

.sticky-disc .pill {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 6px 0 14px;
  background: var(--green-grad);
  color: var(--ink);
  border-radius: var(--r-pill);
  box-shadow: 0 6px 16px rgba(0,0,0,.08);
}

.sticky-disc .pill .sd-lead {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  flex: 1;
  min-width: 0;
}

.sticky-disc .pill .sd-t {
  font-weight: 900;
  font-size: 14.5px;
  letter-spacing: -.01em;
}

.sticky-disc .pill .sd-s {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .02em;
  color: rgba(34,24,28,.72);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sticky-disc .pill .sd-go {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  background: var(--ink);
  color: #fff;
  border-radius: var(--r-pill);
  font-weight: 800;
  font-size: 13px;
  letter-spacing: -.01em;
}

.sticky-disc .pill .sd-go svg {
  width: 14px;
  height: 14px;
  stroke: #fff;
  fill: none;
  stroke-width: 2.4;
}
```

### 5. SECTION (Label + title)
**CSS**:
```css
.sec {
  padding: 22px 22px 4px;
}

.sec .sec-lbl {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .14em;
  color: var(--corallo-ink);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.sec .sec-t {
  font-weight: 900;
  font-size: 19px;
  letter-spacing: -.02em;
  color: var(--ink);
  line-height: 1.2;
}
```

### 6. SECONDO BI (Review text + signature)
**Markup**:
```jsx
<div class="sec">
  <div class="sec-lbl">Secondo Bi</div>
  <div class="sec-t">Uno dei piemontesi dove torno senza pensarci</div>
</div>
<div class="bi-review">
  <p>Il Mulo fa quella cosa rara: una cucina piemontese che non è né museale né "rivisitata" a forza. Vitello tonnato con la salsa giusta, agnolotti del plin di quelli dove il ripieno conta, e una carta dei vini dove trovi cose buone anche senza spendere una follia.</p>
  <p>Ci vado quando voglio offrirmi una cena che mi ricordi che abito a Torino, e non mi delude mai.</p>
  <div class="sig">— Bi</div>
</div>
```

**CSS**:
```css
.bi-review {
  padding: 0 22px;
  margin-top: 10px;
}

.bi-review p {
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--ink);
  font-weight: 500;
}

.bi-review p + p {
  margin-top: 10px;
}

.bi-review .sig {
  margin-top: 12px;
  font-family: var(--ff-hand);
  font-size: 22px;
  color: var(--corallo-ink);
  line-height: 1;
}
```

### 7. ORARI (Card bianca con table)
**Markup**:
```jsx
<div class="orari">
  <div class="orari-head">
    <div class="oh-l"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span class="ot">Orari di apertura</span></div>
    <div class="oh-r"><span class="open"><span class="dot"></span>Aperto ora</span></div>
  </div>
  <div class="orari-sub">Chiude alle 23:30 · cucina fino alle 22:30</div>
  <div class="orari-days">
    <div class="row"><span class="od">Lun</span><span class="oh closed">Chiuso</span></div>
    <div class="row"><span class="od">Mar–Gio</span><span class="oh">12:00–15:00 · 19:00–23:00</span></div>
    <div class="row today"><span class="od">Ven (oggi)</span><span class="oh">12:00–15:00 · 19:00–23:30</span></div>
    <!-- ... -->
  </div>
</div>
```

**CSS**:
```css
.orari {
  margin: 14px 16px 0;
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-md);
  padding: 12px 14px;
}

.orari-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.orari-head .oh-l {
  display: flex;
  align-items: center;
  gap: 8px;
}

.orari-head .oh-l svg {
  width: 16px;
  height: 16px;
  stroke: var(--ink);
  fill: none;
  stroke-width: 2;
}

.orari-head .oh-l .ot {
  font-weight: 800;
  font-size: 13px;
  letter-spacing: -.01em;
}

.orari-head .oh-r .open {
  color: #2E7D5B;
  font-weight: 800;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.orari-head .oh-r .open .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2E7D5B;
}

.orari-sub {
  font-size: 11.5px;
  color: var(--ink-70);
  margin-bottom: 10px;
}

.orari-days {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  font-size: 12px;
}

.orari-days .row {
  display: contents;
}

.orari-days .od {
  color: var(--ink-70);
  font-weight: 600;
}

.orari-days .oh {
  color: var(--ink);
  font-weight: 700;
  text-align: right;
}

.orari-days .row.today .od,
.orari-days .row.today .oh {
  color: var(--corallo-ink);
  font-weight: 800;
}

.orari-days .oh.closed {
  color: var(--ink-40);
  font-weight: 600;
}
```

### 8. COSA PRENDERE (Oro gradient card)
**CSS**:
```css
.cosa-card {
  margin: 18px 16px 0;
  background: linear-gradient(135deg,#B08954 0%,#8E6B3E 100%);
  color: #fff;
  border-radius: var(--r-md);
  padding: 16px 18px;
  box-shadow: var(--shadow-sm);
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.cosa-card .fork {
  font-size: 26px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.cosa-card .cc-t {
  font-weight: 900;
  font-size: 16px;
  letter-spacing: -.01em;
  margin-bottom: 4px;
  color: #fff;
}

.cosa-card .cc-s {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255,255,255,.92);
  font-weight: 500;
}
```

### 9. CIAO SONO BI (Cream card)
**CSS**:
```css
.ciao-bi {
  margin: 22px 16px 0;
  background: var(--cream-deep);
  border-radius: var(--r-lg);
  padding: 20px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  border: 1px solid rgba(176,137,84,.2);
}

.ciao-bi .bi-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg,#F4E7CC,#E8453C);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 20px;
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: var(--shadow-sm);
}

.ciao-bi .bi-t {
  font-weight: 900;
  font-size: 15px;
  letter-spacing: -.01em;
  color: var(--ink);
}

.ciao-bi .bi-s {
  font-size: 11.5px;
  color: var(--ink-70);
  margin-top: 2px;
  margin-bottom: 8px;
}

.ciao-bi .bi-bio {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink);
  margin-bottom: 10px;
}

.ciao-bi .bi-socials {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ciao-bi .bi-socials a {
  padding: 6px 10px;
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ciao-bi .bi-more {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 800;
  color: var(--corallo-ink);
  text-decoration: none;
}
```

### 10. VICINI (Carosello card 220px)
**CSS**:
```css
.vicini {
  padding: 4px 0 30px 0;
}

.vicini-head {
  padding: 0 22px 10px;
  display: flex;
  align-items: end;
  justify-content: space-between;
}

.vicini-head h3 {
  font-weight: 900;
  font-size: 18px;
  letter-spacing: -.02em;
  line-height: 1.1;
}

.vicini-head .sub {
  font-size: 11px;
  color: var(--ink-70);
  margin-top: 2px;
}

.vicini-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 0 16px;
  -webkit-overflow-scrolling: touch;
}

.vicini-row::-webkit-scrollbar {
  display: none;
}

.vcard {
  flex: 0 0 220px;
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-md);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  box-shadow: var(--shadow-sm);
}

.vcard .vph {
  position: relative;
  width: 100%;
  aspect-ratio: 16/10;
  background: #ddd;
  overflow: hidden;
}

.vcard .vph img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vcard .vph .vdisc {
  position: absolute;
  top: 8px;
  left: 8px;
  background: var(--green-grad);
  color: var(--ink);
  font-weight: 800;
  font-size: 10px;
  padding: 3px 7px;
  border-radius: var(--r-pill);
  letter-spacing: -.01em;
}

.vcard .vbody {
  padding: 10px 12px 12px;
}

.vcard .vname {
  font-family: var(--ff-ui);
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -.02em;
  line-height: 1.15;
  color: var(--ink);
}

.vcard .vmeta {
  font-size: 11px;
  color: var(--ink-70);
  margin-top: 4px;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.vcard .vmeta .vt {
  background: var(--ink-05);
  color: var(--ink);
  font-weight: 700;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--r-pill);
}
```

### 11. FOOTER
**CSS**:
```css
.foot {
  margin-top: 24px;
  padding: 18px 20px 10px;
  border-top: 1px solid var(--ink-05);
  color: var(--ink-70);
  font-size: 10.5px;
  text-align: center;
  line-height: 1.55;
}

.foot .wmark {
  font-weight: 900;
  color: var(--corallo-ink);
  font-size: 12px;
  letter-spacing: -.02em;
  margin-bottom: 6px;
}

.foot a {
  color: var(--ink-70);
  text-decoration: none;
}
```

---

## SCHEDA DESKTOP (redesign-v3-desktop-scheda.html)

Questo file usa la vecchia TAN Songbird. **Ignorare completamente il markup e CSS di questo file** per il redesign v4. La struttura 2-col (left panel scrollable 420px + right panel mappa) è il reference layout, ma va riscritta con:
- Nome locale in **Poppins 900** (non TAN Songbird)
- Colori token esatti da v4-mobile-scheda.html
- CTA "Indicazioni" **beige** (#F2EDE1)
- Tutti gli altri componenti conformi a mobile

Il layout desktop 2-col persiste (left-panel 420px + right mappa), ma tutta la tipografia e i token colore passano a v4.

---

## TIPOGRAFIA DEFINITIVA (Regola anti-deriva)

1. **Wordmark + Pin B**: Alfa Slab One (--ff-mark) — SOLO
2. **Titoli di sezione + Nomi ristoranti + Heading principali**: Poppins 900 ultra-tight (letter-spacing: -.02em a -.03em)
3. **Piatti consigliati + Tip editoriale**: Caveat (--ff-hand) 18px–22px SOLO
4. **Tutto il resto (body, meta, label)**: Poppins (--ff-ui), weight 500–800

**NO TAN Songbird** in nessun luogo tranne wordmark.

---

## RESPONSIVE BREAKPOINT

```css
@media (max-width:1100px) {
  .cgrid { grid-template-columns: repeat(2,1fr); }
  .hero-card { grid-template-columns: 1fr; min-height: auto; }
  .hero-photo { min-height: 260px; }
  .hero-title { font-size: 56px; }
  .consiglio { grid-template-columns: 1fr; padding: 32px; }
  .suggest { grid-template-columns: 1fr; padding: 32px; }
  .annot-inner { grid-template-columns: 1fr; }
  .nav-links { display: none; }
}
```

---

Fine della specifica. Questo documento contiene **ogni singolo valore CSS/markup che Claude Code necessita** per replicare il redesign v4 nel sito live React+Vite.

---

---

# PARTE 4 — ESPLORA / SCONTI / SALVATI / PROFILO / AUTH / ADMIN + GLOBAL


---

# ESPLORA / SCONTI / SALVATI / PROFILO / AUTH / VERIFY / ADMIN

## ESPLORA · Mobile

### Topbar flottante (overlay sulla mappa)
```css
.esp-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 30;
  padding: 12px 20px;
  display: flex; gap: 8px; align-items: center;
}
.esp-top .wmark {
  flex: 0 0 auto;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(12px);
  border-radius: 999px;
  padding: 9px 14px;
  font-family: var(--ff-mark);
  font-size: 11px;
  letter-spacing: .08em;
  color: var(--corallo-ink);
  box-shadow: var(--shadow-sm);
  line-height: 1;
}
.esp-top .city {
  flex: 1;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(12px);
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 13px; font-weight: 700;
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  display: inline-flex; align-items: center; gap: 6px;
  cursor: pointer;
}
.esp-top .gps {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(12px);
  display: grid; place-items: center;
  border: 0;
  box-shadow: var(--shadow-sm);
  cursor: pointer; flex-shrink: 0;
}
```

**Markup:**
```jsx
<div class="esp-top">
  <div class="wmark">LA GUIDA DI BI</div>
  <div class="city">Torino <span class="caret">∨</span></div>
  <button class="gps" aria-label="geolocalizza">
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
      <path d="M12 2c-4 0-7 3-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-4-3-7-7-7z"/>
      <circle cx="12" cy="9" r="2.4" fill="currentColor"/>
    </svg>
  </button>
</div>
```

### Chip filtri orizzontali
```css
.esp-filters {
  position: absolute; top: 100px; left: 0; right: 0;
  z-index: 25;
  display: flex; gap: 6px;
  overflow-x: auto;
  padding: 0 12px;
  -webkit-overflow-scrolling: touch;
}
.esp-filters::-webkit-scrollbar { display: none; }
.esp-filters .fchip {
  flex: 0 0 auto;
  background: rgba(255,255,255,.94);
  backdrop-filter: blur(10px);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px; font-weight: 700;
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  display: inline-flex; align-items: center; gap: 5px;
  cursor: pointer; white-space: nowrap;
}
.esp-filters .fchip.active { background: var(--ink); color: #fff; }
.esp-filters .fchip .n {
  font-size: 9.5px; font-weight: 800;
  background: var(--ink-05);
  color: var(--ink);
  padding: 1.5px 5px;
  border-radius: 999px;
}
.esp-filters .fchip.active .n {
  background: rgba(255,255,255,.22); color: #fff;
}
```

### Pin mappa teardrop (colore per categoria)
```css
.esp-pin {
  position: absolute;
  width: 28px; height: 28px;
  margin-left: -14px; margin-top: -28px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 13px;
  z-index: 10;
  border: 2px solid #fff;
  filter: drop-shadow(0 3px 6px rgba(34,24,28,.32));
  cursor: pointer;
}
.esp-pin > * { transform: rotate(45deg); line-height: 1; }

.esp-pin.cat-pasta     { background: #C8601E; }
.esp-pin.cat-pizza     { background: #2E5E8C; }
.esp-pin.cat-vino      { background: #5A3F75; }
.esp-pin.cat-aperitivo { background: #D36B55; }
.esp-pin.cat-asian     { background: #B8563D; }
.esp-pin.cat-dolce     { background: #B73F70; }
.esp-pin.cat-bar       { background: #7E5FA0; }
.esp-pin.cat-carne     { background: #8F3A2F; }
.esp-pin.cat-matcha    { background: #5E9047; }

.esp-pin.sel {
  width: 34px; height: 34px;
  margin-left: -17px; margin-top: -34px;
  background: var(--corallo);
  font-size: 14px; z-index: 15;
  filter: drop-shadow(0 4px 12px rgba(232,80,76,.45));
}

.esp-cluster {
  position: absolute;
  width: 36px; height: 36px;
  margin-left: -18px; margin-top: -18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(34,24,28,.35);
  display: grid; place-items: center;
  font-weight: 800; font-size: 13px;
  color: var(--ink);
  filter: drop-shadow(0 3px 6px rgba(34,24,28,.2));
  z-index: 10;
}
```

### Carosello card bottom (sopra la nav)
```css
.esp-bottom {
  position: absolute; left: 0; right: 0; bottom: 92px;
  z-index: 35;
  pointer-events: none;
}
.esp-bottom > * { pointer-events: auto; }

.esp-lista-pill {
  display: flex; align-items: center; gap: 8px;
  width: fit-content; margin: 0 auto 10px;
  background: var(--ink); color: #fff;
  font-size: 13px; font-weight: 800;
  letter-spacing: -.01em;
  padding: 10px 18px;
  border-radius: 999px;
  border: 0; cursor: pointer;
  box-shadow: var(--shadow-md);
}

.esp-caro {
  display: flex; gap: 10px;
  overflow-x: auto;
  padding: 0 14px 6px;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
}
.esp-caro::-webkit-scrollbar { display: none; }

.esp-caro-card {
  flex: 0 0 82%;
  scroll-snap-align: center;
  background: var(--white);
  border-radius: var(--r-lg);
  overflow: hidden;
  text-decoration: none; color: inherit;
  box-shadow: var(--shadow-md);
  display: grid; grid-template-columns: 96px 1fr auto;
  gap: 12px; padding: 10px;
  align-items: center;
}
.esp-caro-card .eph {
  width: 96px; height: 88px;
  border-radius: var(--r-sm);
  background: #ddd;
  overflow: hidden; position: relative;
  flex-shrink: 0;
}
.esp-caro-card .eph img {
  width: 100%; height: 100%; object-fit: cover;
}
.esp-caro-card .eph .edisc {
  position: absolute; top: 5px; left: 5px;
  background: var(--green-grad);
  color: var(--ink);
  font-size: 9.5px; font-weight: 800;
  padding: 2.5px 6px; border-radius: 999px;
  letter-spacing: -.01em;
}
.esp-caro-card .ename {
  font-family: var(--ff-ui); font-weight: 800;
  font-size: 16px; letter-spacing: -.015em;
  line-height: 1.15; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.esp-caro-card .emeta {
  font-size: 11px; color: var(--ink-70);
  margin-top: 3px;
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 5px;
}
.esp-caro-card .ego {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: var(--ink-05);
  color: var(--ink);
  display: grid; place-items: center;
  font-size: 14px; font-weight: 800;
  flex-shrink: 0;
}
```

### Esplora desktop (split map + sidebar)
- Layout 2-col: **sidebar lista 420px** (scrollable) + **mappa full height** a destra
- Filter chips in alto nella sidebar
- Card lista = `esp-caro-card` ma full-width (senza carosello)
- Tap card → centro mappa + highlight pin

---

## SCONTI · Mobile

### Tabs "Disponibili ora" / "I miei"
```css
.sc-tabs {
  padding: 6px 16px 14px;
  display: flex; gap: 6px;
}
.sc-tab {
  flex: 1; padding: 11px 12px;
  border-radius: var(--r-pill);
  background: var(--ink-05);
  text-align: center;
  font-size: 13px; font-weight: 700;
  color: var(--ink-70);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 7px;
  border: 0;
  font-family: inherit;
}
.sc-tab.active { background: var(--ink); color: #fff; }
.sc-tab .tn {
  display: inline-grid; place-items: center;
  min-width: 20px; height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 10.5px; font-weight: 800;
}
.sc-tab:not(.active) .tn { background: var(--ink); color: #fff; }
.sc-tab.active .tn { background: rgba(255,255,255,.22); color: #fff; }
```

### Drop card (live countdown)
```css
.drop-mini {
  flex: 0 0 68%;
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-md);
  padding: 12px;
  display: flex; gap: 10px; align-items: center;
  box-shadow: var(--shadow-sm);
}
.drop-mini .thumb {
  width: 54px; height: 54px;
  border-radius: var(--r-sm);
  overflow: hidden; background: #ddd;
  flex: 0 0 54px;
}
.drop-mini .thumb img { width: 100%; height: 100%; object-fit: cover; }
.drop-mini .mbody { min-width: 0; flex: 1; }
.drop-mini .dtop {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 4px;
}
.drop-mini .disc-tag {
  background: var(--corallo-soft);
  color: var(--corallo-ink);
  font-weight: 800; font-size: 11px;
  padding: 3px 7px; border-radius: 999px;
  letter-spacing: -.01em;
}
.drop-mini .timer {
  font-size: 10px; font-weight: 700;
  color: var(--ink-40);
  letter-spacing: .04em;
}
.drop-mini .mname {
  font-weight: 800; font-size: 14px;
  letter-spacing: -.01em; line-height: 1.2;
}
.drop-mini .mwhere {
  font-size: 11px; color: var(--ink-70);
  margin-top: 1px;
}
```

Per la drop FULL (dettaglio sconto), aggiungere:
- Progress bar "restano 12 di 30" (colore `var(--corallo)`, track `var(--ink-05)`)
- CTA "Prendi questo drop" pill corallo full-width 15px padding 14
- Stato esaurito: opacity .55 + badge "ESAURITO" ink

### Convention card (static sconto)
```css
.conv {
  display: block;
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-md);
  overflow: hidden;
  text-decoration: none; color: inherit;
  box-shadow: var(--shadow-sm);
}
.conv .cv-banner {
  height: 46px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 14px;
  background: var(--green-grad);
  color: var(--ink);
  font-weight: 800; font-size: 15px;
  letter-spacing: -.01em;
  position: relative;
}
.conv .cv-banner .cv-period {
  font-size: 10px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink);
  background: rgba(255,255,255,.55);
  padding: 3px 8px; border-radius: 999px;
}
.conv-main {
  display: grid; grid-template-columns: 54px 1fr auto;
  gap: 12px; align-items: center;
  padding: 12px 14px;
}
.conv-main .cv-thumb {
  width: 54px; height: 54px;
  border-radius: var(--r-sm);
  overflow: hidden; background: #ddd;
}
.conv-main .cv-name {
  font-family: var(--ff-ui); font-weight: 800;
  font-size: 16px; letter-spacing: -.015em;
  line-height: 1.2; color: var(--ink);
}
.conv-main .cv-where {
  font-size: 11px; color: var(--ink-70);
  margin-top: 2px;
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
}
.conv-main .cv-cta {
  font-size: 12px; font-weight: 800;
  color: #fff; background: var(--ink);
  padding: 9px 14px; border-radius: 999px;
  white-space: nowrap;
}
.conv.used { opacity: .55; }
.conv.used .cv-banner::after {
  content: "✓ GIÀ USATO";
  position: absolute; top: 50%; right: 14px;
  transform: translateY(-50%);
  background: rgba(34,24,28,.8);
  color: #fff;
  font-size: 9px; font-weight: 800;
  letter-spacing: .06em;
  padding: 4px 8px; border-radius: 999px;
}
```

### QR modal (overlay)
```css
.qr-modal {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.7);
  backdrop-filter: blur(4px);
  display: grid; place-items: center;
  z-index: 100;
}
.qr-modal .panel {
  background: var(--page);
  border-radius: var(--r-lg);
  padding: 28px 24px;
  max-width: 340px; text-align: center;
}
.qr-modal .close {
  position: absolute; top: 16px; right: 16px;
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--ink-05);
  display: grid; place-items: center;
  border: 0; cursor: pointer;
}
.qr-modal .code {
  width: 220px; height: 220px;
  background: var(--white);
  border: 2px solid var(--ink-05);
  border-radius: var(--r-md);
  margin: 0 auto 18px;
  display: grid; place-items: center;
  font-size: 140px;
}
.qr-modal h3 {
  font-weight: 900; font-size: 18px;
  letter-spacing: -.02em; margin-bottom: 8px;
}
.qr-modal .sub {
  font-size: 12px; color: var(--ink-70);
  margin-bottom: 16px; line-height: 1.45;
}
.qr-modal .cta {
  display: block; width: 100%;
  padding: 15px;
  background: var(--corallo); color: #fff;
  border: 0; border-radius: 14px;
  font-weight: 800; font-size: 15px; cursor: pointer;
}
```

### Sconti desktop
- Grid 3-col per drop + convention misti
- Filter bar sticky in alto con tabs orizzontali
- Drop card full: hero image 16/10 + body con countdown grande + CTA
- Hover: translateY(-3px), shadow-md

---

## SALVATI · Mobile

### Tabs cartelle orizzontali
```css
.sv-lists {
  display: flex; gap: 8px;
  overflow-x: auto;
  padding: 0 16px 14px;
  -webkit-overflow-scrolling: touch;
}
.sv-lists::-webkit-scrollbar { display: none; }
.sv-list {
  flex: 0 0 auto;
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: var(--white);
  border: 1px solid var(--ink-05);
  text-align: left; cursor: pointer;
  min-width: 130px;
  display: flex; flex-direction: column; gap: 3px;
}
.sv-list.active { background: var(--ink); color: #fff; border-color: var(--ink); }
.sv-list .lname {
  font-weight: 800; font-size: 13px; letter-spacing: -.01em;
}
.sv-list .lcount {
  font-size: 10px; font-weight: 700;
  color: var(--ink-40); letter-spacing: .04em;
}
.sv-list.active .lcount { color: rgba(255,255,255,.55); }
.sv-list.new {
  background: transparent;
  border: 1px dashed var(--ink-15);
  color: var(--ink-70);
  justify-content: center; align-items: center;
  min-width: 100px;
}
.sv-list.new .lname { font-size: 13px; color: var(--ink); }
```

### Grid cartelle/rcard
```css
.sv-grid {
  padding: 0 16px;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.sv-card {
  background: var(--white);
  border-radius: var(--r-md);
  overflow: hidden;
  border: 1px solid var(--ink-05);
  text-decoration: none; color: inherit;
  position: relative;
}
.sv-card .ph {
  position: relative;
  width: 100%; aspect-ratio: 4/3;
  background: #ddd; overflow: hidden;
}
.sv-card .ph img { width: 100%; height: 100%; object-fit: cover; }
.sv-card .ph .heart {
  position: absolute; top: 8px; right: 8px;
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--corallo);
  color: #fff;
  display: grid; place-items: center;
  font-size: 12px; border: 0;
}
.sv-card .body { padding: 8px 10px 10px; }
.sv-card .name {
  font-weight: 800; font-size: 13px;
  letter-spacing: -.01em; line-height: 1.2;
}
.sv-card .meta {
  font-size: 10.5px; color: var(--ink-70); margin-top: 3px;
}
```

### Nota personale (Caveat handwriting)
```css
.sv-note {
  margin: 14px 16px 0;
  padding: 14px;
  background: var(--oro-soft);
  border: 1px solid rgba(176,137,84,.3);
  border-radius: var(--r-md);
  font-family: var(--ff-hand);
  font-size: 17px; line-height: 1.25;
  color: var(--ink);
}
.sv-note::before {
  content: "✏︎  ";
  color: var(--oro);
  font-family: var(--ff-ui);
  font-size: 14px; font-weight: 700; letter-spacing: .04em;
}
```

### Salvati desktop
- Layout 2-col: **sidebar cartelle 240px** + **main grid 3-col rcard**
- Nuova cartella → modal overlay con input + color picker

---

## PROFILO · Mobile

### Header + avatar + CTA modifica
```css
.pf-head {
  padding: 20px 20px 0;
  display: flex; flex-direction: column;
  align-items: center; gap: 8px;
}
.pf-head .avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--corallo), var(--corallo-ink));
  color: #fff;
  display: grid; place-items: center;
  font-family: var(--ff-mark);
  font-size: 28px; font-weight: 700;
}
.pf-name {
  font-weight: 900; font-size: 22px;
  letter-spacing: -.02em;
}
.pf-city {
  font-size: 12px; color: var(--ink-70);
  display: inline-flex; align-items: center; gap: 5px;
}
.pf-city .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--corallo);
}
.pf-edit {
  margin-top: 6px;
  padding: 7px 14px;
  background: var(--ink-05);
  border-radius: 999px;
  font-size: 12px; font-weight: 700;
  color: var(--ink);
  text-decoration: none;
}
```

### Stats row (3 colonne — NO recensioni!)
```css
.pf-stats {
  margin: 14px 16px 0;
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.pf-stat {
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-md);
  padding: 14px 10px;
  text-align: center;
}
.pf-stat .num {
  font-weight: 900; font-size: 24px;
  letter-spacing: -.02em; line-height: 1;
  color: var(--ink);
}
.pf-stat .lbl {
  font-size: 10.5px; color: var(--ink-70);
  margin-top: 5px;
  font-weight: 700; letter-spacing: .04em;
  text-transform: uppercase;
}
.pf-stat.accent .num { color: var(--corallo-ink); }
```

Label concesse: `Ristoranti salvati · Drop presi · Condivisioni` (MAI "recensioni").

### Quote Caveat editoriale
```css
.pf-quote {
  margin: 16px 16px 0;
  padding: 16px 18px;
  background: var(--oro-soft);
  border: 1px solid rgba(176,137,84,.3);
  border-radius: var(--r-md);
}
.pf-quote .q {
  font-family: var(--ff-hand);
  font-size: 19px; line-height: 1.25;
  color: var(--ink);
}
.pf-quote .sig {
  font-size: 11px; color: var(--ink-70);
  margin-top: 6px; font-weight: 700;
}
```

### Menu list con icone
```css
.pf-sec {
  padding: 18px 20px 6px;
  font-size: 10px; font-weight: 800;
  letter-spacing: .12em; color: var(--ink-40);
  text-transform: uppercase;
}
.pf-list {
  margin: 0 16px;
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-md);
  overflow: hidden;
}
.pf-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ink-05);
  text-decoration: none; color: inherit;
}
.pf-item:last-child { border-bottom: 0; }
.pf-item .ic {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: var(--ink-05);
  display: grid; place-items: center;
  color: var(--ink); flex-shrink: 0;
}
.pf-item .ic svg {
  width: 14px; height: 14px;
  stroke: currentColor; fill: none; stroke-width: 2;
}
.pf-item .ic.cor { background: var(--corallo-soft); color: var(--corallo-ink); }
.pf-item .ic.oro { background: var(--oro-soft); color: var(--oro); }
.pf-item .lbl {
  flex: 1;
  font-weight: 700; font-size: 14px; letter-spacing: -.01em;
}
.pf-item .caret { color: var(--ink-40); font-size: 14px; }
.pf-item.danger .lbl { color: var(--corallo-ink); }
```

**Voci menu canoniche:**
1. Suggerisci un locale (`ic.cor`) → apri bottom sheet "Consiglia"
2. Per i locali (`ic.oro`) → link a `/verify` (PIN ristoratore)
3. Preferenze notifiche
4. Privacy & dati
5. Aiuto
6. Esci (`.danger`)

---

## AUTH MOBILE · 3 Schermate

### Screen 1 — Welcome
```css
.auth-body { padding: 28px 24px 0; }

.auth-kick {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px;
  background: var(--corallo-soft);
  color: var(--corallo-ink);
  border-radius: 999px;
  font-size: 10.5px; font-weight: 800;
  letter-spacing: .1em; text-transform: uppercase;
}
.auth-h1 {
  font-family: var(--ff-ui); font-weight: 900;
  font-size: 38px; letter-spacing: -.03em;
  line-height: 1.04;
  margin: 12px 0 8px;
  color: var(--ink);
}
.auth-sub {
  font-size: 14px; color: var(--ink-70);
  line-height: 1.5; margin-bottom: 22px;
}

.gbtn {
  display: flex; align-items: center; justify-content: center;
  gap: 12px;
  width: 100%; padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--ink-15);
  border-radius: 16px;
  font-weight: 800; font-size: 14.5px;
  color: var(--ink);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  text-decoration: none;
}
.gbtn svg { width: 18px; height: 18px; }
.gbtn.apple { background: var(--ink); color: #fff; border-color: var(--ink); }

.divider {
  display: flex; align-items: center; gap: 10px;
  margin: 18px 0;
  color: var(--ink-40);
  font-size: 11px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase;
}
.divider::before, .divider::after {
  content: ""; flex: 1; height: 1px;
  background: var(--ink-15);
}
```

**Copy canonica Screen 1:**
- Kicker: "CIAO SONO BI"
- H1: "Questa è la mia guida a Torino"
- Sub: "Entra per salvare i locali, prendere gli sconti, ricevere i miei consigli."
- `.gbtn` "Continua con Google" (logo G)
- `.gbtn.apple` "Continua con Apple" (logo)
- `.divider` "Oppure"
- Link testuale corallo "Continua con email"
- Footer link: "Sei ristoratore? Accedi qui" → `/verify`

### Screen 2 — Email input + CTA
```css
.field { margin-bottom: 12px; }
.field label {
  display: block;
  font-size: 11.5px; font-weight: 800;
  letter-spacing: .04em; text-transform: uppercase;
  color: var(--ink-70);
  margin-bottom: 6px;
}
.field input {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--ink-15);
  border-radius: 14px;
  background: #fff;
  font-family: inherit;
  font-size: 14.5px; color: var(--ink);
  outline: none;
  transition: border-color .2s;
}
.field input:focus { border-color: var(--corallo); }
.field input::placeholder { color: var(--ink-40); font-weight: 500; }

.cta-large {
  display: block; width: 100%;
  margin-top: 8px;
  padding: 15px;
  background: var(--corallo); color: #fff;
  border: 0; border-radius: 16px;
  font-weight: 800; font-size: 15px;
  cursor: pointer;
  letter-spacing: -.01em;
  box-shadow: 0 8px 20px rgba(232,69,60,.28);
  transition: transform .15s;
}
.cta-large:hover { transform: translateY(-1px); }

.bottom-link {
  margin-top: 22px; text-align: center;
  font-size: 13px; color: var(--ink-70);
}
.bottom-link a {
  color: var(--corallo-ink); font-weight: 800;
  text-decoration: none;
}
```

### Screen 3 — Magic link sent
Copy centrata verticalmente:
- Icona mail 48px ink
- H1: "Ti ho mandato il link"
- Sub: "Apri la mail che trovi in arrivo. Basta un tap e sei dentro."
- CTA secondaria "Rinvia il link" (pill ghost)
- Link "Cambia email" (testo corallo)

---

## VERIFY · PIN 6 cifre ristoratore

### PIN lock screen
```css
.pin-wrap {
  height: 100%;
  background: linear-gradient(180deg, var(--page) 0%, var(--cream-deep) 100%);
  padding: 24px 28px 24px;
  display: flex; flex-direction: column;
}

.pin-logo {
  font-family: var(--ff-mark);
  font-size: 18px; letter-spacing: .02em;
  line-height: 1;
  text-align: center;
  margin-top: 16px;
}
.pin-logo small {
  display: block;
  font-family: var(--ff-ui);
  font-weight: 700; font-size: 10px;
  letter-spacing: .14em;
  color: var(--corallo);
  margin-top: 4px;
  text-transform: uppercase;
}

.pin-av {
  width: 76px; height: 76px;
  border-radius: 22px;
  background: var(--ink); color: #fff;
  display: grid; place-items: center;
  font-family: var(--ff-mark); font-size: 30px;
  margin: 30px auto 14px;
  box-shadow: 0 14px 32px rgba(34,24,28,.2);
}

.pin-biz { text-align: center; margin-bottom: 4px; }
.pin-biz .n {
  font-family: var(--ff-ui); font-weight: 900;
  font-size: 22px; letter-spacing: -.02em;
}
.pin-biz .z {
  font-size: 12px; color: var(--ink-70);
  font-weight: 700; margin-top: 2px;
}

.pin-sub {
  text-align: center;
  color: var(--ink-70);
  font-size: 12px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  margin: 14px 0 18px;
}

.pin-dots {
  display: flex; justify-content: center; gap: 11px;
  margin: 10px 0 18px;
}
.pin-dot {
  width: 15px; height: 15px;
  border-radius: 50%;
  border: 2px solid var(--ink-15);
  background: transparent;
  transition: .15s;
}
.pin-dot.on { background: var(--ink); border-color: var(--ink); }
.pin-dot.wrong {
  background: var(--corallo);
  border-color: var(--corallo);
  animation: shake .4s;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

.pin-pad {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: auto;
}
.pk {
  background: #fff;
  border: 1px solid var(--ink-15);
  border-radius: 18px;
  padding: 18px;
  text-align: center;
  font-family: var(--ff-ui);
  font-weight: 800; font-size: 26px;
  letter-spacing: -.02em;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,.02);
  position: relative;
}
.pk .sub {
  display: block;
  font-size: 10px; font-weight: 800;
  letter-spacing: .08em;
  color: var(--ink-70);
  margin-top: 2px;
  text-transform: uppercase;
}
.pk.spc {
  background: transparent; border: 0; box-shadow: none;
  cursor: default;
}
.pk.ico {
  font-size: 20px;
  background: transparent; border: 0; box-shadow: none;
  font-weight: 700; color: var(--ink-70);
}

.pin-foot {
  text-align: center;
  margin-top: 14px;
  font-size: 12px; color: var(--ink-70);
  font-weight: 600;
}
.pin-foot a {
  color: var(--ink); font-weight: 800;
  text-decoration: underline;
}
```

**Markup:**
```jsx
<div class="pin-wrap">
  <div class="pin-logo">LA GUIDA DI BI<small>Area ristoratori</small></div>
  <div class="pin-av">C</div>
  <div class="pin-biz">
    <div class="n">Consorzio</div>
    <div class="z">San Salvario · Daniele</div>
  </div>
  <div class="pin-sub">inserisci le 6 cifre</div>
  <div class="pin-dots">
    <div class="pin-dot on"></div>
    <div class="pin-dot on"></div>
    <div class="pin-dot on"></div>
    <div class="pin-dot on"></div>
    <div class="pin-dot"></div>
    <div class="pin-dot"></div>
  </div>
  <div class="pin-pad">
    <div class="pk">1</div><div class="pk">2</div><div class="pk">3</div>
    <div class="pk">4</div><div class="pk">5</div><div class="pk">6</div>
    <div class="pk">7</div><div class="pk">8</div><div class="pk">9</div>
    <div class="pk spc"></div><div class="pk">0</div><div class="pk ico">⌫</div>
  </div>
  <div class="pin-foot">PIN dimenticato? <a href="#">Chiama Bi</a></div>
</div>
```

**Comportamento:**
- Autofocus su campo hidden, accetta digit 0-9
- Dopo 6 digit → POST `/api/verify-pin` con cookie `verify_device_token`
- Error: shake 0.4s + dots corallo + auto-reset dopo 600ms
- Link "Chiama Bi" apre `tel:+39...`

---

## ADMIN MOBILE

### Topbar sticky
```css
.m-top {
  padding: 8px 14px;
  display: flex; align-items: center; gap: 12px;
  border-bottom: 1px solid var(--ink-05);
}
.m-top .burger {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: transparent; border: 0;
  font-size: 18px; cursor: pointer;
}
.m-top .wm {
  flex: 1;
  font-family: var(--ff-mark);
  font-size: 12px; letter-spacing: .02em;
  font-weight: 700; line-height: 1;
}
.m-top .wm small {
  display: block;
  font-family: var(--ff-ui);
  font-size: 8px; font-weight: 700;
  letter-spacing: .14em;
  color: var(--corallo);
  margin-top: 2px;
  text-transform: uppercase;
}
.m-top .bell {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--ink-05);
  display: grid; place-items: center;
  font-size: 16px; cursor: pointer;
}
.m-top .av {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--corallo);
  color: #fff;
  display: grid; place-items: center;
  font-family: var(--ff-mark);
  font-size: 14px; font-weight: 700;
}
```

### KPI cards (2x2 grid)
```css
.stat-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.stat {
  background: #fff;
  border: 1px solid var(--ink-05);
  border-radius: 14px;
  padding: 12px 14px;
}
.stat .lab {
  font-size: 10px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink-70);
}
.stat .val {
  font-family: var(--ff-ui); font-weight: 900;
  font-size: 24px; letter-spacing: -.03em;
  margin-top: 4px; line-height: 1;
}
.stat .sub {
  font-size: 11px; font-weight: 700;
  color: var(--ink-70); margin-top: 2px;
}
.stat .sub.up { color: #2C7A4A; }
.stat.featured {
  background: var(--ink); color: #fff;
  border-color: var(--ink);
}
.stat.featured .lab { color: rgba(255,255,255,.55); }
```

### Lista ristoranti (rist-card)
```css
.rist-card {
  background: var(--white);
  border: 1px solid var(--ink-05);
  border-radius: var(--r-md);
  overflow: hidden;
  padding: 10px;
  display: flex; gap: 12px;
  align-items: flex-start;
  margin-bottom: 8px;
}
.rist-card .cover {
  width: 64px; height: 64px;
  border-radius: var(--r-sm);
  background: linear-gradient(135deg, #c6a78f, #8e6e52);
  position: relative;
  flex-shrink: 0;
}
.rist-card .cover .dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #2E7D5B;
  position: absolute; top: 4px; right: 4px;
}
.rist-card .cover .dot.off { background: var(--ink-40); }
.rist-card .body { min-width: 0; flex: 1; }
.rist-card .nm {
  font-weight: 800; font-size: 14px;
  letter-spacing: -.01em;
}
.rist-card .meta {
  font-size: 11px; color: var(--ink-70);
  margin-top: 2px;
  display: flex; gap: 6px; flex-wrap: wrap;
  align-items: center;
}
.rist-card .dsep {
  width: 1px; height: 12px;
  background: var(--ink-15);
}
.rist-card .chips {
  display: flex; gap: 4px; margin-top: 4px;
}
.t-tag {
  font-size: 9px; font-weight: 800;
  padding: 2px 6px; border-radius: 6px;
  background: var(--ink-05); color: var(--ink);
}
.t-tag.g { background: #E0F0E8; color: #2E7D5B; }
.t-tag.m { background: var(--oro-soft); color: var(--oro); }
.t-tag.c { background: var(--corallo-soft); color: var(--corallo-ink); }
.t-disc {
  font-size: 9px; font-weight: 800;
  padding: 2px 6px; border-radius: 6px;
  background: var(--corallo); color: #fff;
}
.rist-card .arr {
  color: var(--ink-40); font-size: 14px;
  margin-left: auto;
}
```

### FAB + bottom nav admin
```css
.fab {
  position: fixed; bottom: 80px; right: 16px;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--corallo); color: #fff;
  border: 0;
  font-size: 24px; cursor: pointer;
  box-shadow: 0 12px 28px rgba(232,69,60,.45);
  z-index: 40;
}
.m-bottom {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #fff;
  border-top: 1px solid var(--ink-05);
  display: flex; gap: 0; padding: 0;
}
.bn {
  flex: 1; padding: 10px; text-align: center;
  font-size: 11px; font-weight: 800;
  color: var(--ink-70);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  position: relative; cursor: pointer;
}
.bn .ic { font-size: 18px; }
.bn.on { color: var(--corallo); }
.bn.on .ic {
  background: var(--corallo-soft);
  width: 32px; height: 32px;
  border-radius: 8px;
  display: grid; place-items: center;
}
.bn .badge {
  position: absolute; top: 2px; right: 6px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--corallo); color: #fff;
  font-size: 10px; font-weight: 900;
  display: grid; place-items: center;
}
```

**Voci nav admin:** Dashboard · Ristoranti · Drop · Email · Profilo

---

## ADMIN DESKTOP

### Layout split: sidebar 240–250px + main area
```css
.dsk-wrap {
  display: grid;
  grid-template-columns: 250px 1fr;
  min-height: 100vh;
}

.dsk-side {
  background: var(--ink); color: #fff;
  padding: 26px 18px;
  display: flex; flex-direction: column; gap: 4px;
  width: 250px; min-height: 100%;
}
.dsk-side .wm {
  font-family: var(--ff-mark);
  font-size: 14px; line-height: 1.1;
  padding: 8px 8px 18px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  margin-bottom: 18px;
}
.dsk-side .wm small {
  display: block;
  font-family: var(--ff-ui);
  font-weight: 700; font-size: 10px;
  letter-spacing: .14em;
  color: rgba(255,255,255,.45);
  margin-top: 4px;
  text-transform: uppercase;
}
.dsk-side .ni {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  font-size: 14px; font-weight: 700;
  color: rgba(255,255,255,.78);
  cursor: pointer;
}
.dsk-side .ni .ic {
  width: 20px; font-size: 14px; text-align: center;
}
.dsk-side .ni.on {
  background: var(--corallo); color: #fff;
  box-shadow: 0 6px 14px rgba(232,69,60,.3);
}

.dsk-side .dsk-user {
  margin-top: auto;
  display: flex; align-items: center; gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.04);
}
.dsk-side .dsk-user .av {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--corallo);
  display: grid; place-items: center;
  color: #fff;
  font-family: var(--ff-mark);
  font-size: 14px;
}
.dsk-side .dsk-user .u { font-size: 13px; font-weight: 800; }
.dsk-side .dsk-user .r {
  font-size: 10px; color: rgba(255,255,255,.5);
  font-weight: 600;
}
```

**Voci sidebar:** Dashboard · Ristoranti · Drop · Convenzioni · Email · Settings

### Main content (crumb + title + grid)
```css
.dsk-main {
  overflow-y: auto;
  padding: 26px 32px;
  flex: 1;
}
.dsk-crumb {
  font-size: 12px; font-weight: 700;
  color: var(--ink-70); margin-bottom: 6px;
}
.dsk-title {
  font-family: var(--ff-ui); font-weight: 900;
  font-size: 32px; letter-spacing: -.025em;
}
.dsk-sub {
  color: var(--ink-70); font-weight: 500;
  margin: 4px 0 22px;
  display: flex; align-items: center; gap: 10px;
}
.dsk-sub .dot {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: var(--ink-70);
}
.dsk-grid {
  display: grid; grid-template-columns: 1.3fr 1fr;
  gap: 18px;
}

.dsk-hero {
  background: linear-gradient(135deg, #A3E635, #4ADE80);
  color: var(--ink);
  border-radius: 22px;
  padding: 26px;
  position: relative; overflow: hidden;
}
.dsk-hero::before {
  content: "";
  position: absolute; top: -40px; right: -40px;
  width: 200px; height: 200px;
  border-radius: 50%;
  background: rgba(255,255,255,.22);
}
.dsk-hero .lab {
  font-size: 11px; font-weight: 900;
  letter-spacing: .14em; text-transform: uppercase;
  opacity: .75; position: relative;
}
.dsk-hero .val {
  font-family: var(--ff-ui); font-weight: 900;
  font-size: 68px; letter-spacing: -.045em;
  line-height: 1; margin-top: 8px;
  position: relative;
}

.dsk-stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px; margin: 18px 0;
}
.dsk-stat {
  background: #fff;
  border: 1px solid var(--ink-05);
  border-radius: 18px;
  padding: 16px;
}
.dsk-stat .lab {
  font-size: 11px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink-70);
}
.dsk-stat .val {
  font-family: var(--ff-ui); font-weight: 900;
  font-size: 34px; letter-spacing: -.03em;
  line-height: 1; margin-top: 6px;
}
.dsk-stat .sub {
  font-size: 12px; font-weight: 700;
  color: var(--ink-70); margin-top: 4px;
}
.dsk-stat .sub.up { color: #2C7A4A; }

.dsk-card {
  background: #fff;
  border: 1px solid var(--ink-05);
  border-radius: 18px;
  padding: 20px;
}
.dsk-card h4 {
  font-family: var(--ff-ui); font-weight: 900;
  font-size: 16px; letter-spacing: -.01em;
  margin-bottom: 12px;
  display: flex; align-items: center;
}
.dsk-card h4 .c-all {
  margin-left: auto;
  font-size: 11px; font-weight: 800;
  color: var(--corallo);
}
```

### Tabella ristoranti desktop
- `<table class="admin-tbl">` con header sticky
- Colonne: Nome · Stato (dot green/grey) · Zona · Categoria · Drop attivi · Ultima modifica · Azioni (⋯)
- Row hover: `background:var(--ink-05)`
- Action menu: Modifica · Disattiva · Elimina (conferma modale)

### Dettaglio ristorante (split 60/40)
- Left: form modifica (immagini, testo "Secondo Bi", orari, piatti consigliati, sconto attivo)
- Right: sticky preview "Come lo vede l'utente" con scheda mobile embeddata in iframe 390×780

---

# RESPONSIVE GLOBAL

```css
/* Desktop → tablet collapse */
@media (max-width: 1100px) {
  .cgrid { grid-template-columns: repeat(2,1fr); }
  .hero-card { grid-template-columns: 1fr; min-height: auto; }
  .hero-photo { min-height: 260px; }
  .hero-title { font-size: 56px; }
  .consiglio { grid-template-columns: 1fr; padding: 32px; }
  .suggest { grid-template-columns: 1fr; padding: 32px; }
  .nav-links { display: none; }
  .dsk-grid { grid-template-columns: 1fr; }
  .dsk-stats { grid-template-columns: repeat(2,1fr); }
}

/* Tablet → mobile collapse */
@media (max-width: 768px) {
  .cgrid { grid-template-columns: 1fr; }
  .dsk-stats { grid-template-columns: 1fr 1fr; }
  .dsk-wrap { grid-template-columns: 1fr; }
  .dsk-side { position: fixed; transform: translateX(-100%); transition: .2s; }
  .dsk-side.open { transform: translateX(0); }
}
```

---

# SAFARI iOS (PR1 specs)

Aggiungere SEMPRE in `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#FAF7F2" media="(prefers-color-scheme: light)" />
```

CSS globale:
```css
html, body { min-height: 100vh; min-height: -webkit-fill-available; }
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
.nav { bottom: calc(18px + env(safe-area-inset-bottom,0px)); }
.sticky-disc { padding-bottom: calc(10px + env(safe-area-inset-bottom,14px)); }
.hero-topbar { top: calc(44px + env(safe-area-inset-top,0px)); }
```

---

# FONT LOADING (PR2 specs)

Rimuovere tutti i riferimenti a Satoshi/TAN Songbird. In `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Caveat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

CSS:
```css
:root {
  --ff-ui: 'Poppins', -apple-system, 'Helvetica Neue', sans-serif;
  --ff-mark: 'Alfa Slab One', Georgia, serif;
  --ff-hand: 'Caveat', cursive;
}
body {
  font-family: var(--ff-ui);
  font-weight: 500;
  color: var(--ink);
  background: var(--page);
  font-feature-settings: "ss01", "cv11";
}
```

**Ricorda: Caveat SOLO in blocchi editoriali `Secondo Bi`, firma `— Bi`, piatti consigliati, tip quote. MAI in nav, bottoni, form, admin.**

---

# LIQUIDGL NAV (PR5 specs)

Vendorizzare 2 file sotto `/public/vendor/`:
- `liquidGL.js` (~20KB gz, MIT da naughtyduk/liquidGL)
- `html2canvas.min.js` (~48KB gz)

Import in `BottomNav.jsx`:
```jsx
import { useEffect } from 'react';

export function BottomNav({ active }) {
  useEffect(() => {
    // Carica vendor script una sola volta
    const s1 = document.createElement('script');
    s1.src = '/vendor/html2canvas.min.js'; s1.defer = true;
    document.head.appendChild(s1);

    const s2 = document.createElement('script');
    s2.src = '/vendor/liquidGL.js'; s2.defer = true;
    s2.onload = () => {
      if (typeof liquidGL === 'undefined') return;
      try {
        liquidGL({
          target: '.liquidGL',
          snapshot: '#app-main',
          resolution: 2.0,
          refraction: 0.025,
          bevelDepth: 0.11,
          bevelWidth: 0.18,
          frost: 2,
          shadow: true,
          specular: true,
          reveal: 'fade',
          magnify: 1,
        });
      } catch (e) { console.warn('[v4] liquidGL init error:', e); }
    };
    document.head.appendChild(s2);
  }, []);

  return (
    <nav className="nav liquidGL" data-liquid-ignore>
      {/* 5 <NavLink>, markup come documentato sopra */}
    </nav>
  );
}
```

**Fallback CSS deve funzionare sempre** (pre-init + no-WebGL): `backdrop-filter:blur(24px) saturate(180%)` + `background:rgba(255,255,255,.55)`. La active pill grigia è pura CSS — funziona anche senza liquidGL.

---

# LIBRERIA SVG ICONE (tutti gli icon path riuniti)

```jsx
// Bottom nav (filled black, fill:currentColor)
const ICO_HOME    = <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z"/></svg>;
const ICO_ESPLORA = <svg viewBox="0 0 24 24"><path d="M12 2c-4 0-7 3-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.4" fill="#fff"/></svg>;
const ICO_SCONTI  = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.2" fill="currentColor"/><circle cx="17.5" cy="17.5" r="2.2" fill="currentColor"/></svg>;
const ICO_SALVATI = <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>;
const ICO_PROFILO = <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.5-8 6v2h16v-2c0-3.5-3.6-6-8-6z"/></svg>;

// Scheda CTAs (stroke-based)
const ICO_BACK    = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>;
const ICO_SHARE   = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.6 13.5l6.8 3.8M15.4 6.7l-6.8 3.8"/></svg>;
const ICO_HEART_F = <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-5-10-10.5C.5 6.5 4 3 8 5c1.5.8 2.5 2 4 4 1.5-2 2.5-3.2 4-4 4-2 7.5 1.5 6 5.5C19 16 12 21 12 21z"/></svg>;
const ICO_PHONE   = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.88.34 1.73.61 2.55a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.53-1.53a2 2 0 0 1 2.11-.45c.82.27 1.67.48 2.55.61A2 2 0 0 1 22 16.92z"/></svg>;
const ICO_NAV     = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>;
const ICO_CLOCK   = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;

// Generali
const ICO_SEARCH  = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>;
const ICO_PIN     = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const ICO_CARET   = <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4l3 3 3-3"/></svg>;
const ICO_CLOSE   = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M6 18L18 6"/></svg>;

// Logo Google (auth screen)
const ICO_GOOGLE = (
  <svg viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-4z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.3c-2 1.5-4.7 2.5-7.5 2.5-5.2 0-9.6-3.3-11.2-7.9l-6.5 5.1C9.4 39.6 16.1 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20H42V20H24v8h11.3c-.8 2.1-2.2 3.9-4 5.3l.1.1 6.5 5.3.1-.1C42.4 35.6 44 30.1 44 24c0-1.3-.1-2.6-.4-4z"/>
  </svg>
);
```

---

# CHECK-LIST ANTI-DERIVA (obbligatoria prima del merge di qualsiasi PR)

- [ ] Zero riferimenti a Satoshi, TAN Songbird, TAN-Songbird nel bundle
- [ ] Zero riferimenti a stelle, rating, recensioni utente, review visibili nell'UI
- [ ] Ogni nav ha 5 voci: Home, Esplora, Sconti, Salvati, Profilo
- [ ] Active nav = grigio `rgba(0,0,0,.05)` + outline `rgba(0,0,0,.08)` (NON corallo)
- [ ] Icone nav filled `fill:currentColor; stroke:none` (tranne Sconti stroke-based)
- [ ] Tutti i colori presi da `:root` — zero hex/rgba hardcoded nei componenti
- [ ] "Secondo Bi" in ogni scheda (NON "Recensione")
- [ ] Firma "— Bi" in Caveat alla fine di ogni testo editoriale
- [ ] Safe-area CSS su nav, sticky CTA, topbar scheda
- [ ] Poppins weights 400/500/600/700/800/900 caricati
- [ ] Test iPhone SE (375px) + iPhone 16 Pro Max (430px) + iPad landscape
