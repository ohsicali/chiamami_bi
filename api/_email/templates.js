/**
 * Le email, una funzione ciascuna.
 *
 * Ognuna restituisce { subject, html, text }. Chi le manda (send-email.js,
 * notify-subscribers.js) non sa niente di HTML: prende questi tre campi e
 * li passa a Resend.
 *
 * Sul tono: Bi parla in prima persona e dà del tu, come sul sito. Gli
 * oggetti dicono la cosa concreta ("Hai 50% da Bar Stampa") e non la
 * categoria ("Notifica sconto"), perché in elenco si legge solo quello.
 */

import { COLORS, SITE_URL } from './theme.js'
import { renderEmail } from './render.js'
import {
  h1, h2, p, divider, button, discountCard, codeBlock,
  successBox, heroPhoto, signature, checklist, esc,
} from './blocks.js'

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || ''

/* ================================================================== */
/*  1. Registrazione completata                                        */
/* ================================================================== */

export function welcomeEmail({ name, unsubscribeUrl }) {
  const n = firstName(name)
  const hi = n ? `Ciao ${n},` : 'Ciao,'
  return {
    subject: n ? `${n}, benvenuta nel Bi Club` : 'Benvenuta nel Bi Club',
    ...renderEmail({
      preheader: 'Il tuo account è attivo: da adesso gli sconti dei locali che ho provato sono tuoi.',
      unsubscribeUrl,
      unsubscribeLabel: 'Vuoi ricevere meno email?',
      blocks: [
        h1('Ci sei.'),
        p(`${esc(hi)} da adesso hai accesso a tutti gli sconti del Bi Club — quelli veri, nei locali che ho provato di persona.`),
        h2('Cosa puoi fare'),
        checklist([
          'Prendere uno sconto e mostrarlo al locale: niente da stampare, basta il telefono.',
          'Salvare i posti che ti piacciono e organizzarli in liste tue.',
          'Chiedermi un consiglio a parole: ti dico dove andare stasera.',
        ]),
        button('Guarda gli sconti attivi', `${SITE_URL}/sconti`, { bg: COLORS.corallo }),
        divider(),
        p('Una cosa: i locali qui dentro li scelgo io e ci torno. Niente sponsorizzazioni, niente scambi di favori. Se un posto non mi è piaciuto, non lo trovi.', { size: 15 }),
        signature('— Bi'),
      ],
      text: [
        hi,
        '',
        'Ci sei: da adesso hai accesso a tutti gli sconti del Bi Club, nei locali che ho provato di persona.',
        '',
        'Cosa puoi fare:',
        '- Prendere uno sconto e mostrarlo al locale, direttamente dal telefono',
        '- Salvare i posti che ti piacciono e organizzarli in liste tue',
        '- Chiedermi un consiglio a parole',
        '',
        `Gli sconti attivi: ${SITE_URL}/sconti`,
        '',
        'I locali qui dentro li scelgo io e ci torno. Niente sponsorizzazioni.',
        '',
        '— Bi',
        unsubscribeUrl ? `\nPer ricevere meno email: ${unsubscribeUrl}` : '',
      ].join('\n'),
    }),
  }
}

/* ================================================================== */
/*  2. Nuovo sconto pubblicato                                         */
/* ================================================================== */

