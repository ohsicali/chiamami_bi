import './ScanResult.css'

function formatDiscountValue(discount) {
  if (!discount) return ''
  const v = String(discount.discount_value ?? '').trim()
  if (!v) return ''
  if (discount.discount_type === 'percentage') return v.includes('%') ? v : `${v}%`
  if (discount.discount_type === 'fixed') return v.includes('€') ? v : `€${v}`
  return v
}

/**
 * Schermata fullscreen ristoratore — codice già utilizzato. PR23 §6.3.
 * Sfondo grigio scuro gradient, cerchio con check, banner percentuale opacità 60%.
 */
export default function AlreadyUsedResult({ data, onReset }) {
  const value = formatDiscountValue(data?.discount)
  const usedAt = data?.redeemed_at
    ? new Date(data.redeemed_at).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="ris-scan-screen ris-used">
      <div className="ris-scan-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h1 className="ris-h1">Già utilizzato</h1>
      <p className="ris-desc">
        {usedAt
          ? `Questo codice è stato attivato il ${usedAt}`
          : 'Questo codice è già stato attivato.'}
      </p>

      {value && (
        <div className="ris-pct-banner is-faded">
          <div className="ris-pct-num">{value}</div>
          <div className="ris-pct-info">
            <strong>{data?.discount?.title || 'Bi Club'}</strong>
            {data?.user_name && <p>Cliente: {data.user_name}</p>}
          </div>
        </div>
      )}

      <button type="button" className="ris-cta" onClick={onReset}>
        Chiudi
      </button>
    </div>
  )
}
