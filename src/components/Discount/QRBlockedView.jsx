import { useEffect } from 'react'
import {
  checkValidity,
  effectiveValidDays,
  todayDayOfWeek,
  formatDays,
  formatSlots,
  computeNextValidWindow,
  DAY_SHORT_LABELS,
} from '../../lib/validity'
import './QRBlockedView.css'

/**
 * Mostrata quando l'utente clicca "Apri QR" su uno sconto NON valido ora.
 * Sostituisce il popup QR normale finché lo status !== 'valid_now'.
 *
 * Spec: PR23 §3.4.
 */
export default function QRBlockedView({
  deal,
  photoUrl,
  restaurantName,
  restaurantSubtitle,
  discountValue,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const status = checkValidity(deal)
  const validDays = effectiveValidDays(deal)
  const today = todayDayOfWeek()
  const next = computeNextValidWindow(deal)

  const headline = (() => {
    if (status === 'valid_today_later') {
      const slots = Array.isArray(deal?.valid_meal_slots) ? deal.valid_meal_slots : []
      if (slots.length === 1) {
        const label = slots[0]
        return `Solo a ${label}`
      }
      return 'Più tardi oggi'
    }
    if (status === 'expired') return 'Drop scaduto'
    return 'Oggi non puoi usarlo'
  })()

  const description = (() => {
    if (status === 'valid_today_later') {
      return next ? `Si attiva ${next}.` : 'Si attiva più tardi oggi.'
    }
    if (status === 'expired') {
      return 'Questo vantaggio non è più disponibile.'
    }
    const days = formatDays(deal?.valid_days)
    const slotsText = formatSlots(deal?.valid_meal_slots)
    if (slotsText && slotsText !== 'Qualsiasi fascia') {
      return `Questo vantaggio è valido ${days.toLowerCase().includes('tutti') ? days.toLowerCase() : days}, fascia ${slotsText.toLowerCase()}.`
    }
    return `Questo vantaggio è valido ${days.toLowerCase().includes('tutti') ? days.toLowerCase() : days}.`
  })()

  const reminder = (() => {
    if (status === 'valid_today_later' && next) return `⏰ Te lo ricordo io ${next}`
    if (next) return `⏰ Te lo ricordo io ${next}`
    return null
  })()

  return (
    <div
      className="qrb-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sconto non valido oggi"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="qrb-sheet">
        <div className="qrb-grip" aria-hidden="true" />
        <button type="button" className="qrb-close" aria-label="Chiudi" onClick={onClose}>✕</button>

        <div className="qrb-body">
          {/* place mini */}
          <div className="qrb-place">
            {photoUrl && (
              <div className="qrb-thumb">
                <img src={photoUrl} alt="" loading="lazy" decoding="async" />
              </div>
            )}
            <div className="qrb-info">
              <h3>{restaurantName}</h3>
              {restaurantSubtitle && <div className="qrb-meta">{restaurantSubtitle}</div>}
            </div>
            {discountValue && <span className="qrb-pct">{discountValue}</span>}
          </div>

          {/* lock circle */}
          <div className="qrb-lock-circle" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </div>

          <h2 className="qrb-headline">{headline}</h2>
          <p className="qrb-desc">{description}</p>

          {/* day strip o countdown */}
          {status === 'valid_today_later' && next ? (
            <div className="qrb-countdown">{next}</div>
          ) : (
            <div className="qrb-day-strip" role="list">
              {DAY_SHORT_LABELS.map((lbl, idx) => {
                const dow = idx + 1
                const isOk = validDays.includes(dow)
                const isToday = dow === today
                const cls = ['qrb-day']
                if (isOk) cls.push('is-ok')
                if (isToday) cls.push('is-today')
                return (
                  <span key={idx} className={cls.join(' ')} role="listitem" aria-label={lbl}>
                    {lbl}
                  </span>
                )
              })}
            </div>
          )}

          {reminder && <div className="qrb-reminder">{reminder}</div>}
        </div>

        <div className="qrb-footer">
          <button type="button" className="qrb-cta" onClick={onClose}>
            Capito
          </button>
        </div>
      </div>
    </div>
  )
}
