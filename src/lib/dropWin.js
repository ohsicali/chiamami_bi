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
 * `DropWinGate` non è montato) con `{ shown, action }`. Se la festa c'è
 * stata il QR NON si apre (deciso dal proprietario il 30/09: chi ha appena
 * preso il drop non è alla cassa, lo userà dopo da «I miei vantaggi»):
 * dalla festa si va al tutorial sugli sconti ("Scopri come usare lo
 * sconto", `action: 'tutorial'`) o si chiude (`action: 'close'`).
 */

export const DROP_WIN_EVENT = 'chiamamibi:drop-win'

/**
 * Il primo sconto sbloccato (30/09, deciso dal proprietario): a chi sblocca
 * il suo PRIMO sconto — drop o convenzione — parte "Come si usa lo sconto",
 * così tutti sanno come usarlo. A chi ne ha già sbloccati altri no.
 * `claimCount` = quanti riscatti ha l'utente contando quello appena fatto
 * (null se non si è riusciti a contarli: niente tutorial). `seen` = già
 * mostrato su questo browser (un riscatto cancellato non lo fa ripartire).
 */
export function isFirstClaim({ claimCount, seen = false } = {}) {
  return !seen && claimCount === 1
}

const firstClaimKey = (userId) => `chiamamibi:first-claim-tour:${userId}`

export function hasSeenFirstClaimTour(userId) {
  if (!userId) return true
  try { return localStorage.getItem(firstClaimKey(userId)) === '1' } catch { return false }
}

export function markFirstClaimTourSeen(userId) {
  if (!userId) return
  try { localStorage.setItem(firstClaimKey(userId), '1') } catch { /* niente */ }
}

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

/** Com'è finita quando la festa non c'è stata (non è un drop, nessun Gate). */
export const NO_WIN = Object.freeze({ shown: false, action: null })

/**
 * Da chiamare dopo uno sblocco NUOVO (non quando si riapre un riscatto che
 * c'era già), drop o convenzione: il Gate decide se c'è la festa (drop) e
 * se parte "Come si usa lo sconto" (primo sblocco). `deal` se chi chiama ce
 * l'ha: per una convenzione si evita di chiedere il posto al DB. Si
 * risolve quando festa e tutorial si sono chiusi, con `{ shown, action }`:
 * con `shown` (c'è stata la festa) il QR non si apre; senza, chi chiama
 * apre il QR come sempre (dopo il tutorial, se c'era).
 */
export function celebrateClaim({ redemptionId, deal } = {}) {
  if (typeof window === 'undefined' || !redemptionId) return Promise.resolve(NO_WIN)
  return new Promise((resolve) => {
    let taken = false
    const detail = {
      redemptionId,
      deal: deal || null,
      // Il Gate lo segna appena riceve l'evento: se nessuno ascolta
      // (pagina senza Gate) si va avanti subito, lo sblocco non resta appeso.
      take: () => { taken = true },
      // Il Gate chiama `done({ shown, action })`; senza argomenti = niente festa.
      done: (result) => resolve(result || NO_WIN),
    }
    window.dispatchEvent(new CustomEvent(DROP_WIN_EVENT, { detail }))
    if (!taken) resolve(NO_WIN)
  })
}
