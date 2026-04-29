# HANDOFF PR23 — Popup dettagli + Sblocca sconto + Validità giorno/fascia

**Status:** Ready for implementation
**Scope:** Riprogettazione del popup dettagli sconto (drop + convenzione) + flusso "Sblocca sconto" con QR inline + sistema di validità giorno della settimana / fascia oraria + 3 schermate ristoratore.
**Branch consigliato:** `feat/pr23-detail-unlock-validity`
**Mockup di riferimento:**
- `docs/mockups/v4-mobile-detail-popup-redesign.html` — popup mobile (locked + unlocked + Secondo Bi alla fine)
- `docs/mockups/v4-desktop-detail-popup-redesign.html` — popup desktop modal centrato
- `docs/mockups/v4-mobile-validity-states.html` — stati validità: cliente + ristoratore (6 frame)

---

## 0. Regola d'oro: scope

Il design del popup attuale è "cheap" (box decorativi Material, emoji random, gerarchia confusa). Si sostituisce con un layout editoriale brand-aligned.

**NON modificare**:
- Le card live attuali nella pagina /sconti (Bi Club) — già piacciono ad Augusto
- Sistema scan ristoratore backend per la parte "già usato" — esistente
- Header globale, nav floating desktop, tab bar mobile

**Modifica**:
1. Popup dettagli sconto: layout editoriale completo (foto fullbleed + percentuale overlay + countdown + specs + Scopri ristorante + Secondo Bi alla fine)
2. CTA card e popup: da "Lo voglio"/"Prendi sconto" a "**Sblocca sconto**" 🔒 sempre uniforme
3. Sblocco → popup transitions a stato "QR inline" con banner success + QR + PDF
4. **Pill validità** sulle card Bi Club esistenti (sotto il nome del locale) — modifica minima alle card
5. Validity block nel popup dettagli (verde/giallo/rosso)
6. Pill validità in "I miei vantaggi"
7. Quando l'utente apre QR in giorno non valido → schermata informativa "Oggi non puoi usarlo"
8. Schermate ristoratore 3 stati post-scan (success / non valido oggi / già usato)
9. Backend scan endpoint: validation giorno + fascia + già usato

---

## 1. Modello dati validità

### 1.1 Campi nuovi su tabella `discounts`

```sql
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_days int[] DEFAULT NULL;
-- es. {1,2,3,4,5} per Lun-Ven · NULL = tutti i giorni

ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_meal_slots text[] DEFAULT NULL;
-- es. {'pranzo','cena'} · NULL = qualsiasi
-- enum values: 'pranzo' | 'cena' | 'aperitivo' | 'brunch' | 'colazione'

ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_time_from time DEFAULT NULL;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_time_to time DEFAULT NULL;
-- range orario opzionale specifico, es. 19:00-23:00
```

### 1.2 Default fasce orarie (se ristoratore sceglie meal_slot invece di orario custom)

```js
const MEAL_SLOTS = {
  colazione:  { from: '07:00', to: '11:00' },
  pranzo:     { from: '12:00', to: '15:00' },
  aperitivo:  { from: '17:30', to: '20:00' },
  cena:       { from: '19:00', to: '23:30' },
  brunch:     { from: '10:00', to: '14:00' },
};
```

### 1.3 Helper `checkValidity(discount, now)` — server + client

```js
export function checkValidity(discount, now = new Date()) {
  if (discount.expires_at && now > new Date(discount.expires_at)) return 'expired';

  const dayOfWeek = ((now.getDay() + 6) % 7) + 1;
  const validDays = discount.valid_days || [1,2,3,4,5,6,7];
  
  if (!validDays.includes(dayOfWeek)) return 'valid_other_day';
  
  const ranges = computeValidRanges(discount);
  if (ranges.length === 0) return 'valid_now';
  
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isInRange = ranges.some(r => nowMinutes >= r.fromMin && nowMinutes <= r.toMin);
  
  if (isInRange) return 'valid_now';
  
  const nextRange = ranges.find(r => r.fromMin > nowMinutes);
  if (nextRange) return 'valid_today_later';
  
  return 'valid_other_day';
}

function computeValidRanges(discount) {
  if (discount.valid_time_from && discount.valid_time_to) {
    return [{ fromMin: timeToMin(discount.valid_time_from), toMin: timeToMin(discount.valid_time_to) }];
  }
  if (discount.valid_meal_slots?.length) {
    return discount.valid_meal_slots.map(slot => {
      const m = MEAL_SLOTS[slot];
      return { fromMin: timeToMin(m.from), toMin: timeToMin(m.to) };
    });
  }
  return [];
}

function timeToMin(t) { const [h,m] = t.split(':'); return +h * 60 + +m; }
```

