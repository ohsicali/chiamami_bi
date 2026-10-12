import { useEffect, useState } from 'react'
import { claimTimeLeft, formatClaimDeadlineShort, formatClaimLeft } from '../../lib/dropClaim'
import './ClaimTimer.css'

/**
 * Il tempo per usare un drop preso (12/10): una barra che si svuota e il
 * conto alla rovescia che scende, secondo per secondo.
 *
 * Chi prende un drop ha 7 giorni per usarlo, dal tocco su "Sblocca"; poi il
 * posto passa al primo in lista d'attesa (src/lib/dropClaim.js). Questa è la
 * cosa che deve vedere ogni volta che riapre lo sconto: nella festa del drop
 * (`intro`: la barra si riempie e il tempo parte), nel foglio del QR e in
 * cima a «I miei vantaggi».
 *
 *   tone="coral"  su fondo corallo (festa, card del drop): bianco
 *   tone="light"  su fondo chiaro (foglio del QR): corallo
 *
 * Il colore è quello dei drop: il corallo vale solo per loro (CLAUDE.md,
 * "il colore dice il tipo di sconto"), e solo un drop ha i giorni contati.
 * Nelle ultime 24 ore la punta della barra pulsa e la scritta lo dice.
 */
export default function ClaimTimer({ redemption, deal = redemption?.discount, tone = 'light', intro = false, compact = false, className = '' }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // La festa: la barra parte vuota e si riempie, poi comincia a scendere.
  const [filled, setFilled] = useState(!intro)
  useEffect(() => {
    if (!intro) return undefined
    const t = setTimeout(() => setFilled(true), 350)
    return () => clearTimeout(t)
  }, [intro])

  const left = claimTimeLeft(redemption, deal, now)
  if (!left) return null

  const fraction = filled ? left.fraction : 0
  const words = formatClaimLeft(left.ms)
  const label = left.expired
    ? 'Tempo scaduto'
    : left.urgency === 'urgent'
      ? 'Ultime ore per usarlo'
      : 'Tempo per usarlo'
  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div
      className={`ct ct--${tone} ct--${left.urgency} ${compact ? 'ct--compact' : ''} ${intro ? 'ct--intro' : ''} ${className}`}
      role="group"
      aria-label={left.expired ? 'Tempo per usarlo scaduto' : `Ti restano ${words} per usarlo`}
    >
      <div className="ct-head">
        <span className="ct-label">
          <HourglassIcon />
          {label}
        </span>
        {!left.expired && (
          <span className="ct-count" aria-hidden="true">
            {left.days > 0 && <><b>{left.days}</b><small>g</small></>}
            <b>{pad(left.hours)}</b><small>h</small>
            <b>{pad(left.minutes)}</b><small>m</small>
            {!compact && <><b>{pad(left.seconds)}</b><small>s</small></>}
          </span>
        )}
      </div>
      <div
        className="ct-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left.fraction * 100)}
        aria-label="Tempo che resta"
      >
        <i className="ct-fill" style={{ transform: `scaleX(${fraction})` }} />
        <span className="ct-tip" style={{ left: `${fraction * 100}%` }} aria-hidden="true" />
      </div>
      {!compact && (
        <p className="ct-foot">
          {left.expired
            ? 'Il codice non vale più.'
            : <>Vale fino a <b>{formatClaimDeadlineShort(left.deadline)}</b></>}
        </p>
      )}
    </div>
  )
}

function HourglassIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
    </svg>
  )
}
