import { Link } from 'react-router-dom'
import BiLogoMark from '../UI/BiLogoMark'
import { setPendingDiscountId } from '../../lib/utils/pendingDiscount'

export default function SconteAuthGate({ pendingDiscountId, onClose }) {
  // Persist across OAuth/email-OTP redirects so we can auto-claim on return.
  if (pendingDiscountId) setPendingDiscountId(pendingDiscountId)
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
        <h3 id="sc-auth-gate-title">Entra nel Club di Bi per prenderlo</h3>
        <p>
          Per salvare il vantaggio e mostrarlo al ristoratore con il QR,
          ho bisogno che tu acceda. Ci metti 30 secondi.
        </p>
        <Link
          to="/login"
          state={{ returnTo: '/sconti', pendingDiscountId }}
          className="sc-btn-primary"
        >
          Accedi
        </Link>
        <Link
          to="/login"
          state={{ returnTo: '/sconti', pendingDiscountId, mode: 'register' }}
          className="sc-btn-secondary"
        >
          Registrati gratis
        </Link>
        <button type="button" onClick={onClose} className="sc-btn-link">
          Annulla
        </button>
      </div>
    </div>
  )
}
