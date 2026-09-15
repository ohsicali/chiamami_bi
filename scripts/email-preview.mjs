/**
 * Costruisce l'anteprima di tutte le email, in un file solo.
 *
 *   node scripts/email-preview.mjs
 *
 * Perché serve: prima l'unico modo di vedere una email era pubblicare e
 * aspettare che arrivasse a qualcuno. Le nove email adesso si guardano una
 * accanto all'altra in `docs/email-preview/index.html` — che è anche l'unico
 * modo di accorgersi che due si presentano in modo diverso, cosa che guardate
 * una per volta a distanza di settimane non si nota.
 *
 * L'anteprima nel browser non sostituisce la prova vera: Gmail taglia il
 * blocco <style>, Outlook ignora i bordi arrotondati, e quelle cose si vedono
 * solo in posta. Per quello c'è il bottone "Provala" in /admin/settings, che
 * manda una copia all'admin.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  welcomeEmail, newDiscountEmail, newRestaurantEmail,
  discountClaimedEmail, discountUsedEmail, partnerWelcomeEmail,
  suggestionConfirmationEmail, partnerApplicationConfirmationEmail,
  recoveryOtpEmail, internalSuggestionEmail, internalPartnerApplicationEmail,
  SAMPLE,
} from '../api/_email/templates.js'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'email-preview')
const UNSUB = 'https://chiamamibi.com/preferenze-email?t=anteprima'

// La fascia della foto: un file locale con lo stesso rapporto del ritaglio
// che fa /api/img in produzione (600×250), così l'anteprima mostra lo spazio
// vero che la foto si prende e non uno inventato.
const FOTO = './foto-esempio.jpg'

const EMAIL = [
  ['Registrazione completata', 'benvenuto', welcomeEmail({ ...SAMPLE.welcome, unsubscribeUrl: UNSUB })],
  ['Drop nuovo', 'drop', newDiscountEmail({ ...SAMPLE.newDiscount, photoUrl: FOTO, unsubscribeUrl: UNSUB })],
  ['Sconto nuovo (non drop)', 'sconto', newDiscountEmail({ ...SAMPLE.newDiscount, photoUrl: FOTO, isDrop: false, countdown: null, unsubscribeUrl: UNSUB })],
  ['Locale nuovo in guida', 'locale', newRestaurantEmail({ ...SAMPLE.newRestaurant, photoUrl: FOTO, unsubscribeUrl: UNSUB })],
  ['Sconto preso — col codice', 'codice', discountClaimedEmail(SAMPLE.discountClaimed)],
  ['Sconto usato', 'usato', discountUsedEmail(SAMPLE.discountUsed)],
  ['Benvenuto ristoratore — col PIN', 'ristoratore', partnerWelcomeEmail(SAMPLE.partnerWelcome)],
  ['Conferma suggerimento', 'suggerimento', suggestionConfirmationEmail(SAMPLE.suggestionConfirmation)],
  ['Conferma candidatura partner', 'candidatura', partnerApplicationConfirmationEmail(SAMPLE.partnerApplicationConfirmation)],
  ['Codice di recupero', 'otp', recoveryOtpEmail(SAMPLE.recoveryOtp)],
  ['Interna — nuovo suggerimento', 'interna-suggerimento', internalSuggestionEmail(SAMPLE.internalSuggestion)],
  ['Interna — nuova candidatura', 'interna-candidatura', internalPartnerApplicationEmail(SAMPLE.internalPartnerApplication)],
]

/** La riga d'anteprima che i client mostrano in elenco, estratta dall'HTML. */
function preheaderOf(html) {
  const m = html.match(/mso-hide:all;">([\s\S]*?)(?:&#847;|<\/div>)/)
  return m ? m[1].trim() : ''
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

mkdirSync(OUT, { recursive: true })

// Il logo vive su chiamamibi.com: aprendo l'anteprima da file:// resterebbe
// un riquadro rotto e si giudicherebbe male una testata che in posta si vede
// benissimo. Le copie locali servono solo qui; l'HTML spedito punta al sito.
for (const nome of ['guida-bi-ink.png', 'guida-bi-white.png', 'guida-bi-coral.png']) {
  copyFileSync(join(OUT, '..', '..', 'public', 'email-assets', nome), join(OUT, nome))
}
const locale = (html) => html.replaceAll('https://chiamamibi.com/email-assets/', './')

for (const [, slug, mail] of EMAIL) {
  writeFileSync(join(OUT, `${slug}.html`), locale(mail.html))
  writeFileSync(join(OUT, `${slug}.txt`), `Oggetto: ${mail.subject}\n\n${mail.text}`)
}

const index = `<!doctype html>
<html lang="it"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Email ChiamamiBi — anteprima</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; background:#F3EDE4; font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#22181C; }
  header { padding:40px 20px 24px; max-width:1180px; margin:0 auto; }
  h1 { font-size:30px; letter-spacing:-0.6px; margin:0 0 8px; }
  header p { margin:0; color:#5C5359; font-size:15px; line-height:1.6; max-width:62ch; }
  .griglia { max-width:1180px; margin:0 auto; padding:16px 20px 64px; display:grid; gap:28px; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); }
  .scheda { background:#fff; border:1px solid #E6E1D8; border-radius:20px; overflow:hidden; }
  .inbox { padding:16px 18px; border-bottom:1px solid #E6E1D8; background:#F7F2E9; }
  .da { font-size:11px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:#B08954; }
  .oggetto { font-size:15px; font-weight:700; margin:6px 0 3px; line-height:1.35; }
  .pre { font-size:13px; color:#8A8388; line-height:1.45; }
  .conta { font-size:11px; color:#8A8388; margin-top:8px; }
  iframe { width:100%; height:760px; border:0; display:block; background:#F3EDE4; }
  .piede { padding:12px 18px; border-top:1px solid #E6E1D8; font-size:12.5px; }
  .piede a { color:#C53A33; text-decoration:none; margin-right:14px; }
  @media (max-width:620px) { iframe { height:560px; } }
</style>
</head><body>
<header>
  <h1>Le email di Bi</h1>
  <p>Tutte quelle che il sito manda, come arrivano davvero. In cima a ogni scheda c'è quello che si legge in elenco prima di aprire — mittente, oggetto, riga d'anteprima — perché è lì che si decide se un messaggio viene aperto o buttato.</p>
</header>
<div class="griglia">
${EMAIL.map(([nome, slug, mail]) => `  <div class="scheda">
    <div class="inbox">
      <div class="da">${esc(nome)}</div>
      <div class="oggetto">${esc(mail.subject)}</div>
      <div class="pre">${esc(preheaderOf(mail.html))}</div>
      <div class="conta">Oggetto: ${mail.subject.length} caratteri · HTML: ${(mail.html.length / 1024).toFixed(0)} KB · testo: ${mail.text.length} caratteri</div>
    </div>
    <iframe src="./${slug}.html" title="${esc(nome)}" loading="lazy"></iframe>
    <div class="piede"><a href="./${slug}.html" target="_blank">Apri intera</a><a href="./${slug}.txt" target="_blank">Versione testo</a></div>
  </div>`).join('\n')}
</div>
</body></html>
`

writeFileSync(join(OUT, 'index.html'), index)
console.log(`Scritte ${EMAIL.length} email in docs/email-preview/`)
for (const [nome, , mail] of EMAIL) {
  console.log(`  ${String(mail.subject.length).padStart(2)} car · ${nome}: ${mail.subject}`)
}
