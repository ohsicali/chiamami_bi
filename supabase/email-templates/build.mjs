/**
 * Genera i template delle email che manda Supabase.
 *
 * Perché uno script e non un file scritto a mano: questa mail la manda
 * Supabase, non noi, quindi vive nel suo dashboard e non passa da
 * api/_email/. Ma deve somigliare alle altre cinque, e se un domani cambia
 * il logo o il corallo del sistema grafico un HTML incollato lì dentro
 * resterebbe indietro in silenzio. Rigenerandolo da render.js e blocks.js
 * la somiglianza è per costruzione.
 *
 *   node supabase/email-templates/build.mjs
 *
 * Ogni file prodotto si apre con un commento che dice dove incollarlo e con
 * che oggetto — la convenzione l'aveva già introdotta change-email.html.
 *
 * `{{ .Token }}` è il segnaposto che Supabase sostituisce con le sei cifre
 * al momento dell'invio: passa da esc() senza danni, perché le graffe non
 * sono fra i caratteri che vengono sostituiti.
 */
import { writeFileSync } from 'node:fs'
import { renderEmail } from '../../api/_email/render.js'
import { COLORS } from '../../api/_email/theme.js'
import { h1, p, lede, eyebrow, codeBlock, button, divider, note, signature } from '../../api/_email/blocks.js'

/** Il cartello di istruzioni in cima al file, invisibile una volta incollato. */
const intestazione = (nome, oggetto) => `<!--
  Template per Supabase: ${nome}
  Vai su: Supabase Dashboard → Authentication → Email Templates → ${nome}

  Subject: ${oggetto}

  Incolla tutto quello che segue nel campo "Body".
  Generato da supabase/email-templates/build.mjs — non modificare a mano,
  le modifiche andrebbero perse alla prossima rigenerazione.
-->
`

const TEMPLATES = []

function scrivi(file, nome, oggetto, segnaposto, contenuto) {
  const { html } = renderEmail(contenuto)
  if (!html.includes(segnaposto)) {
    throw new Error(`${file}: manca ${segnaposto}, la mail arriverebbe inutilizzabile.`)
  }
  TEMPLATES.push({ file, nome, oggetto, segnaposto, contenuto: intestazione(nome, oggetto) + html })
}

scrivi('conferma-registrazione.html', 'Confirm signup', 'Il tuo codice per entrare nel Bi Club', '{{ .Token }}', {
  preheader: 'Sei cifre e sei dentro: il codice scade fra un\'ora.',
  reason: 'Ricevi questa email perché qualcuno ha chiesto di registrarsi su ChiamamiBi con questo indirizzo.',
  blocks: [
    eyebrow('Conferma registrazione'),
    h1('Confermiamo che sei tu.'),
    lede('Scrivi questo codice sul sito, nella schermata dove ti ho lasciato.'),
    codeBlock({
      code: '{{ .Token }}',
      label: 'Il tuo codice',
      note: 'Scade fra un\'ora.',
    }),
    divider({ gold: true }),
    p('Appena confermi, gli sconti del Bi Club sono tuoi.', { size: 15 }),
    note('Se non hai richiesto niente, puoi ignorare questa email: senza il codice l\'account non si attiva.'),
    signature('— Bi'),
  ],
  text: [
    'Confermiamo che sei tu.',
    '',
    'Il tuo codice: {{ .Token }}',
    '',
    'Scrivilo sul sito, nella schermata dove ti ho lasciato. Scade fra un\'ora.',
    '',
    'Se non hai richiesto niente puoi ignorare questa email: senza il codice l\'account non si attiva.',
    '',
    '— Bi',
  ].join('\n'),
})

// Il cambio indirizzo resta col link e non col codice: cambiarlo vorrebbe
// dire gestire la verifica anche lato sito, che oggi non esiste. Qui si
// rifà solo la veste, che era rimasta a un'intestazione scritta a mano
// senza logo e in Arial.
scrivi('change-email.html', 'Change Email Address', 'Conferma il nuovo indirizzo email — ChiamamiBi', '{{ .ConfirmationURL }}', {
  preheader: 'Conferma il nuovo indirizzo per continuare a ricevere gli sconti.',
  reason: 'Ricevi questa email perché è stato chiesto di cambiare l\'indirizzo del tuo account ChiamamiBi.',
  blocks: [
    eyebrow('Cambio indirizzo'),
    h1('Il nuovo indirizzo sei tu?'),
    lede('Hai chiesto di cambiare l\'email del tuo account. Conferma qui sotto e da quel momento ti scrivo qui.'),
    button('Conferma il nuovo indirizzo', '{{ .ConfirmationURL }}', { bg: COLORS.corallo }),
    divider({ gold: true }),
    note('Se non sei stato tu, non fare niente: senza questa conferma l\'indirizzo resta quello di prima.'),
    signature('— Bi'),
  ],
  text: [
    'Cambio indirizzo.',
    '',
    'Hai chiesto di cambiare l\'email del tuo account. Conferma qui:',
    '{{ .ConfirmationURL }}',
    '',
    'Se non sei stato tu, non fare niente: senza questa conferma l\'indirizzo resta quello di prima.',
    '',
    '— Bi',
  ].join('\n'),
})

// Il link di reset lo manda Supabase stesso (resetPasswordForEmail, chiamato
// da "Password dimenticata?" in LoginPage.jsx): non passa da api/_email/, e
// senza rigenerarlo qui restava sul default di Supabase — niente logo,
// niente corallo, niente "— Bi".
scrivi('reset-password.html', 'Reset Password', 'Reimposta la password — ChiamamiBi', '{{ .ConfirmationURL }}', {
  preheader: 'Un link per scegliere una password nuova.',
  reason: 'Ricevi questa email perché è stato chiesto di reimpostare la password del tuo account ChiamamiBi.',
  blocks: [
    eyebrow('Reset password'),
    h1('Vuoi una password nuova?'),
    lede('Hai chiesto di reimpostare la password del tuo account. Clicca qui sotto e scegline una nuova.'),
    button('Reimposta la password', '{{ .ConfirmationURL }}', { bg: COLORS.corallo }),
    divider({ gold: true }),
    note('Se non sei stato tu, non fare niente: la password resta quella di prima.'),
    signature('— Bi'),
  ],
  text: [
    'Vuoi una password nuova?',
    '',
    'Hai chiesto di reimpostare la password del tuo account. Apri questo link e scegline una nuova:',
    '{{ .ConfirmationURL }}',
    '',
    'Se non sei stato tu, non fare niente: la password resta quella di prima.',
    '',
    '— Bi',
  ].join('\n'),
})

export { TEMPLATES }

/**
 * Scrive solo quando lo script è lanciato a mano. Importandolo — come fa la
 * prova — i template si ottengono senza toccare il disco.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const t of TEMPLATES) {
    writeFileSync(new URL(`./${t.file}`, import.meta.url), t.contenuto)
    console.log(`Scritto ${t.file} (${t.contenuto.length} caratteri)`)
  }
}
