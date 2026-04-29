import { useEffect, useState } from 'react'
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
 * Schermata fullscreen ristoratore — sconto attivato. PR23 §6.1.
 * Sfondo verde gradient, cerchio bianco semi-trasparente con check + pulse-ring,
 * banner percentuale con info cliente, CTA "Scansiona il prossimo".
 */
export default function SuccessResult({ data, onReset }) {
  const [phase, setPhase] = useState('burst')
  useEffect(() => {
    const t = setTimeout(() => setPhase('settled'), 1200)
    return () => clearTimeout(t)
  }, [])

  const value = formatDiscountValue(data?.discount)
  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long',
  })

  return (
    <div className="ris-scan-screen ris-success">
      <div className={`ris-scan-icon ${phase === 'burst' ? 'is-pulse' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path className="ris-check-path" d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h1 className="ris-h1">Sconto attivato</h1>
      <p className="ris-desc">Applica il vantaggio al conto del cliente</p>

      {value && (
        <div className="ris-pct-banner">
          <div className="ris-pct-num">{value}</div>
          <div className="ris-pct-info">
            <strong>{data?.discount?.title || 'Bi Club'}</strong>
            <p>{data?.user_name ? `Cliente: ${data.user_name} · ${dateStr}` : dateStr}</p>
          </div>
        </div>
      )}

      <button type="button" className="ris-cta" onClick={onReset}>
        Scansiona il prossimo →
      </button>
    </div>
  )
}
