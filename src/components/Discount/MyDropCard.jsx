import { proxyImg } from '../../lib/supabase'
import { formatDiscountBadge, pickPerk } from '../../lib/utils/discountFormat'
import { claimTimeLeft, formatClaimDeadlineShort } from '../../lib/dropClaim'
import ClaimTimer from './ClaimTimer'
import './MyDropCard.css'

function firstPhoto(r) {
  const photos = Array.isArray(r?.photos) ? [...r.photos] : []
  photos.sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
  const p = photos[0]
  return proxyImg(p?.thumb_url || p?.photo_url || null, { w: 300 })
}

/**
 * Un drop preso coi giorni contati, in cima a «I miei vantaggi» (12/10).
 *
 * Deciso dal proprietario: "il drop va in cima, con un colore diverso, più
 * in evidenza, e fa vedere quanto manca per usarlo". Corallo pieno, perché
 * è un drop (il corallo vale solo per loro), con la barra del tempo che si
 * svuota e il bottone del QR. Le convenzioni e i drop di prima restano le
 * card di sempre, sotto.
 */
export default function MyDropCard({ redemption, onOpenQR }) {
  const deal = redemption?.discount
  if (!deal) return null
  const r = deal.restaurant || {}
  const badge = formatDiscountBadge(deal)
  const perk = pickPerk(deal)
  const photo = firstPhoto(r)
  const left = claimTimeLeft(redemption, deal)
  const urgent = left?.urgency === 'urgent'

  return (
    <article className={`mdc ${urgent ? 'mdc--urgent' : ''}`} aria-label={`Il tuo drop da ${r.name || deal.title}`}>
      <div className="mdc-top">
        <div className="mdc-ph" aria-hidden="true">
          {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <span>🍽️</span>}
        </div>
        <div className="mdc-id">
          <span className="mdc-tag"><i aria-hidden="true" />Il tuo drop</span>
          <h4>{r.name || deal.title}</h4>
          {perk && <p>{perk}</p>}
        </div>
        {badge && <span className="mdc-badge">{badge}</span>}
      </div>

      <ClaimTimer redemption={redemption} deal={deal} tone="coral" />

      <div className="mdc-actions">
        <button type="button" className="mdc-qr" onClick={() => onOpenQR?.(redemption)}>
          <QRIcon />Apri il QR
        </button>
        {left?.deadline && (
          <span className="mdc-note">
            {urgent ? 'Ultimo giorno: usalo entro ' : 'Se non lo usi entro '}
            {formatClaimDeadlineShort(left.deadline)}
            {urgent ? '' : ' passa al primo in lista'}
          </span>
        )}
      </div>
    </article>
  )
}

function QRIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
    </svg>
  )
}
