import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import RatingStars from './RatingStars'
import { CUISINE_CATEGORIES } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'

const cardVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

function NearbyCard({ restaurant, index, onSelect }) {
  const category = CUISINE_CATEGORIES.find(
    (c) => (restaurant.category || []).includes(c.name) || c.name === restaurant.cuisine_type
  )

  const photoUrl =
    Array.isArray(restaurant.photos) && restaurant.photos.length > 0
      ? typeof restaurant.photos[0] === 'string'
        ? restaurant.photos[0]
        : restaurant.photos[0]?.photo_url
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
      <div className="relative h-24 w-full overflow-hidden bg-accent-light">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${restaurant.name}${restaurant.city ? ` - ${restaurant.city}` : ''}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            {category?.emoji || '🍽️'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2.5">
        <h4 className="truncate text-left text-sm font-semibold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
          {restaurant.name}
        </h4>
        {category && (
          <span
            className="text-left text-[11px] font-medium"
            style={{ color: category.color }}
          >
            {category.emoji} {category.name}
          </span>
        )}
        {restaurant.our_rating != null && (
          <div className="flex items-center gap-1">
            <RatingStars rating={restaurant.our_rating} size="sm" />
          </div>
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

  if (nearby.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-semibold text-primary">
        {t('restaurant.nearby')}
      </h3>

      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
        {nearby.map((restaurant, i) => (
          <NearbyCard
            key={restaurant.id}
            restaurant={restaurant}
            index={i}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
