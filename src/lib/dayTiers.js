/**
 * Sconto a fasce: lo stesso sconto vale di più certi giorni e meno altri.
 *
 * Nasce il 15/10 da un locale che voleva "il 30% in settimana e il 15% nel
 * weekend, dal venerdì alla domenica". Due sconti separati confondevano:
 * due card dello stesso locale, due «Sblocca», due QR in «I miei vantaggi»,
 * e di sabato il −30% rifiutato alla cassa. Uno sconto che cambia valore
 * senza dirlo è peggio: chi ha visto 30 lunedì e trova 15 sabato pensa a
 * un trucco. Quindi uno sconto solo, che dice sempre tutte e due le cifre,
 * con quella di oggi accesa (deciso dal proprietario il 15/10).
 *
 * Sul DB è `discounts.day_tiers`: `[{ days: [1,2,3,4], value: '30' },
 * { days: [5,6,7], value: '15' }]` (1 = lunedì … 7 = domenica, come
 * `valid_days`). Il tipo (percentuale o euro) è quello dello sconto, uguale
 * per tutte le fasce. Il trigger di supabase/discount-day-tiers-2026-10-15.sql
 * tiene `valid_days` = l'unione dei giorni delle fasce e `discount_value` =
 * il valore della prima, così tutto quello che non sa delle fasce (i
 * controlli di validità, la cassa, i vecchi punti del sito) continua a
 * funzionare. Il valore applicato alla cassa lo sceglie `verify_redeem_qr`
 * col giorno di Roma e lo scrive in `discount_redemptions.applied_value`.
 *
 * Si usa una volta sola, come ogni sconto: in settimana prendi il 30, nel
 * weekend il 15. Solo per le convenzioni (un drop ha già i suoi posti e il
 * suo countdown) e solo per percentuale ed euro: un omaggio non ha una
 * cifra da far cambiare.
 *
 * Qui solo regole e parole, niente React: lo importano anche le email e il
 * PDF (api/). Come si disegnano: src/components/Discount/DayTiers.jsx. I
 * valori formattati ("−30%") li fa `formatDiscountBadge` passandogli
 * `tierDeal(deal, tier)`.
 */

export const DAY_TIER_TYPES = ['percentage', 'fixed']

const SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
const LONG = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const EN = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/**
 * Il giorno della settimana a Roma, 1 = lunedì … 7 = domenica.
 *
 * Roma e non il fuso di chi guarda: la cassa sceglie la fascia col giorno
 * del locale (`verify_redeem_qr`), e chi pianifica la cena da un altro fuso
 * deve leggere lo stesso valore che troverà sullo scontrino.
 */
export function romeWeekday(now = new Date()) {
  const t = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(t.getTime())) return null
  const w = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', weekday: 'short' }).format(t)
  return EN[w] || null
}

/** Giorni puliti: interi 1..7, senza doppioni, in ordine. */
export function cleanDays(raw) {
  if (!Array.isArray(raw)) return []
  const set = new Set()
  for (const x of raw) {
    const n = Number(x)
    if (Number.isInteger(n) && n >= 1 && n <= 7) set.add(n)
  }
  return [...set].sort((a, b) => a - b)
}

function parseTiers(raw) {
  let list = raw
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { return [] }
  }
  if (!Array.isArray(list)) return []
  const taken = new Set()
  const out = []
  for (const t of list) {
    // Un giorno sta in una fascia sola: se due fasce se lo contendono vince
    // la prima, come nel trigger del DB (che però le rifiuta prima).
    const days = cleanDays(t?.days).filter((d) => !taken.has(d))
    const value = String(t?.value ?? '').trim()
    if (!days.length || !value) continue
    days.forEach((d) => taken.add(d))
    out.push({ days, value })
  }
  return out.sort((a, b) => a.days[0] - b.days[0])
}

/**
 * Le fasce dello sconto, in ordine di giorno (la settimana prima del
 * weekend), ognuna con `days`, `value` e `index`. Vuoto se lo sconto non è
 * a fasce: una fascia sola è uno sconto normale coi suoi giorni.
 */
export function dayTiers(deal) {
  if (!deal || deal.is_drop) return []
  if (!DAY_TIER_TYPES.includes(deal.discount_type)) return []
  const tiers = parseTiers(deal.day_tiers)
  return tiers.length >= 2 ? tiers.map((t, index) => ({ ...t, index })) : []
}

