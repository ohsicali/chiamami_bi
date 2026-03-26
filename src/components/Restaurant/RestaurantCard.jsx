import { motion } from 'framer-motion'
import { useState } from 'react'
import SaveButton from './SaveButton'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i * 0.05, 0.3),
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
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
  variant = 'default', // 'default' | 'hero'
}) {
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
      ? getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude)
      : null

  const priceStr = restaurant.price_range != null
    ? '€'.repeat(restaurant.price_range + 1)
    : null

  // HERO VARIANT — dark featured card
  if (variant === 'hero') {
    return (
      <motion.button
        className="w-full text-left relative overflow-hidden"
        style={{ borderRadius: 22, height: 200 }}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        custom={index}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClick?.(restaurant)}
      >
        {/* Background */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a1510, #2a1f18, #111)' }}>
          {photoUrl && (
            <img
              src={photoUrl}
              alt={restaurant.name}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-40' : 'opacity-0'}`}
            />
          )}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
          }} />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(232,69,60,0.12), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(196,162,101,0.1), transparent 50%)',
          }} />
        </div>

        {/* Save button */}
        {onSaveToggle && (
          <div className="absolute top-4 right-4 z-10">
            <SaveButton saved={saved} onClick={onSaveToggle} size="sm" dark />
          </div>
        )}

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-2">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#C4A265', color: '#fff',
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 6,
            marginBottom: 10,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
            In evidenza
          </div>

          <div className="flex items-baseline gap-2.5 flex-wrap" style={{ marginBottom: 6 }}>
            <h3 style={{
              fontFamily: "'TAN Songbird', 'Cormorant Garamond', serif",
              fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.35,
            }}>
              {restaurant.name}
            </h3>
            {hasDiscount && discountValue && (
              <span style={{
                background: '#E8453C', color: '#fff',
                fontSize: 12, fontWeight: 700,
                padding: '3px 10px', borderRadius: 8,
                whiteSpace: 'nowrap',
              }}>
                {discountValue}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {category && <span>{category.name}</span>}
            {priceStr && <><span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} /><span>{priceStr}</span></>}
            {distance != null && <><span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} /><span>{formatDistance(distance)}</span></>}
          </div>
        </div>
      </motion.button>
    )
  }

  // DEFAULT VARIANT — horizontal compact card
  return (
    <motion.button
      className="flex w-full items-center gap-3.5 text-left relative"
      style={{
        padding: 14,
        background: '#fff',
        borderRadius: 18,
        border: '1px solid rgba(0,0,0,0.04)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(restaurant)}
    >
      {/* Photo */}
      <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 88, height: 88, borderRadius: 14 }}>
        <div
          className="absolute inset-0"
          style={{ background: category?.color ? `linear-gradient(135deg, ${category.color}40, ${category.color}20)` : 'linear-gradient(135deg, #e8d5c0, #d4c0a8)' }}
        />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={restaurant.name}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 32, opacity: 0.6 }}>
            {category?.emoji || '🍽️'}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Name + discount */}
        <div className="flex items-baseline gap-2" style={{ marginBottom: 3 }}>
          <h3 style={{
            fontFamily: "'TAN Songbird', 'Cormorant Garamond', serif",
            fontSize: 15, fontWeight: 600, color: '#111',
            lineHeight: 1.4,
          }}>
            {restaurant.name}
          </h3>
          {hasDiscount && discountValue && (
            <span style={{
              background: 'rgba(232,69,60,0.1)', color: '#E8453C',
              fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 6,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {discountValue}
            </span>
          )}
        </div>

        {/* Cuisine */}
        <div style={{ fontSize: 12, color: '#8A8680', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          {category && <span>{category.name}</span>}
          {restaurant.recommended_for && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />
              <span>{restaurant.recommended_for}</span>
            </>
          )}
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {distance != null && (
            <span style={{ fontSize: 11, color: '#8A8680', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
              {formatDistance(distance)}
            </span>
          )}
          {priceStr && (
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
              {priceStr.split('').map((c, i) => (
                <span key={i} style={{ color: i < (restaurant.price_range + 1) ? '#111' : '#ccc' }}>€</span>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Save heart */}
      {onSaveToggle && (
        <div className="absolute top-3.5 right-3.5">
          <SaveButton saved={saved} onClick={onSaveToggle} size="sm" />
        </div>
      )}
    </motion.button>
  )
}
