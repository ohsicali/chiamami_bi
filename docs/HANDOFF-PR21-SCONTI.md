# HANDOFF PR21 — Sconti redesign

**Status:** Ready for implementation
**Scope:** Chirurgico. Solo pagina `/sconti`. Non toccare nav, header globale, tab bar, home, esplora, scheda, drop-card-home, sistema QR backend.
**Branch consigliato:** `feat/pr21-sconti-redesign`
**Mockup di riferimento:**
- `docs/mockups/v4-mobile-sconti-redesign.html` — 4 frame (Disponibili catalogo · I miei→Disponibili · QR popup · I miei→Utilizzati)
- `docs/mockups/v4-desktop-sconti-redesign.html` — 4 frame analoghi desktop

---

## 0. Regola d'oro: scope chirurgico

Il sito live è in produzione, funziona. **NON modificare**:
- Header globale (logo + city picker + Bi avatar / pill desktop)
- Nav floating desktop con pill "Chiedi a Bi"
- Tab bar mobile (Home · Esplora · Sconti · Salvati · Profilo)
- Home, Esplora, Salvati, Profilo, Scheda ristorante
- Sistema QR già live: scan ristoratore → backend valida → marca discount come `used`
- Drop card mostrata in Home (resta com'è)
- Tabelle DB esistenti — solo aggiungere colonne se serve, vedi §6

**Modifica solo**:
1. La pagina `/sconti` con la nuova struttura gerarchica (vedi §1)
2. Il popup QR (riusa pattern esistente, abbellisci e aggiungi azione PDF)
3. Aggiungi endpoint `/api/discount/pdf/[id]` per generazione PDF
4. Eventuale colonna DB `status` su `user_discounts` se non esiste già (`saved` | `used`)

---

## 1. Struttura nuova pagina `/sconti`

### 1.1 Header pagina (riusa esistente)

```
H1 "Sconti"
P "Drop a tempo, convenzioni sempre valide, e i tuoi sconti pronti da usare."
```

### 1.2 Segment LIVELLO 1 (sotto l'header pagina)

Sostituisce il toggle attuale "Disponibili / I miei (2)" con un segment a 2 voci:

```jsx
<SegmentControl level="primary">
  <Tab id="disponibili" count={countDisponibili}>Disponibili</Tab>
  <Tab id="miei" count={countTuttiIMiei}>I miei sconti</Tab>
</SegmentControl>
```

- `countDisponibili` = total sconti attivi nel catalogo (drop attivi + convenzioni)
- `countTuttiIMiei` = `saved` + `used` per current user

Stile: pill ink quando attivo, grigio chiaro background. Counter corallo soft.

### 1.3 Segment LIVELLO 2 (dentro "I miei sconti")

Sub-tab a 2 voci, visibili SOLO quando livello 1 = "I miei sconti":

```jsx
<SubSegment>
  <SubTab id="miei-disponibili" count={countSaved}>Disponibili</SubTab>
  <SubTab id="miei-utilizzati" count={countUsed}>Utilizzati</SubTab>
</SubSegment>
```

Stile: pill outlined, bordo line, attivo = ink. Più leggero del livello 1.

---

## 2. Tab "Disponibili" (livello 1) — catalogo

Layout sezione doppia: drop a tempo in alto + convenzioni sotto.

### 2.1 Drop a tempo

**Mobile**: carousel orizzontale scroll-snap, card 78% width, 1.2 cards visibili per peek next.

**Desktop**: griglia 3-col fissa.

**Card drop** (componente `<DropCard>`):

```jsx
<DropCard>
  <Photo src={drop.photo} />
  <BadgePct>{drop.percentuale}%</BadgePct>  {/* corallo, font-mark, top-left */}
  <BadgeTime>{drop.scadenza}</BadgeTime>   {/* nero traslucido, top-right */}
  <BadgeLive>live</BadgeLive>              {/* rosso pulsante, bottom-left */}
  <Body>
    <h4>{drop.nome}</h4>
    <Meta>{drop.tipo} · {drop.indirizzo}</Meta>
    <Progress>
      <Bar fill={drop.presi/drop.totali} />
      <span>{drop.presi}/{drop.totali} presi</span>
    </Progress>
    <CTA primary onClick={() => prendiSconto(drop.id)}>Prendi sconto</CTA>
  </Body>
</DropCard>
```

Quando drop esaurito (presi==totali) → la card NON appare in Disponibili (filtro lato API).

### 2.2 Convenzioni

**Mobile**: lista verticale 1-col (cards stack).
**Desktop**: griglia 3-col.

**Card convenzione** (componente `<ConvCard>`):

```jsx
<ConvCard>
  <Photo src={conv.photo} />
  <BadgePct>{conv.label}</BadgePct>  {/* es. "Baozi 1,50€" o "−10%", verde o corallo */}
  <Body>
    <Info>
      <h4>{conv.nome}</h4>
      <Meta>
        <CategoryPill>{conv.categoria}</CategoryPill>
        {conv.condizione}  {/* es. "Per due persone min." */}
      </Meta>
    </Info>
    <CTA mini onClick={() => prendiSconto(conv.id)}>Prendi</CTA>
  </Body>
</ConvCard>
```

### 2.3 Click su card → comportamento

- Click sul bottone "Prendi sconto" / "Prendi" → controllo auth, se anonimo → AuthGate (riusa PR20b), altrimenti API call POST `/api/discount/save` con `discount_id` → success → optimistic update counter "I miei sconti" + segment switch automatico (opzionale, oppure stay)
- Click sull'altra parte della card (non bottone) → naviga a scheda ristorante (come live oggi)

### 2.4 API per il catalogo

Riusa l'API esistente che alimenta `/sconti` ora. Estendi con filtro:
- `WHERE status_drop != 'sold_out' AND (drop_end > now() OR is_convenzione = true)`
- Escludi gli sconti già nello stato `saved` o `used` per current user (così non li vedi 2 volte tra "Disponibili" e "I miei")

---

## 3. Tab "I miei sconti" (livello 1)

Mostra il sub-segment livello 2. Default: sub-tab "Disponibili".

### 3.1 "Disponibili" (presi, da usare)

Lista compatta, NON griglia.

**Componente** `<MineRow>`:

```jsx
<MineRow>
  <PhotoMini src={d.locale.photo} />
  <Info>
    <h4>{d.locale.nome}</h4>
    <Meta>{d.locale.tipo} · {d.locale.indirizzo}</Meta>
    <BadgeRow>
      <BadgePct>{d.percentuale}</BadgePct>
      {d.scadenza && <ScadBadge>{d.scadenza}</ScadBadge>}
    </BadgeRow>
  </Info>
  <QRButton onClick={() => apriQR(d.id)}>
    <QrIcon /> Apri QR
  </QRButton>
</MineRow>
```

`d.scadenza`:
- Drop a tempo → countdown vivo "2g 14h" (solo se drop ha scadenza, sempre per drop)
- Convenzione stagionale → data fissa "fino al 31 mag"
- Convenzione sempre valida → NON renderizzare lo scad badge

Il bottone "Apri QR" è ink scuro, icona QR + label. Tap → apre popup QR (vedi §4).

### 3.2 "Utilizzati" (storico)

Lista compatta read-only.

**Componente** `<UsedRow>`:

```jsx
<UsedRow>
  <PhotoMini src={u.locale.photo} />
  <Info>
    <h4>{u.locale.nome}</h4>
    <Sub>
      {u.locale.tipo} · 
      {u.locale.zona && `${u.locale.zona} · `}
      {tipoSconto === 'percentuale' ? 'sconto ' : 'convenzione '}
      <strong>{u.label}</strong>
    </Sub>
  </Info>
  <When>
    <strong>{formatDate(u.used_at)}</strong>
    {/* Mobile: solo "26 apr" + anno sotto. Desktop: "26 aprile 2026" + "X giorni fa" */}
  </When>
</UsedRow>
```

Ordinati per `used_at` desc. Wrapper container con `border-radius: 14px` + bordo line, righe separate da `border-top`.

Niente "totale risparmiato" — dato non disponibile.

Empty state: "Quando userai uno sconto, lo trovi qui."

---

## 4. Popup QR (componente cardinale — riusa pattern, abbellisci)

Bottom sheet su mobile (animazione slideUp), modal centrato 480px su desktop.

### 4.1 Markup

```jsx
<QRPopup discount={d} onClose={...}>
  <PlaceInfo>
    <Photo src={d.locale.photo} />
    <Info>
      <h3>{d.locale.nome}</h3>
      <Meta>{d.locale.tipo} · {d.locale.indirizzo}</Meta>
    </Info>
    <BadgePct>{d.percentuale}</BadgePct>  {/* solo desktop nel header del popup */}
  </PlaceInfo>
  
  {/* Mobile: percentuale grande sotto place-info come elemento separato */}
  {isMobile && <PctBig>{d.percentuale}</PctBig>}
  
  <QRBlock>
    <QRCode value={d.qr_payload} size={200} />
  </QRBlock>
  
  <QRHint>Mostra al ristoratore</QRHint>  {/* font Caveat corallo */}
  <SmallInfo>
    Lui scansiona il codice e <strong>attiva lo sconto</strong>.<br/>
    Codice valido una sola volta.
  </SmallInfo>
  
  {d.scadenza && <ScadLine>Scade tra {d.scadenza}</ScadLine>}
  
  <QRActions>
    <ActionBtn onClick={() => downloadPDF(d.id)}>
      <Icon>⬇</Icon>
      Scarica PDF
      <small>stampa o salva sul telefono</small>
    </ActionBtn>
  </QRActions>
</QRPopup>
```

### 4.2 Stili — mobile (bottom sheet)

```css
.qr-overlay {
  position: fixed; inset: 0;
  background: rgba(34, 24, 28, 0.65);
  backdrop-filter: blur(6px);
  z-index: 100;
  display: flex; align-items: flex-end;
}
.qr-sheet {
  width: 100%; background: var(--paper);
  border-radius: 24px 24px 0 0;
  padding: 18px 18px 30px;
  animation: slideUp 0.3s ease;
  display: flex; flex-direction: column; align-items: center;
}
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.qr-block {
  background: #fff; border: 2px solid var(--ink);
  border-radius: 14px; padding: 14px;
}
.qr-block .qr { width: 170px; height: 170px; }

.qr-hint {
  font-family: var(--ff-hand);  /* Caveat */
  font-size: 18px; color: var(--corallo);
}
```

### 4.3 Stili — desktop (modal centrato)

```css
.qr-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(34, 24, 28, 0.65); backdrop-filter: blur(6px);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 30px;
}
.qr-modal {
  width: 480px; max-width: 100%;
  background: var(--paper); border-radius: 24px;
  padding: 30px 36px 32px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.4);
}
.qr-modal .qr-block .qr { width: 200px; height: 200px; }
```

### 4.4 Generazione QR code

Usa libreria `qrcode` (Node) o `qrcode.react` (client). Payload identico a quello già usato dal sistema scan-ristoratore esistente. **Non cambiare il payload** — il backend già sa decodificarlo.

### 4.5 Live update quando ristoratore scansiona

Mentre il QR popup è aperto, se il ristoratore scansiona dal suo dispositivo:
- Backend marca lo sconto come `used`
- Ideale (NICE-TO-HAVE): canale realtime Supabase su `user_discounts` notifica il client → popup si chiude e mostra animation success "✓ Sconto attivato"
- Acceptable in PR21 base: il popup resta aperto, ma se l'utente lo chiude e torna, lo sconto è migrato in "Utilizzati" automaticamente al refresh/navigazione

---

## 5. Generazione PDF — endpoint nuovo

### 5.0 Template di riferimento — DA SEGUIRE 1:1

**File template ufficiale**: `docs/templates/pdf-coupon-template.html`

Aprilo nel browser per vedere ESATTAMENTE come deve apparire il PDF generato. Tutte le dimensioni, colori, font, spacing, posizioni sono già definiti. Il template usa:
- Logo SVG ufficiale `/logo-guida-bi.svg` (esistente in `public/`)
- Tagline "BY CHIAMAMI BI" in Poppins 700
- Font Google Fonts: Poppins (UI) + Caveat (hint "Mostra al ristoratore")
- Colori brand: corallo #E8453C, ink #22181C, page #FAF7F2, oro #B08954
- Layout A6 verticale (105×148mm)
- Variabili `{{...}}` da sostituire a runtime

**Strategia di generazione consigliata**: `puppeteer-core` + `@sparticuz/chromium` (insieme ~50MB, sotto cap Vercel). Carichi `pdf-coupon-template.html`, fai `page.setContent()` con HTML processato (variabili sostituite + QR base64 inline), poi `page.pdf({format: 'A6', printBackground: true})`.

Alternative leggere accettabili: `@react-pdf/renderer` o `pdfkit` ma DEVONO produrre output visivamente identico al template HTML.

### 5.1 Endpoint

```
GET /api/discount/pdf/[savedDiscountId]
Returns: application/pdf, attachment
```

### 5.2 Verifica auth

```js
const userId = await getUserFromAuth(req);
const saved = await db.userDiscounts.findFirst({
  where: { id: savedDiscountId, user_id: userId }
});
if (!saved) return res.status(404).end();
```

### 5.3 Implementazione consigliata — puppeteer + template HTML

```js
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import QRCode from 'qrcode';
import path from 'path';

export default async function handler(req, res) {
  const { id } = req.query;
  
  const userId = await getUserFromAuth(req);
  const saved = await db.userDiscounts.findFirst({
    where: { id, user_id: userId },
    include: { discount: { include: { locale: true } } }
  });
  if (!saved) return res.status(404).end();
  
  const templatePath = path.join(process.cwd(), 'docs/templates/pdf-coupon-template.html');
  let html = await fs.readFile(templatePath, 'utf-8');
  
  const qrDataUrl = await QRCode.toDataURL(saved.qr_token, { width: 400, margin: 0 });
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chiamamibi.com';
  
  html = html
    .replace(/\{\{locale_nome\}\}/g, saved.discount.locale.nome)
    .replace(/\{\{locale_categoria\}\}/g, saved.discount.locale.categoria)
    .replace(/\{\{locale_indirizzo\}\}/g, saved.discount.locale.indirizzo)
    .replace(/\{\{percentuale\}\}/g, saved.discount.percentuale)
    .replace(/\{\{descrizione_sconto\}\}/g, saved.discount.descrizione || 'Valido una sola volta')
    .replace(/\{\{codice_testuale\}\}/g, `Codice: ${saved.qr_token.slice(0, 12).toUpperCase()}`)
    .replace(/\{\{scadenza\}\}/g, formatScadenza(saved.discount.expires_at))
    .replace(/src="\/logo-guida-bi\.svg"/g, `src="${baseUrl}/logo-guida-bi.svg"`)
    .replace(/<div class="cp-qr-placeholder"><\/div>/, `<img src="${qrDataUrl}" alt="QR">`)
    .replace(/(<div class="cp-photo">\s*<img src=")[^"]+(")/, `$1${saved.discount.locale.photo}$2`);
  
  if (!saved.discount.expires_at) {
    html = html.replace(/<div class="cp-scad">[^<]*<\/div>/, '');
  }
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdf = await page.pdf({
    format: 'A6',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  
  await browser.close();
  
  const slug = saved.discount.locale.slug || 'sconto';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sconto-${slug}.pdf"`);
  res.send(pdf);
}
```

**Vincoli importanti**:
- `puppeteer-core + @sparticuz/chromium` insieme ~50MB → sotto cap Vercel Hobby function size 250MB
- Function timeout 10s default → se serve più, configurare in `vercel.json` (max 60s su Hobby)
- Cold start può essere 3-5s la prima volta dopo deploy, poi <1s in warm
- Il logo SVG va caricato via URL pubblico assoluto (relative path non funziona dentro puppeteer headless senza base href)

### 5.4 Vincolo Vercel Hobby

Cap 12 funzioni. Verifica current count + se sforiamo, consolidare con un router pattern (es. `/api/discount/[action]` con switch su action) — vedi memoria esistente per pattern.

### 5.5 Frontend trigger

```jsx
async function downloadPDF(discountId) {
  const res = await fetch(`/api/discount/pdf/${discountId}`);
  if (!res.ok) {
    toast.error('Non sono riuscito a generare il PDF, riprova.');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sconto-${slug}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

Su iOS Safari: il download può aprire il viewer in-app, l'utente può salvare con tap. Va bene.

---

## 6. Schema DB

Verifica che `user_discounts` (o equivalente) abbia almeno questi campi:

```sql
CREATE TABLE IF NOT EXISTS user_discounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  discount_id  uuid NOT NULL REFERENCES discounts(id),
  status       text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'used')),
  saved_at     timestamptz NOT NULL DEFAULT now(),
  used_at      timestamptz,
  qr_token     text NOT NULL UNIQUE,  -- usato per scan ristoratore (già esistente)
  UNIQUE (user_id, discount_id)        -- un utente può prendere uno sconto una volta
);
```

Se la tabella esiste già con nomi diversi, NON rinominare: adatta solo il codice. Se manca `status` o `saved_at`, aggiungi colonne con migration:

```sql
ALTER TABLE user_discounts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'used' CHECK (status IN ('saved', 'used'));
ALTER TABLE user_discounts ADD COLUMN IF NOT EXISTS saved_at timestamptz NOT NULL DEFAULT now();
```

Default 'used' su righe esistenti perché ad oggi nel sistema TUTTI gli `user_discounts` sono già stati scansionati (= used).

### 6.1 RLS policies

```sql
CREATE POLICY "users read own user_discounts" ON user_discounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own user_discounts" ON user_discounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- UPDATE solo lato admin/ristoratore (sistema esistente)
```

---

## 7. Endpoint da creare/modificare

| Endpoint | Metodo | Purpose | Note |
|----------|--------|---------|------|
| `/api/discount/save` | POST | Crea row in `user_discounts` con `status='saved'` | NUOVO se non esiste |
| `/api/discount/pdf/[id]` | GET | Genera PDF on-the-fly | NUOVO |
| `/api/discount/scan` | POST | Esistente, ristoratore valida QR → marca `status='used'`, set `used_at` | NON TOCCARE se funziona già |
| `/api/discounts/list` | GET | Catalogo Disponibili (drop attivi + convenzioni) | Esistente |
| `/api/discounts/mine` | GET | Lista user_discounts del current user | NUOVO o estendi esistente |

**Vincolo Vercel Hobby cap 12 funzioni**: verificare. Se sforiamo, consolidare i 2 nuovi endpoint sotto `/api/discount/[action]` con switch (router pattern già usato in PR12c per `send-email`).

---

## 8. Component diagram

```
SconteRedesignPage
├── PageHeader (h1 + p, esistente)
├── SegmentLevel1 (Disponibili / I miei sconti)
├── { livello1 === 'disponibili' && (
│     <CatalogoView>
│       ├── DropSection (carousel mobile / 3-col desktop)
│       │   └── DropCard[]
│       └── ConvSection (lista mobile / 3-col desktop)
│           └── ConvCard[]
│     </CatalogoView>
│   )}
└── { livello1 === 'miei' && (
      <MieiView>
        ├── SubSegmentLevel2 (Disponibili / Utilizzati)
        ├── { livello2 === 'disponibili' && (
        │     <MieiDisponibiliList>
        │       └── MineRow[]  (con bottone "Apri QR")
        │     </MieiDisponibiliList>
        │   )}
        └── { livello2 === 'utilizzati' && (
              <MieiUtilizzatiList>
                └── UsedRow[]
              </MieiUtilizzatiList>
            )}
      </MieiView>
    )}

QRPopup (portal, mounted on demand)
├── PlaceInfo (foto + nome + tipo + percentuale badge)
├── QRBlock (QR scansionabile)
├── QRHint (font Caveat corallo)
├── SmallInfo (descrizione)
├── ScadLine (solo se applicabile)
└── QRActions
    └── ActionBtn "Scarica PDF"

AuthGate (riusa PR20b)
└── triggered da "Prendi sconto" se anonimo
```

---

## 9. Routing & URL state

- `/sconti` → tab Disponibili (default)
- `/sconti?tab=miei` → tab I miei sconti, sub-tab Disponibili
- `/sconti?tab=miei&sub=utilizzati` → tab I miei, sub-tab Utilizzati

Permette deep-link e back/forward browser.

```jsx
const [searchParams, setSearchParams] = useSearchParams();
const tab = searchParams.get('tab') || 'disponibili';
const sub = searchParams.get('sub') || 'disponibili';
```

---

## 10. Edge cases

- **Drop esaurito (presi==totali)**: scompare dal catalogo Disponibili
- **Drop scaduto (now > drop_end)**: scompare dal catalogo Disponibili. Se l'utente l'aveva preso (status='saved'), in "I miei → Disponibili" mostra badge "scaduto" + bottone "Apri QR" disabilitato + copy "non più valido"
- **Scansione concorrente**: se lo stesso QR viene scansionato due volte (race condition), il backend rifiuta la seconda con error. Frontend: in caso di re-fetch dopo errore, lo sconto risulta `used`, sposta in Utilizzati
- **Anonimo che clicca "Prendi sconto"**: AuthGate stesso pattern di PR20b — copy: "Per prendere lo sconto, accedi o registrati"
- **PDF generation fail**: toast error "Non sono riuscito a generare il PDF, riprova"
- **Click sulla card non bottone**: naviga a scheda ristorante (come live)

---

## 11. Test plan

### 11.1 Smoke test
- [ ] `/sconti` apre con segment "Disponibili" attivo, mostra drop carousel + convenzioni
- [ ] Click "Prendi sconto" su drop senza login → AuthGate
- [ ] Click "Prendi sconto" loggato → success, counter "I miei sconti" si incrementa
- [ ] Sezione "I miei sconti" → "Disponibili" mostra lo sconto preso
- [ ] Click "Apri QR" → popup con QR + tutti gli elementi
- [ ] Bottone "Scarica PDF" → download file con foto, nome, %, QR, scadenza
- [ ] Aprire il PDF e scansionarlo da un altro telefono → riconosciuto come QR valido
- [ ] Sezione "Utilizzati" mostra storico in lista compatta
- [ ] URL deep-link `/sconti?tab=miei&sub=utilizzati` funziona

### 11.2 Edge cases
- [ ] Drop scaduto preso prima della scadenza → "I miei → Disponibili" mostra "scaduto"
- [ ] Stesso sconto preso 2 volte → errore (UNIQUE constraint)
- [ ] Anonimo apre `/sconti` → vede catalogo Disponibili senza problemi
- [ ] Anonimo clicca "Prendi" → AuthGate, dopo login lo sconto si salva automaticamente
- [ ] Refresh pagina su sub-tab → mantiene stato

### 11.3 Visual parity
- [ ] Mobile match con `docs/mockups/v4-mobile-sconti-redesign.html` (4 frame)
- [ ] Desktop match con `docs/mockups/v4-desktop-sconti-redesign.html` (4 frame)
- [ ] Header globale invariato (logo + city + Bi avatar)
- [ ] Tab bar mobile / nav desktop invariati
- [ ] Drop card hover/click come live attuale
- [ ] Scheda ristorante invariata

### 11.4 Performance
- [ ] Carousel drop fluido su mobile (60fps scroll)
- [ ] Popup QR apre in <300ms
- [ ] PDF generato in <3s
- [ ] Listing "Utilizzati" rapido anche con 50+ entries

---

## 12. Out of scope (NON fare in PR21)

- Aggiunta a Wallet (Apple/Google) — scartato 27/04
- Realtime push del successo scan ristoratore (nice-to-have, opzionale)
- Multi-lingua (solo IT)
- Ricerca/filtri sui propri sconti (lista breve, non serve)
- "Hai risparmiato in totale": dato non disponibile
- Restyling header globale, nav floating, tab bar mobile, home, esplora, scheda
- Modifica del sistema scan ristoratore esistente
- Sostituzione drop card nella home (resta com'è)

---

## 13. Vincoli speciali

- **Vercel Hobby cap 12 funzioni**: PR21 aggiunge potenzialmente 2 nuovi endpoint (`/api/discount/save`, `/api/discount/pdf/[id]`). Verifica current count: se sforiamo, consolidare sotto `/api/discount/[action]` con switch.
- **Sistema QR scan ristoratore**: già live e funzionante. NON toccare backend logic. Riusa stesso `qr_token` payload nel popup, riusa stesso endpoint scan.
- **AuthGate riuso**: copia pattern da PR20b (modale "fai login per chattare"). Adatta copy: "Per prendere lo sconto, accedi o registrati."

---

## 14. Definizione di "done"

PR21 è done quando:
1. ✅ `/sconti` ha la struttura gerarchica a 2 livelli (Disponibili / I miei sconti → Disponibili / Utilizzati)
2. ✅ Visual match con i 2 mockup mobile/desktop (8 frame totali)
3. ✅ "Prendi sconto" funziona, sposta in "I miei → Disponibili"
4. ✅ Popup QR si apre con tutti gli elementi (foto + nome + percentuale grande + QR + caption Caveat + scadenza + bottone PDF)
5. ✅ Download PDF funzionante con layout descritto in §5.3
6. ✅ Sistema scan ristoratore esistente continua a funzionare invariato → sposta automatico in Utilizzati
7. ✅ AuthGate per anonimi (riusa PR20b)
8. ✅ Header globale, nav, tab bar mobile, altre pagine invariate
9. ✅ Test plan §11 verde
10. ✅ Smoke test su prod preview

---

## 15. Risorse

- Mockup mobile: `docs/mockups/v4-mobile-sconti-redesign.html`
- Mockup desktop: `docs/mockups/v4-desktop-sconti-redesign.html`
- **Template PDF coupon (DA SEGUIRE 1:1)**: `docs/templates/pdf-coupon-template.html`
- Logo brand: `public/logo-guida-bi.svg` (esistente, NON modificare)
- Pattern AuthGate da copiare: PR20b → `src/components/AuthGate.jsx`
- Sistema QR scan esistente: `/api/discount/scan` o equivalente (NON toccare)
- Tabella `user_discounts` Supabase (verifica schema, eventualmente add colonne)
- Memoria architettura: `project_pr20_chiedi_a_bi.md` (per pattern AuthGate)
- Design tokens v4 esistenti (corallo, ink, oro, Poppins, Caveat)

---

## 16. Quick checklist pre-merge

- [ ] Branch `feat/pr21-sconti-redesign` creato da main
- [ ] 2 nuovi componenti React: `<MineRow>`, `<UsedRow>`
- [ ] 1 nuovo componente popup: `<QRPopup>` (mobile bottom-sheet + desktop modal)
- [ ] 1 nuovo endpoint: `/api/discount/pdf/[id]` (con `pdfkit` + `qrcode`)
- [ ] 1 endpoint forse nuovo: `/api/discount/save` (verifica se esiste)
- [ ] Eventuale migration su `user_discounts` per aggiungere `status` + `saved_at`
- [ ] Pacchetti npm aggiunti: `pdfkit`, `qrcode` (se non presenti)
- [ ] Test plan §11 eseguito a mano in preview
- [ ] PR aperto con descrizione che linka questo handoff
- [ ] Verifica Vercel Hobby function count post-deploy
