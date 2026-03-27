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

        {/* Top left badges: In evidenza + Discount */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#C4A265', color: '#fff',
            fontSize: 11, fontWeight: 700, letterSpacing: 1,
            textTransform: 'uppercase',
            padding: '5px 12px', borderRadius: 10,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
            In evidenza
          </div>
          {hasDiscount && discountValue && (
            <div style={{
              background: '#E8453C', color: '#fff',
              fontSize: 11, fontWeight: 700,
              padding: '5px 12px', borderRadius: 10,
              boxShadow: '0 2px 10px rgba(232,69,60,0.4)',
            }}>
              -{discountValue}%
            </div>
          )}
        </div>

        {/* Heart — top right, glassmorphic with white border */}
        {onSaveToggle && (
          <div
            className="absolute z-10"
            style={{ top: 16, right: 16 }}
            onClick={(e) => { e.stopPropagation(); onSaveToggle() }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid rgba(255,255,255,0.25)',
              cursor: 'pointer',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill={saved ? '#E8453C' : 'none'}
                stroke={saved ? '#E8453C' : '#fff'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
          </div>
        )}

        {/* Content — bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-2">
          {/* Name */}
          <h3 style={{
            fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
            fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.5,
            marginBottom: restaurant.tagline ? 4 : 8,
          }}>
            {restaurant.name}
          </h3>

          {/* Tagline */}
          {restaurant.tagline && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginBottom: 8 }}>
              {restaurant.tagline}
            </p>
          )}

          {/* Info row: category colored · recommended_for · price · distance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)', flexWrap: 'wrap' }}>
            {category && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: `${category.color}30`,
                color: '#fff', fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 20,
              }}>
                {category.emoji} {category.name}
              </span>
            )}
            {restaurant.recommended_for?.length > 0 && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                <span>{restaurant.recommended_for[0]}</span>
              </>
            )}
            {priceStr && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                <span>{priceStr}</span>
              </>
            )}
            {distance != null && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                <span>{formatDistance(distance)}</span>
              </>
            )}
          </div>
        </div>
      </motion.button>
    )
  }

  // DEFAULT VARIANT — horizontal compact card
  return (
    <motion.button
      className="flex w-full items-start gap-3.5 text-left relative"
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
      <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 100, height: 100, borderRadius: 14 }}>
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
      <div className="flex-1 min-w-0 flex flex-col" style={{ paddingTop: 2 }}>
        {/* Name + discount */}
        <div className="flex items-baseline gap-2" style={{ marginBottom: 3 }}>
          <h3 style={{
            fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
            fontSize: 14, fontWeight: 600, color: '#111',
            lineHeight: 1.5,
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

        {/* Tagline */}
        {restaurant.tagline && (
          <p style={{ fontSize: 12, color: '#8A8680', fontWeight: 500, marginBottom: 4 }}>
            {restaurant.tagline}
          </p>
        )}

        {/* Category badges — max 2 visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          {categories.slice(0, 2).map(cat => (
            <span
              key={cat.name}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: `${cat.color}20`,
                color: cat.color,
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 20,
              }}
            >
              {cat.emoji} {cat.name}
            </span>
          ))}
          {categories.length > 2 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)',
              fontSize: 10, fontWeight: 700, color: '#8A8680',
            }}>
              +{categories.length - 2}
            </span>
          )}
        </div>

        {/* Recommended + Price + Distance row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8A8680', fontWeight: 500 }}>
          {restaurant.recommended_for?.length > 0 && (
            <>
              <span>{restaurant.recommended_for[0]}</span>
              {(priceStr || distance != null) && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />}
            </>
          )}
          {priceStr && (
            <span style={{ fontWeight: 600 }}>
              {priceStr.split('').map((c, i) => (
                <span key={i} style={{ color: i < (restaurant.price_range + 1) ? '#111' : '#ccc' }}>€</span>
              ))}
            </span>
          )}
          {distance != null && (
            <>
              {priceStr && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                {formatDistance(distance)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Save heart */}
      {onSaveToggle && (
        <div className="absolute bottom-3.5 right-3.5">
          <SaveButton saved={saved} onClick={onSaveToggle} size="sm" />
        </div>
      )}
    </motion.button>
  )
}
