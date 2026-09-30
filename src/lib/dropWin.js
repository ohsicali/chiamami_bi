/**
 * "Ce l'hai fatta!" — il momento di chi riesce a prendere un drop (30/09).
 *
 * Richiesta del proprietario per il drop delle 19 (cannolo gratis, 20
 * posti): chi preme "Sblocca sconto" e ce la fa vede Bi che applaude e
 * "sei il numero 7 su 20". Solo per i drop, solo al primo sblocco (mai
 * quando si riapre il QR), e prima del QR, non sopra.
 *
 * Il posto in fila lo sa solo il DB (RPC `my_claim_rank`, SQL
 * `supabase/drop-claim-rank-2026-09-30.sql`): il browser non vede i
 * riscatti degli altri. Lo stesso SQL mette in fila i riscatti dello stesso
 * sconto, così due persone sull'ultimo posto non passano tutte e due.
 *
 * Chi sblocca chiama `celebrateClaim()` e aspetta: la promessa si risolve
 * quando l'animazione si chiude (o subito, se non è un drop o se
 * `DropWinGate` non è montato). Così il QR si apre DOPO la festa, e i punti
 * che sbloccano (Bi Club, scheda del locale) non devono sapere niente di
 * come è fatta.
 */

export const DROP_WIN_EVENT = 'chiamamibi:drop-win'

/** Sotto questo numero di posti i pallini si contano a colpo d'occhio. */
export const DOTS_MAX = 30

/**
 * Le parole della festa. `rank`/`total` possono mancare (RPC fallita,
 * drop senza tetto): la festa c'è lo stesso, senza il numero.
 */
export function dropWinCopy({ rank, total, restaurantName } = {}) {
  const r = Number(rank) > 0 ? Math.floor(Number(rank)) : null
  const t = Number(total) > 0 ? Math.floor(Number(total)) : null
  // Un riscatto fatto dall'admin passa senza controllo dei posti: il
  // numero non deve mai dire "21 su 20".
  const shownRank = r && t ? Math.min(r, t) : r
  const place = restaurantName ? ` di ${restaurantName}` : ''

  let title = 'Ce l\'hai fatta!'
  let line
  if (shownRank && t) {
    if (shownRank === 1) {
      title = 'Primo posto!'
      line = `Sei il numero 1 su ${t}: nessuno ha preso il drop${place} prima di te.`
    } else if (shownRank === t) {
      title = 'Preso al volo!'
      line = `Sei il numero ${t} su ${t}: l'ultimo posto del drop${place} è tuo.`
    } else {
      line = `Sei il numero ${shownRank} su ${t} ad aver preso il drop${place}.`
    }
  } else if (shownRank) {
    line = `Sei il numero ${shownRank} ad aver preso il drop${place}.`
  } else {
    line = `Il drop${place} è tuo.`
  }

  return {
    title,
    line,
    outro: 'Goditelo!',
    rank: shownRank,
    total: t,
    showDots: !!(shownRank && t && t <= DOTS_MAX),
  }
}

/**
 * Da chiamare dopo uno sblocco NUOVO (non quando si riapre un riscatto che
 * c'era già). `deal` se chi chiama ce l'ha: se non è un drop si evita la
 * chiamata al DB. Si risolve quando la festa si chiude.
 */
export function celebrateClaim({ redemptionId, deal } = {}) {
  if (typeof window === 'undefined' || !redemptionId) return Promise.resolve()
  if (deal && !deal.is_drop) return Promise.resolve()
  return new Promise((resolve) => {
    let taken = false
    const detail = {
      redemptionId,
      deal: deal || null,
      // Il Gate lo segna appena riceve l'evento: se nessuno ascolta
      // (pagina senza Gate) si va avanti subito, il QR non resta appeso.
      take: () => { taken = true },
      done: resolve,
    }
    window.dispatchEvent(new CustomEvent(DROP_WIN_EVENT, { detail }))
    if (!taken) resolve()
  })
}
