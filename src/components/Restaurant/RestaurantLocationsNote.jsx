import {
  getAllLocations,
  hasMultipleLocations,
  locationMapsUrl,
  locationName,
  locationStreet,
  locationsArea,
} from '../../lib/utils/restaurantLocations'
import './RestaurantLocationsNote.css'

/**
 * Le sedi del locale sulla scheda: "Le 4 sedi di Taco Bang a Torino e
 * dintorni", una riga per sede che apre Google Maps su quella sede.
 * Compare solo se `restaurant.locations` (sedi extra oltre a quella
 * principale) non è vuoto. Stesso componente per mobile (RestaurantSheet) e
 * desktop (DesktopRestaurantSheet) così le due schede non possono raccontare
 * due liste di sedi diverse.
 *
 * Qui non si parla di sconti (13/10): prima diceva "lo sconto vale in
 * entrambe" anche su Taco Bang, che uno sconto non l'aveva ancora. In quali
 * sedi vale uno sconto lo dice lo sconto (`discounts.valid_location_ids`,
 * blocco "Dove vale" di DiscountRules).
 */
export default function RestaurantLocationsNote({ restaurant }) {
  if (!hasMultipleLocations(restaurant)) return null
  const locations = getAllLocations(restaurant)
  const area = locationsArea(locations, restaurant.city)

  return (
    <section className="rln" aria-labelledby={`rln-title-${restaurant.id || 'r'}`}>
      <header className="rln-head">
        <span className="rln-head-icon" aria-hidden="true"><PinIcon size={16} /></span>
        <div className="rln-head-txt">
          <h3 className="rln-title" id={`rln-title-${restaurant.id || 'r'}`}>
            Le {locations.length} sedi{area ? ` ${area}` : ''}
          </h3>
          <p className="rln-sub">Tocca una sede per aprirla in Google Maps</p>
        </div>
      </header>
      <ul className="rln-list">
        {locations.map((loc, i) => {
          const addr = locationStreet(loc.address, restaurant.city)
          const url = locationMapsUrl(loc, restaurant.name)
          const name = locationName(loc, i)
          const inner = (
            <>
              <span className="rln-badge" aria-hidden="true">{i + 1}</span>
              <span className="rln-info">
                <span className="rln-label">{name}</span>
                {addr && <span className="rln-addr">{addr}</span>}
              </span>
              {url && (
                <span className="rln-go" aria-hidden="true">
                  <MapIcon /> Mappa
                </span>
              )}
            </>
          )
          return (
            <li key={loc.id || i}>
              {url ? (
                <a
                  className="rln-row"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${restaurant.name} ${name}: apri in Google Maps`}
                >
                  {inner}
                </a>
              ) : (
                <div className="rln-row">{inner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
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

function MapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-8-8 18-2-8-8-2z" />
    </svg>
  )
}
