/**
 * Il guscio di ogni email: intestazione, colonna, piè di pagina.
 *
 * `renderEmail` mette insieme i blocchi di blocks.js e restituisce sia
 * l'HTML sia la versione a solo testo. La versione testo non è un di più:
 * i filtri antispam penalizzano i messaggi che hanno solo HTML, e chi legge
 * con la sintesi vocale o su un orologio vede quella.
 */

import { COLORS, FONT_BODY, FONT_DISPLAY, FONT_FILES, LOGO, SITE_URL, WIDTH } from './theme.js'
import { esc } from './blocks.js'

/**
 * Il testo grigetto che i client mostrano in elenco accanto all'oggetto.
 *
 * Senza, Gmail ci mette le prime parole del corpo — che nelle nostre email
 * è il logo, quindi in elenco si leggeva "CHIAMAMI BI CHIAMAMI BI". Il
 * riempimento di caratteri invisibili in coda serve a non far pescare anche
 * la riga successiva.
 */
function preheaderBlock(text) {
  if (!text) return ''
  const pad = '&#847;&zwnj;&nbsp;'.repeat(60)
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(text)}${pad}</div>`
}

function header({ tone = 'coral' } = {}) {
  const onCoral = tone === 'coral'
  const bg = onCoral ? COLORS.corallo : COLORS.cream
  const logo = onCoral ? LOGO.white : LOGO.ink
  return `<tr><td style="background:${bg};padding:26px 32px;" align="center">
    <a href="${SITE_URL}" style="text-decoration:none;">
      <img src="${logo}" width="168" alt="La Guida di Bi" style="display:block;width:168px;max-width:168px;height:auto;border:0;outline:none;" />
    </a>
  </td></tr>`
}

/**
 * Il piè di pagina con il link per non ricevere più questo tipo di email.
 *
 * `unsubscribeUrl` non è facoltativo per le email che annunciano qualcosa:
 * mandare promozioni senza una via d'uscita a un clic è fuori legge in UE,
 * e i client di posta lo trattano come segnale di spam. Per le email che
 * rispondono a un gesto della persona (hai preso lo sconto, l'hai usato) il
 * link non serve e non c'è.
 */
function footer({ unsubscribeUrl, unsubscribeLabel }) {
  return `<tr><td style="background:${COLORS.cream};padding:28px 32px 32px;" align="center">
    <img src="${LOGO.ink}" width="116" alt="ChiamamiBi" style="display:block;width:116px;max-width:116px;height:auto;border:0;outline:none;opacity:0.55;" />
    <div style="font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:${COLORS.ink45};padding-top:14px;">
      La guida ai posti dove tornerei, a Torino.
    </div>
    <div style="font-family:${FONT_BODY};font-size:13px;line-height:1.9;padding-top:12px;">
      <a href="${SITE_URL}" style="color:${COLORS.ink70};text-decoration:underline;">Il sito</a>
      &nbsp;·&nbsp;
      <a href="${SITE_URL}/sconti" style="color:${COLORS.ink70};text-decoration:underline;">Bi Club</a>
      &nbsp;·&nbsp;
      <a href="${SITE_URL}/privacy" style="color:${COLORS.ink70};text-decoration:underline;">Privacy</a>
    </div>
    ${unsubscribeUrl ? `<div style="font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${COLORS.ink45};padding-top:16px;">
      ${esc(unsubscribeLabel || 'Non vuoi più ricevere queste email?')}
      <a href="${esc(unsubscribeUrl)}" style="color:${COLORS.ink45};text-decoration:underline;">Scegli cosa ricevere</a>.
    </div>` : ''}
    <div style="font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:${COLORS.ink45};padding-top:14px;">
      © ${new Date().getFullYear()} ChiamamiBi
    </div>
  </td></tr>`
}

/**
 * @param {object}   o
 * @param {string}   o.preheader   riga di anteprima nell'elenco dei messaggi
 * @param {string[]} o.blocks      righe di tabella da blocks.js
 * @param {string}   [o.tone]      'coral' | 'cream' — colore dell'intestazione
 * @param {string}   [o.unsubscribeUrl]
 * @param {string}   [o.text]      versione a solo testo
 */
export function renderEmail({ preheader, blocks, tone = 'coral', unsubscribeUrl, unsubscribeLabel, text }) {
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no" />
<!-- Le email restano chiare anche dove il sistema è scuro: i client che
     invertono i colori da soli fanno danni sul corallo pieno. -->
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>ChiamamiBi</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  /* Gmail taglia questo blocco quando si inoltra un messaggio: qui dentro
     ci va solo quello che si può perdere senza danni — e Poppins lo è:
     dove non arriva resta il sans di sistema della pila. */
${FONT_FILES.map((w) => `  @font-face {
    font-family: 'Poppins';
    font-style: normal;
    font-weight: ${w};
    font-display: swap;
    src: url('${SITE_URL}/fonts/poppins-${w}.woff2') format('woff2');
  }`).join('\n')}
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  table { border-collapse:collapse !important; }
  img { -ms-interpolation-mode:bicubic; }
  a { color:${COLORS.coralloInk}; }
  @media only screen and (max-width:620px) {
    .cb-col { width:100% !important; }
    .cb-pad { padding-left:20px !important; padding-right:20px !important; }
    .cb-pad-sm { padding-left:14px !important; padding-right:14px !important; }
    .cb-h1 { font-size:26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
${preheaderBlock(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
  <tr><td align="center" style="padding:24px 12px 32px;">
    <table role="presentation" class="cb-col" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${WIDTH}px;max-width:${WIDTH}px;background:${COLORS.white};border-radius:22px;overflow:hidden;">
      ${header({ tone })}
      <tr><td style="padding:28px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${blocks.filter(Boolean).join('\n')}
      </table></td></tr>
      ${footer({ unsubscribeUrl, unsubscribeLabel })}
    </table>
  </td></tr>
</table>
</body>
</html>`

  return { html, text: text || stripToText(html) }
}

/** Ripiego quando non passiamo un testo scritto a mano. */
function stripToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|div|p|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#10003;/g, '-')
    .replace(/&#847;|&zwnj;/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export { FONT_BODY, FONT_DISPLAY }
