# Upload su GitHub — v4 + Safari + Poppins + Liquid-glass WebGL

## File da sostituire / caricare su GitHub

Destinazione nel repo `ohsicali/chiamami_bi`: cartella **`docs/mockups/`** (o dove Claude Code li sta già leggendo — controlla dove sono i file v4 attuali nel repo).

### File aggiornati / nuovi da caricare

**Tutti i 7 HTML mockup mobile + desktop + index + safari-preview + moodboard + logo-preview sono stati aggiornati (Satoshi → Poppins in 20 file).** I file critici da ricaricare:

| File | Stato | Cosa è cambiato |
|------|-------|-----------------|
| `v4-index.html` | **AGGIORNATO** | Poppins + Safari principle + Riferimenti tecnici card |
| `v4-mobile-home.html` | **AGGIORNATO** | Poppins + banner Safari + **nav liquid-glass WebGL + active pill grigia con contorno scuro stile Neotaste** (icone nere piene, pin teardrop Esplora, % Sconti) |
| `v4-mobile-auth.html` | **AGGIORNATO** | Poppins + banner Safari |
| `v4-mobile-pagine.html` | **AGGIORNATO** | Poppins + banner Safari + active pill Neotaste-style su 5 phone (CSS-only, gallery) |
| `v4-mobile-scheda.html` | **AGGIORNATO** | Poppins + banner Safari |
| `v4-mobile-admin.html` | **AGGIORNATO** | Poppins + meta viewport + banner Safari versione scura |
| `v4-verify.html` | **AGGIORNATO** | Poppins + meta viewport + banner Safari versione scura |
| `v4-safari-chrome-preview.html` | **NUOVO** | 3 confronti before/after Safari iOS + snippet CSS |
| `v4-desktop-home.html` | **AGGIORNATO** | Poppins (font solo, no Safari fix) |
| `v4-desktop-pagine.html` | **AGGIORNATO** | Poppins (font solo) |
| `v4-desktop-admin.html` | **AGGIORNATO** | Poppins (font solo) |

---

## Come caricarli (2 metodi)

### Metodo A — drag & drop su GitHub (facile, no git)
1. Vai su `https://github.com/ohsicali/chiamami_bi/tree/main/docs/mockups`
2. Clicca **"Add file"** → **"Upload files"**
3. Trascina tutti i file v4-*.html aggiornati
4. Commit message: `v4: Poppins typography + Safari iOS viewport-aware + liquid glass WebGL nav`
5. Commit direttamente su `main`

### Metodo B — via terminale
```bash
cp v4-*.html logo-preview.html neotaste-v4-moodboard.html ~/path/al/repo/docs/mockups/
cd ~/path/al/repo
git add docs/mockups/
git commit -m "v4: Poppins typography + Safari iOS viewport-aware + liquid glass WebGL nav"
git push
```

---

## Prompt per Claude Code — **3 PR separate in ordine**

### PR 1 — Safari iOS viewport-aware

```
Prima di aprire Track B, PR dedicata solo a questo fix.

Contesto: la web app gira dentro Safari iOS (niente PWA). Safari riserva ~52px in alto (URL bar) e ~84px in basso (tab bar + home indicator). I mockup sono disegnati a schermo pieno 390×844 ma nel codice reale restano ~708px effettivi.

Leggi prima docs/mockups/v4-safari-chrome-preview.html — ha 3 confronti before/after e lo snippet CSS completo.

Task:

1. Verifica che in index.html ci sia `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Se manca `viewport-fit=cover`, aggiungilo.

2. Aggiungi al CSS globale:

   .screen-full { min-height: 100vh; min-height: 100dvh; }
   .no-scroll-screen { height: 100vh; height: 100dvh; overflow: hidden; display: flex; flex-direction: column; }

   .app-root {
     padding-top: env(safe-area-inset-top);
     padding-bottom: env(safe-area-inset-bottom);
   }
   .bottom-nav, .bottom-cta, .sticky-pill {
     padding-bottom: calc(12px + env(safe-area-inset-bottom));
   }
   .floating-card {
     bottom: calc(14px + env(safe-area-inset-bottom));
   }

3. Applica .screen-full / .no-scroll-screen ai container root delle pagine che usano 100vh o height fissa (Verify PIN lock, Esplora mappa, Scheda con pill sconto sticky).

