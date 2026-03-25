import { motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SaveButton from './SaveButton'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i * 0.04, 0.3),
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

export default function RestaurantCard({
  restaurant,
  index = 0,
  userPosition,
  onClick,
  saved,
  onSaveToggle,
  hasDiscount,
  discountValue,
}) {
  const { t } = useTranslation()
  const [imageLoaded, setImageLoaded] = useState(false)

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))
  const category = categories[0]

  const photos = Array.isArray(restaurant.photos) ? restaurant.photos : []
  const firstPhoto = photos.length > 0 ? photos[0] : null
  const photoUrl = firstPhoto
    ? typeof firstPhoto === 'string'
      ? firstPhoto
      : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null
  const photoCount = photos.length

  const distance =
    userPosition && restaurant.latitude && restaurant.longitude
      ? getDistance(
          userPosition.lat,
          userPosition.lng,
          restaurant.latitude,
          restaurant.longitude
        )
      : null

  return (
    <motion.button
      className="flex flex-col w-full rounded-2xl bg-card text-left shadow-sm overflow-hidden"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(restaurant)}
    >
      {/* Full-width photo — 160px height */}
      <div className="relative w-full" style={{ height: 160 }}>
        <div
          className="absolute inset-0"
          style={{ backgroundColor: category?.color ? `${category.color}15` : '#f3f4f6' }}
        />
        {photoUrl && (
          <img
            src={photoUrl}
            alt={`${restaurant.name}${restaurant.city ? ` - ${restaurant.city}` : ''}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
        {!photoUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            {category?.emoji || '🍽️'}
          </div>
        )}

        {/* Photo dot indicators */}
        {photoCount > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {photos.slice(0, Math.min(photoCount, 5)).map((_, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  background: i === 0 ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
        )}

        {/* Heart button — white circle, top right */}
        {onSaveToggle && (
          <div className="absolute top-2.5 right-2.5">
            <SaveButton saved={saved} onClick={onSaveToggle} size="sm" variant="white" />
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="flex flex-col gap-1 px-3 py-2.5">
        {/* Name + discount badge inline */}
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className="text-[15px] font-semibold text-primary leading-snug truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {restaurant.name}
          </h3>
          {hasDiscount && (
            <span className="flex-shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {discountValue || t('discount.badge')}
            </span>
          )}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {categories.map(cat => (
              <span
                key={cat.name}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: cat.color ? `${cat.color}15` : '#f3f4f6',
                  color: cat.color || '#888',
                }}
              >
                {cat.emoji} {cat.name}
              </span>
            ))}
            {restaurant.price_range != null && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: '#f3f4f6', color: '#888' }}
              >
                {PRICE_LABELS[restaurant.price_range] || ''}
              </span>
            )}
          </div>
        )}

        {/* Address + distance on same line */}
        {(restaurant.address || distance != null) && (
          <p className="truncate text-xs text-secondary/70">
            {restaurant.address}
            {restaurant.address && distance != null && ' · '}
            {distance != null && formatDistance(distance)}
          </p>
        )}
      </div>
    </motion.button>
  )
}
