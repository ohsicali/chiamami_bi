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

/** Convenzione attiva. */
export function isActiveConvention(d, now = new Date()) {
  return isConvention(d) && isActiveDiscount(d, now)
}

/** Tutti gli sconti attivi di una lista. Nessun filtro geografico: è il punto. */
export function filterActive(list, now = new Date()) {
  return (list || []).filter((d) => isActiveDiscount(d, now))
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