4. Applica padding safe-area al bottom-nav fisso e a qualsiasi CTA sticky.

Vincoli:
- Niente modifiche funzionali, solo CSS.
- Non rimuovere 100vh — lascialo come fallback SOPRA 100dvh (supporto iOS <15.4).
- Non riscrivere componenti, aggiungi solo classi utility.

Output atteso: un solo PR, titolo "Safari iOS viewport-aware (100dvh + env safe-area-inset)".
```

### PR 2 — Typography swap: Satoshi → Poppins

```
Dopo PR Safari, prima di Track B e della nav liquid-glass.

Contesto: su verifica diretta del sito Neotaste.com (Chrome DevTools font inspection) il font usato è **Poppins**, non Satoshi come avevamo assunto inizialmente. Augusto ha scelto di allinearsi al riferimento.

Task:

1. Aggiornare index.html (o layout root) — sostituire il link Fontshare con Google Fonts:

   RIMUOVERE:
   <link rel="preconnect" href="https://api.fontshare.com">
   <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,800,900&display=swap" rel="stylesheet">

   AGGIUNGERE:
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700;800;900&display=swap" rel="stylesheet">

2. Nel CSS globale (tokens / theme) sostituire ovunque:

   --ff-ui: 'Satoshi', -apple-system, 'Helvetica Neue', sans-serif;

   CON:

   --ff-ui: 'Poppins', -apple-system, 'Helvetica Neue', sans-serif;

3. Se da qualche parte c'è hard-coded `font-family: 'Satoshi', ...` in componenti, sostituire con `font-family: var(--ff-ui)` o direttamente `'Poppins'`.

4. Lasciare invariati Alfa Slab One (logo/pin) e Caveat (tip Bi). Quelli non cambiano.

Nota QA visivo:
- Poppins è leggermente più tondo/largo di Satoshi. I titoli con letter-spacing -.015em o -.025em potrebbero sembrare più aperti. In fase di review, se un titolo sembra troppo spaziato, stringere a -.02em / -.03em.

Output atteso: PR titolo "Typography: Satoshi → Poppins (allineato a Neotaste)".
```

### PR 3 — Bottom nav liquid glass WebGL (naughtyduk/liquidGL)

```
Dopo Safari + Poppins. Prima di Track B.

Contesto: l'effetto liquid glass iOS 26 non è replicabile con CSS puro o SVG backdrop-filter su Safari. La libreria **naughtyduk/liquidGL** (https://github.com/naughtyduk/liquidGL, MIT) usa un WebGL shader con snapshot DOM via html2canvas per ottenere rifrazione vera + bevel + specular. Supporto Chrome/Safari/Firefox/Edge.

Riferimento mockup: docs/mockups/v4-mobile-home.html ha l'integrazione completa funzionante con CDN. Ispeziona quel file per copiare CSS + init params.

Task:

Step 1 · Vendor dependencies (NO CDN nel live)

Scarica e committa nel repo:
- /public/vendor/html2canvas.min.js  (da https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js, ~200KB unminified)
- /public/vendor/liquidGL.js  (da https://raw.githubusercontent.com/naughtyduk/liquidGL/main/scripts/liquidGL.js, ~67KB)

Aggiungi copyright notices nel README (entrambe MIT license).

Step 2 · Load scripts

In index.html, prima di </body>:
  <script src="/vendor/html2canvas.min.js" defer></script>
  <script src="/vendor/liquidGL.js" defer></script>

Step 3 · CSS BottomNav (container pill liquid glass)

Nel componente BottomNav (o layout file), la classe `.bottom-nav` deve avere:

  .bottom-nav {
    position: fixed;
    left: 14px; right: 14px;
    bottom: calc(18px + env(safe-area-inset-bottom));
    height: 68px;
    border-radius: 999px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 6px; gap: 2px;
    z-index: 40;

    /* Pre-init + no-WebGL fallback */
    background: rgba(255,255,255,.55);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    /* Bordo "firma" — identico a quello dell'active pill */
    border: 1px solid rgba(0,0,0,.08);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.9),
      0 2px 8px rgba(34,24,28,.06),
      0 14px 32px rgba(34,24,28,.14);
  }

