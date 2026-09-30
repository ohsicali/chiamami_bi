/**
 * Sconti — unica fonte di verità sulla definizione di "sconto attivo".
 *
 * Nasce dal bug del Blocco 0 (handoff v10): l'admin segnava 6 sconti attivi,
 * il Bi Club pubblico ne mostrava 4 e la dashboard ne contava 0 di tipo drop.
 * Tre definizioni diverse in tre punti diversi del codice.
 *
 * Regola, valida ovunque:
 *   1. Ogni sconto attivo compare SEMPRE in Bi Club (`/sconti`).
 *   2. Ogni sconto attivo compare SEMPRE sulla scheda del suo locale.
 *   3. La home è l'unica vetrina con selezione.
 *   4. Il badge città è solo informazione, MAI un filtro.
 *
 * Se ti viene voglia di aggiungere un filtro città/zona qui dentro o a valle di
 * `filterActive`, rileggi il punto 4: è la regressione che questo modulo esiste
 * per impedire (vedi `tests/discounts.test.mjs`).
 */

/** Fine validità di uno sconto, qualunque campo la porti. */
export function discountEndsAt(d) {
  if (!d) return null
  const iso = (d.is_drop && d.drop_ends_at) || d.valid_until || d.drop_ends_at || null
  if (!iso) return null
  const t = new Date(iso)
  return isNaN(t.getTime()) ? null : t
}

/**
 * Quanti pezzi sono già stati presi.
 *
 * Il DB porta due colonne per la stessa cosa e nessuna delle due è affidabile
 * da sola: `claimed_count` è stata aggiunta con i drop ma nessuno la
 * incrementa (verificato: nessuna funzione/trigger la tocca, resta a 0),
 * mentre `total_redeemed` viene alzata dal riscatto QR. Prendiamo la maggiore
 * delle due: così un `claimed_count` fermo a 0 non nasconde i riscatti reali,
 * e se un giorno qualcuno inizia a scrivere `claimed_count` il conteggio
 * continua a funzionare senza toccare questo file.
 */
export function claimedCount(d) {
  const a = Number(d?.claimed_count) || 0
  const b = Number(d?.total_redeemed) || 0
  return Math.max(a, b)
}

/** Quanti pezzi totali (0/null = illimitato). */
export function maxQuantity(d) {
  return Number(d?.max_quantity) || Number(d?.max_redemptions) || 0
}

/** Pezzi ancora disponibili, o null se illimitato. */
export function remainingCount(d) {
  const max = maxQuantity(d)
  if (!max || max <= 0) return null
  return Math.max(0, max - claimedCount(d))
}

/** Esaurito: ha un tetto e i pezzi sono finiti. */
export function isSoldOut(d) {
  const left = remainingCount(d)
  return left !== null && left <= 0
}

/** Scaduto rispetto al timestamp di fine. */
export function isExpired(d, now = new Date()) {
  const end = discountEndsAt(d)
  return !!end && end.getTime() < now.getTime()
}

/**
 * LA definizione. Uno sconto è attivo se è marcato attivo, non è scaduto e
 * non è esaurito. Nient'altro — nessuna città, nessuna zona, nessun
 * `drop_time` (campo legacy, oggi null su tutte le righe).
 */
export function isActiveDiscount(d, now = new Date()) {
  if (!d) return false
  if (d.is_active === false) return false
  if (isExpired(d, now)) return false
  if (isSoldOut(d)) return false
  return true
}

/** Drop = sconto a tempo/quantità limitata. */
export function isDrop(d) {
  return !!d?.is_drop
}

/** Convenzione = sconto sempre valido, non a scadenza-evento. */
export function isConvention(d) {
  return !!d && !d.is_drop
}

/** Drop attivo: è un drop ed è attivo. */
export function isActiveDrop(d, now = new Date()) {
  return isDrop(d) && isActiveDiscount(d, now)
}

/**
 * Drop non scaduti né disattivati, esaurito o no.
 *
 * Non è un sinonimo di `isActiveDrop`: quello resta la definizione di
 * "attivo" (esaurito escluso, usato per i conteggi). Questo serve a ciò che
 * si MOSTRA (home e Bi Club): un drop esaurito resta in vetrina con lo
 * stato "sold out" — chi arriva tardi vede che c'era ed è stato preso, e
 * aspetta il prossimo. Un drop scaduto o disattivato invece sparisce.
 * (Dal 28 al 30/09 gli esauriti erano nascosti, PR #309: tolto il 30/09.)
 */
export function isVisibleDrop(d, now = new Date()) {
  if (!d || !isDrop(d)) return false
  if (d.is_active === false) return false
  if (isExpired(d, now)) return false
  return true
}

export function filterVisibleDrops(list, now = new Date()) {
  return (list || []).filter((d) => isVisibleDrop(d, now))
}

