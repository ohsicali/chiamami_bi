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

import { BRAND, CLAIM, COLORS, SITE_URL } from './theme.js'
import { renderEmail } from './render.js'
import {
  h1, h2, p, lede, eyebrow, metaLine, divider, button, offerCard, codeBlock,
  successBox, photoMosaic, dropCard, conventionOffer, microNote,
  textLink, signature, checklist, checkRows, steps, note, dataTable, spacer,
  esc, SIGN,
} from './blocks.js'
import { isBareDiscountValue } from './discount.js'
import { clipSentences, conventionValidity, metaFor, perkBeyondValue } from './content.js'

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || ''

/**
 * Il testo di Bi, tagliato su una frase intera.
 *
 * Il taglio secco a N caratteri è quello che produceva "…carne, verdu…" in
 * posta: la regola vera sta in content.js, qui c'è solo il nome corto.
 */
const clip = (s, n = 180) => clipSentences(s, n)

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

export function welcomeEmail({ name, unsubscribeUrl, attivi = null }) {
  const n = firstName(name)
  // Il numero nel bottone è l'esca: "Guarda i 6 sconti attivi" si tocca più
  // di "Guarda gli sconti attivi", ed è la stessa regola che il sito applica
  // già sul gate di registrazione. Quando il conteggio non arriva, la frase
  // regge lo stesso senza numeri inventati.
  const quanti = Number.isFinite(attivi) && attivi > 0 ? attivi : null
  const cta = quanti ? `Guarda i ${quanti} sconti attivi →` : 'Guarda gli sconti attivi →'
  return {
    subject: n ? `${n}, da adesso sei nel Bi Club` : 'Da adesso sei nel Bi Club',
    ...renderEmail({
      preheader: quanti
        ? `${quanti} sconti attivi ti aspettano nei locali che ho provato io.`
        : 'Gli sconti dei locali dove vado a mangiare io, a partire da stasera.',
      reason: MOTIVO.account,
      unsubscribeUrl,
      claim: CLAIM.club,
      blocks: [
        eyebrow('Il Bi Club', { padding: '24px 20px 0' }),
        h1(n ? `Ci sei, ${n}.` : 'Ci sei.', { size: 30 }),
        lede('Da adesso hai accesso a tutti gli sconti del Bi Club — quelli veri, nei locali che ho provato di persona.'),
        button(cta, `${SITE_URL}/sconti`, { padding: '18px 20px 0' }),
        // Tre cose, una riga ciascuna, dentro un riquadro solo. Prima erano
        // tre blocchi con gli spazi in mezzo: duecento pixel per dire quello
        // che qui sta in novanta.
        checkRows([
          'Prendi uno sconto e mostralo al locale',
          'Salva i posti e organizzali in liste tue',
          'Chiedimi un consiglio a parole, ti dico dove andare',
        ]),
        // Il manifesto resta: in questa email è il motivo per cui ti fidi
        // del Club. Ma è testo normale, non una citazione incorniciata.
        p(`I locali qui dentro li scelgo io e ci torno. Niente sponsorizzazioni, niente scambi di favori.${SIGN}`, { size: 13.5, padding: '18px 20px 0' }),
        spacer(22),
      ],
      text: [
        n ? `Ci sei, ${n}.` : 'Ci sei.',
        '',
        'Da adesso hai accesso a tutti gli sconti del Bi Club, nei locali che ho provato di persona.',
        '',
        `${cta.replace(' →', '')}: ${SITE_URL}/sconti`,
        '',
        '- Prendi uno sconto e mostralo al locale',
        '- Salva i posti e organizzali in liste tue',
        '- Chiedimi un consiglio a parole, ti dico dove andare',
        '',
        'I locali qui dentro li scelgo io e ci torno. Niente sponsorizzazioni, niente scambi di favori.',
        '',
        '— Bi',
      ].join('\n'),
    }),
  }
}

/* ================================================================== */
/*  2. Nuovo sconto pubblicato — drop oppure convenzione               */
/* ================================================================== */

