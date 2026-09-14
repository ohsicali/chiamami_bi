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
 */

import { COLORS, FONT_BODY, FONT_DISPLAY, FONT_MONO } from './theme.js'

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

export function h1(text, { color = COLORS.ink, align = 'left' } = {}) {
  return `<tr><td style="padding:0 32px 12px;font-family:${FONT_DISPLAY};font-size:30px;line-height:1.18;font-weight:700;color:${color};text-align:${align};">${esc(text)}</td></tr>`
}

export function h2(text, { color = COLORS.ink } = {}) {
  return `<tr><td style="padding:22px 32px 8px;font-family:${FONT_BODY};font-size:13px;line-height:1.3;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${color};">${esc(text)}</td></tr>`
}

export function p(html, { color = COLORS.ink70, size = 16, align = 'left', padding = '0 32px 16px' } = {}) {
  return `<tr><td style="padding:${padding};font-family:${FONT_BODY};font-size:${size}px;line-height:1.6;color:${color};text-align:${align};">${html}</td></tr>`
}

export function spacer(px = 20) {
  return `<tr><td style="font-size:0;line-height:0;height:${px}px;">&nbsp;</td></tr>`
}

export function divider({ padding = '8px 32px' } = {}) {
  return `<tr><td style="padding:${padding};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:${COLORS.line};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`
}

/* ── Bottone ───────────────────────────────────────────────────────── */

/**
 * Il padding sta sulla cella: in Outlook `display:inline-block` su un <a>
 * viene ignorato e il bottone si affloscia sul testo.
 */
export function button(label, href, { bg = COLORS.ink, color = COLORS.white, align = 'left' } = {}) {
  return `<tr><td style="padding:6px 32px 22px;" align="${align}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${bg};border-radius:999px;" align="center">
        <a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONT_BODY};font-size:15px;font-weight:700;color:${color};text-decoration:none;border-radius:999px;">${esc(label)}</a>
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

/* ── La card dello sconto ──────────────────────────────────────────── */

/**
 * Il corallo pieno con il valore in grande: è lo stesso blocco che sul sito
 * apre la home, e chi apre l'email lo riconosce prima di leggere.
 */
// I colori qui dentro sono in esadecimale anche dove sarebbe comodo un
// rgba: Outlook ignora `rgba()` e al suo posto non mette niente, quindi la
// pillola della scadenza restava un testo bianco su corallo, illeggibile.
// #ED6E67 è bianco al 22% sul corallo, #FCE3E2 è bianco all'85%.
export function discountCard({ value, restaurantName, perk, meta, countdown }) {
  return `<tr><td style="padding:4px 24px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.corallo};border-radius:20px;">
      <tr><td style="padding:26px 26px 24px;">
        ${countdown ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td style="background:#ED6E67;border-radius:999px;padding:6px 13px;font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:1px;color:#FFFFFF;text-transform:uppercase;">${esc(countdown)}</td></tr></table>` : ''}
        <div style="font-family:${FONT_DISPLAY};font-size:44px;line-height:1;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">${esc(value)}</div>
        <div style="font-family:${FONT_DISPLAY};font-size:26px;line-height:1.15;font-weight:700;color:#FFFFFF;padding-top:4px;">da ${esc(restaurantName)}</div>
        ${perk ? `<div style="font-family:${FONT_BODY};font-size:15px;line-height:1.5;font-weight:600;color:#FFFFFF;padding-top:14px;">${esc(perk)}</div>` : ''}
        ${meta ? `<div style="font-family:${FONT_BODY};font-size:13px;line-height:1.5;color:#FCE3E2;padding-top:6px;">${esc(meta)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>`
}

/**
 * Il codice da mostrare al locale.
 *
 * Scritto, non disegnato: il QR come immagine su molti client resta
 * bloccato finché non lo si sblocca a mano, e chi è già al bancone non ha
 * voglia di cercare il pulsante "mostra immagini". Il QR vero sta in
 * allegato e nell'app, il codice in chiaro funziona sempre.
 */
export function codeBlock({ code, note }) {
  return `<tr><td style="padding:0 24px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cream};border:1.5px dashed ${COLORS.line};border-radius:16px;">
      <tr><td align="center" style="padding:22px 20px 18px;">
        <div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.ink45};padding-bottom:10px;">Il tuo codice</div>
        <div style="font-family:${FONT_MONO};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:2px;color:${COLORS.ink};word-break:break-all;">${esc(code)}</div>
        ${note ? `<div style="font-family:${FONT_BODY};font-size:13px;line-height:1.5;color:${COLORS.ink70};padding-top:12px;">${esc(note)}</div>` : ''}
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
  const photo = photoUrl
    ? `<img src="${esc(photoUrl)}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;border-radius:12px;object-fit:cover;border:0;" />`
    : `<table role="presentation" width="72" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="width:72px;height:72px;background:${COLORS.creamDeep};border-radius:12px;font-size:28px;">🍽️</td></tr></table>`
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

/** Foto larga in cima al contenuto. */
export function heroPhoto(url, alt = '') {
  if (!url) return ''
  return `<tr><td style="padding:0 0 4px;"><img src="${esc(url)}" width="600" alt="${esc(alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;" /></td></tr>`
}

/** La firma di Bi, scritta a mano come sul sito. */
export function signature(text = '— Bi') {
  return `<tr><td style="padding:4px 32px 26px;font-family:${FONT_DISPLAY};font-size:19px;font-style:italic;color:${COLORS.ink45};">${esc(text)}</td></tr>`
}

/** Elenco puntato con la spunta corallo. */
export function checklist(items) {
  return `<tr><td style="padding:0 32px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${items.map((it) => `<tr>
        <td width="26" valign="top" style="padding:0 0 10px;font-family:${FONT_BODY};font-size:16px;font-weight:700;color:${COLORS.corallo};line-height:1.55;">&#10003;</td>
        <td valign="top" style="padding:0 0 10px;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${COLORS.ink70};">${esc(it)}</td>
      </tr>`).join('')}
    </table>
  </td></tr>`
}
