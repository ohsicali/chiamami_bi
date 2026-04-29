import { DAY_SHORT_LABELS, formatDays, formatSlots } from '../../lib/validity'
import './InvalidNowResult.css'

/**
 * Schermata fullscreen ristoratore — sconto valido in altri giorni o fasce.
 * Sfondo rosso gradient. PR23 §6.2.
 */
export default function InvalidNowResult({ data, reason, onReset }) {
  const validDays = Array.isArray(data?.valid_days) && data.valid_days.length
    ? data.valid_days
    : [1, 2, 3, 4, 5, 6, 7]
  const today = data?.today_dow || 1
  const slots = Array.isArray(data?.valid_meal_slots) ? data.valid_meal_slots : []

  const headline = reason === 'valid_today_later'
    ? 'Non ancora valido'
    : 'Non valido oggi'

  const desc = (() => {
    if (reason === 'valid_today_later') {
      const slotText = slots.length ? formatSlots(slots).toLowerCase() : 'più tardi'
      if (data?.valid_time_from && data?.valid_time_to) {
        return `Si attiva ${slotText} (${data.valid_time_from.slice(0, 5)}–${data.valid_time_to.slice(0, 5)})`
      }
      return `Si attiva ${slotText}`
    }
    const daysText = formatDays(validDays).toLowerCase()
    const slotText = slots.length ? `, fascia ${formatSlots(slots).toLowerCase()}` : ''
    return `Si attiva ${daysText}${slotText}`
  })()

  const todayName = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'][today - 1] || ''
  const dateStr = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })

  return (
    <div className="ris-scan-screen ris-invalid">
      <div className="ris-scan-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </div>

      <h1 className="ris-h1">{headline}</h1>
      <p className="ris-desc">{desc}</p>

      {reason !== 'valid_today_later' && (
        <div className="ris-day-strip" role="list">
          {DAY_SHORT_LABELS.map((lbl, idx) => {
            const dow = idx + 1
            const isOk = validDays.includes(dow)
            const isToday = dow === today
            const cls = ['ris-day']
            if (isOk) cls.push('is-ok')
            if (isToday) cls.push('is-today')
            return <span key={idx} className={cls.join(' ')} role="listitem" aria-label={lbl}>{lbl}</span>
          })}
        </div>
      )}

      {data?.discount_value && (
        <div className="ris-meta-line">
          {data.discount_title || data.discount_value} · Tentato {todayName} {dateStr}
        </div>
      )}

      <button type="button" className="ris-cta" onClick={onReset}>Chiudi</button>
    </div>
  )
}
