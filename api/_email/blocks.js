/**
 * I mattoni con cui sono fatte le email.
 *
 * Ogni funzione restituisce una stringa HTML che sta dentro la colonna da
 * 600px. Regole che valgono per tutte, e che sono il motivo per cui questo
 * file non somiglia a del normale HTML:
 *
 *  · tabelle e non div — Outlook usa il motore di rendering di Word, che di
 *    flexbox e grid non sa niente e dei margini fa quello che gli pare;
 *  · stile in linea e non classi — Gmail taglia via `<style>` quando inoltra
 *    un messaggio, e quello che resta senza stile deve essere comunque
 *    leggibile;
 *  · niente `background-image` per cose che contano — Outlook non le carica;
 *  · bottoni con padding sulla cella, non sul link — così l'area cliccabile
 *    è tutta la pillola anche dove `display:inline-block` viene ignorato.
 *
 * Sul disegno, dopo la revisione di settembre: il corallo non è più il fondo
 * dei blocchi grandi ma solo l'accento (occhiello, bottone, un filo qua e
 * là). I blocchi importanti — l'offerta, il codice — stanno sull'inchiostro
 * con un filo d'oro. Il corallo pieno a tutta larghezza faceva volantino;
 * l'inchiostro con l'oro fa guida.
 */

import { COLORS, DROP_PHOTO, FONT_BODY, FONT_DISPLAY, FONT_MONO, MOSAIC, SITE_URL, THUMB, WIDTH } from './theme.js'

/** Niente HTML dentro il testo che arriva dal database. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ── Testi ─────────────────────────────────────────────────────────── */

/**
 * L'occhiello: due parole in maiuscoletto spaziato sopra il titolo.
 *
 * Fa il lavoro che nelle email fa di solito una frase buttata lì ("Ciao, ti
 * scrivo perché…"): dice in un colpo d'occhio di che si tratta, e lascia al
 * titolo il compito di dire la cosa concreta.
 */
export function eyebrow(text, { color = COLORS.corallo, padding = '18px 20px 0' } = {}) {
  if (!text) return ''
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:10px;line-height:1.3;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:${color};">${esc(text)}</td></tr>`
}

export function h1(text, { color = COLORS.ink, align = 'left', padding = '6px 20px 0', size = 27 } = {}) {
  return `<tr><td class="cb-h1" style="padding:${padding};font-family:${FONT_DISPLAY};font-size:${size}px;line-height:1.14;font-weight:800;letter-spacing:-0.5px;color:${color};text-align:${align};">${esc(text)}</td></tr>`
}

/**
 * La riga sotto il titolo: cucina, fascia di prezzo, indirizzo.
 *
 * In oro e non in grigio perché l'oro nel brand è il colore della curatela:
 * dice "questa riga l'ha scritta qualcuno", non "questi sono i metadati".
 */
export function metaLine(text, { padding = '5px 20px 0' } = {}) {
  if (!text) return ''
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:13px;line-height:1.4;font-weight:600;color:${COLORS.oroDeep};">${esc(text)}</td></tr>`
}

/**
 * La firma, dentro la frase.
 *
 * Prima era un blocco a sé con un divisore sopra e ottanta pixel attorno.
 * È la stessa voce e lo stesso "— Bi": cambia solo che adesso sta in coda
 * all'ultimo paragrafo, dove finisce naturalmente chi scrive una cosa di
 * suo pugno. `white-space:nowrap` perché "— Bi" spezzato su due righe è
 * l'unico modo di far sembrare finta una firma vera.
 */
export const SIGN = ` <span style="color:${COLORS.oroDeep};font-weight:700;white-space:nowrap;">— Bi</span>`

export function h2(text, { color = COLORS.ink, padding = '20px 20px 0' } = {}) {
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:11px;line-height:1.3;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:${color};">${esc(text)}</td></tr>`
}

/** Il paragrafo d'apertura, un gradino più grande del corpo. */
export function lede(text, { padding = '10px 20px 0', html = null } = {}) {
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:14.5px;line-height:1.6;color:${COLORS.body};">${html || esc(text)}</td></tr>`
}

export function p(html, { color = COLORS.body, size = 14, align = 'left', padding = '14px 20px 0' } = {}) {
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:${size}px;line-height:1.65;color:${color};text-align:${align};">${html}</td></tr>`
}

export function spacer(px = 20) {
  return `<tr><td style="font-size:0;line-height:0;height:${px}px;">&nbsp;</td></tr>`
}

