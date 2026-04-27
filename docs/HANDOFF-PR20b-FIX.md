# HANDOFF PR20b — Fix accesso a Chiedi a Bi

**Status:** Follow-up di PR20 — fix gap di accessibilità identificati nel deploy preview
**Scope:** Chirurgico. 4 modifiche puntuali, nient'altro.
**Branch consigliato:** `feat/pr20b-fix-chiedi-bi-access`
**Mockup:** `docs/mockups/v4-mobile-search-redesign.html` + `v4-desktop-search-redesign.html` (riferimento per /chiedi page)

---

## Contesto — perché serve PR20b

PR20 ha implementato `/chiedi` ma con due gap di accessibilità:

1. **Mobile**: il tab bar (Home · Esplora · Sconti · Salvati · Profilo) non ha la lente. La pagina `/chiedi` esiste ma da mobile è raggiungibile **solo via URL diretto**. Un utente normale non la trova mai.
2. **Desktop**: la nav floating ha un'icona search generica che porta a `/chiedi`, ma è troppo poco prominente per la "feature iconica" che vogliamo Bi sia.

Inoltre due cose erano in handoff PR20 ma sono state skipped: prompt cards nell'empty state di `/chiedi` e input "Chiedi a Bi" nella Home.

---

## Le 4 modifiche

### 1. Mobile — sostituire avatar utente con icona B nell'header

**Cosa**: nell'header globale mobile, l'avatar profilo "A" in alto a destra viene sostituito con l'icona "Bi" (cerchio corallo gradiente + B bianca + sparkle oro).

**Dove**: il componente che gestisce l'header mobile (probabilmente `<MobileHeader>` o simile, da grep).

**File live attuale (per riferimento)**: header sx = wordmark "LA GUIDA DI BI · BY CHIAMAMI BI" + centro = pill "Torino ▾" (city picker) + dx = avatar profilo "A" → diventa = avatar profilo "A" rimosso, sostituito da icona Bi.

**Markup**:

```jsx
// PRIMA (esempio)
<button className="header-avatar" onClick={() => navigate('/profilo')}>
  <Avatar user={user} />
</button>

// DOPO
<button className="header-bi-icon" onClick={() => navigate('/chiedi')} aria-label="Chiedi a Bi">
  <span className="bi-circle">
    B
    <span className="sp">✦</span>
  </span>
</button>
```

**CSS**:

```css
.header-bi-icon {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  position: relative;
  width: 36px;
  height: 36px;
}
.bi-circle {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--corallo) 0%, var(--corallo-ink) 100%);
  color: #fff;
  font-family: var(--ff-mark); /* Alfa Slab One */
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(232, 69, 60, 0.35);
  position: relative;
}
.bi-circle .sp {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  background: var(--oro);
  border-radius: 50%;
  border: 2px solid var(--page);
  display: grid;
  place-items: center;
  font-size: 7px;
  color: #fff;
  font-weight: 700;
}
```

**Profilo utente**: continua ad essere accessibile dal tab "Profilo" del tab bar mobile. Niente da modificare lì.

**Tab bar mobile**: NON toccare. Resta com'è (Home · Esplora · Sconti · Salvati · Profilo).

---

### 2. Desktop — pill "Chiedi a Bi" accanto alla navbar floating

**Cosa**: aggiungere una seconda pill secondaria alla destra della navbar floating principale, contenente avatar B + label "Chiedi a Bi". Le due pill insieme appaiono centrate orizzontalmente.

**Dove**: il componente della nav floating desktop (probabilmente `<DesktopFloatingNav>` o simile).

**Comportamento**:
- La navbar attuale (Home · Esplora · Sconti · Salvati) **resta identica**, niente da cambiare al suo interno
- Si aggiunge una pill **a parte** subito a destra, separata da un piccolo gap (~10px)
- Stessa estetica liquid glass della navbar (sfondo translucido, blur, bordo morbido)
- Le 2 pill come unità sono centrate nel viewport orizzontalmente
- L'avatar profilo utente "A" continua a vivere all'estrema destra del viewport (fuori dal centro), invariato
- La city pill "Torino ▾" continua a vivere a destra, invariata

**Lente attuale** (icona search generica tra "Salvati" e "Torino"): **RIMUOVERE**. È diventata ridondante con la pill nuova.

**Markup**:

```jsx
<div className="desktop-nav-wrapper">
  {/* Sinistra: wordmark — invariato */}
  <div className="nav-logo">LA GUIDA DI BI</div>
  
  {/* CENTRO: nav principale + pill Bi — INSIEME centrate */}
  <div className="nav-center">
    <nav className="nav-pill-main">
      {/* invariata: Home Esplora Sconti Salvati */}
    </nav>
    
    <button className="nav-pill-bi" onClick={() => navigate('/chiedi')}>
      <span className="bi-circle bi-circle-sm">B<span className="sp">✦</span></span>
      <span className="bi-label">Chiedi a Bi</span>
    </button>
  </div>
  
  {/* Destra: city + profilo — invariati */}
  <div className="nav-right">
    {/* RIMUOVERE qui la vecchia icona lente search */}
    <CityPicker />
    <UserAvatar />
  </div>
</div>
```

**CSS**:

```css
.nav-center {
  display: flex;
  align-items: center;
  gap: 10px;
  /* le 2 pill insieme sono al centro */
}

.nav-pill-bi {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px 7px 7px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(232, 69, 60, 0.25);
  border-radius: 99px;
  box-shadow: 
    0 8px 30px rgba(34, 24, 28, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}
.nav-pill-bi:hover {
  border-color: var(--corallo);
  transform: translateY(-1px);
}

.bi-circle-sm {
  width: 28px;
  height: 28px;
  font-size: 13px;
}
.bi-circle-sm .sp {
  width: 10px;
  height: 10px;
  font-size: 5.5px;
  top: -2px;
  right: -2px;
  border-width: 1.5px;
}

.bi-label {
  font-family: var(--ff-ui); /* Poppins */
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}
```

---

### 3. Pagina /chiedi — completare empty state mancante

Verificato live: la pagina `/chiedi` ha l'hero (avatar gigante + titolo + sub Caveat) ma mancano:

#### 3a. Le 6 prompt cards suggerite

Sotto il paragrafo "Ti consiglio dove andare…", aggiungere divider + 6 cards. Già specificato in handoff PR20 §4.1 e visibili nel mockup `docs/mockups/v4-mobile-search-redesign.html`.

```jsx
const promptSuggestions = [
  { icon: '🥂', title: 'Aperitivo a Vanchiglia', sub: 'cocktail bar, locali con tagliere', query: 'Aperitivo a Vanchiglia' },
  { icon: '🍣', title: 'Giapponese aperto stasera', sub: 'solo locali con orario verificato', query: 'Giapponese aperto stasera' },
  { icon: '🍕', title: 'Pizza in centro la domenica', sub: 'quartiere + giorno + cucina', query: 'Pizza in centro la domenica' },
  { icon: '🐟', title: 'Pesce a San Salvario', sub: 'cucina + zona', query: 'Pesce a San Salvario' },
  { icon: '🥟', title: 'Locali che fanno gli agnolotti', sub: 'piatto specifico', query: 'Locali che fanno gli agnolotti del plin' },
  { icon: '🏷️', title: 'Sconti attivi stasera vicino a me', sub: 'chi ha sconto + è aperto adesso', query: 'Sconti attivi stasera' }
];
```

Cards in colonna su mobile (320-380px), griglia 2×3 su desktop (max-width 760px). CSS dal mockup.

#### 3b. Blocco didattico "Cosa posso dirti / Cosa non so"

Sopra le prompt cards (subito dopo il paragrafo descrittivo dell'hero), aggiungere:

```jsx
<div className="bi-explainer">
  <div className="explainer-row">
    <div className="ic ic-yes">✓</div>
    <div>
      <strong>Cosa posso dirti</strong>
      <p>
        Ti consiglio dove andare tra i locali che ho selezionato io a Torino.
        Cucina, zona, momento della giornata, piatti specifici, sconti attivi, 
        chi è aperto adesso. Sono ~200 ristoranti, tutti validati da me.
      </p>
    </div>
  </div>
  <div className="explainer-row">
    <div className="ic ic-no">~</div>
    <div>
      <strong>Cosa non so</strong>
      <p>
        Prezzi precisi, recensioni utenti, disponibilità di un tavolo stasera, 
        menu in tempo reale. Per quelle cose, ti passo il numero del locale.
      </p>
    </div>
  </div>
</div>
```

CSS già in handoff PR20 §4.4. Visibilità: solo nell'empty state (prima della prima domanda).

---

### 4. Home — aggiungere input "Chiedi a Bi"

Verificato live: la Home non ha l'input "Chiedi a Bi" che era previsto dal redesign 24/04.

**Posizione**: subito dopo l'hero della home (dopo banner DROP LIVE / dopo i 5 momenti — meglio in cima, prima dei momenti, così è la prima cosa interattiva sotto l'header). Decidere in base al flow: la cosa più importante della home è "Bi è qui, parla con me".

**Markup proposto**:

```jsx
function HomeChiediBi() {
  const [text, setText] = useState('');
  const navigate = useNavigate();
  
  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    navigate('/chiedi', { state: { initialMessage: text } });
  }
  
  return (
    <section className="home-chiedi-bi">
      <div className="hcb-header">
        <span className="bi-circle bi-circle-sm">B<span className="sp">✦</span></span>
        <div>
          <strong>Chiedi a Bi</strong>
          <small>Dimmi che voglia hai e ti dico dove andare</small>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="hcb-form">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='es. "ramen a Vanchiglia stasera"'
          aria-label="Chiedi a Bi"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Invia">
          →
        </button>
      </form>
    </section>
  );
}
```

**CSS**:

```css
.home-chiedi-bi {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px 18px;
  margin: 16px 16px 24px;  /* mobile */
  box-shadow: 0 8px 24px rgba(232, 69, 60, 0.05);
}
@media (min-width: 768px) {
  .home-chiedi-bi {
    max-width: 760px;
    margin: 24px auto 32px;
    padding: 20px 24px;
  }
}

.hcb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.hcb-header strong { font-size: 15px; color: var(--ink); display: block; }
.hcb-header small { font-family: var(--ff-hand); font-size: 16px; color: var(--corallo); }

.hcb-form {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--page);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 8px;
  transition: border-color 0.2s;
}
.hcb-form:focus-within {
  border-color: var(--corallo);
}
.hcb-form input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--ff-ui);
  font-size: 14px;
  padding: 6px 10px;
  color: var(--ink);
}
.hcb-form input::placeholder {
  color: var(--ink-3);
  font-style: italic;
}
.hcb-form button {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--corallo);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  display: grid; place-items: center;
}
.hcb-form button:disabled {
  background: var(--ink-3);
  cursor: not-allowed;
}
```

**Su submit**: `navigate('/chiedi', { state: { initialMessage: text } })` — la conversazione parte automaticamente in `/chiedi` (handler già in PR20 ChiediPage).

---

## Out of scope

- NON toccare il resto della home (banner DROP, 5 momenti, sezioni editoriali, scheda)
- NON toccare Esplora, Sconti, Salvati, Profilo, Scheda
- NON toccare il city picker
- NON toccare la pagina /chiedi a parte aggiunte 3a + 3b
- NON cambiare comportamento dei filtri di Esplora
- NON aggiungere altre tab al tab bar mobile

---

## Test manuale

### Mobile (iPhone SE / iPhone 15)
- [ ] Home: header destro mostra icona B coral con sparkle (NON l'avatar A)
- [ ] Click sull'icona B → naviga a `/chiedi`
- [ ] Tab bar mobile invariato (5 tab Home/Esplora/Sconti/Salvati/Profilo)
- [ ] Click tab "Profilo" → pagina profilo accessibile come prima
- [ ] Home: visibile blocco "Chiedi a Bi" con input
- [ ] Scrivo "aperitivo Vanchiglia" + invio → naviga a `/chiedi`, vedo bubble user automatico, Bi risponde
- [ ] `/chiedi` empty state: avatar gigante + titolo + blocco didattico "Cosa posso dirti / Cosa non so" + 6 prompt cards in colonna

### Desktop (1280px+)
- [ ] Top nav: 2 pill centrate insieme — sinistra "Home Esplora Sconti Salvati", destra "B Chiedi a Bi"
- [ ] La vecchia icona lente NON c'è più
- [ ] Click sulla pill "Chiedi a Bi" → naviga a `/chiedi`
- [ ] City picker e avatar utente "A" restano all'estrema destra, fuori dal centro
- [ ] Wordmark "LA GUIDA DI BI" resta all'estrema sinistra
- [ ] Home: visibile blocco "Chiedi a Bi" con input centrato max-width 760px
- [ ] `/chiedi` empty state: stessi elementi del mobile in versione desktop (avatar 120px, prompt cards in griglia 2×3)

### Edge cases
- [ ] Refresh su `/chiedi/[id]` ricarica la conversazione
- [ ] Senza login: tentativo di invio → AuthGate modale (già implementato PR20)
- [ ] Click sulla home da `/chiedi` → torna alla home (link wordmark o tab Home)

---

## Sintesi delle 4 modifiche in 4 righe

1. Mobile header: avatar A → icona B (corallo + sparkle), click apre /chiedi
2. Desktop nav: pill secondaria "B Chiedi a Bi" accanto alla navbar; rimuovere lente vecchia
3. Pagina /chiedi: aggiungere prompt cards (6) + blocco didattico "Cosa posso / non so"
4. Home: aggiungere input "Chiedi a Bi" che apre /chiedi col messaggio già inviato

Ogni altra parte del sito resta invariata.