function ms(iso) {
  const t = iso ? new Date(iso).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

/** Quando è uscito il drop (inizio del drop, o creazione), in ms. */
function dropStartMs(d) {
  return ms(d?.drop_starts_at || d?.created_at)
}

/**
 * Quando il drop è arrivato sul sito, in ms: il più tardi fra l'inizio del
 * drop e la creazione della riga. Un drop creato oggi con l'inizio messo a
 * ieri è comunque "nuovo" rispetto a una scelta fatta stamattina.
 */
function dropOutMs(d) {
  return Math.max(ms(d?.drop_starts_at), ms(d?.created_at))
}

/** Il drop è già iniziato (o non ha un inizio)? */
function dropStarted(d, now) {
  return !d?.drop_starts_at || ms(d.drop_starts_at) <= now.getTime()
}

/**
 * I drop da MOSTRARE (home e Bi Club): tutti quelli attivi più UN SOLO drop
 * esaurito, l'ultimo uscito. Deciso dal proprietario il 30/09: il drop
 * appena finito resta col "sold out" (Gelateria Borghese), quelli esauriti
 * prima no (Shoro −30%, esaurito dal 22/09) — altrimenti la vetrina si
 * riempirebbe di drop che non si possono più prendere. Quando un nuovo drop
 * va esaurito prende lui il posto, senza toccare niente a mano.
 */
export function filterShownDrops(list, now = new Date()) {
  const visible = filterVisibleDrops(list, now)
  const soldOut = visible.filter((d) => isSoldOut(d))
  const latest = soldOut.reduce((best, d) => (!best || dropStartMs(d) > dropStartMs(best) ? d : best), null)
  return visible.filter((d) => !isSoldOut(d) || d === latest)
}

/** Convenzione attiva. */
export function isActiveConvention(d, now = new Date()) {
  return isConvention(d) && isActiveDiscount(d, now)
}

/** Tutti gli sconti attivi di una lista. Nessun filtro geografico: è il punto. */
export function filterActive(list, now = new Date()) {
  return (list || []).filter((d) => isActiveDiscount(d, now))
}

/**
 * Gli sconti di UN locale da mostrare sulla sua scheda: solo gli attivi,
 * nell'ordine della lista (il più recente prima).
 *
 * Il drop esaurito resta in vetrina in home e Bi Club, non qui: sulla scheda
 * la pillola sulla foto e la barra in fondo dicono cosa prendi OGGI. Il 30/09
 * Shoro mostrava "30% di sconto" sulla foto (drop esaurito, il più recente)
 * e "20% di sconto" nella barra (la convenzione ancora valida).
 */
export function activeDiscountsFor(list, restaurantId, now = new Date()) {
  if (!restaurantId) return []
  return filterActive(list, now).filter((d) => d.restaurant_id === restaurantId)
}

/**
 * Locale → lo sconto da raccontare su pin e card: il primo attivo, lo stesso
 * che la scheda mette in primo piano (`activeDiscountsFor(...)[0]`).
 */
export function discountByRestaurant(list, now = new Date()) {
  const map = {}
  for (const d of filterActive(list, now)) {
    if (d.restaurant_id && !(d.restaurant_id in map)) map[d.restaurant_id] = d
  }
  return map
}

export function filterActiveDrops(list, now = new Date()) {
  return (list || []).filter((d) => isActiveDrop(d, now))
}

export function filterActiveConventions(list, now = new Date()) {
  return (list || []).filter((d) => isActiveConvention(d, now))
}

/**
 * Ordinamento per scadenza: il più vicino a finire per primo (Blocco 4).
 * Chi non ha scadenza va in fondo, non in testa.
 */
export function sortByExpiry(list) {
  return [...(list || [])].sort((a, b) => {
    const ea = discountEndsAt(a)
    const eb = discountEndsAt(b)
    if (!ea && !eb) return 0
    if (!ea) return 1
    if (!eb) return -1
    return ea.getTime() - eb.getTime()
  })
}

/**
 * Uno sconto scelto a mano per la vetrina può andarci? Deve essere online
 * (non in prova, non in pausa, non scaduto) e ancora prendibile — tranne un
 * drop esaurito, che in vetrina ci sta col suo "sold out".
 */
export function canFeatureInHome(d, now = new Date()) {
  if (!d || d.is_test) return false
  return isActiveDiscount(d, now) || isVisibleDrop(d, now)
}

/**
 * Lo sconto in evidenza in home (la card grande). Deciso dal proprietario
 * il 30/09: "vince l'ultima cosa successa".
 *
 * - L'ultimo drop uscito (attivo o esaurito col "sold out"): quando ne esce
 *   uno nuovo prende il posto del precedente. Il precedente resta valido
 *   per chi l'ha preso ("I miei vantaggi") e, se ha ancora posti, resta
 *   tra gli altri sconti e nel Bi Club.
 * - Lo sconto scelto a mano dal pannello (`home_featured_at`, bottone 🏠
 *   sulla card): va in vetrina al posto del drop, finché non esce un drop
 *   più nuovo della scelta o non lo si toglie. Se ce ne sono più d'uno vale
 *   l'ultimo scelto. Solo la vetrina della home: il Bi Club non cambia.
 * - Se non c'è nessuno dei due, la convenzione attiva più vicina a scadere.
 */
export function pickFeaturedDeal(list, now = new Date()) {
  return chooseFeaturedDeal(list, now).deal
}

/**
 * Come `pickFeaturedDeal`, più il perché — lo dice il pannello sconti:
 * 'pinned' (scelto a mano), 'drop' (l'ultimo drop uscito), 'auto' (né drop
 * né scelta: la convenzione che scade prima), null se non c'è niente.
 */
export function chooseFeaturedDeal(list, now = new Date()) {
  const items = (list || []).filter((d) => d && !d.is_test)
  const latestDrop = filterShownDrops(items, now)
    .filter((d) => dropStarted(d, now))
    .reduce((best, d) => (!best || dropOutMs(d) > dropOutMs(best) ? d : best), null)
  const pinned = items
    .filter((d) => d.home_featured_at && canFeatureInHome(d, now))
    .reduce((best, d) => (!best || ms(d.home_featured_at) > ms(best.home_featured_at) ? d : best), null)
  if (pinned && (!latestDrop || ms(pinned.home_featured_at) >= dropOutMs(latestDrop))) {
    return { deal: pinned, reason: 'pinned' }
  }
  if (latestDrop) return { deal: latestDrop, reason: 'drop' }
  const conv = sortByExpiry(filterActiveConventions(items, now))[0] || null
  return { deal: conv, reason: conv ? 'auto' : null }
}

/** Millisecondi mancanti alla fine, o null. */
export function msUntilEnd(d, now = new Date()) {
  const end = discountEndsAt(d)
  if (!end) return null
  return end.getTime() - now.getTime()
}

/**
 * Countdown compatto per la pill di stato del drop: "6G 19H", "19H 04M",
 * "04M". Restituisce null quando non c'è scadenza o è già passata.
 */
export function formatCountdown(d, now = new Date()) {
  const ms = msUntilEnd(d, now)
  if (ms === null || ms <= 0) return null
  const totMin = Math.floor(ms / 60000)
  const days = Math.floor(totMin / 1440)
  const hours = Math.floor((totMin % 1440) / 60)
  const mins = totMin % 60
  if (days > 0) return `${days}G ${hours}H`
  if (hours > 0) return `${hours}H ${String(mins).padStart(2, '0')}M`
  return `${mins}M`
}

/**
 * Rete di sicurezza per l'admin (Blocco 8).
 *
 * Elenca gli sconti che sono attivi ma che il sito pubblico non riuscirebbe a
 * mostrare, con la causa in chiaro e l'azione per risolverla. Dopo il fix del
 * Blocco 0 il risultato deve essere vuoto: se torna a popolarsi, la dashboard
 * lo dice invece di lasciare che l'incoerenza passi inosservata.
 *
 * Non è il posto dove reintrodurre un filtro: qui si segnala, non si esclude.
 */
export function findUnreachableDiscounts(activeDiscounts) {
  const out = []
  for (const d of activeDiscounts || []) {
    const r = d?.restaurants || d?.restaurant || null
    if (!r) {
      out.push({ discount: d, reason: 'Locale collegato mancante', fix: 'Ricollega lo sconto a un locale' })
      continue
    }
    if (r.is_published === false) {
      out.push({
        discount: d,
        reason: `${r.name || 'Il locale'} non è pubblicato → la scheda non è raggiungibile`,
        fix: 'Pubblica il locale',
      })
    }
  }
  return out
}

/**
 * Perché il database ha rifiutato uno sblocco, detto a chi lo stava facendo.
 *
 * Il trigger `guard_redemption_insert` (supabase/security-audit-2026-09-23.sql)
 * blocca l'INSERT del riscatto con un codice nel messaggio: `sold_out`,
 * `discount_expired`, `discount_not_available`. Finché la pagina non si
 * aggiorna, chi ha davanti uno sconto appena esaurito può ancora premere
 * "Sblocca": prima riceveva "Riprova" (Bi Club), niente (scheda del locale
 * da telefono) o un errore non gestito (da computer, visto in PostHog il
 * 28-29/09 su Shoro). Riprovare non serve: qui si dice cosa è successo.
 *
 * Restituisce `{ title, text }` per i rifiuti noti, `null` per il resto
 * (rete, permessi...), che resta un errore vero.
 */
export function claimRefusal(error) {
  const code = String(error?.message || error || '').trim()
  switch (code) {
    case 'sold_out':
      return { title: 'Posti finiti', text: 'Qualcuno è stato più veloce: questo sconto è esaurito. Gli altri sconti del locale restano validi.' }
    case 'discount_expired':
      return { title: 'Sconto scaduto', text: 'Questo sconto non vale più.' }
    case 'discount_not_available':
      return { title: 'Sconto non disponibile', text: 'Questo sconto non è più attivo.' }
    default:
      return null
  }
}