Importante: NON usare `isolation: isolate` sul .bottom-nav — interferisce col canvas condiviso di liquidGL.

Step 4 · Markup — icone + label SEMPRE visibili (Neotaste-style)

Aggiungi sull'elemento .bottom-nav:
  - classe aggiuntiva: `liquidGL` (hook target della libreria)
  - attributo: `data-liquid-ignore` (esclude la nav dallo snapshot)

Ogni voce ha icona + label, **entrambe sempre visibili su tutte le voci**. L'active state è una pill grigio chiaro con contorno scuro 1px che combacia col bordo della nav — **icona e label restano nere piene, mai corallo**.

Icone: **tutte filled solid black** (fill: currentColor, no stroke). Eccezione Sconti (linea % con cerchietti pieni). Copia gli SVG COMPLETI qui sotto — non abbreviare, non inventare.

  <nav className="bottom-nav liquidGL" data-liquid-ignore aria-label="Navigazione principale">
    <Link to="/" className={isActive('/') ? 'active' : ''} aria-label="Home" title="Home">
      <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z"/></svg>
      <span className="nav-label">Home</span>
    </Link>
    <Link to="/esplora" className={isActive('/esplora') ? 'active' : ''} aria-label="Esplora" title="Esplora">
      {/* Pin teardrop con puntino bianco — stile Neotaste */}
      <svg viewBox="0 0 24 24">
        <path d="M12 2c-4 0-7 3-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-4-3-7-7-7z"/>
        <circle cx="12" cy="9" r="2.4" fill="#fff"/>
      </svg>
      <span className="nav-label">Esplora</span>
    </Link>
    <Link to="/sconti" className={isActive('/sconti') ? 'active' : ''} aria-label="Sconti" title="Sconti">
      {hasActiveDrop && <span className="badge" />}
      {/* Icona percent-style (NON ticket): stroke + 2 cerchi pieni */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="19" y1="5" x2="5" y2="19"/>
        <circle cx="6.5" cy="6.5" r="2.2" fill="currentColor"/>
        <circle cx="17.5" cy="17.5" r="2.2" fill="currentColor"/>
      </svg>
      <span className="nav-label">Sconti</span>
    </Link>
    <Link to="/salvati" className={isActive('/salvati') ? 'active' : ''} aria-label="Salvati" title="Salvati">
      {/* Cuore pieno */}
      <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
      <span className="nav-label">Salvati</span>
    </Link>
    <Link to="/profilo" className={isActive('/profilo') ? 'active' : ''} aria-label="Profilo" title="Profilo">
      {/* Persona piena (testa + busto) */}
      <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.5-8 6v2h16v-2c0-3.5-3.6-6-8-6z"/></svg>
      <span className="nav-label">Profilo</span>
    </Link>
  </nav>

Step 5 · Icone + active subtle pill

  .bottom-nav a {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    border-radius: 28px;
    color: #141414;                 /* nero pieno — niente corallo nemmeno su active */
    text-decoration: none;
    position: relative; z-index: 3;
    transition: background .18s ease, box-shadow .18s ease;
  }
  .bottom-nav a svg {
    width: 22px; height: 22px;
    fill: currentColor;             /* FILLED solid black */
    stroke: none;
  }
  .bottom-nav a .nav-label {
    font-family: var(--ff-ui); font-weight: 600; font-size: 11px;
    letter-spacing: -.005em; line-height: 1; white-space: nowrap;
    color: #141414;
  }

  /* Active = pill grigia + contorno scuro 1px identico al bordo della nav.
     Niente corallo: in Neotaste la selezione è neutra (pesa solo il bold). */
  .bottom-nav a.active {
    background: rgba(0, 0, 0, .05);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .08);
  }
  .bottom-nav a.active .nav-label {
    font-weight: 800;
  }

Step 6 · Badge Sconti (drop attivo)

  .bottom-nav a .badge {
    position: absolute;
    top: 5px; right: 10px;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--corallo);
    border: 1.5px solid rgba(255,255,255,.95);
    z-index: 4;
  }
  /* Nessun "inverted badge" su active — l'active è grigio, non corallo,
     quindi il pallino rosso resta leggibile così com'è. */

Step 7 · Init liquidGL