/**
 * Due email, non una: il tipo di sconto sceglie il vestito.
 *
 * **Drop** (`isDrop`): card corallo piena con la foto dentro, il badge a
 * cavallo del bordo, la pillola "scade tra…" e la barra dei posti. Scade, i
 * posti finiscono, e il corallo pieno se lo guadagna perché c'è davvero
 * qualcosa da perdere.
 *
 * **Convenzione**: mosaico di foto, blocco crema con il filetto d'oro, la
 * percentuale grande e il chip mint che dice quando vale ("valido solo a
 * cena · fino al 30 novembre"). Niente barra, niente
 * conto alla rovescia, niente conteggio posti — non c'è un numero che
 * scende, e metterlo sarebbe una bugia che si smaschera da sola alla
 * seconda email. Da lì in poi l'urgenza non funziona più nemmeno sui drop
 * veri, che sono quelli per cui serve.
 *
 * Il bottone resta corallo in tutti e due: il corallo è il colore
 * dell'azione, cambia il blocco dello sconto, non la chiamata.
 *
 * @param {object}   o
 * @param {string}   o.value          il badge del valore ("−30%", "3x2")
 * @param {string}   o.restaurantName
 * @param {string}   [o.perk]         il vantaggio in parole
 * @param {string}   [o.conditions]   il vincolo, che non è il vantaggio
 * @param {string}   [o.review]       cosa dice Bi del locale: l'unica parte
 *                                    che una macchina non saprebbe scrivere
 * @param {boolean}  [o.isDrop]       scade, e questo cambia tutta l'email
 * @param {string}   [o.countdown]    "3 giorni", già a parole
 * @param {number}   [o.taken]        posti già presi (solo drop)
 * @param {number}   [o.left]         posti rimasti (solo drop, null = senza tetto)
 * @param {object}   [o.validity]     quando vale: { days, slots, timeFrom,
 *                                    timeTo, until } dalle colonne valid_*
 *                                    (vedi conventionValidity; nel drop
 *                                    solo la fascia, la scadenza è il countdown)
 * @param {string[]} [o.photos]       le foto del locale, in ordine
 * @param {number}   [o.photoCount]   quante ne esistono, per il "+N"
 */
