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

/**
 * Canonical 5 daily moments — gemelli dei pill di home e filtri Esplora.
 * Ogni fascia ha un intervallo [startMin, endMin] in minuti dall'inizio
 * della giornata locale. `endMin > 24*60` significa cross-midnight.
 */
export const MOMENT_SLOTS = {
  colazione: { startMin:  6 * 60 + 30, endMin: 10 * 60 + 30, emoji: '🥐', label: 'Colazione' },
  pranzo:    { startMin: 11 * 60 + 30, endMin: 14 * 60 + 30, emoji: '🍝', label: 'Pranzo' },
  aperitivo: { startMin: 17 * 60,      endMin: 20 * 60 + 30, emoji: '🥂', label: 'Aperitivo' },
  cena:      { startMin: 19 * 60 + 30, endMin: 23 * 60 + 30, emoji: '🍷', label: 'Cena' },
  dopocena:  { startMin: 22 * 60 + 30, endMin: 26 * 60,      emoji: '🍸', label: 'Dopo cena' },
}

export const MOMENT_KEYS = ['colazione', 'pranzo', 'aperitivo', 'cena', 'dopocena']

/**
 * Domanda contestuale in voce Bi per ogni fascia, usata nel Time Hero.
 */
export const MOMENT_QUESTIONS = {
  colazione: "È l'ora della colazione. Ce l'hai un posto in mente?",
  pranzo:    "È l'ora del pranzo. Ce l'hai un posto in mente?",
  aperitivo: "È l'ora dell'aperitivo. Ce l'hai un posto in mente?",
  cena:      "È l'ora di cena. Ce l'hai un posto in mente?",
  dopocena:  "È l'ora di un cocktail. Ce l'hai un posto in mente?",
  // fallback fasce grigie (15:00, 03:00 ecc.)
  none:      'Dove ti porto adesso?',
}

/**
 * Dato un Date, ritorna { active: string|null, next: string } dove:
 * - active = chiave del momento corrente se siamo dentro una fascia (null se fascia grigia)
 * - next   = chiave del momento più vicino in futuro (mai null, rotazione circolare).
 *
 * Le fasce canoniche si sovrappongono (es. aperitivo 17-20:30 + cena 19:30-23:30):
 * nel sovrapposto priorità alla fascia iniziata più tardi (= quella più "attuale").
 */
export function getCurrentMoment(now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowMinCross = nowMin + 24 * 60 // per confronti cross-midnight

  let active = null
  let activeStart = -1
  for (const key of MOMENT_KEYS) {
    const s = MOMENT_SLOTS[key]
    const inNormal = nowMin >= s.startMin && nowMin < s.endMin
    const inCross = s.endMin > 24 * 60 && nowMinCross < s.endMin && nowMin < s.startMin
    if ((inNormal || inCross) && s.startMin > activeStart) {
      active = key
      activeStart = s.startMin
    }
  }

  // next: se siamo in fascia grigia trova il prossimo inizio ≥ ora
  let next = null
  let bestDelta = Infinity
  for (const key of MOMENT_KEYS) {
    const s = MOMENT_SLOTS[key]
    let delta = s.startMin - nowMin
    if (delta <= 0) delta += 24 * 60
    if (delta < bestDelta) {
      bestDelta = delta
      next = key
    }
  }

  return { active, next }
}

/**
 * isOpenForMoment — ritorna se un ristorante è ragionevolmente aperto per
 * un dato momento giornata. Combina due segnali in OR:
 *
 *   1. Tag manuale dell'admin (`manualMoments` da restaurants.moments).
 *      Se include il momento richiesto → match (anche se gli orari Google
 *      non coprirebbero la fascia, es. cocktail bar a cui Google non ha
 *      messo "aperitivo").
 *   2. Overlap orario tra la fascia del momento e uno dei `periods[]`
 *      di `hours_cache` proiettati sul giorno target. Se i due si
 *      sovrappongono → match.
 *
 * Quindi: l'admin marca "cena" su un locale che a Roma sa fare anche
 * pranzo nel weekend → il sistema lo trova lo stesso a pranzo nei giorni
 * giusti grazie agli orari Google.
 *
 * `opensAt`/`closesAt` arrivano sempre dagli orari reali quando l'overlap
 * c'è; se il match nasce solo dal tag manuale (orari Google assenti o
 * non coprono la fascia) restano `null` e l'UI mostra "Aperto" senza
 * orario.
 *
 * Return:
 *   { match, verified, opensAt, closesAt }
 */