/**
 * Il filo. Quello d'oro separa due discorsi diversi dentro la stessa email,
 * quello chiaro separa due paragrafi dello stesso discorso.
 */
export function divider({ padding = '18px 20px 0', gold = false } = {}) {
  const color = gold ? COLORS.oro : COLORS.line
  const h = gold ? 2 : 1
  const w = gold ? '46' : '100%'
  return `<tr><td style="padding:${padding};"><table role="presentation" width="${w}" cellpadding="0" cellspacing="0" border="0" style="${gold ? 'width:46px;' : 'width:100%;'}"><tr><td style="height:${h}px;background:${color};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`
}

/* ── Bottone ───────────────────────────────────────────────────────── */

/**
 * Il padding sta sulla cella: in Outlook `display:inline-block` su un <a>
 * viene ignorato e il bottone si affloscia sul testo.
 */
export function button(label, href, { bg = COLORS.corallo, color = COLORS.white, align = 'left', padding = '20px 20px 0', block = false } = {}) {
  // Il bottone "block" occupa tutta la colonna: serve dentro la card del
  // drop e sotto il blocco della convenzione, dove una pillola stretta in
  // mezzo a un riquadro colorato sembra un bottone dimenticato lì.
  const cell = `<td align="center" bgcolor="${bg}" style="background:${bg};border-radius:999px;">
        <a href="${esc(href)}" style="display:${block ? 'block' : 'inline-block'};padding:14px ${block ? '20' : '30'}px;font-family:${FONT_BODY};font-size:15px;line-height:1.2;font-weight:700;color:${color};text-decoration:none;border-radius:999px;">${esc(label)}</a>
      </td>`
  return `<tr><td style="padding:${padding};" align="${align}">
    <table role="presentation" ${block ? 'width="100%" ' : ''}cellpadding="0" cellspacing="0" border="0"${block ? ' style="width:100%;"' : ''}><tr>
      ${cell}
    </tr></table>
  </td></tr>`
}

/** Bottone secondario, con il solo bordo. */
export function buttonGhost(label, href, { align = 'left', padding = '12px 20px 0' } = {}) {
  return `<tr><td style="padding:${padding};" align="${align}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border:1.5px solid ${COLORS.line};border-radius:999px;" align="center">
        <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT_BODY};font-size:14px;font-weight:700;color:${COLORS.ink};text-decoration:none;border-radius:999px;">${esc(label)}</a>
      </td>
    </tr></table>
  </td></tr>`
}

/* ── La foto in cima ───────────────────────────────────────────────── */

/**
 * L'indirizzo della foto già ritagliata.
 *
 * Il ritaglio lo fa il nostro proxy (`/api/img`), non il client di posta:
 * `object-fit` in Outlook non esiste, e una fascia ottenuta con un'altezza
 * fissa senza ritaglio server schiaccerebbe la foto. Chiediamo il doppio
 * delle dimensioni finali perché gli schermi dei telefoni hanno il doppio
 * dei punti, e `fm=jpg` perché il WebP che il proxy servirebbe di sua
 * iniziativa in Outlook 2016 e in qualche webmail resta un riquadro vuoto.
 *
 * Le foto che non stanno su Supabase (un domani: un link esterno) tornano
 * indietro come sono, e chi le usa non mette l'altezza fissa.
 */
export function croppedPhoto(url, { w = THUMB.w, h = THUMB.h, q = null, retina = true } = {}) {
  const raw = String(url || '')
  if (!raw || !raw.includes('supabase.co/storage/')) return { url: raw, cropped: false }
  const k = retina ? 2 : 1
  const params = new URLSearchParams({ url: raw, w: String(w * k), h: String(h * k), fit: 'cover', fm: 'jpg' })
  // La qualità si abbassa solo dove le foto sono tante: quattro immagini a
  // piena qualità fanno superare a Gmail la soglia oltre la quale tronca il
  // messaggio, e la prima cosa che sparisce è il piè di pagina — cioè il
  // link per disiscriversi, che non è facoltativo.
  if (q) params.set('q', String(q))
  return { url: `${SITE_URL}/api/img?${params.toString()}`, cropped: true }
}

/* ── Il mosaico 1+3 ────────────────────────────────────────────────── */

/**
 * I fondi caldi che sostituiscono una foto che non c'è.
 *
 * Mai un rettangolo grigio e mai una tessera vuota: un buco grigio in
 * un'email che parla di un posto dove si mangia dice "qui manca qualcosa",
 * e chi legge lo legge come trascuratezza nostra. Un fondo caldo con
 * l'emoji della categoria dice invece "questa foto non ce l'ho ancora", che
 * è la verità e non fa danno.
 *
 * Il gradiente lo capiscono Apple Mail e Gmail; Outlook ignora
 * `background-image` e si tiene il `background-color`, che per questo sta
 * scritto anche da solo.
 */