**Stato di ritorno**: 1 di 5
- `valid_now` — usabile in questo momento
- `valid_today_later` — oggi sì ma non ora (es. cena, sono le 14)
- `valid_other_day` — oggi no, valido in altri giorni
- `expired` — scaduto definitivamente
- `used` — già scansionato (controllato lato user_discounts)

### 1.4 Stessa funzione su backend e frontend

Estrai in modulo condiviso `lib/validity.js` oppure replicalo identico. **Il backend SCAN è autoritativo**: il frontend è solo previsione UX.

### 1.5 Helper di formattazione human

```js
export function formatValidityHuman(discount) {
  return {
    days: formatDays(discount.valid_days),       // "Lun–Ven", "Mar · Mer · Gio", "Tutti i giorni"
    slots: formatSlots(discount.valid_meal_slots), // "Pranzo · Cena", "Solo aperitivo"
    next: computeNextValidWindow(discount),      // "stasera 19:00", "martedì", "tra 4h"
    short: formatShortPill(discount, status),    // "Valido ora", "Solo a cena · da 19:00", "Oggi no · Mar–Ven"
  };
}
```

---

## 2. Card Bi Club catalogo — solo aggiunta pill

**NON ridisegnare** le card del catalogo. Aggiungi SOLO la pill validità sotto il nome del locale.

### 2.1 Markup minimal aggiuntivo

```jsx
function DiscountCard({ discount }) {
  const status = checkValidity(discount);
  const pill = formatShortPill(discount, status);
  
  return (
    <article className="discount-card">
      {/* tutto il markup live attuale invariato */}
      
      <ValidityPill status={status} text={pill} />
    </article>
  );
}
```

### 2.2 Componente `<ValidityPill>`

```jsx
function ValidityPill({ status, text }) {
  return (
    <span className={`pill pill-${status}`}>
      <span className="dot" />
      {text}
    </span>
  );
}
```

```css
.pill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 700;
  padding: 4px 10px 4px 8px; border-radius: 99px;
  letter-spacing: 0.2px;
}
.pill .dot { width: 6.5px; height: 6.5px; border-radius: 50%; }

.pill-valid_now { background: var(--verde-soft); color: var(--verde-ink); }
.pill-valid_now .dot { background: var(--verde); animation: blink 1.6s infinite; box-shadow: 0 0 0 3px rgba(63,185,85,.18); }

.pill-valid_today_later { background: var(--giallo-soft); color: var(--giallo-ink); }
.pill-valid_today_later .dot { background: var(--giallo); }

.pill-valid_other_day { background: var(--line); color: var(--ink-2); }
.pill-valid_other_day .dot { background: var(--ink-3); }
```

Tokens nuovi (aggiungere a `tokens.css`):
```css
--verde: #3FB955;
--verde-soft: #DDF4E0;
--verde-ink: #1d6e30;
--giallo: #E8A53C;
--giallo-soft: #FBEDD0;
--giallo-ink: #7a5a17;
```

---

## 3. Popup dettagli sconto — riscrittura completa

Rimpiazza il popup live attuale (che ha box decorativi Material). Layout editoriale.

### 3.1 Struttura componente `<DiscountDetailPopup>`

