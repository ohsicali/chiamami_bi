/**
 * OrariLocale — mostra gli orari di apertura del locale via Google Places.
 *
 * Data flow:
 *   1. Se restaurant.place_id null / non verificato → fallback "Chiama per orari"
 *   2. Altrimenti fetch /api/places-details?restaurantId=... → orari
 *   3. Se API down o dati mancanti → fallback "Chiama per orari"
 *
 * UI:
 *   - Badge stato: "Aperto ora" (verde) | "Chiuso" (grigio) | "Chiude alle HH:MM" (giallo tenue)
 *   - Accordion con orari settimanali
 */
import { useEffect, useState } from 'react'

const ITALIAN_DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // Lun..Dom; Places usa 0=Dom
const DAY_LABELS_SHORT = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab',
}

function ChevronIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function formatTime(hour, minute) {
  const h = String(hour ?? 0).padStart(2, '0')
  const m = String(minute ?? 0).padStart(2, '0')
  return `${h}:${m}`
}

function periodsByDay(periods) {
  const byDay = new Map()
  for (const p of periods || []) {
    const day = p.open?.day
    if (day == null) continue
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(p)
  }
  return byDay
}

function humanRange(period) {
  if (!period?.open) return ''
  const openStr = formatTime(period.open.hour, period.open.minute)
  const closeStr = period.close ? formatTime(period.close.hour, period.close.minute) : null
  if (!closeStr) return `Dalle ${openStr}`
  return `${openStr} – ${closeStr}`
}

function computeStatus(data) {
  // Calcolo sempre in locale (non fidarti di openNow: può essere stale
  // fino a 24h per via della cache server-side).
  const source = data?.currentOpeningHours || data?.regularOpeningHours
  if (!source) return null
  const periods = source.periods || []
  if (!periods.length) return null

  // Tempo nel fuso del locale via utcOffsetMinutes (se disponibile).
  const utcOffset = typeof data.utcOffsetMinutes === 'number' ? data.utcOffsetMinutes : null
  const nowReal = new Date()
  const local = utcOffset !== null
    ? new Date(nowReal.getTime() + nowReal.getTimezoneOffset() * 60_000 + utcOffset * 60_000)
    : nowReal
  const todayDow = local.getDay()
  const nowHM = local.getHours() * 60 + local.getMinutes()

  for (const p of periods) {
    const openDay = p.open?.day
    if (openDay == null) continue
    const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)

    // 24/7: open senza close
    if (!p.close) {
      return { openNow: true, closesAt: null }
    }

    const closeDay = p.close.day
    const closeMin = (p.close.hour || 0) * 60 + (p.close.minute || 0)
    const closeStr = formatTime(p.close.hour, p.close.minute)

    // Periodo nello stesso giorno
    if (openDay === closeDay) {
      if (todayDow === openDay && nowHM >= openMin && nowHM < closeMin) {
        return { openNow: true, closesAt: closeStr }
      }
      continue
    }
    // Periodo che attraversa la mezzanotte (close.day != open.day, es. 22→02)
    // Siamo aperti se: oggi == openDay && ora >= openMin  OPPURE
    //                  oggi == closeDay && ora < closeMin
    if (todayDow === openDay && nowHM >= openMin) {
      return { openNow: true, closesAt: closeStr }
    }
    if (todayDow === closeDay && nowHM < closeMin) {
      return { openNow: true, closesAt: closeStr }
    }
  }

  return { openNow: false, closesAt: null }
}

export default function OrariLocale({ restaurant }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const hasVerifiedPlaceId = !!restaurant?.place_id && !!restaurant?.place_id_verified_at

  useEffect(() => {
    if (!restaurant?.id || !hasVerifiedPlaceId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/places-details?restaurantId=${restaurant.id}`)
        const json = await r.json()
        if (cancelled) return
        if (json.ok && json.data) setData(json.data)
        else setFailed(true)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [restaurant?.id, hasVerifiedPlaceId])

  // Se no place_id o API fallita, non mostrare nulla: il bottone "Chiama"
  // nella barra azioni del RestaurantSheet funziona già da fallback naturale.
  const showFallback = !hasVerifiedPlaceId || failed || (!loading && !data)
  if (showFallback) return null

  if (loading) {
    return (
      <div style={{
        height: 36, width: 120, background: 'rgba(0,0,0,0.06)',
        borderRadius: 10, animation: 'orariPulse 1.2s ease-in-out infinite',
      }}>
        <style>{`@keyframes orariPulse { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }`}</style>
      </div>
    )
  }

  const status = computeStatus(data)
  const byDay = periodsByDay(data?.regularOpeningHours?.periods)
  const weekdayLines = data?.regularOpeningHours?.weekdayDescriptions || []

  const statusLabel = status?.openNow
    ? (status.closesAt ? `Aperto · chiude alle ${status.closesAt}` : 'Aperto ora')
    : 'Chiuso ora'
  const statusColor = status?.openNow
    ? 'var(--color-success, #2e7d57)'
    : 'var(--color-secondary, #888)'
  const statusBg = status?.openNow
    ? 'rgba(46, 125, 87, 0.1)'
    : 'rgba(0, 0, 0, 0.04)'

  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: statusBg, border: 'none', cursor: 'pointer',
          color: statusColor, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
        }}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: status?.openNow ? '#2e7d57' : '#999',
          }} />
          {statusLabel}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div style={{
          marginTop: 6, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(0,0,0,0.02)', fontSize: 13, color: 'var(--color-primary, var(--color-ink))',
        }}>
          {weekdayLines.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {weekdayLines.map((line, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ITALIAN_DAYS_ORDER.map(dow => {
                const periods = byDay.get(dow) || []
                return (
                  <li key={dow} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontWeight: 600, width: 40 }}>{DAY_LABELS_SHORT[dow]}</span>
                    <span style={{ textAlign: 'right', flex: 1 }}>
                      {periods.length === 0 ? 'Chiuso' : periods.map(humanRange).join(' · ')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p style={{
            margin: '10px 0 0', fontSize: 11, color: 'var(--color-ink-55, rgba(34,24,28,.55))',
          }}>
            Fonte: Google Places
          </p>
        </div>
      )}
    </div>
  )
}
