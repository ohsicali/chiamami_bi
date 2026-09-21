import { getAllLocations, hasMultipleLocations, locationMapsUrl } from '../../lib/utils/restaurantLocations'
import { formatAddress } from '../../lib/utils/formatAddress'

/**
 * "Questo locale ha 2 sedi" — compare solo se `restaurant.locations` (sedi
 * extra oltre a quella principale) non è vuoto. Stesso componente per
 * mobile (RestaurantSheet, centrato) e desktop (DesktopRestaurantSheet,
 * allineato a sinistra) così le due schede non possono raccontare due sedi
 * diverse.
 */
export default function RestaurantLocationsNote({ restaurant, align = 'center' }) {
  if (!hasMultipleLocations(restaurant)) return null
  const locations = getAllLocations(restaurant)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        textAlign: align,
        alignItems: align === 'center' ? 'center' : 'flex-start',
        background: 'rgba(232,69,60,0.06)',
        border: '1px solid rgba(232,69,60,0.18)',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 12.5,
        color: 'var(--color-ink-70, rgba(34,24,28,.7))',
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--color-corallo-ink, #C23A32)' }}>
        📍 Questo locale ha {locations.length} sedi — lo sconto vale in entrambe
      </div>
      {locations.map((loc, i) => {
        const addr = formatAddress(loc.address) || loc.address
        const url = locationMapsUrl(loc)
        const label = loc.label || `Sede ${i + 1}`
        return (
          <div key={loc.id || i}>
            <b>{label}:</b>{' '}
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                {addr}
              </a>
            ) : (
              addr
            )}
          </div>
        )
      })}
    </div>
  )
}
