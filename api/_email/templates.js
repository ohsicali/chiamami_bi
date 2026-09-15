/**
 * Le email, una funzione ciascuna.
 *
 * Ognuna restituisce { subject, html, text }. Chi le manda (send-email.js,
 * notify-subscribers.js, partner-application.js, recovery-otp.js) non sa
 * niente di HTML: prende questi tre campi e li passa a Resend. Prima metà
 * delle email aveva il proprio HTML scritto a mano dentro l'endpoint che le
 * spediva, con un'altra testata, un altro carattere e un altro piè di
 * pagina: chi le riceveva in fila non vedeva un mittente ma tre.
 *
 * Sul tono: Bi parla in prima persona e dà del tu, come sul sito. Gli
 * oggetti dicono la cosa concreta ("Pan y Pata: 30% in meno") e non la
 * categoria ("Notifica sconto"), perché in elenco si legge solo quello.
 *
 * Sugli oggetti, dopo la revisione di settembre: niente prefisso fisso
 * ("Drop:", "Nuovo sconto:"). Un prefisso uguale su ogni messaggio è la
 * firma delle email automatiche — la riconosce chi legge, che smette di
 * aprirle, e la riconosce il filtro, che smette di consegnarle. Il nome del
 * locale, invece, è la cosa che fa aprire.
 */

import { BRAND, COLORS, SITE_URL } from './theme.js'
import { renderEmail } from './render.js'
import {
  h1, h2, p, lede, eyebrow, divider, button, offerCard, codeBlock,
  successBox, heroPhoto, signature, checklist, steps, quote, note,
  dataTable, esc,
} from './blocks.js'
import { isBareDiscountValue } from './discount.js'

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || ''

/** Il testo tagliato a una lunghezza che non manda a capo tre volte. */
const clip = (s, n) => {
  const t = String(s || '').trim()
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t
}

/**
 * Il vantaggio detto in due parole, per l'oggetto.
 *
 * "30%" da solo in un oggetto non vuol dire niente ("30% di cosa?"), e
 * "−30%" nemmeno: il segno meno davanti è roba da etichetta sulla vetrina,
 * in elenco sembra un errore di battitura. Ma "3x2" o "Paghi 2 prendi 3
 * Veneziane" sono già frasi complete, e attaccarci "in meno" le rompe:
 * per questo si guarda se il valore è un numero secco o un titolo.
 */
function offerPhrase(value) {
  const plain = String(value || '').replace(/^[−-]\s*/, '').trim()
  if (!plain) return ''
  return isBareDiscountValue(plain) ? `${plain} in meno` : plain
}

/** Le tre righe che valgono per ogni annuncio, in fondo. */
const MOTIVO = {
  account: `Ricevi questa email perché hai un account su ${BRAND.name}.`,
  sconti: `Ricevi questa email perché hai un account su ${BRAND.name} e gli avvisi sui nuovi sconti sono accesi.`,
  locali: `Ricevi questa email perché hai un account su ${BRAND.name} e gli avvisi sui nuovi locali sono accesi.`,
  ricevuta: `Ricevi questa email perché hai preso questo sconto dal tuo account ${BRAND.name}.`,
  partner: `Ricevi questa email perché il tuo locale è nella Guida di Bi.`,
  sicurezza: `Ricevi questa email perché è stata chiesta una modifica al tuo account ${BRAND.name}.`,
  interna: 'Notifica automatica del sito, non serve rispondere.',
  candidatura: `Ricevi questa email perché hai candidato il tuo locale su ${BRAND.name}.`,
}

/* ================================================================== */
/*  1. Registrazione completata                                        */
/* ================================================================== */