export function isOpenForMoment(hours, moment, now = new Date(), manualMoments = null) {
  if (!MOMENT_SLOTS[moment]) return { match: false, verified: true, opensAt: null, closesAt: null }

  const manualMatch = Array.isArray(manualMoments) && manualMoments.includes(moment)

  const slot = MOMENT_SLOTS[moment]
  const source = hours?.regularOpeningHours || hours?.currentOpeningHours
  if (!source || !Array.isArray(source.periods) || source.periods.length === 0) {
    // Senza hours_cache: il match dipende solo dal tag manuale.
    if (manualMatch) return { match: true, verified: false, opensAt: null, closesAt: null }
    return { match: false, verified: false, opensAt: null, closesAt: null }
  }

  const utcOffset = typeof hours?.utcOffsetMinutes === 'number' ? hours.utcOffsetMinutes : null
  const { dow: todayDow } = toLocalTime(now, utcOffset)

  // Giorno target = oggi per la maggior parte dei momenti; dopocena cross-midnight
  // viene gestito iterando anche il giorno precedente per catturare periodi 22:00→02:00.
  const daysToCheck = moment === 'dopocena' ? [todayDow, (todayDow + 6) % 7] : [todayDow]

  let bestCloseMin = null
  let bestOpenMin = null

  for (const checkDow of daysToCheck) {
    for (const p of source.periods) {
      if (p.open?.day == null) continue
      const openDay = p.open.day
      const closeDay = p.close?.day ?? openDay
      const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)
      const closeMinRaw = p.close ? (p.close.hour || 0) * 60 + (p.close.minute || 0) : 24 * 60

      // Considera un periodo come intervallo [periodStart, periodEnd] sul giorno target.
      // Due casi:
      //   a) openDay == checkDow e close lo stesso giorno → [openMin, closeMin]
      //   b) openDay == checkDow con cross-midnight (closeDay != openDay) → [openMin, 24h + closeMin]
      //   c) openDay == checkDow-1 con cross-midnight → [0, closeMin] (mattina presto)
      let periodStart, periodEnd
      if (openDay === checkDow && closeDay === openDay) {
        periodStart = openMin
        periodEnd = closeMinRaw <= openMin ? 24 * 60 : closeMinRaw
      } else if (openDay === checkDow && closeDay !== openDay) {
        periodStart = openMin
        periodEnd = 24 * 60 + closeMinRaw
      } else if (closeDay === checkDow && openDay !== closeDay && checkDow !== todayDow) {
        // Periodo cross-midnight del giorno precedente che si estende al mattino di oggi.
        // Rilevante solo per dopocena su giorno corrente: periodStart negativo.
        periodStart = -(24 * 60 - openMin)
        periodEnd = closeMinRaw
      } else {
        continue
      }

      // Overlap con slot [slot.startMin, slot.endMin]
      const overlapStart = Math.max(periodStart, slot.startMin)
      const overlapEnd = Math.min(periodEnd, slot.endMin)
      if (overlapEnd > overlapStart) {
        // Match! Tieni l'apertura più anticipata e la chiusura più tardiva
        // fra i periodi che intersecano il momento (così "apre alle" è
        // l'orario reale di apertura, "chiude alle" la chiusura reale).
        const closeNormalized = periodEnd > 24 * 60 ? periodEnd - 24 * 60 : periodEnd
        if (bestCloseMin == null || closeNormalized > bestCloseMin) {
          bestCloseMin = closeNormalized
        }
        const openNormalized = periodStart < 0 ? periodStart + 24 * 60 : periodStart
        if (bestOpenMin == null || openNormalized < bestOpenMin) {
          bestOpenMin = openNormalized
        }
      }
    }
  }

  const fmt = (mins) => {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  if (bestCloseMin != null) {
    return {
      match: true,
      verified: true,
      opensAt: bestOpenMin != null ? fmt(bestOpenMin) : null,
      closesAt: fmt(bestCloseMin),
    }
  }
  // Nessun overlap orario: il match dipende solo dal tag manuale.
  if (manualMatch) return { match: true, verified: false, opensAt: null, closesAt: null }
  return { match: false, verified: true, opensAt: null, closesAt: null }
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
