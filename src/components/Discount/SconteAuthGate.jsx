import { Link, useLocation } from 'react-router-dom'
import BiLogoMark from '../UI/BiLogoMark'
import { setPendingDiscountId } from '../../lib/utils/pendingDiscount'

/**
 * Il gate sullo sblocco di uno sconto.
 *
 * `returnTo` è la pagina da cui si arriva, non `/sconti` fisso: chi sta sulla
 * scheda di Bar Stampa e preme "Sblocca" deve tornare su Bar Stampa con lo
 * sconto già preso, non ritrovarsi nel catalogo a ricominciare la ricerca.
 * (Blocco 5, terza regola trasversale.)
 */
export default function SconteAuthGate({ pendingDiscountId, onClose }) {
  const location = useLocation()
  // Persist across OAuth/email-OTP redirects so we can auto-claim on return.
  if (pendingDiscountId) setPendingDiscountId(pendingDiscountId)
  const returnTo = `${location.pathname}${location.search}`

  return (
    <div
      className="sc-auth-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sc-auth-gate-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sc-auth-gate-card">
        <div className="sc-av-iconic">
          <BiLogoMark style={{ width: '88%', height: '88%' }} />
          <span aria-hidden="true">✦</span>
        </div>
        <h3 id="sc-auth-gate-title">Ci metti 20 secondi</h3>
        {/* Il beneficio concreto, non "registrati per continuare": si dice
            cosa si ottiene e cosa costa. */}
        <p>
          Gratis · poi mostri il QR al locale e paghi meno.
        </p>
        <Link
          to="/login"
          state={{ returnTo, pendingDiscountId, mode: 'register' }}
          className="sc-btn-primary"
        >
          Registrati gratis
        </Link>
        <Link
          to="/login"
          state={{ returnTo, pendingDiscountId }}
          className="sc-btn-secondary"
        >
          Ho già un account
        </Link>
        <button type="button" onClick={onClose} className="sc-btn-link">
          Annulla
        </button>
      </div>
    </div>
  )
}
