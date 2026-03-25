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

  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0]
    : null
  const photoUrl = firstPhoto
    ? typeof firstPhoto === 'string'
      ? firstPhoto
      : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null

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
      className="flex w-full items-start gap-3 rounded-2xl bg-card p-2.5 text-left shadow-sm"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(restaurant)}
    >
      {/* Photo thumbnail */}
      <div className="relative h-[88px] w-[88px] flex-shrink-0 overflow-hidden rounded-xl">
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
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            {category?.emoji || '🍽️'}
          </div>
        )}
        {/* Discount badge on photo */}
        {hasDiscount && (
          <div className="absolute bottom-1.5 left-1.5 rounded-md bg-accent px-1.5 py-0.5 shadow-sm">
            <span className="text-[10px] font-bold text-white leading-none">
              {discountValue || t('discount.badge')}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        {/* Name */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <h3 className="text-[15px] font-semibold text-primary leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
            {restaurant.name}
          </h3>
          {onSaveToggle && (
            <div className="flex-shrink-0 -mt-0.5">
              <SaveButton saved={saved} onClick={onSaveToggle} size="sm" />
            </div>
          )}
        </div>

        {/* Category + price inline */}
        <div className="flex items-center gap-1 text-xs text-secondary">
          {category && (
            <span style={{ color: category.color }}>
              {category.emoji} {category.name}
            </span>
          )}
          {category && restaurant.price_range != null && <span>·</span>}
          {restaurant.price_range != null && (
            <span>{PRICE_LABELS[restaurant.price_range] || ''}</span>
          )}
        </div>

        {/* Address */}
        {restaurant.address && (
          <p className="truncate text-xs text-secondary/70 mt-0.5">
            {restaurant.address}
          </p>
        )}

        {/* Distance */}
        {distance != null && (
          <span className="text-xs text-secondary/70 mt-0.5">
            {formatDistance(distance)}
          </span>
        )}
      </div>
    </motion.button>
  )
}
