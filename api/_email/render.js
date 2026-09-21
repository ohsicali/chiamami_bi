/**
 * Il guscio di ogni email: testata, colonna, piè di pagina.
 *
 * `renderEmail` mette insieme i blocchi di blocks.js e restituisce sia
 * l'HTML sia la versione a solo testo. La versione testo non è un di più:
 * i filtri antispam penalizzano i messaggi che hanno solo HTML, e chi legge
 * con la sintesi vocale o su un orologio vede quella.
 *
 * La testata è la stessa per tutte le email — una sola, sempre quella. Prima
 * ce n'erano due (una fascia corallo piena per gli annunci, una crema per il
 * resto) e una terza scritta a mano dentro send-email.js: tre modi di
 * presentarsi a chi ci legge, che è uno dei motivi per cui il risultato
 * sembrava messo insieme di fretta.
 */

import { BRAND, CLAIM, COLORS, FONT_BODY, FONT_DISPLAY, FONT_FILES, SITE_URL, WIDTH } from './theme.js'
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
  const pad = '&#847;&zwnj;&nbsp;'.repeat(40)
  // Due blocchi e non uno: il primo porta il testo, il secondo il
  // riempimento di caratteri invisibili. Separati, perché un client che
  // decide di mostrare il primo per intero non si porta dietro anche
  // quaranta caratteri vuoti in coda all'anteprima.
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(text)}</div>
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${pad}</div>`
}

/**
 * La testata: una riga sola, 44px.
 *
 * Prima era una fascia da 90px con il logo grande al centro e "by Chiamami
 * Bi" sotto. Il logo in cima a un'email è spazio pagato per dire una cosa
 * che chi legge sa già — gliel'hai mandata tu, il mittente è scritto sopra
 * l'oggetto. Adesso: il nome a sinistra in corallo, la città a destra, e il
 * filo sotto. È l'unico divisore che resta in tutta l'email.
 *
 * Il logo PNG è sparito anche da qui, e non è una perdita: era un'immagine,
 * e chi tiene le foto spente (cioè la maggioranza, in Gmail) vedeva un
 * riquadro vuoto al posto della testata. Questo è testo, si vede sempre.
 */
export function emailHeader({ city = 'TORINO' } = {}) {
  return `<tr><td style="padding:14px 20px;border-bottom:1px solid ${COLORS.line};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" style="font-family:${FONT_BODY};font-size:12px;line-height:1.3;font-weight:800;letter-spacing:.09em;color:${COLORS.corallo};">LA GUIDA DI BI</td>
      <td align="right" style="font-family:${FONT_BODY};font-size:9.5px;line-height:1.3;font-weight:700;letter-spacing:.16em;color:${COLORS.mastheadCity};">${esc(String(city).toUpperCase())}</td>
    </tr></table>
  </td></tr>`
}

/**
 * Il piè di pagina: quattro righe, fuori dalla card bianca.
 *
 * Prima era alto quanto il contenuto — un secondo logo, il claim, quattro
 * link, un divisore, tre righe di spiegazione, indirizzo, email e
 * copyright: su iPhone quasi uno schermo pieno di roba che nessuno legge.
 * Adesso: i link, il claim, il motivo dell'invio con la via d'uscita, e la
 * riga di chi manda. Il secondo logo non c'è più; al suo posto c'è la
 * promessa ("ci sono stato, ho pagato il conto"), che è quello che il logo
 * avrebbe voluto dire.
 *
 * Restano per obbligo, non per gusto: chi manda con un indirizzo fisico,
 * perché il messaggio è arrivato proprio a te, e come farlo smettere in un
 * clic. Sono fra i primi segnali che Gmail guarda per decidere se un
 * messaggio è posta o pubblicità non richiesta.
 */
export function emailFooter({ unsubscribeUrl, unsubscribeLabel, reason, claim = CLAIM.utenti }) {
  const link = (href, label) => `<a href="${href}" style="color:${COLORS.oroDeep};text-decoration:none;font-weight:600;">${label}</a>`
  const fine = (href, label) => `<a href="${href}" style="color:${COLORS.footerFine};text-decoration:underline;">${label}</a>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${WIDTH}px;">
    <tr><td align="center" style="padding:18px 20px 6px;font-family:${FONT_BODY};font-size:12px;line-height:1.9;color:${COLORS.oroDeep};">
      ${link(SITE_URL, 'Il sito')} &nbsp;·&nbsp; ${link(`${SITE_URL}/sconti`, 'Bi Club')} &nbsp;·&nbsp; ${link(BRAND.instagram, 'Instagram')}
    </td></tr>
    <tr><td align="center" style="padding:0 24px 12px;font-family:${FONT_BODY};font-size:12px;line-height:1.6;font-style:italic;color:${COLORS.footerClaim};">${claim}</td></tr>
    <tr><td align="center" style="padding:0 24px 20px;font-family:${FONT_BODY};font-size:10.5px;line-height:1.75;color:${COLORS.footerFine};">
      ${esc(reason || `Ricevi questa email perché hai un account su ${BRAND.name}.`)}${unsubscribeUrl ? ` · ${fine(esc(unsubscribeUrl), esc(unsubscribeLabel || 'Scegli cosa ricevere'))}` : ''}<br />
      ${esc(BRAND.postal)} · ${fine(`mailto:${BRAND.contact}`, BRAND.contact)} · © ${new Date().getFullYear()}
    </td></tr>
  </table>`
}

/**
 * @param {object}   o
 * @param {string}   o.preheader   riga di anteprima nell'elenco dei messaggi
 * @param {string[]} o.blocks      righe di tabella da blocks.js
 * @param {string}   [o.reason]    perché questo messaggio è arrivato
 * @param {string}   [o.unsubscribeUrl]
 * @param {string}   [o.unsubscribeLabel]
 * @param {string}   [o.text]      versione a solo testo
 * @param {string}   [o.city]      la città in testata, a destra
 * @param {string}   [o.claim]     il claim in corsivo del piè di pagina
 */
export function renderEmail({ preheader, blocks, reason, unsubscribeUrl, unsubscribeLabel, text, city, claim }) {
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no" />
<!-- Le email restano chiare anche dove il sistema è scuro: i client che
     invertono i colori da soli fanno danni sui blocchi scuri. -->
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
    .cb-pad { padding-left:16px !important; padding-right:16px !important; }
    .cb-h1 { font-size:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
${preheaderBlock(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
  <tr><td align="center" style="padding:18px 12px 24px;">
    <table role="presentation" class="cb-col" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${WIDTH}px;max-width:${WIDTH}px;background:${COLORS.white};border-radius:16px;overflow:hidden;">
      ${emailHeader({ city })}
      ${blocks.filter(Boolean).join('\n')}
    </table>
    ${emailFooter({ unsubscribeUrl, unsubscribeLabel, reason, claim })}
  </td></tr>
</table>
</body>
</html>`

  return { html, text: text ? footerText(text, { reason, unsubscribeUrl }) : stripToText(html) }
}