export function hasDayTiers(deal) {
  return dayTiers(deal).length > 0
}

/** La fascia di quel giorno (1..7), o null se quel giorno lo sconto non vale. */
export function tierForDay(deal, dow) {
  return dayTiers(deal).find((t) => t.days.includes(dow)) || null
}

/** La fascia di oggi a Roma, o null se oggi non vale. */
export function todayTier(deal, now = new Date()) {
  return tierForDay(deal, romeWeekday(now))
}

/**
 * La fascia da mettere in primo piano: quella di oggi o, se oggi lo sconto
 * non vale (il locale è chiuso), la prossima che arriva. È quella del badge
 * piccolo su pin e card, dove ci sta una cifra sola.
 */
export function currentTier(deal, now = new Date()) {
  const tiers = dayTiers(deal)
  if (!tiers.length) return null
  const today = romeWeekday(now) || 1
  for (let k = 0; k < 7; k++) {
    const dow = ((today - 1 + k) % 7) + 1
    const t = tiers.find((x) => x.days.includes(dow))
    if (t) return t
  }
  return tiers[0]
}

/**
 * Lo sconto come se fosse solo quella fascia: un oggetto normale, senza
 * fasce, da dare a `formatDiscountBadge` e a tutto ciò che sa leggere un
 * valore solo. `day_tiers: null` impedisce di ricadere qui dentro.
 */
export function tierDeal(deal, tier) {
  if (!deal || !tier) return deal
  return { ...deal, discount_value: tier.value, valid_days: tier.days, day_tiers: null }
}

/** Lo sconto con il valore di oggi (o della prossima fascia). Uguale se non è a fasce. */
export function dealToday(deal, now = new Date()) {
  const tier = currentTier(deal, now)
  return tier ? tierDeal(deal, tier) : deal
}

/**
 * Lo sconto come è stato usato alla cassa: il valore scritto da
 * `verify_redeem_qr` in `applied_value` e nient'altro. Per un riscatto
 * non ancora usato (o di prima delle fasce) è lo sconto così com'è.
 */
export function usedDeal(redemption, discount = redemption?.discount) {
  if (!discount) return discount
  if (redemption?.status !== 'redeemed') return discount
  const applied = String(redemption?.applied_value ?? '').trim()
  if (applied) return { ...discount, discount_value: applied, day_tiers: null }
  // Usato prima che la cassa scrivesse il valore: la fascia del giorno in
  // cui è stato convalidato.
  const tier = redemption.redeemed_at ? tierForDay(discount, romeWeekday(new Date(redemption.redeemed_at))) : null
  return tier ? tierDeal(discount, tier) : discount
}

/* ── I giorni in parole ────────────────────────────────────────────────── */

/**
 * I giorni a blocchi consecutivi. Il blocco che tocca la domenica e quello
 * che parte dal lunedì sono lo stesso blocco: "ven–lun", non "lun, ven–dom".
 */
function dayRuns(days) {
  const d = cleanDays(days)
  if (!d.length) return []
  const runs = []
  let start = d[0]
  let prev = d[0]
  for (let i = 1; i <= d.length; i++) {
    const cur = d[i]
    if (cur !== prev + 1) {
      runs.push([start, prev])
      start = cur
    }
    prev = cur
  }
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 7) {
    const first = runs.shift()
    runs[runs.length - 1] = [runs[runs.length - 1][0], first[1]]
  }
  return runs
}

function runDays([a, b]) {
  const out = []
  let x = a
  for (;;) {
    out.push(x)
    if (x === b) break
    x = x === 7 ? 1 : x + 1
  }
  return out
}