```jsx
function DiscountDetailPopup({ discount, isOpen, onClose }) {
  const [unlocked, setUnlocked] = useState(false);
  const [savedDiscountId, setSavedDiscountId] = useState(null);
  const status = checkValidity(discount);
  
  async function handleUnlock() {
    const { user } = useAuth();
    if (!user) return openAuthGate();
    
    const res = await fetch('/api/discount/save', {
      method: 'POST',
      body: JSON.stringify({ discount_id: discount.id })
    });
    const data = await res.json();
    setSavedDiscountId(data.id);
    setUnlocked(true);
  }
  
  return (
    <BottomSheet onClose={onClose} maxHeight="88%">
      {!unlocked ? (
        <DetailLockedView discount={discount} status={status} onUnlock={handleUnlock} />
      ) : (
        <UnlockedQRView discount={discount} savedDiscountId={savedDiscountId} status={status} onClose={onClose} />
      )}
    </BottomSheet>
  );
}
```

### 3.2 Stato Locked — `<DetailLockedView>`

Layout (ordine dall'alto):
1. **Foto top** aspect-ratio 4:3 (mobile) o 16:9 (desktop), con percentuale overlay grande in basso a sinistra ("−20%" Alfa Slab + "sul totale" Caveat)
2. **Live pill** in alto a sinistra (drop) — niente per convenzione
3. **X close** in alto a destra
4. **Header** body: meta corallo uppercase + nome Alfa Slab + "dove" Poppins ink-3
5. **Validity block** colorato (verde/giallo/rosso) con icona + testo bold + descrittivo
6. **Countdown ink** (drop) o niente (convenzione)
7. **Progress bar** (drop): "X/Y presi · Z liberi"
8. **Specs** in lista (icone outline corallo · gold per scadenza):
   - Quando: giorni validi
   - Fascia: orario o meal slot
   - Cosa ottieni
   - Da sapere
9. **Link "Scopri il ristorante"** — card minimale ink, naviga a `/r/[slug]`
10. **Box "Secondo Bi"** in oro-soft con avatar gradient corallo + logo SVG `/bi_logo_def_centrato.svg` + sparkle oro + Caveat 18px (pesca da campo `secondoBi` esistente, max ~140 char)
11. **Footer sticky** con CTA corallo "Sblocca sconto" 🔒 con shadow

**CTA SEMPRE "Sblocca sconto"** — niente varianti tipo "sblocca lo stesso me lo tieni". L'utente sblocca sempre, la validità si verifica all'apertura QR.

### 3.3 Stato Unlocked — `<UnlockedQRView>`

Layout:
1. **Banner success corallo** gradient: ✓ "Sbloccato! L'ho aggiunto ai tuoi vantaggi"
2. **Place mini** (foto 42px + nome + categoria + percentuale corallo)
3. **QR display** 170px (mobile) / 200px (desktop) con bordo nero 2px
4. **Caveat hint** corallo "Mostra al ristoratore" (21px)
5. **Info caption** Poppins 11px ink-2: "Lui scansiona il codice e attiva lo sconto. Codice valido una sola volta."
6. **Reassurance pill verde**: "✓ Salvato in I miei vantaggi · Scade in 2g 14h" (per drop) o "Sempre valido" (per convenzione)
7. **Footer**: bottone "Scarica PDF" outlined + link testo "Chiudi"

### 3.4 Apri QR da "I miei vantaggi" quando NON valido oggi

**NUOVA schermata** — sostituisce il popup QR normale quando `status !== 'valid_now'`:

Layout:
1. Place mini (foto + nome + percentuale)
2. **Cerchio lucchetto grande** corallo soft (90px) con icona lock-with-keyhole
3. Titolo Alfa Slab "Oggi non puoi usarlo"
4. Paragrafo descrittivo: "Questo vantaggio è valido **da martedì a venerdì**, fascia pranzo e pomeriggio. Oggi è sabato."
5. **Day strip** orizzontale: 7 cerchi L M M G V S D, quelli validi verde-soft, oggi outlined ink scuro
6. **Reminder Caveat oro**: "⏰ Te lo ricordo io martedì"
7. CTA scuro "Capito"

Variante valid_today_later: "**Solo a cena**" + countdown "Tra 4h 23m" invece di day strip.

---

## 4. I miei vantaggi (lista sbloccati) — pill validità su ogni voce

```jsx
function MineRow({ saved }) {
  const status = checkValidity(saved.discount);
  const pill = formatShortPill(saved.discount, status);
  
  return (
    <div className="mine-row">
      <Photo />
      <div className="info">
        <h4>{saved.discount.locale.nome} · {saved.discount.percentuale}</h4>
        <div className="meta">{saved.discount.locale.tipo} · {saved.discount.locale.zona}</div>
        <div className="pill-row-mini">
          <ValidityPill status={status} text={pill} />
        </div>
      </div>
      <button className="qr-btn" onClick={() => openQRPopup(saved, status)}>
        <QrIcon /> Apri QR
      </button>
    </div>
  );
}
```

**Bottone "Apri QR" SEMPRE attivo** — non disabilitato. Click apre popup QR. Se `status !== 'valid_now'` → mostra `<QRBlockedView>` (sezione 3.4).

---

## 5. Backend: scan endpoint con validation

`/api/discount/scan` (esistente, da estendere):

```js
export default async function handler(req, res) {
  const { qr_token } = req.body;
  
  const saved = await db.userDiscounts.findFirst({
    where: { qr_token },
    include: { discount: { include: { locale: true } } }
  });
  
  if (!saved) {
    return res.json({ status: 'not_found' });
  }
  
  if (saved.status === 'used') {
    return res.json({
      status: 'already_used',
      used_at: saved.used_at,
      discount: { percentuale: saved.discount.percentuale, locale: saved.discount.locale.nome }
    });
  }
  
  const validity = checkValidity(saved.discount);
  
  if (validity === 'expired') {
    return res.json({
      status: 'expired',
      expired_at: saved.discount.expires_at,
      discount: { ... }
    });
  }
  
  if (validity !== 'valid_now') {
    return res.json({
      status: 'invalid_now',
      reason: validity,  // 'valid_today_later' | 'valid_other_day'
      validity_human: formatValidityHuman(saved.discount),
      discount: { percentuale: saved.discount.percentuale, locale: saved.discount.locale.nome }
    });
  }
  
  await db.userDiscounts.update({
    where: { id: saved.id },
    data: { status: 'used', used_at: new Date(), used_by_restaurant_id: req.body.restaurant_id }
  });
  
  return res.json({
    status: 'success',
    discount: { percentuale: saved.discount.percentuale, locale: saved.discount.locale.nome },
    customer_name: saved.user.first_name,
    used_at: new Date()
  });
}
```

---

## 6. Schermate ristoratore (3 stati post-scan)

Riusa il pattern del mockup `v4-mobile-validity-states.html` — schermate fullscreen.

### 6.1 Success — sfondo verde gradient `#3FB955 → #1d6e30`
- Cerchio bianco semi-traspar 120px con icona check + animazione pulse-ring
- H1 "Sconto attivato" Alfa Slab 32px
- Paragrafo "Applica il vantaggio al conto del cliente"
- Banner percentuale: "−20%" Alfa Slab 32px + "Bi Club · [Locale]" + "Cliente: [Nome] · [data]"
- CTA bianco "Scansiona il prossimo →"

### 6.2 Non valido oggi — sfondo rosso gradient `#E84141 → #A12727`
- Cerchio con ✕
- H1 "Non valido oggi"
- Paragrafo "Questo vantaggio si attiva da [giorni], fascia [slots]"
- **Day strip 7 cerchi**: giorni validi bianchi · oggi outlined `rgba(255,255,255,.4)`
- Meta line: "[Locale] · Tentato [giorno] [data]"
- CTA bianco "Chiudi"

### 6.3 Già utilizzato — sfondo grigio scuro gradient `#5C4F54 → #22181C`
- Cerchio con check
- H1 "Già utilizzato"
- Paragrafo "Questo codice è stato attivato il [data] alle [ora]"
- Banner percentuale opacità 60%
- CTA bianco "Chiudi"

---

## 7. Cascata cambi label CTA in altri punti del sito

| Posizione | Prima | Dopo |
|---|---|---|
| Card drop catalogo | "Prendi sconto" | **"Sblocca sconto"** 🔒 |
| Card convenzione catalogo | "Prendi" | **"Sblocca"** 🔒 |
| Drop hero home | "Prendi sconto" | **"Sblocca sconto"** 🔒 |
| Popup dettagli (CTA principale) | "Lo voglio" | **"Sblocca sconto"** 🔒 |
| AuthGate copy | "Per prendere lo sconto, accedi" | "Entra nel Club di Bi per sbloccare" |
| Email transazionale | "Hai uno sconto attivo" | "Hai un vantaggio sbloccato" |

---

## 8. Test plan

### 8.1 Smoke
- [ ] Card Bi Club: pill validità appare sotto nome locale (verde/giallo/grigio)
- [ ] Click card → popup dettagli con block validità + CTA "Sblocca sconto"
- [ ] Click "Sblocca sconto" senza login → AuthGate
- [ ] Click "Sblocca sconto" con login → popup transitions a stato unlocked con QR
- [ ] Banner success corallo + QR + reassurance verde
- [ ] Click "Scarica PDF" → download PDF coupon (PR21)
- [ ] Lo sconto compare in "I miei vantaggi → Disponibili" con pill validità

### 8.2 Validità giorno
- [ ] Sconto valido Lun-Ven, oggi sabato → pill "Oggi no · Mar–Ven" grigia
- [ ] Apri QR → schermata "Oggi non puoi usarlo" con day strip + reminder
- [ ] Scan ristoratore stesso QR → schermo rosso "Non valido oggi" con day strip

### 8.3 Validità fascia oraria
- [ ] Sconto solo cena (19-23), ora 14:30 → pill gialla "Solo a cena · da 19:00"
- [ ] Click Apri QR alle 14 → schermata "Tra 4h 30m" con countdown
- [ ] Click Apri QR alle 19:30 → QR mostrato (valid_now)

### 8.4 Già usato
- [ ] Sconto scansionato → diventa `used`, sposta in "I miei vantaggi → Utilizzati"
- [ ] Tentativo scan stesso QR → schermo grigio "Già utilizzato il [data]"

### 8.5 Visual parity
- [ ] Mobile match con `v4-mobile-detail-popup-redesign.html` (locked + unlocked)
- [ ] Desktop match con `v4-desktop-detail-popup-redesign.html` (modal centrato)
- [ ] Schermate ristoratore match con `v4-mobile-validity-states.html`

---

## 9. Out of scope

- Modifiche alle card live di /sconti (Bi Club) oltre alla pill validità
- Modifiche alla home, esplora, scheda
- Sistema di notifiche push (reminder "domani torna disponibile")
- UI ristoratore per CONFIGURARE valid_days/valid_meal_slots (per ora solo via admin/SQL — UI di config arriverà dopo)
- Validazione realtime quando il popup è aperto e il countdown scocca

---

## 10. Definizione di done

1. ✅ Card Bi Club: pill validità appare sotto nome locale (3 stati)
2. ✅ Popup dettagli: layout editoriale con block validità + Secondo Bi alla fine + Scopri ristorante
3. ✅ CTA "Sblocca sconto" sempre uniforme
4. ✅ Stato unlocked: QR inline + Scarica PDF (riusa PR21)
5. ✅ I miei vantaggi: pill validità + bottone "Apri QR" sempre attivo
6. ✅ Schermata "Oggi non puoi usarlo" quando QR aperto fuori validità
7. ✅ Backend scan endpoint ritorna 4 stati (success / invalid_now / expired / already_used)
8. ✅ Schermate ristoratore 3 stati post-scan (verde / rosso / grigio)
9. ✅ DB schema esteso con valid_days, valid_meal_slots, valid_time_from/to
10. ✅ Helper `checkValidity` condiviso server+client
11. ✅ Visual parity con tutti i mockup
12. ✅ Test plan §8 verde

---

## 11. Risorse

- Mockup popup mobile: `docs/mockups/v4-mobile-detail-popup-redesign.html`
- Mockup popup desktop: `docs/mockups/v4-desktop-detail-popup-redesign.html`
- Mockup validità (cliente + ristoratore): `docs/mockups/v4-mobile-validity-states.html`
- Logo SVG Bi: `public/bi_logo_def_centrato.svg`
- Template PDF coupon: `docs/templates/pdf-coupon-template.html` (PR21)
- AuthGate: `src/components/AuthGate.jsx` (PR20b)
- Endpoint scan esistente: `/api/discount/scan` (da estendere)
