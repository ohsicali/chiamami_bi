/**
 * Periodi della pagina admin Analytics → intervallo da chiedere al DB,
 * periodo precedente per il confronto e grana del grafico.
 *
 * "7g" vuol dire oggi più i sei giorni prima, a partire dalla mezzanotte:
 * così ogni barra del grafico è un giorno intero e non un pezzo. Il periodo
 * precedente è lo stesso intervallo spostato indietro della sua durata
 * ("Oggi" si confronta con ieri fino alla stessa ora).
 */
export const PERIODS = [
  { key: 'today', label: 'Oggi', days: 1 },
  { key: '7d', label: '7g', days: 7 },
  { key: '30d', label: '30g', days: 30 },
  { key: '90d', label: '90g', days: 90 },
]

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

// Un giorno di calendario dopo `d`, alla mezzanotte: con il cambio dell'ora
// legale un giorno non è sempre lungo 24 ore.
function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function getAnalyticsRange(period, customFrom, customTo, now = new Date()) {
  let from
  let to
  let days
  if (period === 'custom' && customFrom && customTo) {
    from = startOfDay(customFrom)
    to = addDays(startOfDay(customTo), 1)
    if (to > now) to = now
    days = Math.max(1, Math.round((startOfDay(customTo) - from) / DAY_MS) + 1)
  } else {
    days = PERIODS.find((x) => x.key === period)?.days || 7
    from = addDays(startOfDay(now), -(days - 1))
    to = new Date(now)
  }
  return {
    from,
    to,
    prevFrom: addDays(from, -days),
    prevTo: addDays(to, -days),
    days,
    bucket: days === 1 ? 'hour' : 'day',
  }
}