/**
 * La stessa coda anche in fondo alla versione a solo testo.
 *
 * Chi legge in solo testo — e chi lo legge è spesso un filtro, non una
 * persona — deve trovarci le stesse cose dell'HTML: chi manda, perché, e
 * come smettere. Un HTML con il piè di pagina completo e un testo che finisce
 * con "— Bi" sono due messaggi diversi, e i due messaggi diversi sono
 * esattamente quello che un filtro va a cercare.
 */
function footerText(text, { reason, unsubscribeUrl }) {
  const coda = [
    '',
    '—',
    reason || `Ricevi questa email perché hai un account su ${BRAND.name}.`,
    unsubscribeUrl ? `Scegli cosa ricevere: ${unsubscribeUrl}` : '',
    BRAND.postal,
    `${SITE_URL} · ${BRAND.contact}`,
  ].filter((r) => r !== '')
  return `${text.trimEnd()}\n${coda.join('\n')}\n`
}

/**
 * Ripiego quando non passiamo un testo scritto a mano.
 *
 * Esportato perché serve anche a send.js: un messaggio senza versione a solo
 * testo è uno dei modi più rapidi per finire nella posta indesiderata, e la
 * rete di sicurezza va messa nell'unico punto da cui parte tutto, non
 * sperando che ogni template si ricordi di scriverla.
 */
export function htmlToText(html) {
  return stripToText(html)
}

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
