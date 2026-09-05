import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { DUR, EASE_OUT, staggerDelay } from '../../lib/motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getCategoryInfo, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { proxyImg } from '../../lib/supabase'
import SmartImage from '../UI/SmartImage'

// Era 450ms con 100ms di stagger senza tetto: la sesta card entrava
// mezzo secondo dopo che l'utente aveva già iniziato a scorrere. Ora
// 280ms, 50ms di sfalsamento e il ritardo si ferma a 240ms. La curva
// era easeInOutQuad — una ease-in-out su un'entrata; ora ease-out.
const cardVariants = {
  hidden: { opacity: 0, x: 24 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: staggerDelay(i),
      duration: DUR.reveal,
      ease: EASE_OUT,
    },
  }),
}

function NearbyCard({ restaurant, index, onSelect }) {
  const primaryType = (restaurant.category || [])[0] || restaurant.cuisine_type
  const category = primaryType ? getCategoryInfo(primaryType) : null
  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''

  const photoUrl = proxyImg(
    Array.isArray(restaurant.photos) && restaurant.photos.length > 0
      ? typeof restaurant.photos[0] === 'string'
        ? restaurant.photos[0]
        : restaurant.photos[0]?.thumb_url || restaurant.photos[0]?.photo_url
      : null,
    { w: 400 }
  )

  // Short description: first ~60 chars of our_review
  const shortDesc = restaurant.our_review
    ? restaurant.our_review.length > 60
      ? restaurant.our_review.slice(0, 60).trimEnd() + '…'
      : restaurant.our_review
    : null

  return (
    <motion.button
      className="flex w-40 flex-shrink-0 flex-col overflow-hidden rounded-2xl bg-card shadow-sm"
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      custom={index}
      whileTap={{ scale: 0.96 }}
      onClick={() => onSelect?.(restaurant)}
    >
      {/* Photo */}
      <SmartImage
        className="relative h-24 w-full overflow-hidden bg-accent-light"
        src={photoUrl}
        alt={`${restaurant.name}${restaurant.city ? ` - ${restaurant.city}` : ''}`}
        emoji={category?.emoji || '🍽️'}
        gradient={category?.color ? `linear-gradient(135deg, ${category.color}55, ${category.color}22)` : undefined}
        fallbackFontSize="1.6em"
      />

      {/* Info */}
      <div className="flex flex-col gap-1 p-2.5 flex-1">
        <h4 className="text-left text-xs font-semibold text-primary mb-auto" style={{ fontFamily: "var(--font-sans)", fontWeight: 800, lineHeight: 1.5 }}>
          {restaurant.name}
        </h4>
        {(category || priceLabel) && (
          <div className="flex items-center gap-1 flex-wrap">
            {category && (
              <span
                className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                style={{ color: category.color, border: `1px solid ${category.color}` }}
              >
                {category.emoji} {category.name}
              </span>
            )}
            {priceLabel && (
              <span className="text-[10px] font-medium text-secondary">{priceLabel}</span>
            )}
          </div>
        )}
        {shortDesc && (
          <p className="text-left text-[11px] text-secondary leading-tight mt-0.5" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {shortDesc}
          </p>
        )}
      </div>
    </motion.button>
  )
}

export default function NearbySection({
  currentRestaurant,
  allRestaurants = [],
  onSelect,
}) {
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

  const { t } = useTranslation()
  const navigate = useNavigate()

  if (nearby.length === 0) return null

  const totalCount = allRestaurants.length

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-semibold text-primary">
        {t('restaurant.nearby')}
      </h3>

      <div className="-mx-5 flex items-stretch gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
        {nearby.map((restaurant, i) => (
          <NearbyCard
            key={restaurant.id}
            restaurant={restaurant}
            index={i}
            onSelect={onSelect}
          />
        ))}
        {/* "More" card */}
        <motion.button
          className="flex w-20 flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl"
          variants={cardVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-20px' }}
          custom={nearby.length}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/list')}
          style={{
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: 'none',
            gap: 6, marginRight: 4,
          }}
        >
          <span style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 }}>
            {totalCount} locali
          </span>
        </motion.button>
      </div>
    </div>
  )
}
