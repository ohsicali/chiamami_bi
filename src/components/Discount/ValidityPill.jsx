import './ValidityPill.css'

/**
 * Pill validità — 3 stati colorati come da spec PR23 §2.2.
 *   - valid_now → verde con dot pulsante
 *   - valid_today_later → giallo
 *   - valid_other_day | expired | used → grigio
 */
export default function ValidityPill({ status, text, className = '' }) {
  const variant = (() => {
    if (status === 'valid_now') return 'ok'
    if (status === 'valid_today_later') return 'soon'
    return 'other'
  })()
  return (
    <span className={`vp-pill vp-${variant} ${className}`}>
      <span className="vp-dot" aria-hidden="true" />
      {text}
    </span>
  )
}
