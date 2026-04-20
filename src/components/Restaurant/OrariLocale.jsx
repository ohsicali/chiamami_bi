/**
 * OrariLocale — card orari del locale (mockup v4-mobile-scheda §316-329).
 *
 * UI:
 *  - Card bianca con header: icona orologio + "Orari di apertura" + pill
 *    verde "Aperto ora" / grigia "Chiuso ora"
 *  - Subtitle: "Chiude alle HH:MM"
 *  - Griglia giorni compattata; oggi evidenziato in corallo
 *
 * Data via useOrariStatus (compute local, no stale cache).
 * Fallback: se no place_id verificato o API ko, nessuna card.
 */
import { useOrariStatus } from '../../lib/hooks/useOrariStatus'

const DAY_LABELS_SHORT = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab',
}
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function formatTime(hour, minute) {
  const h = String(hour ?? 0).padStart(2, '0')
  const m = String(minute ?? 0).padStart(2, '0')
  return `${h}:${m}`
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function periodsLabel(periods) {
  if (!periods || periods.length === 0) return null
  return periods
    .filter(p => p.open && p.close)
    .map(p => `${formatTime(p.open.hour, p.open.minute)}–${formatTime(p.close.hour, p.close.minute)}`)
    .join(' · ')
}

export default function OrariLocale({ restaurant }) {
  const { data, status, loading, failed, hasVerified } = useOrariStatus(restaurant)

  if (!hasVerified || failed || (!loading && !data)) return null

  if (loading) {
    return (
      <div style={{
        height: 52, background: 'rgba(0,0,0,0.04)',
        borderRadius: 14, animation: 'orariPulse 1.2s ease-in-out infinite',
      }}>
        <style>{`@keyframes orariPulse { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }`}</style>
      </div>
    )
  }

  const periods = data?.regularOpeningHours?.periods || []
  const todayDow = new Date().getDay()

  // Raggruppa periodi per giorno (apertura/chiusura multipli nel giorno)
  const byDay = new Map()
  for (const p of periods) {
    const d = p.open?.day
    if (d == null) continue
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d).push(p)
  }

  const openNow = status?.openNow === true
  const closesAt = status?.closesAt

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-ink-05, rgba(34,24,28,.06))',
      borderRadius: 14,
      padding: '12px 14px',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: closesAt ? 2 : 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-ink)' }}>
          <ClockIcon />
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em' }}>
            Orari di apertura
          </span>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 12, fontWeight: 800,
          color: openNow ? '#2E7D5B' : 'var(--color-ink-55, rgba(34,24,28,.55))',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: openNow ? '#2E7D5B' : '#9a8e84',
          }} />
          {openNow ? 'Aperto ora' : 'Chiuso ora'}
        </span>
      </div>

      {closesAt && (
        <div style={{
          fontSize: 11.5, color: 'var(--color-ink-70, rgba(34,24,28,.7))',
          marginBottom: 10, fontWeight: 500,
        }}>
          {openNow ? `Chiude alle ${closesAt}` : null}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', fontSize: 12 }}>
        {DAY_ORDER.map(dow => {
          const dayPeriods = byDay.get(dow) || []
          const isToday = dow === todayDow
          const label = dayPeriods.length === 0 ? 'Chiuso' : periodsLabel(dayPeriods)
          const dayName = DAY_LABELS_SHORT[dow] + (isToday ? ' (oggi)' : '')
          return (
            <div key={dow} style={{ display: 'contents' }}>
              <span style={{
                color: isToday ? 'var(--color-corallo-ink, #C6372F)' : 'var(--color-ink-70)',
                fontWeight: isToday ? 800 : 600,
              }}>
                {dayName}
              </span>
              <span style={{
                textAlign: 'right',
                color: isToday
                  ? 'var(--color-corallo-ink, #C6372F)'
                  : (dayPeriods.length === 0 ? 'var(--color-ink-40)' : 'var(--color-ink)'),
                fontWeight: isToday ? 800 : (dayPeriods.length === 0 ? 600 : 700),
              }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <p style={{
        marginTop: 10, fontSize: 10.5,
        color: 'var(--color-ink-55, rgba(34,24,28,.55))',
      }}>
        Fonte: Google Places
      </p>
    </div>
  )
}
