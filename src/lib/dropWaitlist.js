/**
 * Il bottone di un drop, per chi lo guarda (12/10).
 *
 * Da quando i drop hanno i giorni contati (src/lib/dropClaim.js) un drop
 * esaurito non è più finito per sempre: chi l'ha preso ha 7 giorni per
 * usarlo, e se non lo usa il posto passa al primo della lista d'attesa. Chi
 * arriva a drop esaurito vede il "sold out" e, al posto del bottone spento
 * "Esaurito", «Mettiti in lista».
 *
 * Questa funzione decide cosa dice il bottone e la riga sotto, uguale in
 * home (telefono e computer) e nel Bi Club. Pura: chi la usa le passa il
 * riscatto della persona (se c'è) e lo stato della lista
 * (`drop_waitlist_status`, vedi hooks/useDropWaitlist.js). Sotto test in
 * tests/drop-claims.test.mjs.
 */

import { isSoldOut } from './discounts.js'
import { claimTimeLeft, claimWindowDays, formatClaimLeft, isClaimExpired } from './dropClaim.js'

/**
 * @param {object} o
 * @param {object} o.deal          la riga dello sconto
 * @param {object} [o.redemption]  il riscatto della persona per questo sconto
 * @param {object} [o.wait]        { waiting, my_position, my_status } da drop_waitlist_status
 * @returns {{ kind: 'claim'|'open'|'used'|'expired'|'soldout'|'waitlist'|'waiting',
 *             label?: string, disabled: boolean, tone?: string, note?: string, canLeave?: boolean }}
 */
export function dropCtaState({ deal, redemption = null, wait = null, now = new Date() } = {}) {
  const days = claimWindowDays(deal)
  const giorni = days ? `${days} ${days === 1 ? 'giorno' : 'giorni'}` : null
  const status = redemption?.status

  if (status === 'redeemed') return { kind: 'used', label: 'Già usato', disabled: true }
  if (redemption && isClaimExpired(redemption, now)) {
    return {
      kind: 'expired',
      label: 'Tempo scaduto',
      disabled: true,
      note: `Non l’hai usato entro ${giorni || 'i giorni previsti'}: il codice non vale più e il posto è passato a chi era in lista.`,
    }
  }
  if (status === 'generated') {
    const left = claimTimeLeft(redemption, deal, now)
    return {
      kind: 'open',
      label: 'Apri il QR',
      disabled: false,
      note: left && !left.expired ? `⏳ Ti restano ${formatClaimLeft(left.ms)} per usarlo.` : null,
    }
  }
  if (isSoldOut(deal)) {
    if (!days) return { kind: 'soldout', label: 'Esaurito', disabled: true }
    if (wait?.my_status === 'waiting') {
      return {
        kind: 'waiting',
        label: wait.my_position ? `In lista · sei il n° ${wait.my_position}` : 'Sei in lista',
        disabled: true,
        tone: 'waiting',
        note: `Se chi l’ha preso non lo usa entro ${giorni}, il posto passa a chi è in lista: quando tocca a te ti scrivo.`,
        canLeave: true,
      }
    }
    const n = Number(wait?.waiting) || 0
    return {
      kind: 'waitlist',
      label: '🔔 Mettiti in lista',
      disabled: false,
      tone: 'waitlist',
      note: `Chi l’ha preso ha ${giorni} per usarlo: se non lo usa, il posto passa al primo in lista.${n ? ` ${n === 1 ? 'C’è già 1 persona' : `Ci sono già ${n} persone`} in lista.` : ''}`,
    }
  }
  return {
    kind: 'claim',
    disabled: false,
    note: giorni ? `Da quando lo sblocchi hai ${giorni} per usarlo.` : null,
  }
}

/**
 * Cosa dire dopo «Mettiti in lista», dalla risposta di `drop_waitlist_join`.
 * `{ text, claim }`: con `claim` c'è un posto libero e conviene sbloccarlo.
 */
export function waitlistJoinMessage(result) {
  switch (result?.status) {
    case 'joined':
    case 'already':
      return {
        text: result.position
          ? `Sei in lista: sei il n° ${result.position}. Se si libera un posto è tuo, e ti scrivo.`
          : 'Sei in lista. Se si libera un posto è tuo, e ti scrivo.',
      }
    case 'claim_available':
      return { text: 'Si è appena liberato un posto: sbloccalo adesso!', claim: true }
    case 'already_claimed':
      return { text: 'Questo drop l’hai già preso: lo trovi in «I miei vantaggi».' }
    case 'not_authenticated':
      return { text: 'Entra nel tuo account per metterti in lista.' }
    case 'not_available':
      return { text: 'Questo drop è finito: niente più lista d’attesa.' }
    default:
      return { text: 'Non sono riuscito a metterti in lista. Riprova tra poco.' }
  }
}
