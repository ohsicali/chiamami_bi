import { motion } from 'framer-motion'
import { useState } from 'react'
import Badge from '../UI/Badge'
import { CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
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
}) {
  const [imageLoaded, setImageLoaded] = useState(false)

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => CUISINE_CATEGORIES.find(c => c.name === name))
    .filter(Boolean)
  const category = categories[0]

  const photoUrl =
    Array.isArray(restaurant.photos) && restaurant.photos.length > 0
      ? typeof restaurant.photos[0] === 'string'
        ? restaurant.photos[0]
        : restaurant.photos[0]?.photo_url
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
      className="flex w-full items-center gap-3.5 rounded-2xl bg-card p-3 text-left shadow-sm transition-shadow"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{
        y: -4,
        boxShadow:
          '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick?.(restaurant)}
    >
      {/* Photo thumbnail */}
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-accent-light">
        {/* Placeholder color */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: category?.color ? `${category.color}20` : '#f3f4f6' }}
        />
        {photoUrl && (
          <img
            src={photoUrl}
            alt={restaurant.name}
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
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Name */}
        <h3 className="truncate text-base font-semibold text-primary" style={{ fontFamily: "'TAN Songbird', serif", lineHeight: 1.4, paddingTop: 2 }}>
          {restaurant.name}
        </h3>

        {/* Category badges + price */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => (
            <Badge key={cat.name} color={cat.color} className="text-[11px]">
              {cat.emoji} {cat.name}
            </Badge>
          ))}
          {restaurant.price_range != null && (
            <span className="text-xs font-medium text-secondary">
              {PRICE_LABELS[restaurant.price_range] || ''}
            </span>
          )}
        </div>

        {/* Distance */}
        {distance != null && (
          <span className="text-xs text-secondary">
            {formatDistance(distance)}
          </span>
        )}

        {/* Address */}
        {restaurant.address && (
          <p className="truncate text-xs text-secondary">
            {restaurant.address}
          </p>
        )}
      </div>
    </motion.button>
  )
}
