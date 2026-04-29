/**
 * PR23 — Helper validità sconto (giorno settimana + fascia oraria).
 * Usato lato client per UX preview. La verità autoritativa resta lato
 * backend (RPC verify_redeem_qr) per l'attivazione finale.
 */

export const MEAL_SLOTS = {
  colazione: { from: '07:00', to: '11:00' },
  pranzo:    { from: '12:00', to: '15:00' },
  aperitivo: { from: '17:30', to: '20:00' },
  cena:      { from: '19:00', to: '23:30' },
  brunch:    { from: '10:00', to: '14:00' },
}

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

function dayOfWeek(date) {
  // 1=Mon ... 7=Sun
  return ((date.getDay() + 6) % 7) + 1
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

  const today = dayOfWeek(now)
  const validDays = Array.isArray(discount.valid_days) && discount.valid_days.length
    ? discount.valid_days
    : [1, 2, 3, 4, 5, 6, 7]

  if (!validDays.includes(today)) return 'valid_other_day'

  const ranges = computeValidRanges(discount)
  if (ranges.length === 0) return 'valid_now'

  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (ranges.some((r) => nowMin >= r.fromMin && nowMin <= r.toMin)) return 'valid_now'

  const nextToday = ranges.find((r) => r.fromMin > nowMin)
  if (nextToday) return 'valid_today_later'

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
    const nowMin = now.getHours() * 60 + now.getMinutes()
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