export function newDiscountEmail({
  value, restaurantName, perk, conditions, city, cuisine, review,
  address, neighborhood, priceRange, photoUrl, photos, photoCount,
  href, scheda, isDrop, countdown, taken = null, left = null, validity, unsubscribeUrl,
}) {
  const phrase = offerPhrase(value)
  const plain = String(value || '').replace(/^[−-]\s*/, '').trim()
  const meta = metaFor({ cuisine, priceRange, address, neighborhood, city })
  const testo = clip(review)
  const lista = photos?.length ? photos : [photoUrl].filter(Boolean)
  const link = href || `${SITE_URL}/sconti`
  // Il valore è già la cosa più grande dell'email: la riga del vantaggio
  // resta solo se dice qualcosa in più. Sul database metà dei titoli sono
  // la percentuale e basta ("30% di sconto"), e ripeterla sotto il badge è
  // il difetto che l'handoff chiama "il drop dice lo sconto due volte".
  const vantaggio = perkBeyondValue(perk, plain)

  // Quando vale, detto per davvero: il chip "sempre valido" finiva sopra
  // condizioni come "solo il mercoledì e il giovedì" e si smentiva da solo.
  const quando = conventionValidity({ ...validity, conditions })

  /* ── Drop ─────────────────────────────────────────────────────── */
  if (isDrop) {
    // La fascia entra solo se limita qualcosa: un drop che vale solo a cena
    // lo deve dire (Shoro), uno che vale sempre non ha bisogno di una riga.
    // La scadenza no: quella è già nel countdown.
    const fascia = quando.limited ? quando.when : ''
    const posti = Number.isFinite(left) && left !== null ? `${left} posti` : 'posti limitati'
    return {
      subject: `Ho acceso un drop da ${restaurantName}`,
      ...renderEmail({
        preheader: `${phrase ? `${phrase}, ` : ''}${posti}. Quando finiscono, finiscono.`,
        reason: MOTIVO.sconti,
        unsubscribeUrl,
        city,
        blocks: [
          dropCard({
            badge: plain && isBareDiscountValue(plain) ? `−${plain}` : '',
            restaurantName,
            perk: vantaggio,
            meta: [meta, conditions, fascia].filter(Boolean).join(' · '),
            countdown,
            taken, left,
            photoUrl: lista[0] || null,
            cuisine,
            href: link,
          }),
          testo ? p(`${esc(testo)}${SIGN}`, { padding: '16px 20px 0' }) : '',
          scheda ? textLink(`Scopri ${restaurantName} →`, scheda) : '',
          spacer(20),
        ],
        text: [
          `Ho acceso un drop da ${restaurantName}.`,
          '',
          [phrase, vantaggio].filter(Boolean).join(' — '),
          meta,
          conditions || '',
          fascia ? `${fascia}.` : '',
          countdown ? `Scade tra ${countdown}.` : '',
          Number.isFinite(left) && left !== null ? `${left} rimasti su ${left + (taken || 0)}.` : '',
          '',
          'Prendi il codice, ordina, mostralo alla cassa.',
          `Prendilo qui: ${link}`,
          '',
          testo ? `${testo}\n\n— Bi` : '— Bi',
        ].filter((l) => l !== '').join('\n'),
      }),
    }
  }

  /* ── Convenzione ──────────────────────────────────────────────── */
  const soggetto = plain && isBareDiscountValue(plain)
    ? `Da oggi hai il ${plain} da ${restaurantName}`
    : (phrase ? `Da oggi da ${restaurantName}: ${phrase}` : `Uno sconto nuovo da ${restaurantName}`)

  const scadenza = quando.until || 'nessuna scadenza'

  return {
    subject: soggetto,
    ...renderEmail({
      preheader: `${quando.when}, ogni volta che ci vai. ${scadenza.charAt(0).toUpperCase()}${scadenza.slice(1)}.`,
      reason: MOTIVO.sconti,
      unsubscribeUrl,
      city,
      blocks: [
        photoMosaic({ photos: lista, total: photoCount || lista.length, alt: restaurantName, cuisine }),
        eyebrow('Nuova convenzione', { color: COLORS.oroDeep }),
        h1(restaurantName),
        metaLine(meta),
        conventionOffer({ value: plain, perk: vantaggio, conditions, validity: `${quando.when} · ${scadenza}` }),
        button('Aggiungilo ai tuoi sconti →', link, { padding: '18px 20px 0', block: true }),
        microNote('Resta nel tuo Bi Club. Lo mostri alla cassa ogni volta che ci vai.'),
        testo ? p(`${esc(testo)}${SIGN}`, { padding: '18px 20px 0' }) : '',
        spacer(22),
      ],
      text: [
        soggetto,
        meta,
        '',
        [plain, vantaggio].filter(Boolean).join(' — '),
        conditions || '',
        `${quando.when}, ${scadenza}.`,
        '',
        'Resta nel tuo Bi Club. Lo mostri alla cassa ogni volta che ci vai.',
        `Aggiungilo qui: ${link}`,
        '',
        testo ? `${testo}\n\n— Bi` : '— Bi',
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  3. Nuovo locale nella guida                                        */
/* ================================================================== */

export function newRestaurantEmail({
  restaurantName, tagline, review, city, cuisine, price, priceRange,
  address, neighborhood, photoUrl, photos, photoCount, href, unsubscribeUrl,
}) {
  // `price` arrivava già in simboli da qualche chiamante, `priceRange` è il
  // numero grezzo del database: si accettano tutti e due, e il numero passa
  // sempre da formatPrice — è il "Spagnolo · 2 · Torino" che si leggeva in
  // posta.
  const meta = metaFor({ cuisine, priceRange: priceRange ?? price, address, neighborhood, city })
  const testo = clip(review || tagline || '')
  const lista = photos?.length ? photos : [photoUrl].filter(Boolean)
  return {
    subject: `In guida da oggi: ${restaurantName}`,
    ...renderEmail({
      preheader: testo || `${restaurantName}${meta ? ` — ${meta}` : ''}`,
      reason: MOTIVO.locali,
      unsubscribeUrl,
      city,
      blocks: [
        photoMosaic({ photos: lista, total: photoCount || lista.length, alt: restaurantName, cuisine }),
        eyebrow('Nuovo in guida'),
        h1(restaurantName),
        metaLine(meta),
        testo ? p(`${esc(testo)}${SIGN}`) : '',
        button('Guarda la scheda →', href, { padding: '20px 20px 0' }),
        spacer(22),
      ],
      text: [
        `In guida da oggi: ${restaurantName}`,
        meta,
        '',
        testo,
        testo ? '— Bi' : '',
        '',
        `La scheda: ${href}`,
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
          note: 'Se la fotocamera del locale non legge il QR, detta questo codice: lo digitano loro. Lo trovi anche nel Bi Club, sotto il QR.',
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
        spacer(22),
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
        spacer(22),
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
        spacer(22),
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
        spacer(22),
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
        spacer(22),
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
        spacer(22),
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
        spacer(22),
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
        spacer(22),
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
  welcome: { name: 'Giulia Rossi', attivi: 6 },
  newDiscount: {
    value: '−50%', restaurantName: 'Bar Stampa', perk: '50% su tutto il conto',
    conditions: 'Valido solo sull’acquisto del tramezzino base',
    city: 'Torino', cuisine: 'Tramezzini', priceRange: 1,
    address: 'Via Antonio Giuseppe Bertola 2, 10122 Torino TO, Italy',
    review: 'Il tramezzino è quello classico torinese, alto e morbido, e qui lo fanno come si deve. Ci vado quando ho quindici minuti e voglio mangiare bene lo stesso, e non mi è mai capitato di pentirmene.',
    href: `${SITE_URL}/sconti`, scheda: `${SITE_URL}/restaurant/bar-stampa`,
    isDrop: true, countdown: '3 giorni', taken: 4, left: 6,
    validity: { days: [1, 2, 3, 4, 5], slots: ['pranzo'] },
  },
  newRestaurant: {
    restaurantName: 'Bomaki Murazzi', tagline: 'Sushi fusion sul Po',
    review: 'Sushi fusion fatto bene, sotto i Murazzi. La cosa da prendere è il tacos di tonno: lo fanno solo qui e ci torno apposta. Il resto del menù è buono ma non indimenticabile.',
    city: 'Torino', cuisine: 'Sushi', priceRange: 3,
    address: 'Murazzi del Po Arturo Olivieri 37, 10124 Torino TO, Italy',
    href: `${SITE_URL}/restaurant/bomaki-murazzi`,
  },
  discountClaimed: {
    value: '−50%', restaurantName: 'Bar Stampa', perk: '50% di sconto',
    conditions: 'Valido solo sull’acquisto del tramezzino base',
    address: 'Via Antonio Giuseppe Bertola 2',
    code: 'K48 213', expiryLabel: 'Scade il 14 settembre',
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