export function newDiscountEmail({ value, restaurantName, perk, conditions, city, cuisine, photoUrl, href, isDrop, countdown, unsubscribeUrl }) {
  const meta = [cuisine, city].filter(Boolean).join(' · ')
  return {
    subject: isDrop
      ? `Drop: ${value} da ${restaurantName}`
      : `Nuovo sconto: ${value} da ${restaurantName}`,
    ...renderEmail({
      preheader: perk
        ? `${perk}${conditions ? ` — ${conditions}` : ''}`
        : `${value} da ${restaurantName}${meta ? `, ${meta}` : ''}.`,
      unsubscribeUrl,
      unsubscribeLabel: 'Non vuoi gli avvisi sui nuovi sconti?',
      blocks: [
        heroPhoto(photoUrl, restaurantName),
        h1(isDrop ? 'Drop nuovo, e scade.' : 'Sconto nuovo nel Club.'),
        p(isDrop
          ? 'I drop hanno posti limitati e una scadenza: quando finiscono, finiscono.'
          : 'Uno in più tra quelli che puoi usare quando vuoi.'),
        discountCard({
          value,
          restaurantName,
          perk,
          meta: [conditions, meta].filter(Boolean).join(' · '),
          countdown: isDrop ? (countdown ? `Drop live · ${countdown}` : 'Drop live') : null,
        }),
        button(isDrop ? 'Prendilo adesso' : 'Prendi lo sconto', href, { bg: COLORS.ink }),
        signature('— Bi'),
      ],
      text: [
        isDrop ? 'Drop nuovo, e scade.' : 'Sconto nuovo nel Club.',
        '',
        `${value} da ${restaurantName}`,
        perk || '',
        [conditions, meta].filter(Boolean).join(' · '),
        '',
        `Prendilo qui: ${href}`,
        '',
        '— Bi',
        unsubscribeUrl ? `\nPer non ricevere più gli avvisi sui nuovi sconti: ${unsubscribeUrl}` : '',
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  3. Nuovo locale nella guida                                        */
/* ================================================================== */

export function newRestaurantEmail({ restaurantName, tagline, review, city, cuisine, price, photoUrl, href, unsubscribeUrl }) {
  const meta = [cuisine, price, city].filter(Boolean).join(' · ')
  const quote = (review || tagline || '').trim()
  const short = quote.length > 260 ? `${quote.slice(0, 260).trimEnd()}…` : quote
  return {
    subject: `Un posto nuovo: ${restaurantName}`,
    ...renderEmail({
      preheader: short || `${restaurantName}${meta ? ` — ${meta}` : ''}`,
      unsubscribeUrl,
      unsubscribeLabel: 'Non vuoi gli avvisi sui nuovi locali?',
      blocks: [
        heroPhoto(photoUrl, restaurantName),
        h1(restaurantName),
        p(meta ? `<span style="color:${COLORS.ink45};font-weight:600;">${esc(meta)}</span>` : '', { padding: '0 32px 14px' }),
        short ? h2('Secondo Bi') : '',
        short ? p(esc(short), { size: 16 }) : '',
        short ? signature('— Bi') : '',
        button('Guarda la scheda', href, { bg: COLORS.corallo }),
      ],
      text: [
        `Un posto nuovo: ${restaurantName}`,
        meta,
        '',
        short,
        '',
        `La scheda: ${href}`,
        '',
        '— Bi',
        unsubscribeUrl ? `\nPer non ricevere più gli avvisi sui nuovi locali: ${unsubscribeUrl}` : '',
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
    subject: `Il tuo sconto da ${restaurantName}`,
    ...renderEmail({
      preheader: `Codice ${code} — mostralo al locale. ${expiryLabel || ''}`.trim(),
      blocks: [
        h1('Sconto tuo.'),
        p(`Mostra questo codice al bancone di <strong style="color:${COLORS.ink};">${esc(restaurantName)}</strong> e lo scalano loro. Non devi stampare niente.`),
        discountCard({
          value,
          restaurantName,
          perk,
          meta: [conditions, address].filter(Boolean).join(' · '),
          countdown: expiryLabel,
        }),
        codeBlock({
          code,
          note: 'Trovi lo stesso codice nel Bi Club, con il QR da far scansionare.',
        }),
        button('Apri il QR nel Bi Club', href, { bg: COLORS.ink }),
        divider(),
        h2('Come funziona al locale'),
        checklist([
          'Ordina come fai di solito.',
          'Al momento di pagare apri il QR e fallo scansionare.',
          'Lo sconto lo applicano loro sul conto.',
        ]),
        p('Se al locale ti dicono che non sanno niente, scrivimi a <a href="mailto:info@chiamamibi.com" style="color:' + COLORS.coralloInk + ';">info@chiamamibi.com</a> e ci penso io.', { size: 14 }),
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
        'Come funziona: ordina come al solito, al momento di pagare fai scansionare il QR, lo sconto lo applicano loro.',
        '',
        'Problemi al locale? info@chiamamibi.com',
      ].filter((l) => l !== '').join('\n'),
    }),
  }
}

/* ================================================================== */
/*  5. Sconto usato — la conferma                                      */
/* ================================================================== */

export function discountUsedEmail({ value, restaurantName, whenLabel, href = `${SITE_URL}/sconti` }) {
  return {
    subject: `Usato: ${value} da ${restaurantName}`,
    ...renderEmail({
      tone: 'cream',
      preheader: `Lo sconto da ${restaurantName} è stato applicato. Spero sia stato buono.`,
      blocks: [
        successBox({
          title: 'Fatto.',
          lines: [
            `${value} da ${restaurantName}`,
            whenLabel ? `Usato ${whenLabel}` : '',
          ].filter(Boolean),
        }),
        p('Questo sconto è stato applicato e adesso è chiuso. Nel Bi Club ce ne sono altri pronti.'),
        button('Vedi gli altri sconti', href, { bg: COLORS.corallo }),
        divider(),
        p(`Com'è andata da ${esc(restaurantName)}? Rispondi a questa email e dimmelo: mi serve per decidere chi resta nella guida.`, { size: 15 }),
        signature('— Bi'),
      ],
      text: [
        'Fatto.',
        '',
        `${value} da ${restaurantName}`,
        whenLabel ? `Usato ${whenLabel}` : '',
        '',
        'Questo sconto è stato applicato ed è chiuso. Gli altri sono qui:',
        href,
        '',
        `Com'è andata? Rispondi a questa email e dimmelo.`,
        '',
        '— Bi',
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
}
