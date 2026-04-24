import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { proxyImg } from '../../lib/supabase'
import SaveButton from './SaveButton'

// Mini card ristorante — stile live identico (foto 68px + nome + tagline + categoria + prezzo + distanza).
// Estratto 1:1 da HomePage.jsx (vincolo Augusto PR19: stile invariato).
export default function MiniCard({ restaurant, userPosition, discountTitle, saved, onSave, onClick, width = 260 }) {
  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))
  const category = categories[0]
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0] : null
  const photoUrl = proxyImg(firstPhoto
    ? typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null)
  const priceStr = restaurant.price_range != null ? '€'.repeat(restaurant.price_range) : null
  const distance = userPosition && restaurant.latitude && restaurant.longitude
    ? getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(restaurant)}
      className="flex-shrink-0"
      style={{
        width,
        scrollSnapAlign: 'start',
        borderRadius: 14,
        background: '#FAF7F2',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', gap: 10, padding: 10, position: 'relative' }}>
        <div style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          {photoUrl ? (
            <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {category?.emoji || '🍽️'}
            </div>
          )}
          {discountTitle && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--color-corallo)', color: '#fff',
              fontSize: 8, fontWeight: 700, textAlign: 'center',
              padding: '2px 0',
            }}>
              {discountTitle}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 20 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 800,
            fontSize: 15, letterSpacing: '-0.015em',
            color: 'var(--color-ink)',
            lineHeight: 1.15, marginBottom: 3,
            whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}>
            {restaurant.name}
          </div>
          {restaurant.tagline && (
            <div style={{ fontSize: 9, color: '#8A8680', fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {restaurant.tagline}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            {category && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                backgroundColor: `${category.color}20`,
                color: category.color,
                fontSize: 9, fontWeight: 600,
                padding: '1px 6px', borderRadius: 12,
                whiteSpace: 'nowrap',
              }}>
                {category.emoji} {category.name}
              </span>
            )}
            {priceStr && <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>{priceStr}</span>}
          </div>
          {distance != null && (
            <div style={{ fontSize: 10, color: '#8A8680', fontWeight: 500 }}>
              {formatDistance(distance)}
            </div>
          )}
        </div>
        {onSave && (
          <div style={{ position: 'absolute', top: 6, right: 6 }}>
            <SaveButton saved={saved} onClick={onSave} size="xs" />
          </div>
        )}
      </div>
    </div>
  )
}
