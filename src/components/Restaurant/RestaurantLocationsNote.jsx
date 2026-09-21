import { getAllLocations, hasMultipleLocations, locationMapsUrl, defaultLocationLabel } from '../../lib/utils/restaurantLocations'
import { formatAddress } from '../../lib/utils/formatAddress'
import './RestaurantLocationsNote.css'

/**
 * "N sedi — lo sconto vale in entrambe" sulla scheda del locale. Compare
 * solo se `restaurant.locations` (sedi extra oltre a quella principale) non
 * è vuoto. Stesso componente per mobile (RestaurantSheet) e desktop
 * (DesktopRestaurantSheet) così le due schede non possono raccontare due
 * liste di sedi diverse.
 */
export default function RestaurantLocationsNote({ restaurant }) {
  if (!hasMultipleLocations(restaurant)) return null
  const locations = getAllLocations(restaurant)

  return (
    <div className="rln">
      <div className="rln-eyebrow">
        <PinIcon size={11} />
        <span>{locations.length} sedi — lo sconto vale in entrambe</span>
      </div>
      <div className="rln-list">
        {locations.map((loc, i) => {
          const addr = formatAddress(loc.address) || loc.address
          const url = locationMapsUrl(loc)
          const label = loc.label || defaultLocationLabel(i)
          const Row = url ? 'a' : 'div'
          return (
            <Row
              key={loc.id || i}
              className="rln-row"
              {...(url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <span className="rln-badge" aria-hidden="true">{i + 1}</span>
              <span className="rln-info">
                <span className="rln-label">{label}</span>
                <span className="rln-addr">{addr}</span>
              </span>
              {url && <GoIcon className="rln-go" />}
            </Row>
          )
        })}
      </div>
    </div>
  )
}

function PinIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function GoIcon({ className }) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H9M17 7V15" />
    </svg>
  )
}