function joinIt(parts) {
  if (parts.length <= 1) return parts[0] || ''
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

/** "lun–gio", "ven–dom", "sab e dom", "lun, mer e ven", "tutti i giorni". */
export function tierDaysShort(days) {
  const d = cleanDays(days)
  if (!d.length) return ''
  if (d.length === 7) return 'tutti i giorni'
  const parts = dayRuns(d).flatMap((run) => {
    const list = runDays(run)
    return list.length >= 3 ? [`${SHORT[run[0] - 1]}–${SHORT[run[1] - 1]}`] : list.map((x) => SHORT[x - 1])
  })
  return joinIt(parts)
}

/**
 * "dal lunedì al giovedì", "dal venerdì alla domenica", "sabato e
 * domenica", "il lunedì": i giorni come si dicono in una frase.
 */
export function tierDaysLong(days) {
  const d = cleanDays(days)
  if (!d.length) return ''
  if (d.length === 7) return 'tutti i giorni'
  if (d.length === 1) return d[0] === 7 ? 'la domenica' : `il ${LONG[d[0] - 1]}`
  const parts = dayRuns(d).flatMap((run) => {
    const list = runDays(run)
    if (list.length < 3) return list.map((x) => LONG[x - 1])
    const end = run[1] === 7 ? `alla ${LONG[6]}` : `al ${LONG[run[1] - 1]}`
    const start = run[0] === 7 ? `dalla ${LONG[6]}` : `dal ${LONG[run[0] - 1]}`
    return [`${start} ${end}`]
  })
  return joinIt(parts)
}

/**
 * Il calendario della settimana a pezzi, per disegnarlo: un pezzo per ogni
 * gruppo di giorni consecutivi con la stessa fascia (o senza, se lo sconto
 * quel giorno non vale). Qui lunedì → domenica senza giri: è una fila.
 *
 * @returns {{ start: number, end: number, days: number[], tier: object|null }[]}
 */
export function weekRuns(deal) {
  const tiers = dayTiers(deal)
  const out = []
  for (let dow = 1; dow <= 7; dow++) {
    const tier = tiers.find((t) => t.days.includes(dow)) || null
    const last = out[out.length - 1]
    if (last && last.tier === tier) {
      last.end = dow
      last.days.push(dow)
    } else {
      out.push({ start: dow, end: dow, days: [dow], tier })
    }
  }
  return out
}

/**
 * Le fasce scritte dall'admin prima di salvare: quali errori ha il modulo.
 * Le stesse regole del trigger, dette in parole. Vuoto = si può salvare.
 */
export function dayTierProblems(tiers, { type } = {}) {
  const problems = []
  const list = Array.isArray(tiers) ? tiers : []
  if (!DAY_TIER_TYPES.includes(type)) problems.push('Le fasce valgono per gli sconti in percentuale o in euro.')
  if (list.length < 2) problems.push('Servono almeno due fasce.')
  const seen = new Map()
  list.forEach((t, i) => {
    const days = cleanDays(t?.days)
    const value = String(t?.value ?? '').replace(/[%€\s]/g, '').replace(/^[-−]/, '').trim()
    if (!value) problems.push(`Fascia ${i + 1}: manca il valore.`)
    else if (!/^\d+([.,]\d+)?$/.test(value)) problems.push(`Fascia ${i + 1}: il valore è un numero, es. 30.`)
    if (!days.length) problems.push(`Fascia ${i + 1}: scegli almeno un giorno.`)
    days.forEach((d) => {
      if (seen.has(d)) problems.push(`${LONG[d - 1][0].toUpperCase()}${LONG[d - 1].slice(1)} è in due fasce: va in una sola.`)
      else seen.set(d, i)
    })
  })
  return [...new Set(problems)]
}

/** Le fasce pronte per il DB: valori puliti, giorni in ordine, fasce in ordine. */
export function normalizeDayTiers(tiers) {
  return parseTiers((Array.isArray(tiers) ? tiers : []).map((t) => ({
    days: t?.days,
    value: String(t?.value ?? '').replace(/[%€\s]/g, '').replace(/^[-−]/, '').trim(),
  })))
}

/**
 * Il modulo del pannello ha le fasce accese e può averle: convenzione (non
 * drop) in percentuale o in euro. Lo leggono editor, anteprima e salvataggio.
 */
export function formUsesDayTiers(form) {
  return !!form?.tiers_on && form.kind !== 'drop' && DAY_TIER_TYPES.includes(form.discount_type)
}

/** Da dove partono le fasce quando le si accende: la richiesta del 15/10. */
export function presetDayTiers(firstValue = '') {
  return [
    { days: [1, 2, 3, 4], value: String(firstValue || '') },
    { days: [5, 6, 7], value: '' },
  ]
}

/** I giorni di tutte le fasce insieme, in ordine (= `valid_days` sul DB). */
export function dayTiersUnion(tiers) {
  return cleanDays((Array.isArray(tiers) ? tiers : []).flatMap((t) => cleanDays(t?.days)))
}
