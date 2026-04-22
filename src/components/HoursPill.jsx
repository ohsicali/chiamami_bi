import { useState, useEffect, useMemo } from 'react'
import { getHoursStatus } from '../lib/hours'

// Color constants — match DesktopRestaurantSheet / RestaurantSheet tokens
const STYLES = {
  open: {
    background: 'linear-gradient(135deg, #A3E635, #4ADE80)',
    color: '#1a4731',
    dot: '#1a4731',
  },
  closing_soon: {
    background: 'var(--color-corallo-wash, #FDEDEB)',
    color: 'var(--color-corallo-ink, #C53A33)',
    dot: 'var(--color-corallo, #E8453C)',
  },
  closed: {
    background: 'var(--color-ink-05, rgba(34,24,28,.06))',
    color: 'var(--color-ink-70, rgba(34,24,28,.7))',
    dot: '#9a8e84',
  },
}

/**
 * HoursPill — compact open/closed status badge.
 *
 * Reads hours directly from restaurant.hours_cache (no API call).
 * Invisible when data is absent or malformed (state='unknown').
 * Re-evaluates every 60 s so the pill transitions live.
 *
 * @param {{ hours: object|null }} props - pass restaurant.hours_cache
 */
export default function HoursPill({ hours }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const status = useMemo(() => getHoursStatus(hours, now), [hours, now])

  if (status.state === 'unknown') return null

  const s = STYLES[status.state]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 14px',
      borderRadius: 999,
      fontFamily: 'var(--font-sans, "Poppins", sans-serif)',
      fontSize: 13,
      fontWeight: status.state === 'closing_soon' ? 800 : 700,
      letterSpacing: '-0.01em',
      background: s.background,
      color: s.color,
      transition: 'background 200ms ease',
      lineHeight: 1,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: s.dot,
        flexShrink: 0,
      }} />
      {status.message}
    </span>
  )
}