const FALLBACK_TINTE = [
  { from: '#F3C9A5', to: '#D98E63', solid: '#E3AC84' },
  { from: '#E8D9C2', to: '#BBA180', solid: '#D2BDA1' },
  { from: '#EFD7C4', to: '#C99A76', solid: '#DCB89D' },
  { from: '#DDC9B8', to: '#A98A72', solid: '#C3AA95' },
]

/** L'emoji che sta al posto della foto, scelta dalla categoria del locale. */
const EMOJI_CUCINA = [
  [/sushi|giappo|ramen|poke/i, '\u{1F363}'],
  [/pizz/i, '\u{1F355}'],
  [/burger|panin|street/i, '\u{1F354}'],
  [/gelat|dolc|pasticc|dessert/i, '\u{1F366}'],
  [/caff|colazion|bar|brunch|pasticceria/i, '\u{2615}'],
  [/cocktail|aperitiv|drink|wine|vin|enotec/i, '\u{1F378}'],
  [/pesc|mare|crudo/i, '\u{1F990}'],
  [/spagnol|tapas|messic|taco/i, '\u{1F958}'],
  [/veg|insalat|healthy/i, '\u{1F957}'],
  [/carne|grill|bracer|steak/i, '\u{1F969}'],
  [/pane|panetteria|forn|focacc/i, '\u{1F956}'],
]

export function emojiFor(cuisine) {
  const t = String(cuisine || '')
  for (const [re, emoji] of EMOJI_CUCINA) if (re.test(t)) return emoji
  return '\u{1F37D}'
}

