import { useEffect, useRef, useState } from 'react'
import { formatShortCode, isShortCode, normalizeShortCode } from '../../lib/shortCode'
import './ShortCodeCard.css'

/**
 * Il codice da dettare, sotto il QR.
 *
 * Sta sotto e non accanto al QR di proposito: il QR resta la strada
 * principale, questo è quello che si guarda quando la fotocamera non ne
 * vuole sapere. Le sei caselle separate servono a chi legge (non si perde
 * il segno a metà) e a chi ascolta dall'altra parte del bancone; la prima
 * è colorata perché è l'unica lettera, e si vede da che verso si legge.
 */
export default function ShortCodeCard({
  code,
  tone = 'light',
  divider = true,
  // `compact`: dentro il tagliando di QRPass — caselle più basse, niente
  // riga di spiegazione (la dice già l'etichetta).
  compact = false,
  label = 'Detta questo codice',
}) {
  const normalized = normalizeShortCode(code)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Niente codice, o un codice che non ha la forma giusta: meglio non
  // mostrare niente che sei caselle con dentro qualcosa che il ristoratore
  // digiterebbe a vuoto. Il QR sopra continua a funzionare.
  if (!isShortCode(normalized)) return null

  const chars = normalized.split('')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(normalized)
    } catch {
      // Safari fuori da HTTPS, permessi negati, webview strane: il codice è
      // comunque già leggibile a schermo, che è il punto. Mostriamo lo
      // stesso il riscontro invece di un errore che non aiuta nessuno.
    }
    setCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`shortcode-card shortcode-${tone} ${compact ? 'is-compact' : ''}`}>
      {divider && (
        <div className="shortcode-or" aria-hidden="true">
          <span>oppure</span>
        </div>
      )}

      <div className="shortcode-label">{label}</div>

      <div className="shortcode-digits">
        {/* Le caselle sono decorazione: allo screen reader diamo il codice
            una volta sola e scandito, non sei caratteri sciolti. */}
        <span className="shortcode-sr">Codice sconto: {chars.join(' ')}</span>
        {chars.map((c, i) => (
          <span
            key={i}
            className={`shortcode-cell ${i === 0 ? 'is-letter' : ''}`}
            aria-hidden="true"
          >
            {c}
          </span>
        ))}
      </div>

      <button
        type="button"
        className={`shortcode-copy ${copied ? 'is-copied' : ''}`}
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            Copiato
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
            Copia {formatShortCode(normalized)}
          </>
        )}
      </button>

      {!compact && (
        <p className="shortcode-hint">
          Il ristoratore può digitarlo al posto di scansionare il QR.
        </p>
      )}
    </div>
  )
}