export function welcomeEmail({ name, unsubscribeUrl }) {
  const n = firstName(name)
  const hi = n ? `Ciao ${n},` : 'Ciao,'
  return {
    subject: n ? `${n}, da adesso sei nel Bi Club` : 'Da adesso sei nel Bi Club',
    ...renderEmail({
      preheader: 'Gli sconti dei locali dove vado a mangiare io, a partire da stasera.',
      reason: MOTIVO.account,
      unsubscribeUrl,
      unsubscribeLabel: 'Vuoi ricevere meno email?',
      blocks: [
        eyebrow('Il Bi Club'),
        h1('Ci sei.'),
        lede(`${hi} da adesso hai accesso a tutti gli sconti del Bi Club — quelli veri, nei locali che ho provato di persona.`),
        button('Guarda gli sconti attivi', `${SITE_URL}/sconti`, { bg: COLORS.corallo }),
        divider({ gold: true }),
        h2('Cosa puoi fare'),
        checklist([
          'Prendere uno sconto e mostrarlo al locale: niente da stampare, basta il telefono.',
          'Salvare i posti che ti piacciono e organizzarli in liste tue.',
          'Chiedermi un consiglio a parole: ti dico dove andare stasera.',
        ]),
        divider(),
        quote('I locali qui dentro li scelgo io e ci torno. Niente sponsorizzazioni, niente scambi di favori: se un posto non mi è piaciuto, non lo trovi.'),
        note(`Se ti serve qualcosa, rispondi a questa email: dall'altra parte ci sono io. <a href="mailto:${BRAND.contact}" style="color:${COLORS.coralloInk};">${BRAND.contact}</a>`),
        signature('— Bi'),
      ],
      text: [
        hi,
        '',
        'Ci sei: da adesso hai accesso a tutti gli sconti del Bi Club, nei locali che ho provato di persona.',
        '',
        `Gli sconti attivi: ${SITE_URL}/sconti`,
        '',
        'COSA PUOI FARE',
        '- Prendere uno sconto e mostrarlo al locale, direttamente dal telefono',
        '- Salvare i posti che ti piacciono e organizzarli in liste tue',
        '- Chiedermi un consiglio a parole',
        '',
        'I locali qui dentro li scelgo io e ci torno. Niente sponsorizzazioni, niente scambi di favori: se un posto non mi è piaciuto, non lo trovi.',
        '',
        `Se ti serve qualcosa, rispondi a questa email: dall'altra parte ci sono io.`,
        '',
        '— Bi',
      ].join('\n'),
    }),
  }
}

/* ================================================================== */
/*  2. Nuovo sconto pubblicato                                         */
/* ================================================================== */

/**
 * @param {object} o
 * @param {string} o.value          il badge del valore ("−30%", "3x2")
 * @param {string} o.restaurantName
 * @param {string} [o.perk]         il vantaggio in parole
 * @param {string} [o.conditions]   il vincolo, che non è il vantaggio
 * @param {string} [o.review]       cosa dice Bi del locale: è l'unica parte
 *                                  che una macchina non saprebbe scrivere
 * @param {boolean} [o.isDrop]      scade, e questo cambia tutto il messaggio
 */