/** Una tessera senza foto: fondo caldo, emoji al centro, altezza data. */
function tintTile({ h, emoji, size, i = 0 }) {
  const t = FALLBACK_TINTE[i % FALLBACK_TINTE.length]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${t.solid};background-image:linear-gradient(135deg,${t.from},${t.to});">
        <tr><td align="center" valign="middle" height="${h}" style="height:${h}px;font-size:${size}px;line-height:${h}px;">${emoji}</td></tr>
      </table>`
}

/**
 * Il mosaico: una foto grande in 16:9 e sotto fino a tre tessere quadrate.
 *
 * Va su "nuovo in guida" e sulle convenzioni. **Non** sul drop: lì la foto
 * sta dentro la card corallo con il badge a cavallo del bordo, e un mosaico
 * spaccherebbe il componente.
 *
 * Tre cose qui non sono estetiche e non si tolgono:
 *
 *  · `font-size:0; line-height:0` su ogni cella che contiene un'immagine.
 *    Senza, i client aggiungono qualche pixel sotto ogni foto (l'immagine è
 *    un elemento di riga e si porta dietro lo spazio del rigo) e le tessere
 *    si sfalsano di un pelo, che è esattamente il genere di sbavatura che
 *    si nota senza saper dire cosa;
 *  · i distacchi sono `border` bianchi da 3px **sulle celle**, non padding
 *    e non spacer gif: il padding dentro una cella con un'immagine al 100%
 *    in Outlook allarga la tabella invece di stringere la foto;
 *  · `border-collapse:collapse` sulle due tabelle, altrimenti i bordi
 *    bianchi si sommano al `cellspacing` e i distacchi diventano sei.
 *
 * Fallback, tutti e quattro obbligatori:
 *  · 1 foto  → solo la grande, la riga sotto non si renderizza;
 *  · 2 foto  → la grande e due tessere al 50%;
 *  · 3 o più → mosaico pieno, con "+N" sull'ultima se ce ne sono altre;
 *  · 0 foto  → una sola fascia a gradiente caldo con l'emoji.
 *
 * @param {object}   o
 * @param {string[]} o.photos   gli indirizzi, in ordine (ne usa al massimo 4)
 * @param {number}   [o.total]  quante ne esistono in tutto, per il "+N"
 * @param {string}   o.alt      il nome del locale: chi ha le foto spente legge questo
 * @param {string}   [o.cuisine] serve solo a scegliere l'emoji del ripiego
 */
export function photoMosaic({ photos = [], total = 0, alt = '', cuisine = '' } = {}) {
  const list = (photos || []).filter(Boolean).slice(0, 4)
  const emoji = emojiFor(cuisine)
  const G = MOSAIC.gutter
  const BIG_H = Math.round((WIDTH * 9) / 16)
  const TILE_H = Math.round((WIDTH - 2 * G) / 3)

  const big = list[0]
    ? `<img src="${esc(croppedPhoto(list[0], { ...MOSAIC.big, retina: false }).url)}" width="${WIDTH}" alt="${esc(alt)}" style="display:block;width:100%;max-width:${WIDTH}px;height:auto;border:0;outline:none;" />`
    : tintTile({ h: BIG_H, emoji, size: 42 })

  const tiles = list.slice(1, 4)
  const rest = Math.max(0, Number(total || list.length) - 4)

  let row2 = ''
  if (tiles.length) {
    // La riga si divide in parti uguali fra le tessere che ci sono: una
    // sola prende tutta la larghezza, due metà ciascuna, tre un terzo.
    //
    // L'handoff scriveva "2 foto → grande + due tessere al 50%", che sono
    // tre immagini con due foto: la scala giusta è quella qui sotto, e il
    // caso "due al 50%" è quello con tre foto. La regola che non si tocca è
    // l'altra, e questa la rispetta: mai una tessera vuota, mai un buco.
    const pct = tiles.length === 1 ? '100%' : tiles.length === 2 ? '50%' : '33.33%'
    const cells = tiles.map((url, i) => {
      const last = i === tiles.length - 1
      const borders = `border-top:${G}px solid ${COLORS.white};${last ? '' : `border-right:${G}px solid ${COLORS.white};`}`
      // La tessera unica è una fascia 2:1 e non un quadrato: un quadrato
      // largo 594 sotto la foto grande raddoppierebbe l'altezza del
      // mosaico per mostrare una foto sola.
      const larghezza = Math.round((WIDTH - (tiles.length - 1) * G) / tiles.length)
      const crop = tiles.length === 1
        ? { w: MOSAIC.big.w, h: Math.round(MOSAIC.big.w / 2), q: MOSAIC.tile.q }
        : MOSAIC.tile
      const img = `<img src="${esc(croppedPhoto(url, { ...crop, retina: false }).url)}" width="${larghezza}" alt="${esc(i === 0 && tiles.length === 1 ? alt : '')}" style="display:block;width:100%;height:auto;border:0;outline:none;" />`
      // Il "+N" è una pastiglia piena in un angolo, non un velo sopra tutta
      // la foto: un velo vorrebbe `rgba()`, che Outlook butta via lasciando
      // il numero bianco su bianco. E sta dentro un commento condizionale
      // perché `position:absolute` nel motore di Word non posiziona niente e
      // la pastiglia cadrebbe *sotto* la foto, in mezzo alla pagina. Dove il
      // commento la nasconde resta la foto pulita: nessun caso peggiore.
      const overlay = last && rest > 0
        ? `<!--[if !mso]><!--><div style="position:relative;font-size:0;line-height:0;"><div style="position:absolute;right:6px;bottom:6px;background-color:${COLORS.ink};border-radius:8px;padding:4px 8px;font-family:${FONT_BODY};font-size:12px;line-height:1;font-weight:800;color:${COLORS.white};">+${rest}</div></div><!--<![endif]-->`
        : ''
      return `<td width="${pct}" style="width:${pct};padding:0;font-size:0;line-height:0;${borders}">${img}${overlay}</td>`
    }).join('\n          ')
    row2 = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr>
          ${cells}
        </tr>
      </table>`
  } else if (list.length === 1) {
    row2 = ''
  } else if (!list.length) {
    row2 = ''
  }

  return `<tr><td style="padding:0;font-size:0;line-height:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:0;font-size:0;line-height:0;">${big}</td></tr>
      </table>
      ${row2}
    </td></tr>`
}

/* ── La card dell'offerta ──────────────────────────────────────────── */

/**
 * Lo sconto, sull'inchiostro con il filo d'oro.
 *
 * Prima era un rettangolo corallo pieno con dentro il numero in bianco: si
 * vedeva da lontano ma somigliava a un volantino del supermercato, che è
 * esattamente quello che questa guida non è. L'inchiostro fa da vetrina —
 * il numero resta la cosa più grande della pagina, ma sopra ci sta del buio
 * e non del rosso, e il corallo torna dove serve davvero, sul bottone.
 *
 * Gli esadecimali al posto di `rgba()` non sono pignoleria: Outlook ignora
 * `rgba()` e al suo posto non mette niente, e la pillola della scadenza
 * diventerebbe testo chiaro su fondo chiaro.
 */
