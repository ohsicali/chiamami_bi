/**
 * PR23 — Helper validità sconto (giorno settimana + fascia oraria).
 * Usato lato client per UX preview. La verità autoritativa resta lato
 * backend (RPC verify_redeem_qr) per l'attivazione finale.
 */

/**
 * Le fasce dei pasti. `from`–`to` è l'orario che si legge (regole dello
 * sconto, pannello); `redeemFrom`–`redeemTo` è quando il locale lo può
 * convalidare davvero.
 *
 * Più larghe apposta (29/10): il conto si paga alla fine del pasto. Con la
 * cena che chiudeva alle 23:30 esatte, a Locanda Bellezia un giovedì alle
 * 23:33 il codice risultava "non valido" con il cliente ancora al tavolo.
 * Un `redeemTo` oltre le 24:00 vuol dire la notte dopo: la cena del giovedì
 * pagata a mezzanotte e mezza conta ancora come giovedì.
 *
 * Le stesse finestre stanno in `private.redeem_windows` di
 * supabase/verify-meal-windows-2026-10-29.sql: tests/validity.test.mjs
 * controlla che non divergano.
 */
export const MEAL_SLOTS = {
  colazione: { from: '07:00', to: '11:00', redeemFrom: '06:30', redeemTo: '12:30' },
  pranzo:    { from: '12:00', to: '15:00', redeemFrom: '11:30', redeemTo: '17:00' },
  aperitivo: { from: '17:30', to: '20:00', redeemFrom: '17:00', redeemTo: '22:00' },
  cena:      { from: '19:00', to: '23:30', redeemFrom: '18:30', redeemTo: '26:30' },
  brunch:    { from: '10:00', to: '14:00', redeemFrom: '09:30', redeemTo: '16:00' },
}

/** Orario scritto a mano dal locale: mezz'ora prima, un'ora dopo. */
export const REDEEM_GRACE_MIN = { before: 30, after: 60 }

/** Senza fascia vale tutto il giorno, e fino alle 3 di notte del giorno dopo. */
export const ALL_DAY_REDEEM_TO_MIN = 27 * 60

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const DAY_LABELS_FULL = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const SLOT_LABELS = {
  colazione: 'Colazione',
  pranzo: 'Pranzo',
  aperitivo: 'Aperitivo',
  cena: 'Cena',
  brunch: 'Brunch',
}

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = String(t).split(':')
  return (+h) * 60 + (+(m || 0))
}

const ROME_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const EN_DOW = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/**
 * Giorno (1=lun … 7=dom) e minuto del giorno a Roma: la cassa guarda
 * l'orologio del locale, non quello del telefono di chi è in vacanza.
 */
function romeClock(date) {
  const parts = Object.fromEntries(ROME_PARTS.formatToParts(date).map((p) => [p.type, p.value]))
  return { dow: EN_DOW[parts.weekday], min: (+parts.hour % 24) * 60 + (+parts.minute) }
}

function dayOfWeek(date) {
  return romeClock(date).dow
}

function computeValidRanges(discount) {
  if (discount?.valid_time_from && discount?.valid_time_to) {
    return [{
      fromMin: timeToMin(discount.valid_time_from),
      toMin: timeToMin(discount.valid_time_to),
    }]
  }
  if (Array.isArray(discount?.valid_meal_slots) && discount.valid_meal_slots.length) {
    return discount.valid_meal_slots
      .map((slot) => MEAL_SLOTS[slot])
      .filter(Boolean)
      .map((m) => ({ fromMin: timeToMin(m.from), toMin: timeToMin(m.to) }))
  }
  return []
}

/**
 * Le finestre in cui il locale può convalidare, in minuti dalla mezzanotte
 * del giorno dello sconto (`toMin` oltre 1440 = la notte dopo).
 */
export function redeemRanges(discount) {
  if (discount?.valid_time_from && discount?.valid_time_to) {
    const from = timeToMin(discount.valid_time_from)
    let to = timeToMin(discount.valid_time_to)
    if (to <= from) to += 24 * 60
    return [{ fromMin: from - REDEEM_GRACE_MIN.before, toMin: to + REDEEM_GRACE_MIN.after }]
  }
  if (Array.isArray(discount?.valid_meal_slots) && discount.valid_meal_slots.length) {
    const ranges = discount.valid_meal_slots
      .map((slot) => MEAL_SLOTS[slot])
      .filter(Boolean)
      .map((m) => ({ fromMin: timeToMin(m.redeemFrom), toMin: timeToMin(m.redeemTo) }))
    if (ranges.length) return ranges
  }
  return [{ fromMin: 0, toMin: ALL_DAY_REDEEM_TO_MIN }]
}

/**
 * Il giorno a cui appartiene questo momento per lo sconto (1..7), o null se
 * adesso non si può usare. Dopo mezzanotte può essere ancora ieri: la cena
 * di giovedì pagata alle 00:30 è giovedì. Stessa regola di
 * `private.redeem_service_dow` nel DB.
 */
export function redeemServiceDay(discount, now = new Date()) {
  const { dow, min } = romeClock(now)
  const yesterday = dow === 1 ? 7 : dow - 1
  const days = Array.isArray(discount?.valid_days) && discount.valid_days.length
    ? discount.valid_days
    : [1, 2, 3, 4, 5, 6, 7]
  const ranges = redeemRanges(discount)
  if (days.includes(dow) && ranges.some((r) => min >= r.fromMin && min <= r.toMin)) return dow
  if (days.includes(yesterday) && ranges.some((r) => min + 1440 >= r.fromMin && min + 1440 <= r.toMin)) return yesterday
  return null
}

