/**
 * getHoursStatus — pure helper for computing restaurant open/closed status.
 *
 * Input (`hours`):  restaurant.hours_cache JSONB — Google Places format:
 *   {
 *     regularOpeningHours: { periods: [{open, close}, ...], weekdayDescriptions: [...] },
 *     currentOpeningHours: { ... },   // fallback (special hours / holidays)
 *     utcOffsetMinutes: number        // e.g. 60 for UTC+1 (Rome summer)
 *   }
 *   where open/close = { day: 0–6 (Sun=0), hour: 0–23, minute: 0–59 }
 *
 * Returns:
 *   { state: 'open'|'closing_soon'|'closed'|'unknown', message: string, nextChange: Date|null }
 *
 * No network calls — pure client-side computation, safe to call every minute.
 *
 * ── Manual test cases (run in browser console or add Vitest when ready) ──
 *
 * Setup helper:
 *   function mkHours(periods, utcOffset = 60) {
 *     return { regularOpeningHours: { periods }, utcOffsetMinutes: utcOffset }
 *   }
 *   function mkPeriod(day, oh, om, ch, cm, cday) {
 *     return { open: { day, hour: oh, minute: om }, close: { day: cday ?? day, hour: ch, minute: cm } }
 *   }
 *   function mkNow(dayOffset, h, m) { // dayOffset from Mon=1
 *     const d = new Date('2026-04-20T00:00:00Z') // Monday in UTC
 *     d.setUTCHours(h - 1, m, 0, 0) // UTC+1 → subtract 1h so local = h:m
 *     d.setUTCDate(d.getUTCDate() + dayOffset)
 *     return d
 *   }
 *
 * Test 1 — open, closes in 3h:
 *   getHoursStatus(mkHours([mkPeriod(1,12,0,23,0)]), mkNow(0,15,0))
 *   → { state:'open', message:'Aperto ora · chiude alle 23:00', nextChange: Date(23:00) }
 *
 * Test 2 — closing_soon (< 30 min):
 *   getHoursStatus(mkHours([mkPeriod(1,12,0,22,45)]), mkNow(0,22,30))
 *   → { state:'closing_soon', message:'Chiude tra 15 min', nextChange: Date(22:45) }
 *
 * Test 3 — closed, reopens same day (lunch split):
 *   getHoursStatus(mkHours([mkPeriod(1,12,0,15,0), mkPeriod(1,19,0,23,0)]), mkNow(0,16,0))
 *   → { state:'closed', message:'Chiuso · apre oggi alle 19:00', ... }
 *
 * Test 4 — closed, reopens tomorrow:
 *   getHoursStatus(mkHours([mkPeriod(2,12,0,23,0)]), mkNow(0,23,30))
 *   → { state:'closed', message:'Chiuso · apre domani alle 12:00', ... }
 *
 * Test 5 — closed, reopens Tuesday (Mon is closed):
 *   getHoursStatus(mkHours([mkPeriod(2,12,0,23,0)]), mkNow(0,10,0))
 *   → { state:'closed', message:'Chiuso · apre domani alle 12:00', ... }
 *   // Mon 10:00 → opens Tue (tomorrow)
 *
 * Test 6 — null data → unknown:
 *   getHoursStatus(null)
 *   → { state:'unknown', message:'', nextChange:null }
 */

const DAY_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

function fmtHM(hour, minute) {
  return `${String(hour ?? 0).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`
}

function toLocalTime(now, utcOffsetMinutes) {
  if (typeof utcOffsetMinutes === 'number') {
    const shifted = new Date(now.getTime() + utcOffsetMinutes * 60_000)
    return { dow: shifted.getUTCDay(), hm: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() }
  }
  return { dow: now.getDay(), hm: now.getHours() * 60 + now.getMinutes() }
}

function findNextOpen(periods, todayDow, nowHM) {
  for (let delta = 0; delta <= 7; delta++) {
    const checkDow = (todayDow + delta) % 7
    const candidates = periods
      .filter(p => p.open?.day === checkDow)
      .filter(p => {
        const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)
        return delta > 0 || openMin > nowHM
      })
      .sort((a, b) => {
        const am = (a.open.hour || 0) * 60 + (a.open.minute || 0)
        const bm = (b.open.hour || 0) * 60 + (b.open.minute || 0)
        return am - bm
      })
    if (!candidates.length) continue
    const p = candidates[0]
    const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)
    const dayLabel = delta === 0 ? 'oggi' : delta === 1 ? 'domani' : DAY_IT[checkDow]
    const minsAhead = delta * 24 * 60 + openMin - nowHM
    return { dayLabel, timeStr: fmtHM(p.open.hour, p.open.minute), minsAhead }
  }
  return null
}

export function getHoursStatus(hours, now = new Date()) {
  const source = hours?.regularOpeningHours || hours?.currentOpeningHours
  if (!source) return { state: 'unknown', message: '', nextChange: null }
  const periods = source.periods || []
  if (!periods.length) return { state: 'unknown', message: '', nextChange: null }

  const utcOffset = typeof hours?.utcOffsetMinutes === 'number' ? hours.utcOffsetMinutes : null
  const { dow: todayDow, hm: nowHM } = toLocalTime(now, utcOffset)

  for (const p of periods) {
    const openDay = p.open?.day
    if (openDay == null) continue
    const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)

    // 24/7 — period with no close
    if (!p.close) {
      return { state: 'open', message: 'Aperto ora · sempre aperto', nextChange: null }
    }

    const closeDay = p.close.day
    const closeMin = (p.close.hour || 0) * 60 + (p.close.minute || 0)

    let minsToClose = 0
    let isOpen = false

    if (openDay === closeDay) {
      // Google sometimes encodes "closes at midnight" as close.hour=0 close.minute=0
      // on the same day — treat closeMin=0 (or any ≤ openMin) as 24:00
      const effectiveClose = closeMin <= openMin ? 24 * 60 : closeMin
      if (todayDow === openDay && nowHM >= openMin && nowHM < effectiveClose) {
        isOpen = true
        minsToClose = effectiveClose - nowHM
      }
    } else {
      // Cross-midnight period (e.g. open Mon 22:00 close Tue 02:00)
      if (todayDow === openDay && nowHM >= openMin) {
        isOpen = true
        minsToClose = 24 * 60 - nowHM + closeMin
      } else if (todayDow === closeDay && nowHM < closeMin) {
        isOpen = true
        minsToClose = closeMin - nowHM
      }
    }

    if (isOpen) {
      const closeStr = fmtHM(p.close.hour, p.close.minute)
      const nextChange = new Date(now.getTime() + minsToClose * 60_000)
      if (minsToClose <= 30) {
        return { state: 'closing_soon', message: `Chiude tra ${minsToClose} min`, nextChange }
      }
      return { state: 'open', message: `Aperto ora · chiude alle ${closeStr}`, nextChange }
    }
  }

  // Currently closed — find next opening slot
  const next = findNextOpen(periods, todayDow, nowHM)
  if (!next) return { state: 'closed', message: 'Chiuso', nextChange: null }
  const nextChange = new Date(now.getTime() + next.minsAhead * 60_000)
  return {
    state: 'closed',
    message: `Chiuso · apre ${next.dayLabel} alle ${next.timeStr}`,
    nextChange,
  }
}
