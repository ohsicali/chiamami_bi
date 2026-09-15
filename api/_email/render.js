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

import { BRAND, COLORS, FONT_BODY, FONT_DISPLAY, FONT_FILES, LOGO, SITE_URL, WIDTH } from './theme.js'
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

/**
 * La testata: marchio al centro, città sotto, filo.
 *
 * Il logo è un PNG e non del testo perché il carattere del marchio (Alfa
 * Slab One) in Gmail e Outlook non si carica, e al suo posto comparirebbe
 * un Times qualunque — cioè il marchio di qualcun altro.
 */
function masthead() {
  return `<tr><td style="background:${COLORS.white};padding:30px 32px 0;" align="center">
    <a href="${SITE_URL}" style="text-decoration:none;">
      <img src="${LOGO.ink}" width="150" alt="La Guida di Bi" style="display:block;width:150px;max-width:150px;height:auto;border:0;outline:none;" />
    </a>
    <div style="font-family:${FONT_BODY};font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${COLORS.oro};padding:12px 0 22px;">Torino</div>
  </td></tr>
  <tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:${COLORS.line};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`
}

/**
 * Il piè di pagina.
 *
 * Tre cose ci stanno per obbligo, non per gusto: chi manda (con un indirizzo
 * fisico), perché questo messaggio è arrivato proprio a te, e come farlo
 * smettere in un clic. Mancavano tutte e tre, e sono fra i primi segnali che
 * Gmail guarda per decidere se un messaggio è posta o pubblicità non
 * richiesta. `unsubscribeUrl` non è facoltativo per le email che annunciano
 * qualcosa: mandare promozioni senza una via d'uscita a un clic è fuori
 * legge in UE. Per le email che rispondono a un gesto della persona (hai
 * preso lo sconto, l'hai usato, ecco il tuo codice) il link non serve e non
 * c'è — ma il motivo dell'invio sì, sempre.
 */
function footer({ unsubscribeUrl, unsubscribeLabel, reason }) {
  const link = (href, label) => `<a href="${href}" style="color:${COLORS.ink70};text-decoration:none;border-bottom:1px solid ${COLORS.line};">${label}</a>`
  return `<tr><td style="background:${COLORS.cream};padding:30px 32px 34px;" align="center">
    <img src="${LOGO.ink}" width="104" alt="ChiamamiBi" style="display:block;width:104px;max-width:104px;height:auto;border:0;outline:none;" />
    <div style="font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:${COLORS.ink70};padding-top:14px;">
      ${esc(BRAND.tagline)}
    </div>
    <div style="font-family:${FONT_BODY};font-size:13px;line-height:2;padding-top:14px;">
      ${link(SITE_URL, 'Il sito')}
      &nbsp;&nbsp;·&nbsp;&nbsp;
      ${link(`${SITE_URL}/sconti`, 'Bi Club')}
      &nbsp;&nbsp;·&nbsp;&nbsp;
      ${link(BRAND.instagram, 'Instagram')}
      &nbsp;&nbsp;·&nbsp;&nbsp;
      ${link(`${SITE_URL}/privacy`, 'Privacy')}
    </div>
    <table role="presentation" width="200" cellpadding="0" cellspacing="0" border="0" style="width:200px;margin:22px auto 0;"><tr><td style="height:1px;background:${COLORS.line};font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <div style="font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${COLORS.ink45};padding-top:18px;">
      ${esc(reason || `Ricevi questa email perché hai un account su ${BRAND.name}.`)}
      ${unsubscribeUrl ? `<br />${esc(unsubscribeLabel || 'Non vuoi più ricevere queste email?')} <a href="${esc(unsubscribeUrl)}" style="color:${COLORS.ink70};text-decoration:underline;">Scegli cosa ricevere</a>.` : ''}
    </div>
    <div style="font-family:${FONT_BODY};font-size:11.5px;line-height:1.7;color:${COLORS.ink45};padding-top:14px;">
      ${esc(BRAND.postal)}<br />
      <a href="mailto:${BRAND.contact}" style="color:${COLORS.ink45};text-decoration:underline;">${BRAND.contact}</a>
      &nbsp;·&nbsp; © ${new Date().getFullYear()} ${esc(BRAND.name)}
    </div>
  </td></tr>`
}

/**
 * @param {object}   o
 * @param {string}   o.preheader   riga di anteprima nell'elenco dei messaggi
 * @param {string[]} o.blocks      righe di tabella da blocks.js
 * @param {string}   [o.reason]    perché questo messaggio è arrivato
 * @param {string}   [o.unsubscribeUrl]
 * @param {string}   [o.unsubscribeLabel]
 * @param {string}   [o.text]      versione a solo testo
 */
export function renderEmail({ preheader, blocks, reason, unsubscribeUrl, unsubscribeLabel, text }) {
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
    .cb-pad { padding-left:22px !important; padding-right:22px !important; }
    .cb-h1 { font-size:27px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
${preheaderBlock(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
  <tr><td align="center" style="padding:28px 12px 36px;">
    <table role="presentation" class="cb-col" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${WIDTH}px;max-width:${WIDTH}px;background:${COLORS.white};border-radius:24px;overflow:hidden;">
      ${masthead()}
      <tr><td style="padding:30px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${blocks.filter(Boolean).join('\n')}
      </table></td></tr>
      ${footer({ unsubscribeUrl, unsubscribeLabel, reason })}
    </table>
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
