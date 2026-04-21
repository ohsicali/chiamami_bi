/**
 * NearbySection — carosello ristoranti vicini (spec §10 VICINI).
 *
 * Card 220px fisse, foto aspect 16/10, discount badge verde top-left,
 * nome Poppins 800 17px ultra-tight, meta chip + prezzo.
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { getCategoryInfo, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { getDistance } from '../../lib/utils/distance'
import { proxyImg } from '../../lib/supabase'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

const cardVariants = {
  hidden: { opacity: 0, x: 24 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: Math.min(i * 0.08, 0.32),
      duration: 0.38,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

function NearbyCard({ restaurant, index, onSelect, discountBadge }) {
  const primaryType = (restaurant.category || [])[0] || restaurant.cuisine_type
  const category = primaryType ? getCategoryInfo(primaryType) : null
  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''

  const photoUrl = proxyImg(
    Array.isArray(restaurant.photos) && restaurant.photos.length > 0
      ? typeof restaurant.photos[0] === 'string'
        ? restaurant.photos[0]
        : restaurant.photos[0]?.thumb_url || restaurant.photos[0]?.photo_url
      : null
  )

  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(restaurant)}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      custom={index}
      whileTap={{ scale: 0.97 }}
      style={{
        flex: '0 0 220px',
        background: '#fff',
        border: '1px solid var(--color-ink-05, rgba(34,24,28,.06))',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
        textAlign: 'left',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Photo */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          background: '#ddd',
          overflow: 'hidden',
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${restaurant.name}${restaurant.city ? ` – ${restaurant.city}` : ''}`}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            display: 'grid', placeItems: 'center', width: '100%', height: '100%',
            fontSize: 28,
          }}>
            {category?.emoji || '🍽️'}
          </div>
        )}
        {/* Discount badge — verde gradient 135° (spec §10 .vdisc) */}
        {discountBadge && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            background: 'linear-gradient(135deg, var(--color-green-a, #A3E635), var(--color-green-b, #4ADE80))',
            color: 'var(--color-ink, #22181C)',
            fontWeight: 800, fontSize: 10,
            padding: '3px 7px', borderRadius: 999,
            letterSpacing: '-0.01em',
          }}>
            {discountBadge}
          </span>
        )}
      </div>

      {/* Body — Poppins 800 17px name (spec §10 .vname) */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 800, fontSize: 17,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: 'var(--color-ink, #22181C)',
        }}>
          {restaurant.name}
        </div>
        <div style={{
          marginTop: 4,
          display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
          fontSize: 11, color: 'var(--color-ink-70, rgba(34,24,28,.7))',
        }}>
          {category && (
            <span style={{
              background: 'var(--color-ink-05, rgba(34,24,28,.06))',
              color: 'var(--color-ink, #22181C)',
              fontWeight: 700, fontSize: 10,
              padding: '2px 6px', borderRadius: 999,
            }}>
              {category.emoji} {category.name}
            </span>
          )}
          {priceLabel && <span>{priceLabel}</span>}
        </div>
      </div>
    </motion.button>
  )
}

export default function NearbySection({
  currentRestaurant,
  allRestaurants = [],
  onSelect,
}) {
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const navigate = useNavigate()

  const nearby = useMemo(() => {
    if (
      !currentRestaurant ||
      !currentRestaurant.latitude ||
      !currentRestaurant.longitude
    )
      return []

    return allRestaurants
      .filter((r) => r.id !== currentRestaurant.id)
      .map((r) => ({
        ...r,
        _distance: getDistance(
          currentRestaurant.latitude,
          currentRestaurant.longitude,
          r.latitude,
          r.longitude
        ),
      }))
      .sort((a, b) => a._distance - b._distance)
      .slice(0, 4)
  }, [currentRestaurant, allRestaurants])

  if (nearby.length === 0) return null

  const totalCount = allRestaurants.length
  const neighborhood = currentRestaurant?.neighborhood || currentRestaurant?.city

  const badgeForRestaurant = (id) => {
    const d = activeDiscounts.find(x => x.restaurant_id === id)
    if (!d) return null
    return d.discount_value || d.title || null
  }

  return (
    <section
      className="rs-nearby"
      style={{
        padding: '4px 0 30px 0',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Head */}
      <div style={{
        padding: '0 22px 10px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900, fontSize: 18,
            letterSpacing: '-0.02em', lineHeight: 1.1,
            color: 'var(--color-ink, #22181C)',
            margin: 0,
          }}>
            Ristoranti vicini
          </h3>
          {neighborhood && (
            <div style={{
              fontSize: 11,
              color: 'var(--color-ink-70, rgba(34,24,28,.7))',
              marginTop: 2,
            }}>
              Altri consigli {neighborhood ? `a ${neighborhood}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Carosello */}
      <div
        className="scrollbar-none"
        style={{
          display: 'flex', gap: 10,
          overflowX: 'auto',
          padding: '0 16px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {nearby.map((restaurant, i) => (
          <NearbyCard
            key={restaurant.id}
            restaurant={restaurant}
            index={i}
            onSelect={onSelect}
            discountBadge={badgeForRestaurant(restaurant.id)}
          />
        ))}
        {/* "Altri locali" card */}
        <motion.button
          type="button"
          variants={cardVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-20px' }}
          custom={nearby.length}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/list')}
          style={{
            flex: '0 0 130px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8,
            background: 'var(--color-cream-deep, #F1EBE0)',
            border: '1px solid var(--color-ink-05, rgba(34,24,28,.06))',
            borderRadius: 14,
            padding: '16px 12px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-ink, #22181C)',
            textAlign: 'center',
          }}
        >
          <span style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#fff',
            border: '1px solid var(--color-ink-05, rgba(34,24,28,.06))',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Tutti i {totalCount}
          </span>
        </motion.button>
      </div>
    </section>
  )
}