In App.tsx (o componente root del layout logged-in), dopo il mount del main container, in useEffect:

  useEffect(() => {
    // Aspetta il prossimo tick per assicurarsi che tutto sia renderizzato
    const timer = setTimeout(() => {
      if (typeof window.liquidGL === 'undefined') {
        console.warn('liquidGL non caricato — fallback CSS attivo');
        return;
      }
      try {
        window.liquidGL({
          target: '.liquidGL',
          snapshot: '#app-main',  // CSS selector del main layout container dell'app logged-in
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
      } catch (e) { console.warn('liquidGL init error:', e); }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

Nota: il `snapshot` deve puntare al container che contiene TUTTO il contenuto dietro la nav (mappa Esplora, liste, schede). Se usi React Router, quel container è tipicamente il main layout wrapper, non la singola route.

Step 8 · TypeScript declaration (se TS)

In `/src/types/liquidGL.d.ts`:

  declare global {
    interface Window {
      liquidGL: (opts: {
        target: string;
        snapshot?: string;
        resolution?: number;
        refraction?: number;
        bevelDepth?: number;
        bevelWidth?: number;
        frost?: number;
        shadow?: boolean;
        specular?: boolean;
        reveal?: 'none' | 'fade';
        magnify?: number;
        tilt?: boolean;
        on?: { init?: (i: unknown) => void };
      }) => unknown;
    }
  }
  export {};

Vincoli:
- NON usare jsdelivr o altre CDN nel live — vendorizza per stabilità.
- NON cambiare il numero di tab, ordine, icone (Home / Esplora / Sconti / Salvati / Profilo).
- NON cambiare routing/comportamento — solo layout + effect.
- Le label `<span class="nav-label">` vanno **sempre** presenti su TUTTE le voci (non condizionate via JSX).
- **Icone SOLID BLACK filled** (fill: currentColor). Non tornare a stroke-outline. Eccezione % Sconti (stroke 2.4 + cerchi pieni).
- **Active state: NIENTE corallo.** Solo `rgba(0,0,0,.05)` background + `inset 0 0 0 1px rgba(0,0,0,.08)` box-shadow. Icona e label restano `#141414` — solo il font-weight passa a 800.
- Il bordo della nav usa lo **stesso rgba(0,0,0,.08)** dell'active pill: quando Home o Profilo sono attive, i due bordi si allineano visivamente.
- Il badge Sconti deve essere condizionale (solo se drop attivo). Niente più "inverted badge" su active (era legato all'active corallo, non serve più).
- `--corallo` = `#E8504C` (resta usato per badge drop, CTA, wordmark — MAI più nella nav selezione).
- Se Safari risulta instabile su iPhone SE (viewport piccolo), ridurre `resolution` a 1.5.

QA visivo da verificare:
- Su iPhone SE (375px) le 5 voci stanno in 68px con label visibili. Label max-width 90px in caso di nomi lunghi.
- Home attiva → il contorno scuro dell'active pill combacia col bordo nav a sinistra. Profilo attivo → combacia a destra. Se c'è uno stacco visibile, ri-controlla che entrambi usino esattamente `rgba(0,0,0,.08)`.
- Le icone filled devono restare leggibili sopra il liquid glass. Se la rifrazione le impasta, alzare leggermente il contrasto del canvas liquidGL (`frost: 3`) invece di cambiare colore icona.

Output atteso: PR titolo "Bottom nav liquid glass WebGL + Neotaste-style active pill (liquidGL + html2canvas)".
```

---

## Cosa fare dopo

1. Carica i file aggiornati su GitHub (metodo A o B).
2. Manda a Claude Code **PR 1 — Safari iOS viewport-aware**.
3. Aspetta, verifica (diff SOLO CSS + meta), mergia.
4. Manda a Claude Code **PR 2 — Typography Satoshi → Poppins**.
5. Aspetta, verifica (diff SOLO font-family + link), mergia.
6. Manda a Claude Code **PR 3 — Bottom nav liquid glass WebGL**.
7. Aspetta, verifica (diff = nuovi vendor file + CSS BottomNav + useEffect init), mergia.
8. A quel punto: Track B secondo v4-PLAN.md.
9. Fix email `RESEND_FROM` → per ultimo.