export function newDiscountEmail({
  value, restaurantName, perk, conditions, city, cuisine, review,
  photoUrl, href, isDrop, countdown, unsubscribeUrl,
}) {
  const meta = [cuisine, city].filter(Boolean).join(' · ')
  const phrase = offerPhrase(value)
  const luogo = city || 'Torino'

  return {
    // Senza valore leggibile (capita con un omaggio salvato senza titolo)
    // l'oggetto composto verrebbe "Locale: , finché dura": meglio una frase
    // che regge da sola, il nome del locale c'è comunque.
    subject: phrase
      ? (isDrop
        ? `${restaurantName}: ${phrase}, finché dura`
        : `${restaurantName}: ${phrase}, da oggi nel Club`)
      : (isDrop
        ? `Un drop da ${restaurantName}, e scade presto`
        : `Uno sconto nuovo da ${restaurantName}`),
    ...renderEmail({
      preheader: isDrop
        ? `${countdown ? `Restano ${countdown}. ` : 'Posti limitati. '}${perk || phrase}${conditions ? ` — ${conditions}` : ''}`
        : `${perk || phrase}${conditions ? ` — ${conditions}` : ''}. Vale quando vuoi, senza fretta.`,
      reason: MOTIVO.sconti,
      unsubscribeUrl,
      unsubscribeLabel: 'Puoi spegnerli quando vuoi:',
      blocks: [
        heroPhoto(photoUrl, restaurantName),
        eyebrow(isDrop ? `Drop · ${luogo}` : `Nuovo sconto · ${luogo}`),
        h1(isDrop
          ? `Ho acceso un drop da ${restaurantName}.`
          : `Da ${restaurantName} si sconta.`),
        lede(isDrop
          ? 'I drop hanno posti limitati e una scadenza: quando finiscono, finiscono.'
          : 'Uno sconto in più fra quelli che puoi usare quando vuoi, senza scadenza addosso.'),
        offerCard({
          value,
          restaurantName: `da ${restaurantName}`,
          perk,
          meta: [conditions, meta].filter(Boolean).join(' · '),
          countdown: isDrop ? (countdown ? `Drop live · restano ${countdown}` : 'Drop live') : null,
        }),
        button(isDrop ? 'Prendilo adesso' : 'Prendi lo sconto', href, { bg: COLORS.corallo }),
        review ? divider({ gold: true }) : '',
        review ? h2('Perché ci mando te') : '',
        review ? quote(clip(review, 240)) : '',
        divider(),
        h2('Come funziona'),
        steps([
          'Apri il Bi Club e prendi lo sconto: diventa un codice tuo.',
          'Vai al locale e ordina come fai di solito.',
          'Al momento di pagare mostri il codice, lo scalano loro.',
        ]),
        signature('— Bi'),
      ],
      text: [
        isDrop ? `Ho acceso un drop da ${restaurantName}.` : `Da ${restaurantName} si sconta.`,
        '',
        isDrop
          ? 'I drop hanno posti limitati e una scadenza: quando finiscono, finiscono.'
          : 'Uno sconto in più fra quelli che puoi usare quando vuoi.',
        '',
        `${value} da ${restaurantName}`,
        perk || '',
        [conditions, meta].filter(Boolean).join(' · '),
        isDrop && countdown ? `Restano ${countdown}.` : '',
        '',
        `Prendilo qui: ${href}`,
        '',
        review ? `PERCHÉ CI MANDO TE\n${clip(review, 240)}` : '',
        '',
        'COME FUNZIONA',
        '1. Apri il Bi Club e prendi lo sconto: diventa un codice tuo.',
        '2. Vai al locale e ordina come fai di solito.',
        '3. Al momento di pagare mostri il codice, lo scalano loro.',
        '',
        '— Bi',
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  3. Nuovo locale nella guida                                        */
/* ================================================================== */

export function newRestaurantEmail({ restaurantName, tagline, review, city, cuisine, price, photoUrl, href, unsubscribeUrl }) {
  const meta = [cuisine, price, city].filter(Boolean).join(' · ')
  const short = clip(review || tagline || '', 260)
  return {
    subject: `In guida da oggi: ${restaurantName}`,
    ...renderEmail({
      preheader: short || `${restaurantName}${meta ? ` — ${meta}` : ''}`,
      reason: MOTIVO.locali,
      unsubscribeUrl,
      unsubscribeLabel: 'Puoi spegnerli quando vuoi:',
      blocks: [
        heroPhoto(photoUrl, restaurantName),
        eyebrow(`Nuovo in guida · ${city || 'Torino'}`),
        h1(restaurantName),
        meta ? p(`<span style="color:${COLORS.oroDeep};font-weight:700;letter-spacing:0.4px;">${esc(meta)}</span>`, { padding: '0 32px 18px', size: 14 }) : '',
        short ? quote(short) : '',
        button('Guarda la scheda', href, { bg: COLORS.corallo }),
        divider(),
        p('Ci sono stato, ho pagato il conto come tutti e ci tornerei: è l\'unico motivo per cui un posto finisce qui dentro.', { size: 15 }),
        signature('— Bi'),
      ],
      text: [
        `In guida da oggi: ${restaurantName}`,
        meta,
        '',
        short,
        '',
        `La scheda: ${href}`,
        '',
        'Ci sono stato, ho pagato il conto come tutti e ci tornerei: è l\'unico motivo per cui un posto finisce qui dentro.',
        '',
        '— Bi',
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  4. Hai preso lo sconto — col codice                                */
/* ================================================================== */

/**
 * Questa risponde a un gesto della persona, quindi non porta il link di
 * disiscrizione: è una ricevuta, non un annuncio. Toglierla di mezzo
 * significherebbe lasciare qualcuno senza il proprio codice.
 */
export function discountClaimedEmail({ value, restaurantName, perk, conditions, address, code, expiryLabel, href }) {
  return {
    subject: `Il tuo codice per ${restaurantName}`,
    ...renderEmail({
      preheader: `${code} — mostralo al locale. ${expiryLabel || ''}`.trim(),
      reason: MOTIVO.ricevuta,
      blocks: [
        eyebrow('Il tuo sconto'),
        h1('Sconto tuo.'),
        lede(`Mostra il codice qui sotto al bancone di ${restaurantName} e lo scalano loro. Non devi stampare niente.`),
        offerCard({
          value,
          restaurantName: `da ${restaurantName}`,
          perk,
          meta: [conditions, address].filter(Boolean).join(' · '),
          countdown: expiryLabel,
        }),
        codeBlock({
          code,
          note: 'Trovi lo stesso codice nel Bi Club, con il QR da far scansionare.',
        }),
        button('Apri il QR nel Bi Club', href, { bg: COLORS.corallo }),
        divider({ gold: true }),
        h2('Come funziona al locale'),
        steps([
          'Ordina come fai di solito.',
          'Al momento di pagare apri il QR e fallo scansionare.',
          'Lo sconto lo applicano loro sul conto.',
        ]),
        note(`Se al locale ti dicono che non sanno niente, scrivimi a <a href="mailto:${BRAND.contact}" style="color:${COLORS.coralloInk};">${BRAND.contact}</a> e ci penso io.`),
      ],
      text: [
        'Sconto tuo.',
        '',
        `${value} da ${restaurantName}`,
        perk || '',
        [conditions, address].filter(Boolean).join(' · '),
        expiryLabel || '',
        '',
        `IL TUO CODICE: ${code}`,
        '',
        `Apri il QR nel Bi Club: ${href}`,
        '',
        'COME FUNZIONA AL LOCALE',
        '1. Ordina come fai di solito.',
        '2. Al momento di pagare apri il QR e fallo scansionare.',
        '3. Lo sconto lo applicano loro sul conto.',
        '',
        `Se al locale ti dicono che non sanno niente, scrivimi a ${BRAND.contact} e ci penso io.`,
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  5. Sconto usato — la conferma                                      */
/* ================================================================== */

export function discountUsedEmail({ value, restaurantName, whenLabel, href = `${SITE_URL}/sconti` }) {
  return {
    subject: `Sconto usato da ${restaurantName}`,
    ...renderEmail({
      preheader: `Lo sconto da ${restaurantName} è stato applicato. Spero sia stato buono.`,
      reason: MOTIVO.ricevuta,
      blocks: [
        eyebrow('Fatto'),
        successBox({
          title: 'Sconto applicato.',
          lines: [
            `${value} da ${restaurantName}`,
            whenLabel ? `Usato ${whenLabel}` : '',
          ].filter(Boolean),
        }),
        p('Questo sconto adesso è chiuso. Nel Bi Club ce ne sono altri pronti.'),
        button('Vedi gli altri sconti', href, { bg: COLORS.corallo }),
        divider({ gold: true }),
        p(`Com'è andata da ${esc(restaurantName)}? Rispondi a questa email e dimmelo: mi serve per decidere chi resta nella guida.`, { size: 15 }),
        signature('— Bi'),
      ],
      text: [
        'Sconto applicato.',
        '',
        `${value} da ${restaurantName}`,
        whenLabel ? `Usato ${whenLabel}` : '',
        '',
        'Questo sconto adesso è chiuso. Gli altri sono qui:',
        href,
        '',
        `Com'è andata? Rispondi a questa email e dimmelo: mi serve per decidere chi resta nella guida.`,
        '',
        '— Bi',
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  6. Benvenuto ristoratore, col PIN                                  */
/* ================================================================== */

/**
 * La più delicata delle sei: senza questa un locale non entra mai nella
 * propria area. Non ha link di disiscrizione perché non è un annuncio — è
 * la chiave di casa.
 */
export function partnerWelcomeEmail({ nomeLocale, pin, verifyUrl }) {
  return {
    subject: `${nomeLocale} è nella Guida di Bi: ecco il tuo PIN`,
    ...renderEmail({
      preheader: `Il PIN per entrare nell'Area Ristoratori e vedere chi passa da voi.`,
      reason: MOTIVO.partner,
      blocks: [
        eyebrow('Area Ristoratori'),
        h1('Ciao, sono Bi.'),
        lede(`Ho aggiunto ${nomeLocale} alla guida. Da adesso potete aggiornare la scheda, pubblicare uno sconto e vedere chi lo usa.`),
        codeBlock({
          code: pin,
          label: 'Il tuo PIN di accesso',
          note: 'Il PIN resta sempre lo stesso: salvatelo dove volete, non lo rimando.',
        }),
        button("Apri l'Area Ristoratori", verifyUrl, { bg: COLORS.corallo }),
        divider({ gold: true }),
        h2('Cosa ci trovate dentro'),
        checklist([
          'Chi ha salvato il locale e chi ha preso uno sconto.',
          'Il lettore per i QR: un cliente mostra il telefono, voi scansionate.',
          'La scheda da aggiornare quando cambia un orario o una foto.',
        ]),
        note(`Il dispositivo viene ricordato: il PIN lo reinserite solo se cambiate telefono. Se qualcosa non torna — una foto sbagliata, un orario che cambia — scrivete a <a href="mailto:${BRAND.contact}" style="color:${COLORS.coralloInk};">${BRAND.contact}</a>. Rispondo io.`),
        signature('— Bi'),
      ],
      text: [
        'Ciao, sono Bi.',
        '',
        `Ho aggiunto ${nomeLocale} alla guida. Da adesso potete aggiornare la scheda, pubblicare uno sconto e vedere chi lo usa.`,
        '',
        `IL TUO PIN DI ACCESSO: ${pin}`,
        '',
        `Entrate da qui: ${verifyUrl}`,
        'Il PIN resta sempre lo stesso: salvatelo dove volete, non lo rimando.',
        '',
        'COSA CI TROVATE DENTRO',
        '- Chi ha salvato il locale e chi ha preso uno sconto.',
        '- Il lettore per i QR: un cliente mostra il telefono, voi scansionate.',
        '- La scheda da aggiornare quando cambia un orario o una foto.',
        '',
        `Se qualcosa non torna, scrivete a ${BRAND.contact}. Rispondo io.`,
        '',
        '— Bi',
      ].join('\n'),
    }),
  }
}

/* ================================================================== */
/*  7. Ho ricevuto il tuo suggerimento                                 */
/* ================================================================== */

export function suggestionConfirmationEmail({ nomeUtente, nomeLocale }) {
  const n = firstName(nomeUtente)
  const hi = n ? `Ciao ${n},` : 'Ciao,'
  return {
    subject: `Ho preso nota di ${nomeLocale}`,
    ...renderEmail({
      preheader: 'Ci passo, e se merita finisce in guida.',
      reason: 'Ricevi questa email perché hai suggerito un locale su ChiamamiBi.',
      blocks: [
        eyebrow('Suggerimento ricevuto'),
        h1('Segnato.'),
        lede(`${hi} grazie per avermi suggerito ${nomeLocale}. Ci vado al più presto — se merita, finisce in guida.`),
        p('Le segnalazioni le leggo una per una, anche quelle che poi non passano il mio filtro. Se te ne viene in mente un altro, sai dove trovarmi.'),
        button('Torna alla guida', SITE_URL, { bg: COLORS.corallo }),
        signature('— Bi'),
      ],
      text: [
        hi,
        '',
        `Grazie per avermi suggerito ${nomeLocale}. Ci vado al più presto — se merita, finisce in guida.`,
        '',
        'Le segnalazioni le leggo una per una, anche quelle che poi non passano il mio filtro.',
        '',
        `La guida: ${SITE_URL}`,
        '',
        '— Bi',
      ].join('\n'),
    }),
  }
}

/* ================================================================== */
/*  8. Candidatura partner — conferma al candidato                     */
/* ================================================================== */

export function partnerApplicationConfirmationEmail({ nomeReferente, nomeAttivita }) {
  const n = firstName(nomeReferente)
  const hi = n ? `Ciao ${n},` : 'Ciao,'
  return {
    subject: `Ho ricevuto la candidatura di ${nomeAttivita}`,
    ...renderEmail({
      preheader: 'La guardo io, una per una. Se ci siamo, ti scrivo.',
      reason: MOTIVO.candidatura,
      blocks: [
        eyebrow('Candidatura ricevuta'),
        h1('Ci do un\'occhiata.'),
        lede(`${hi} ho ricevuto la candidatura di ${nomeAttivita}.`),
        p('Le guardo una per una e passo di persona prima di decidere: è il motivo per cui la guida vale qualcosa. Se ci siamo, ti scrivo io da questo indirizzo.'),
        divider({ gold: true }),
        p('Nel frattempo, se vuoi raccontarmi qualcosa in più del locale, rispondi pure a questa email.', { size: 15 }),
        signature('— Bi'),
      ],
      text: [
        hi,
        '',
        `Ho ricevuto la candidatura di ${nomeAttivita}.`,
        '',
        'Le guardo una per una e passo di persona prima di decidere. Se ci siamo, ti scrivo io da questo indirizzo.',
        '',
        'Se vuoi raccontarmi qualcosa in più del locale, rispondi pure a questa email.',
        '',
        '— Bi',
      ].join('\n'),
    }),
  }
}

/* ================================================================== */
/*  9. Codice di recupero (OTP)                                        */
/* ================================================================== */

/**
 * Il codice sta anche nell'oggetto: su telefono si legge dalla notifica
 * senza aprire niente, ed è la stessa cosa che fanno GitHub e Stripe.
 */
export function recoveryOtpEmail({ name, otp, actionText }) {
  const n = firstName(name)
  const hi = n ? `Ciao ${n},` : 'Ciao,'
  return {
    subject: `${otp} è il tuo codice ChiamamiBi`,
    ...renderEmail({
      preheader: `Scade fra dieci minuti. Se non l'hai chiesto tu, ignora questa email.`,
      reason: MOTIVO.sicurezza,
      blocks: [
        eyebrow('Codice di sicurezza'),
        h1('Il tuo codice.'),
        lede(`${hi} hai chiesto di ${actionText} del tuo account. Scrivi questo codice sul sito, nella schermata dove ti ho lasciato.`),
        codeBlock({ code: otp, label: 'Codice', note: 'Scade fra dieci minuti.' }),
        note('Se non sei stato tu, non fare niente: senza questo codice non cambia nulla. Se succede spesso, scrivimi.'),
        signature('— Bi'),
      ],
      text: [
        hi,
        '',
        `Hai chiesto di ${actionText} del tuo account.`,
        '',
        `IL TUO CODICE: ${otp}`,
        'Scade fra dieci minuti.',
        '',
        'Se non sei stato tu, non fare niente: senza questo codice non cambia nulla.',
        '',
        '— Bi',
      ].join('\n'),
    }),
  }
}

/* ================================================================== */
/*  10-11. Le due email interne                                        */
/* ================================================================== */

/**
 * Queste arrivano a info@chiamamibi.com, cioè ad Augusto. Niente voce di
 * Bi, niente racconto: si legge in tre secondi cosa è arrivato, da chi, e
 * si apre l'admin. L'oggetto comincia con [Bi] perché in una casella di
 * posta vera serve poterle filtrare tutte insieme.
 */
export function internalSuggestionEmail({ nomeLocale, address, tags, description, nomeUtente, emailUtente, urlAdmin }) {
  return {
    subject: `[Bi] Nuovo suggerimento: ${nomeLocale}`,
    ...renderEmail({
      preheader: `Da ${nomeUtente || emailUtente}${address ? ` — ${address}` : ''}`,
      reason: MOTIVO.interna,
      blocks: [
        eyebrow('Suggerimento dal sito'),
        h1(nomeLocale),
        dataTable([
          ['Indirizzo', address],
          ['Categorie', tags],
          ['Da', [nomeUtente, emailUtente].filter(Boolean).join(' · ')],
        ]),
        description ? h2('Nota di chi lo segnala') : '',
        description ? p(esc(description), { size: 15 }) : '',
        button('Apri in admin', urlAdmin, { bg: COLORS.ink }),
      ],
      text: [
        `Nuovo suggerimento: ${nomeLocale}`,
        '',
        address ? `Indirizzo: ${address}` : '',
        tags ? `Categorie: ${tags}` : '',
        `Da: ${[nomeUtente, emailUtente].filter(Boolean).join(' · ')}`,
        '',
        description ? `Nota:\n${description}` : '',
        '',
        `Apri in admin: ${urlAdmin}`,
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

export function internalPartnerApplicationEmail({
  restaurantName, contactName, email, phone, address, instagram, motivation, urlAdmin,
}) {
  return {
    subject: `[Bi] Nuova candidatura: ${restaurantName}`,
    ...renderEmail({
      preheader: `${contactName || email}${address ? ` — ${address}` : ''}`,
      reason: MOTIVO.interna,
      blocks: [
        eyebrow('Candidatura partner'),
        h1(restaurantName),
        dataTable([
          ['Referente', contactName],
          ['Email', email],
          ['Telefono', phone],
          ['Indirizzo', address],
          ['Instagram', instagram],
        ]),
        motivation ? h2('Perché vogliono entrare') : '',
        motivation ? p(esc(motivation), { size: 15 }) : '',
        button('Apri le candidature', urlAdmin, { bg: COLORS.ink }),
        note('Rispondendo a questa email scrivi direttamente al referente.'),
      ],
      text: [
        `Nuova candidatura: ${restaurantName}`,
        '',
        contactName ? `Referente: ${contactName}` : '',
        `Email: ${email}`,
        phone ? `Telefono: ${phone}` : '',
        address ? `Indirizzo: ${address}` : '',
        instagram ? `Instagram: ${instagram}` : '',
        '',
        motivation ? `Perché vogliono entrare:\n${motivation}` : '',
        '',
        `Apri le candidature: ${urlAdmin}`,
        'Rispondendo a questa email scrivi direttamente al referente.',
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  Anteprima per la prova                                             */
/* ================================================================== */

/** Dati finti coerenti, per l'anteprima e per il bottone "mandami una prova". */
export const SAMPLE = {
  welcome: { name: 'Giulia Rossi' },
  newDiscount: {
    value: '−50%', restaurantName: 'Bar Stampa', perk: '50% di sconto',
    conditions: 'Valido solo sull’acquisto del tramezzino base',
    city: 'Torino', cuisine: 'Tramezzini',
    review: 'Il tramezzino è quello classico torinese, alto e morbido, e qui lo fanno come si deve. Ci vado quando ho quindici minuti e voglio mangiare bene lo stesso.',
    href: `${SITE_URL}/sconti`, isDrop: true, countdown: '3g 2h',
  },
  newRestaurant: {
    restaurantName: 'Bomaki Murazzi', tagline: 'Sushi fusion sul Po',
    review: 'Sushi fusion fatto bene, sotto i Murazzi. La cosa da prendere è il tacos di tonno: lo fanno solo qui e ci torno apposta.',
    city: 'Torino', cuisine: 'Sushi', price: '€€€',
    href: `${SITE_URL}/restaurant/bomaki-murazzi`,
  },
  discountClaimed: {
    value: '−50%', restaurantName: 'Bar Stampa', perk: '50% di sconto',
    conditions: 'Valido solo sull’acquisto del tramezzino base',
    address: 'Via Antonio Giuseppe Bertola 2',
    code: 'BI-7QF4-2M8K', expiryLabel: 'Scade il 14 settembre',
    href: `${SITE_URL}/sconti`,
  },
  discountUsed: {
    value: '−50%', restaurantName: 'Bar Stampa',
    whenLabel: 'oggi alle 13:20', href: `${SITE_URL}/sconti`,
  },
  partnerWelcome: {
    nomeLocale: 'Bar Stampa', pin: '481902',
    verifyUrl: `${SITE_URL}/verify?pin=481902`,
  },
  suggestionConfirmation: { nomeUtente: 'Giulia Rossi', nomeLocale: 'Panificio Perino' },
  partnerApplicationConfirmation: { nomeReferente: 'Marco Bianchi', nomeAttivita: 'Pan y Pata' },
  recoveryOtp: { name: 'Giulia Rossi', otp: '481902', actionText: 'reimpostare la password' },
  internalSuggestion: {
    nomeLocale: 'Panificio Perino', address: 'Via Cavour 10, Torino',
    tags: 'Panetteria · Colazione', description: 'Le focacce escono alle 11, ancora calde.',
    nomeUtente: 'Giulia Rossi', emailUtente: 'giulia@example.com',
    urlAdmin: `${SITE_URL}/admin/suggestions`,
  },
  internalPartnerApplication: {
    restaurantName: 'Pan y Pata', contactName: 'Marco Bianchi',
    email: 'marco@example.com', phone: '+39 011 1234567',
    address: 'Via Po 22, Torino', instagram: '@panypata',
    motivation: 'Facciamo bocadillos con jamón iberico tagliato a mano.',
    urlAdmin: `${SITE_URL}/admin/applications`,
  },
}
