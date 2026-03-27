import { motion } from 'framer-motion'
import { useState } from 'react'
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

/* ── Star SVG ── */
const StarIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#C4A265" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
  </svg>
)

/* ── Heart SVG ── */
const HeartIcon = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? '#E8453C' : 'none'}
    stroke={filled ? '#E8453C' : 'currentColor'}
    strokeWidth="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

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
    .filter(Boolean)
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

  // ============================================
  // HERO VARIANT — Featured card with large photo
  // ============================================
  if (variant === 'hero') {
    return (
      <motion.button
        className="w-full text-left relative overflow-hidden"
        style={{ borderRadius: 22, height: 200, border: 'none', padding: 0, display: 'block' }}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        custom={index}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClick?.(restaurant)}
      >
        {/* Background image */}
        <div className="absolute inset-0" style={{ background: '#2a1f18' }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={restaurant.name}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{
              fontSize: 56, opacity: 0.4,
              background: `linear-gradient(135deg, ${category?.color || '#8A8680'}33, ${category?.color || '#8A8680'}11)`,
            }}>
              {category?.emoji || '🍽️'}
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
          }} />
        </div>

        {/* Discount badge */}
        {hasDiscount && discountValue && (
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 3,
            background: '#E8453C', color: '#fff',
            fontSize: 11, fontWeight: 700,
            padding: '5px 12px', borderRadius: 10,
            boxShadow: '0 2px 10px rgba(232,69,60,0.4)',
          }}>
            -{discountValue}%
          </div>
        )}

        {/* Heart button */}
        {onSaveToggle && (
          <div
            onClick={(e) => { e.stopPropagation(); onSaveToggle() }}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 3,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
            }}
          >
            <HeartIcon filled={saved} size={18} />
          </div>
        )}

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 z-10" style={{ padding: 20 }}>
          {restaurant.our_rating >= 4.5 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#C4A265', color: '#fff',
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase',
              padding: '4px 10px', borderRadius: 6, marginBottom: 10,
            }}>
              <StarIcon size={10} />
              Consigliato da Bi
            </div>
          )}

          <div style={{
            fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
            fontSize: 26, fontWeight: 600, color: '#fff',
            lineHeight: 1.1, marginBottom: 6,
          }}>
            {restaurant.name}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 12, color: 'rgba(255,255,255,0.7)',
          }}>
            {restaurant.our_rating && (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#C4A265', fontWeight: 700 }}>
                  <StarIcon size={12} />
                  {restaurant.our_rating}
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
              </>
            )}
            {category && (
              <>
                <span>{category.name}</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
              </>
            )}
            {restaurant.price_range && (
              <span>{'€'.repeat(restaurant.price_range)}</span>
            )}
            {distance != null && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
                <span>{formatDistance(distance)}</span>
              </>
            )}
          </div>
        </div>
      </motion.button>
    )
  }

  // ============================================
  // DEFAULT VARIANT — Horizontal compact card
  // ============================================
  return (
    <motion.button
      className="flex w-full items-center text-left relative"
      style={{
        gap: 14, padding: 14,
        background: '#fff', borderRadius: 18,
        border: '1px solid rgba(0,0,0,0.04)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
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

        {/* Discount badge on image */}
        {hasDiscount && discountValue && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: '#E8453C', color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 6,
            boxShadow: '0 2px 6px rgba(232,69,60,0.3)',
          }}>
            -{discountValue}%
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Name */}
        <div style={{
          fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
          fontSize: 18, fontWeight: 600, color: '#111',
          lineHeight: 1.2, marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          paddingRight: 28,
        }}>
          {restaurant.name}
        </div>

        {/* Cuisine + description */}
        <div style={{
          fontSize: 12, color: '#8A8680', fontWeight: 500,
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {category?.name || restaurant.cuisine_type || 'Ristorante'}
          {restaurant.address && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {restaurant.address.split(',')[0]}
              </span>
            </>
          )}
        </div>

        {/* Bottom row: rating, distance, price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {restaurant.our_rating && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              background: '#FBF9F4', padding: '3px 8px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, color: '#111',
            }}>
              <StarIcon />
              {restaurant.our_rating}
            </div>
          )}
          {distance != null && (
            <div style={{
              fontSize: 11, color: '#8A8680', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
              {formatDistance(distance)}
            </div>
          )}
          {restaurant.price_range != null && (
            <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 'auto' }}>
              {[1, 2, 3].map(i => (
                <span key={i} style={{ color: i <= restaurant.price_range ? '#111' : '#D1CDC6' }}>€</span>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Heart */}
      {onSaveToggle && (
        <div
          onClick={(e) => { e.stopPropagation(); onSaveToggle() }}
          style={{
            position: 'absolute', right: 14, top: 14,
            color: saved ? '#E8453C' : '#D1CDC6',
            cursor: 'pointer', padding: 4,
          }}
        >
          <HeartIcon filled={saved} />
        </div>
      )}
    </motion.button>
  )
}