export function offerCard({ value, restaurantName, perk, meta, countdown }) {
  return `<tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.ink};border-radius:20px;">
      <tr><td style="padding:26px 28px 28px;">
        ${countdown ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;"><tr><td style="border:1px solid #5A4A33;border-radius:999px;padding:7px 14px;font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:1.2px;color:${COLORS.oroLight};">${esc(countdown)}</td></tr></table>` : ''}
        <div style="font-family:${FONT_DISPLAY};font-size:52px;line-height:1;font-weight:700;color:${COLORS.onInk};letter-spacing:-1.5px;">${esc(value)}</div>
        <div style="font-family:${FONT_DISPLAY};font-size:22px;line-height:1.2;font-weight:600;color:${COLORS.oroLight};padding-top:8px;">${esc(restaurantName)}</div>
        ${perk || meta ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr><td style="height:1px;background:#3D3238;font-size:0;line-height:0;">&nbsp;</td></tr></table>` : ''}
        ${perk ? `<div style="font-family:${FONT_BODY};font-size:15px;line-height:1.55;font-weight:600;color:${COLORS.onInk};padding-top:16px;">${esc(perk)}</div>` : ''}
        ${meta ? `<div style="font-family:${FONT_BODY};font-size:13px;line-height:1.55;color:${COLORS.onInk70};padding-top:6px;">${esc(meta)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>`
}

/**
 * La card del drop: corallo pieno, come sul sito.
 *
 * Il corallo pieno non è una scelta di gusto ed è l'unico punto in tutto il
 * sistema dove si usa: **corallo = drop**, cioè uno sconto che scade e i cui
 * posti finiscono. Una convenzione, che non scade, usa `conventionOffer` —
 * crema con il filetto d'oro. Vestire una convenzione da drop brucia
 * l'urgenza anche sui drop veri: dopo due email chi legge impara che la
 * fretta è finta, e da lì in poi non funziona più nemmeno quando è vera.
 *
 * È lo stesso componente che c'è sul sito: chi tocca il bottone ritrova
 * esattamente quello che ha visto nella mail, ed è questo — più di
 * qualunque ornamento — che fa sembrare un prodotto curato.
 *
 * Sul badge della percentuale: sta a cavallo del bordo della foto con
 * `position:absolute`, che il motore di Word non sa posizionare. Invece di
 * lasciarlo cadere in mezzo alla card, lo diamo in due versioni — quella a
 * cavallo per tutti gli altri, e una pastiglia dentro la riga della pill per
 * Outlook. Nessuno dei due client vede quella dell'altro.
 *
 * @param {object} o
 * @param {string} o.badge        "−30%" o "OFFERTA"
 * @param {string} o.restaurantName
 * @param {string} o.perk         il vantaggio in parole
 * @param {string} [o.meta]       cucina · indirizzo
 * @param {string} [o.countdown]  "3 giorni", già scritto
 * @param {number} [o.taken]      quanti sono stati presi
 * @param {number} [o.left]       quanti ne restano (null = senza tetto)
 * @param {string} o.href
 */
export function dropCard({
  badge, restaurantName, perk, meta, countdown, taken = null, left = null,
  photoUrl, cuisine, href, label = '\u{1F513} Prendilo adesso',
  footnote = 'Prendi il codice, ordina, mostralo alla cassa.',
}) {
  const CARD_W = WIDTH - 32
  const photo = photoUrl
    ? `<img src="${esc(croppedPhoto(photoUrl, { ...DROP_PHOTO, retina: false }).url)}" width="${CARD_W}" alt="${esc(restaurantName)}" style="display:block;width:100%;height:auto;border:0;outline:none;" />`
    : tintTile({ h: Math.round((CARD_W * 9) / 16), emoji: emojiFor(cuisine), size: 44 })

  const pill = countdown
    ? `● DROP LIVE · SCADE TRA ${String(countdown).toUpperCase()}`
    : '● DROP LIVE'

  // La barra dei posti. È una tabella dentro una tabella e non un
  // <progress>, che nessun client di posta disegna. Si mette solo se il
  // drop ha davvero un tetto: una barra su uno sconto senza limite
  // racconterebbe una scarsità che non esiste.
  const hasBar = Number.isFinite(left) && left !== null && Number.isFinite(taken)
  const total = hasBar ? Math.max(1, taken + left) : 0
  const pct = hasBar ? Math.max(6, Math.min(100, Math.round((taken / total) * 100))) : 0
  const bar = hasBar ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0 0;"><tr>
            <td style="background-color:${COLORS.onCoralTrack};border-radius:999px;height:7px;line-height:7px;font-size:0;">
              <table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0" border="0" style="width:${pct}%;"><tr><td style="background-color:${COLORS.mint};border-radius:999px;height:7px;line-height:7px;font-size:0;">&nbsp;</td></tr></table>
            </td>
          </tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:7px 0 0;"><tr>
            <td align="left" style="font-family:${FONT_BODY};font-size:11px;line-height:1.3;color:${COLORS.onCoral};">${taken} ${taken === 1 ? 'preso' : 'presi'}</td>
            <td align="right" style="font-family:${FONT_BODY};font-size:11.5px;line-height:1.3;font-weight:800;color:${COLORS.white};">${left} ${left === 1 ? 'rimasto' : 'rimasti'}</td>
          </tr></table>` : ''

  const badgeStyle = `background-color:${COLORS.mint};background-image:linear-gradient(140deg,${COLORS.mint},${COLORS.mint2});color:${COLORS.ink};font-family:${FONT_BODY};font-size:17px;line-height:1.1;font-weight:800;letter-spacing:-.4px;border-radius:12px;padding:8px 14px;`
  const badgeFloat = badge
    ? `<!--[if !mso]><!--><div style="position:relative;font-size:0;line-height:0;"><div style="position:absolute;right:14px;bottom:-18px;${badgeStyle}border:3px solid ${COLORS.corallo};">${esc(badge)}</div></div><!--<![endif]-->`
    : ''
  const badgeMso = badge
    ? `<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="${badgeStyle}">${esc(badge)}</td></tr></table><![endif]-->`
    : ''

  return `<tr><td style="padding:16px 16px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.corallo};background-image:linear-gradient(168deg,${COLORS.corallo} 0%,${COLORS.coralloInk} 100%);border-radius:16px;overflow:hidden;">
      <tr><td style="padding:0;font-size:0;line-height:0;">${photo}${badgeFloat}</td></tr>
      <tr><td style="padding:14px 18px 18px;">
        ${badgeMso}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${COLORS.onCoralFill};border-radius:999px;padding:5px 12px;font-family:${FONT_BODY};font-size:10px;line-height:1.2;font-weight:700;letter-spacing:.09em;color:${COLORS.white};">${esc(pill)}</td></tr></table>
        <div style="margin:9px 0 0;font-family:${FONT_DISPLAY};font-size:25px;line-height:1.1;font-weight:800;letter-spacing:-.5px;color:${COLORS.white};">${esc(restaurantName)}</div>
        ${perk ? `<div style="margin:5px 0 0;font-family:${FONT_BODY};font-size:14px;line-height:1.35;font-weight:700;color:${COLORS.white};">${esc(perk)}</div>` : ''}
        ${meta ? `<div style="margin:2px 0 0;font-family:${FONT_BODY};font-size:11px;line-height:1.4;font-weight:500;color:${COLORS.onCoralSoft};">${esc(meta)}</div>` : ''}
        ${bar}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:15px 0 0;"><tr>
          <td align="center" bgcolor="${COLORS.ink}" style="background:${COLORS.ink};border-radius:999px;">
            <a href="${esc(href)}" style="display:block;padding:14px 20px;font-family:${FONT_BODY};font-size:15px;line-height:1.2;font-weight:800;color:${COLORS.white};text-decoration:none;border-radius:999px;">${esc(label)}</a>
          </td>
        </tr></table>
        ${footnote ? `<div style="margin:9px 0 0;text-align:center;font-family:${FONT_BODY};font-size:10.5px;line-height:1.5;color:${COLORS.onCoralSoft};">${esc(footnote)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>`
}

/**
 * Il blocco della convenzione: crema con il filetto d'oro a sinistra.
 *
 * Quello che qui **non** c'è è il punto di tutto il blocco: niente barra dei
 * posti, niente conto alla rovescia, niente "ne restano sei". Una
 * convenzione non scade e i posti non finiscono: metterceli sarebbe una
 * bugia, e una bugia che si smaschera da sola alla seconda email. Al loro
 * posto il chip mint, che dice la cosa opposta ed è comunque una buona
 * notizia — "questo te lo tieni".
 *
 * Il bottone sotto resta corallo come nel drop: il corallo è il colore
 * dell'azione, cambia il blocco dello sconto, non la chiamata.
 */
export function conventionOffer({ value, perk, conditions }) {
  return `<tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.cream};border-radius:12px;border-left:4px solid ${COLORS.oroDeep};">
      <tr><td style="padding:16px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${value ? `<td valign="middle" style="font-family:${FONT_DISPLAY};font-size:38px;line-height:1;font-weight:800;letter-spacing:-1.5px;color:${COLORS.ink};padding-right:12px;white-space:nowrap;">${esc(value)}</td>` : ''}
          <td valign="middle" style="font-family:${FONT_BODY};font-size:14px;line-height:1.35;font-weight:700;color:${COLORS.ink};">${esc(perk || '')}${conditions ? `<span style="display:block;font-size:11.5px;font-weight:500;color:${COLORS.ink70};margin-top:2px;">${esc(conditions)}</span>` : ''}</td>
        </tr></table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:13px 0 0;"><tr>
          <td style="background-color:${COLORS.mint};border-radius:999px;padding:5px 12px;font-family:${FONT_BODY};font-size:10.5px;line-height:1.2;font-weight:800;letter-spacing:.06em;color:${COLORS.ink};">✓ SEMPRE VALIDO · NESSUNA SCADENZA</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`
}

/** La riga piccola sotto un bottone: come funziona, in una riga sola. */
export function microNote(text, { padding = '9px 20px 0', align = 'center' } = {}) {
  if (!text) return ''
  return `<tr><td align="${align}" style="padding:${padding};font-family:${FONT_BODY};font-size:10.5px;line-height:1.5;color:${COLORS.footerClaim};text-align:${align};">${esc(text)}</td></tr>`
}

/** Il link di testo sotto la card: secondo per gerarchia, non secondo bottone. */
export function textLink(label, href, { padding = '13px 20px 0' } = {}) {
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:13px;line-height:1.4;font-weight:700;"><a href="${esc(href)}" style="color:${COLORS.corallo};text-decoration:none;">${esc(label)}</a></td></tr>`
}

/**
 * Il codice da mostrare al locale.
 *
 * Scritto, non disegnato: il QR come immagine su molti client resta
 * bloccato finché non lo si sblocca a mano, e chi è già al bancone non ha
 * voglia di cercare il pulsante "mostra immagini". Il QR vero sta nell'app,
 * il codice in chiaro funziona sempre.
 */
export function codeBlock({ code, note, label = 'Il tuo codice' }) {
  return `<tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cream};border:1px solid ${COLORS.line};border-radius:18px;">
      <tr><td align="center" style="padding:24px 20px 20px;">
        <div style="font-family:${FONT_BODY};font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLORS.oroDeep};padding-bottom:12px;">${esc(label)}</div>
        <div style="font-family:${FONT_MONO};font-size:27px;line-height:1.2;font-weight:700;letter-spacing:3px;color:${COLORS.ink};word-break:break-all;">${esc(code)}</div>
        ${note ? `<div style="font-family:${FONT_BODY};font-size:13px;line-height:1.55;color:${COLORS.ink70};padding-top:14px;">${esc(note)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>`
}

/** Riquadro verde: è andata bene. */
export function successBox({ title, lines = [] }) {
  return `<tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.mint};border-radius:18px;">
      <tr><td style="padding:24px 26px;">
        <div style="font-family:${FONT_DISPLAY};font-size:24px;line-height:1.2;font-weight:700;color:${COLORS.mintInk};">${esc(title)}</div>
        ${lines.map((l) => `<div style="font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${COLORS.mintInk};padding-top:8px;">${esc(l)}</div>`).join('')}
      </td></tr>
    </table>
  </td></tr>`
}

/** Una riga locale: foto quadrata a sinistra, nome e riga sotto a destra. */
export function restaurantRow({ name, meta, photoUrl, href }) {
  const thumb = croppedPhoto(photoUrl, { w: 72, h: 72 })
  const photo = thumb.url
    ? `<img src="${esc(thumb.url)}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;border-radius:12px;border:0;" />`
    : `<table role="presentation" width="72" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="width:72px;height:72px;background:${COLORS.creamDeep};border-radius:12px;font-size:28px;">&nbsp;</td></tr></table>`
  return `<tr><td style="padding:12px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.white};border:1px solid ${COLORS.line};border-radius:16px;">
      <tr>
        <td width="88" valign="middle" style="padding:12px 0 12px 12px;">${photo}</td>
        <td valign="middle" style="padding:12px 14px 12px 12px;">
          <a href="${esc(href)}" style="font-family:${FONT_BODY};font-size:16px;font-weight:700;line-height:1.25;color:${COLORS.ink};text-decoration:none;">${esc(name)}</a>
          ${meta ? `<div style="font-family:${FONT_BODY};font-size:13px;line-height:1.45;color:${COLORS.ink70};padding-top:3px;">${esc(meta)}</div>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>`
}

/** La firma di Bi, scritta a mano come sul sito. */
export function signature(text = '— Bi') {
  return `<tr><td style="padding:14px 20px 0;font-family:${FONT_BODY};font-size:14px;line-height:1.5;font-weight:700;color:${COLORS.oroDeep};">${esc(text)}</td></tr>`
}

/** Elenco puntato con la spunta corallo. */
export function checklist(items) {
  return `<tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${items.map((it) => `<tr>
        <td width="26" valign="top" style="padding:0 0 12px;font-family:${FONT_BODY};font-size:16px;font-weight:700;color:${COLORS.corallo};line-height:1.55;">&#10003;</td>
        <td valign="top" style="padding:0 0 12px;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${COLORS.ink70};">${esc(it)}</td>
      </tr>`).join('')}
    </table>
  </td></tr>`
}

/**
 * Le tre cose del Bi Club: una riga ciascuna, dentro un riquadro solo.
 *
 * Non è `checklist` con meno padding. La checklist descrive cose che hanno
 * bisogno di una frase ("prendere uno sconto e mostrarlo al locale: niente
 * da stampare, basta il telefono"); questa dice tre cose che stanno in una
 * riga e le tiene insieme in un blocco, invece di darne tre con gli spazi
 * in mezzo. Duecentodieci pixel diventano novanta e non si perde niente.
 */
export function checkRows(items) {
  return `<tr><td style="padding:20px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.cream};border-radius:12px;">
      <tr><td style="padding:13px 15px;font-family:${FONT_BODY};font-size:13px;line-height:2;color:${COLORS.body};">
        ${items.map((it) => `<span style="color:${COLORS.corallo};font-weight:800;">&#10003;</span> &nbsp;${esc(it)}`).join('<br />')}
      </td></tr>
    </table>
  </td></tr>`
}

/**
 * I passaggi numerati.
 *
 * Le spunte dicono "queste cose ci sono", i numeri dicono "queste cose si
 * fanno in quest'ordine": dove si spiega cosa succede al bancone servono i
 * secondi, e chi legge di fretta capisce dal numero che c'è un seguito.
 */
export function steps(items) {
  return `<tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${items.map((it, i) => `<tr>
        <td width="34" valign="top" style="padding:0 0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="24" height="24" align="center" style="width:24px;height:24px;background:${COLORS.creamDeep};border-radius:999px;font-family:${FONT_BODY};font-size:12px;font-weight:700;color:${COLORS.oroDeep};line-height:24px;">${i + 1}</td>
          </tr></table>
        </td>
        <td valign="top" style="padding:1px 0 14px;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${COLORS.ink70};">${esc(it)}</td>
      </tr>`).join('')}
    </table>
  </td></tr>`
}

/**
 * La riga di servizio in fondo al corpo: piccola, su crema, con il filo.
 * Ci va quello che serve sapere ma non merita un paragrafo — un recapito,
 * una scadenza, un "se non sei stato tu".
 */
export function note(html, { padding = '16px 20px 0' } = {}) {
  return `<tr><td style="padding:${padding};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cream};border-radius:14px;">
      <tr><td style="padding:16px 20px;font-family:${FONT_BODY};font-size:13.5px;line-height:1.6;color:${COLORS.ink70};">${html}</td></tr>
    </table>
  </td></tr>`
}

/**
 * La tabellina delle email interne: etichetta a sinistra, valore a destra.
 * Qui dentro la voce di Bi non serve — serve leggere in tre secondi cosa è
 * arrivato e da chi.
 */
export function dataTable(rows) {
  const visible = rows.filter(([, v]) => v != null && String(v).trim() !== '')
  if (!visible.length) return ''
  return `<tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cream};border:1px solid ${COLORS.line};border-radius:16px;">
      ${visible.map(([k, v], i) => `<tr>
        <td width="34%" valign="top" style="padding:${i === 0 ? '22px' : '14px'} 8px 4px 20px;font-family:${FONT_BODY};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.ink45};">${esc(k)}</td>
        <td valign="top" style="padding:${i === 0 ? '18px' : '10px'} 20px 4px 0;font-family:${FONT_BODY};font-size:15px;line-height:1.5;color:${COLORS.ink};">${esc(v)}</td>
      </tr>`).join('')}
      <tr><td colspan="2" style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
  </td></tr>`
}
