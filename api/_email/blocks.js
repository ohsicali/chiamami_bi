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

import { COLORS, FONT_BODY, FONT_DISPLAY, FONT_MONO, HERO, SITE_URL } from './theme.js'

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
export function eyebrow(text, { color = COLORS.corallo, padding = '0 32px 10px' } = {}) {
  if (!text) return ''
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:11px;line-height:1.3;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${color};">${esc(text)}</td></tr>`
}

export function h1(text, { color = COLORS.ink, align = 'left', padding = '0 32px 14px' } = {}) {
  return `<tr><td class="cb-h1" style="padding:${padding};font-family:${FONT_DISPLAY};font-size:31px;line-height:1.14;font-weight:700;letter-spacing:-0.6px;color:${color};text-align:${align};">${esc(text)}</td></tr>`
}

export function h2(text, { color = COLORS.ink } = {}) {
  return `<tr><td style="padding:24px 32px 10px;font-family:${FONT_BODY};font-size:12px;line-height:1.3;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${color};">${esc(text)}</td></tr>`
}

/** Il paragrafo d'apertura, un gradino più grande del corpo. */
export function lede(text, { padding = '0 32px 18px' } = {}) {
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:17.5px;line-height:1.62;color:${COLORS.ink70};">${esc(text)}</td></tr>`
}

export function p(html, { color = COLORS.ink70, size = 16, align = 'left', padding = '0 32px 16px' } = {}) {
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:${size}px;line-height:1.65;color:${color};text-align:${align};">${html}</td></tr>`
}

export function spacer(px = 20) {
  return `<tr><td style="font-size:0;line-height:0;height:${px}px;">&nbsp;</td></tr>`
}

/**
 * Il filo. Quello d'oro separa due discorsi diversi dentro la stessa email,
 * quello chiaro separa due paragrafi dello stesso discorso.
 */
export function divider({ padding = '10px 32px 18px', gold = false } = {}) {
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
export function button(label, href, { bg = COLORS.corallo, color = COLORS.white, align = 'left', padding = '6px 32px 20px' } = {}) {
  return `<tr><td style="padding:${padding};" align="${align}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${bg};border-radius:999px;" align="center">
        <a href="${esc(href)}" style="display:inline-block;padding:16px 32px;font-family:${FONT_BODY};font-size:15.5px;font-weight:700;letter-spacing:0.2px;color:${color};text-decoration:none;border-radius:999px;">${esc(label)}</a>
      </td>
    </tr></table>
  </td></tr>`
}

/** Bottone secondario, con il solo bordo. */
export function buttonGhost(label, href, { align = 'left' } = {}) {
  return `<tr><td style="padding:0 32px 22px;" align="${align}">
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
export function croppedPhoto(url, { w = HERO.w, h = HERO.h } = {}) {
  const raw = String(url || '')
  if (!raw || !raw.includes('supabase.co/storage/')) return { url: raw, cropped: false }
  const q = new URLSearchParams({ url: raw, w: String(w * 2), h: String(h * 2), fit: 'cover', fm: 'jpg' })
  return { url: `${SITE_URL}/api/img?${q.toString()}`, cropped: true }
}

/**
 * La fascia in cima al messaggio.
 *
 * A tutta larghezza e a rapporto fisso: è la prima cosa che si vede e deve
 * finire prima che si scorra. Con `alt` scritto bene chi tiene le immagini
 * spente legge comunque il nome del locale al posto del riquadro grigio.
 */
export function heroPhoto(url, alt = '', { h = HERO.h } = {}) {
  if (!url) return ''
  const photo = croppedPhoto(url, { w: HERO.w, h })
  // L'altezza in attributo la mettiamo solo quando il ritaglio è avvenuto
  // davvero: su una foto non ritagliata fisserebbe un rapporto che la foto
  // non ha, e Outlook — che `height:auto` non lo guarda — la schiaccerebbe.
  const attrs = photo.cropped ? `width="${HERO.w}" height="${h}"` : `width="${HERO.w}"`
  return `<tr><td style="padding:0;font-size:0;line-height:0;" align="center"><img src="${esc(photo.url)}" ${attrs} alt="${esc(alt)}" style="display:block;width:100%;max-width:${HERO.w}px;height:auto;border:0;outline:none;" /></td></tr>`
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
  return `<tr><td style="padding:2px 24px 22px;">
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
 * Il codice da mostrare al locale.
 *
 * Scritto, non disegnato: il QR come immagine su molti client resta
 * bloccato finché non lo si sblocca a mano, e chi è già al bancone non ha
 * voglia di cercare il pulsante "mostra immagini". Il QR vero sta nell'app,
 * il codice in chiaro funziona sempre.
 */
export function codeBlock({ code, note, label = 'Il tuo codice' }) {
  return `<tr><td style="padding:0 24px 20px;">
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
  return `<tr><td style="padding:4px 24px 22px;">
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
  return `<tr><td style="padding:0 24px 12px;">
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
  return `<tr><td style="padding:6px 32px 28px;font-family:${FONT_DISPLAY};font-size:19px;font-style:italic;color:${COLORS.ink45};">${esc(text)}</td></tr>`
}

/**
 * Il giudizio di Bi su un posto, rientrato e con il filo d'oro a lato.
 *
 * È la sola parte di un annuncio che una macchina non saprebbe scrivere, e
 * per questo si vede che è di qualcuno: la mettiamo in evidenza invece di
 * lasciarla in mezzo agli altri paragrafi.
 *
 * La firma sotto al riquadro di norma non ci va: l'email è già firmata in
 * fondo, e due "Bi" a trecento pixel di distanza si annullano a vicenda.
 */
export function quote(text, { author = null } = {}) {
  if (!text) return ''
  return `<tr><td style="padding:4px 32px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="3" style="width:3px;background:${COLORS.oro};font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:2px 0 2px 18px;font-family:${FONT_DISPLAY};font-size:17px;line-height:1.6;font-style:italic;color:${COLORS.ink};">
          ${esc(text)}
          ${author ? `<div style="font-family:${FONT_BODY};font-size:12px;font-style:normal;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${COLORS.oroDeep};padding-top:12px;">${esc(author)}</div>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>`
}

/** Elenco puntato con la spunta corallo. */
export function checklist(items) {
  return `<tr><td style="padding:0 32px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${items.map((it) => `<tr>
        <td width="26" valign="top" style="padding:0 0 12px;font-family:${FONT_BODY};font-size:16px;font-weight:700;color:${COLORS.corallo};line-height:1.55;">&#10003;</td>
        <td valign="top" style="padding:0 0 12px;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${COLORS.ink70};">${esc(it)}</td>
      </tr>`).join('')}
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
  return `<tr><td style="padding:0 32px 20px;">
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
export function note(html, { padding = '0 24px 24px' } = {}) {
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
  return `<tr><td style="padding:0 24px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cream};border:1px solid ${COLORS.line};border-radius:16px;">
      ${visible.map(([k, v], i) => `<tr>
        <td width="34%" valign="top" style="padding:${i === 0 ? '22px' : '14px'} 8px 4px 20px;font-family:${FONT_BODY};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.ink45};">${esc(k)}</td>
        <td valign="top" style="padding:${i === 0 ? '18px' : '10px'} 20px 4px 0;font-family:${FONT_BODY};font-size:15px;line-height:1.5;color:${COLORS.ink};">${esc(v)}</td>
      </tr>`).join('')}
      <tr><td colspan="2" style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
  </td></tr>`
}