/**
 * Ritorna 1 di 5 stati:
 *   'valid_now' — usabile in questo momento
 *   'valid_today_later' — oggi sì ma non ora (es. cena, sono le 14)
 *   'valid_other_day' — oggi no, valido in altri giorni
 *   'expired' — scaduto definitivamente (drop ended / valid_until past)
 *   'used' — già scansionato (usabile solo se redemption è passata)
 */
export function checkValidity(discount, now = new Date()) {
  if (!discount) return 'expired'

  // Scadenza temporale assoluta
  const endIso = discount.drop_ends_at || discount.valid_until || discount.expires_at
  if (endIso) {
    const end = new Date(endIso)
    if (!isNaN(end) && now > end) return 'expired'
  }

  if (redeemServiceDay(discount, now) != null) return 'valid_now'

  const { dow: today, min: nowMin } = romeClock(now)
  const validDays = Array.isArray(discount.valid_days) && discount.valid_days.length
    ? discount.valid_days
    : [1, 2, 3, 4, 5, 6, 7]
  if (!validDays.includes(today)) return 'valid_other_day'

  if (redeemRanges(discount).some((r) => r.fromMin > nowMin)) return 'valid_today_later'

  return 'valid_other_day'
}

/* ============================================================================
   Formattazione human-readable
   ============================================================================ */

function compactDays(daysArr) {
  if (!daysArr || daysArr.length === 0 || daysArr.length === 7) return 'Tutti i giorni'
  // ordina e cerca range consecutivi
  const sorted = [...daysArr].sort((a, b) => a - b)
  const ranges = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur !== prev + 1) {
      ranges.push(start === prev ? DAY_LABELS[start - 1] : `${DAY_LABELS[start - 1]}–${DAY_LABELS[prev - 1]}`)
      start = cur
    }
    prev = cur
  }
  return ranges.join(' · ')
}

export function formatDays(daysArr) {
  return compactDays(daysArr)
}

export function formatSlots(slotsArr) {
  if (!slotsArr || slotsArr.length === 0) return 'Qualsiasi fascia'
  return slotsArr.map((s) => SLOT_LABELS[s] || s).join(' · ')
}

function nextValidDayName(discount, now = new Date()) {
  if (!Array.isArray(discount.valid_days) || discount.valid_days.length === 0) return null
  const today = dayOfWeek(now)
  for (let offset = 1; offset <= 7; offset++) {
    const d = ((today - 1 + offset) % 7) + 1
    if (discount.valid_days.includes(d)) {
      return DAY_LABELS_FULL[d - 1]
    }
  }
  return null
}

function formatHHMM(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function computeNextValidWindow(discount, now = new Date()) {
  const status = checkValidity(discount, now)
  if (status === 'valid_now') return 'ora'
  if (status === 'valid_today_later') {
    const ranges = computeValidRanges(discount)
    const nowMin = romeClock(now).min
    const next = ranges.find((r) => r.fromMin > nowMin)
    if (next) {
      const diff = next.fromMin - nowMin
      const h = Math.floor(diff / 60)
      const m = diff % 60
      if (h === 0) return `tra ${m}m`
      return `dalle ${formatHHMM(next.fromMin)} (tra ${h}h ${m}m)`
    }
  }
  const day = nextValidDayName(discount, now)
  if (day) return day
  return null
}

/**
 * Pill compatta per card / lista. Es.
 *   "Valido ora", "Solo a cena · da 19:00", "Oggi no · Mar–Ven"
 */
export function formatShortPill(discount, status) {
  const s = status || checkValidity(discount)
  if (s === 'valid_now') return 'Valido ora'
  if (s === 'expired') return 'Scaduto'
  if (s === 'used') return 'Già usato'

  const ranges = computeValidRanges(discount)
  const slots = Array.isArray(discount.valid_meal_slots) ? discount.valid_meal_slots : []

  if (s === 'valid_today_later') {
    if (slots.length === 1) {
      const slot = slots[0]
      const meal = MEAL_SLOTS[slot]
      const label = SLOT_LABELS[slot] || slot
      return `Solo a ${label.toLowerCase()} · da ${meal?.from || ''}`
    }
    if (ranges.length) {
      const r = ranges[0]
      return `Da ${formatHHMM(r.fromMin)}`
    }
    return 'Più tardi oggi'
  }

  // valid_other_day
  if (Array.isArray(discount.valid_days) && discount.valid_days.length > 0 && discount.valid_days.length < 7) {
    return `Oggi no · ${compactDays(discount.valid_days)}`
  }
  return 'Oggi non valido'
}

export function formatValidityHuman(discount, now = new Date()) {
  return {
    days: formatDays(discount.valid_days),
    slots: formatSlots(discount.valid_meal_slots),
    next: computeNextValidWindow(discount, now),
    short: formatShortPill(discount, checkValidity(discount, now)),
  }
}

/**
 * Ritorna l'array dei dayOfWeek (1..7) effettivi (per day-strip UI).
 * Se valid_days null/empty → tutti i giorni.
 */
export function effectiveValidDays(discount) {
  if (Array.isArray(discount?.valid_days) && discount.valid_days.length > 0) {
    return [...discount.valid_days].sort((a, b) => a - b)
  }
  return [1, 2, 3, 4, 5, 6, 7]
}

export function todayDayOfWeek(now = new Date()) {
  return dayOfWeek(now)
}

export const DAY_SHORT_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
