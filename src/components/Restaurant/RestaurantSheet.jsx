import { motion, useAnimate } from 'framer-motion'
import { useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PhotoCarousel from './PhotoCarousel'
import NearbySection from './NearbySection'
import SaveButton from './SaveButton'
import DiscountBanner from '../Discount/DiscountBanner'
import ReviewSection from '../Review/ReviewSection'
import Badge from '../UI/Badge'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useRestaurantTranslation } from '../../lib/hooks/useTranslation'
import { useRestaurantDiscount, useUserRedemption } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'

function ShareButton({ restaurant, t }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/restaurant/${restaurant.slug || restaurant.id}`

  const handleShare = async () => {
    const shareData = {
      title: restaurant.name,
      text: t('share.shareText', { name: restaurant.name }),
      url: shareUrl,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 rounded-2xl bg-card px-5 py-3.5 font-sans text-sm font-semibold text-primary shadow-sm border border-border"
      variants={itemVariants}
      whileTap={{ scale: 0.97 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {copied ? t('share.copied') : t('share.shareRestaurant')}
    </motion.button>
  )
}

const contentVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export default function RestaurantSheet({
  restaurant,
  onClose,
  allRestaurants = [],
  onSelectNearby,
  saved,
  onSaveToggle,
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isItalian = i18n.language === 'it' || i18n.language?.startsWith('it-')
  const scrollRef = useRef(null)
  const [backdropScope, animateBackdrop] = useAnimate()
  const [sheetScope, animateSheet] = useAnimate()

  const handleClose = useCallback(async () => {
    await Promise.all([
      animateBackdrop(backdropScope.current, { opacity: 0 }, { duration: 0.25, ease: 'easeOut' }),
      animateSheet(sheetScope.current, { y: '100%', opacity: 0 }, {
        duration: 0.32,
        ease: [0.4, 0, 0.7, 0.2],
      }),
    ])
    onClose()
  }, [onClose, animateBackdrop, animateSheet, backdropScope, sheetScope])

  if (!restaurant) return null

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))

  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''

  const mapsUrl = restaurant.google_maps_url
    || (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null)

  const phoneUrl = restaurant.phone
    ? `tel:${restaurant.phone.replace(/\s/g, '')}`
    : null

  const { t: tr } = useRestaurantTranslation(restaurant)
  const reviewText = tr('our_review') || ''
  const tipText = tr('our_tip') || null

  // Auth + discount state for sticky bar
  const { user } = useAuth()
  const { discount } = useRestaurantDiscount(restaurant.id)
  const { redemption } = useUserRedemption(discount?.id, user?.id)

  // Get first photo for hero
  const photos = restaurant.photos || []
  const heroPhoto = photos.length > 0
    ? (typeof photos[0] === 'string' ? photos[0] : photos[0]?.photo_url)
    : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <motion.div
        ref={backdropScope}
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        ref={sheetScope}
        className="relative mt-8 flex flex-1 flex-col overflow-hidden rounded-t-3xl bg-bg"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: 'spring',
          damping: 30,
          stiffness: 350,
          mass: 0.7,
        }}
      >
        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-none"
          style={{ paddingBottom: discount ? 80 : 0 }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* ── IMMERSIVE HERO — 380px ── */}
          <div className="relative w-full" style={{ height: 380 }}>
            {heroPhoto ? (
              <img
                src={heroPhoto}
                alt={restaurant.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-6xl"
                style={{ backgroundColor: categories[0]?.color ? `${categories[0].color}20` : '#f3f4f6' }}
              >
                {categories[0]?.emoji || '🍽️'}
              </div>
            )}

            {/* Gradient overlay — bottom half */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)',
              }}
            />

            {/* Back button — glassmorphism */}
            <motion.button
              className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md"
              style={{
                background: 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
              onClick={handleClose}
              whileTap={{ scale: 0.92 }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 20 }}
              aria-label="Chiudi"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </motion.button>

            {/* Save button — glassmorphism, top right */}
            {onSaveToggle && (
              <motion.div
                className="absolute top-4 right-4 z-10"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 20 }}
              >
                <SaveButton saved={saved} onClick={onSaveToggle} size="md" />
              </motion.div>
            )}

            {/* Name + category on photo — bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10">
              <h1
                className="text-2xl font-bold text-white mb-1.5"
                style={{ fontFamily: 'var(--font-display)', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
              >
                {restaurant.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {categories.map(cat => (
                  <span
                    key={cat.name}
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      color: '#fff',
                    }}
                  >
                    {cat.emoji} {cat.name}
                  </span>
                ))}
                {priceLabel && (
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                  >
                    {priceLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Photo count indicator (if multiple photos) */}
            {photos.length > 1 && (
              <div
                className="absolute bottom-5 right-5 z-10 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                📷 1/{photos.length}
              </div>
            )}
          </div>

          {/* Content */}
          <motion.div
            className="flex flex-col gap-5 px-5 pt-5 pb-10"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Quick actions — Indicazioni / Chiama / Sito */}
            <motion.div className="grid grid-cols-3 gap-2" variants={itemVariants}>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-xl bg-accent py-3 text-sm font-semibold text-white"
                >
                  Indicazioni
                </a>
              )}
              {phoneUrl ? (
                <a
                  href={phoneUrl}
                  className="flex items-center justify-center rounded-xl border border-border bg-card py-3 text-sm font-semibold text-primary"
                >
                  Chiama
                </a>
              ) : (
                <div />
              )}
              {restaurant.website ? (
                <a
                  href={restaurant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-xl border border-border bg-card py-3 text-sm font-semibold text-primary"
                >
                  Sito
                </a>
              ) : (
                <ShareButton restaurant={restaurant} t={t} />
              )}
            </motion.div>

            {/* "Perché mi piace" — with Bi avatar */}
            {reviewText && (
              <motion.div className="flex flex-col gap-3" variants={itemVariants}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0"
                    style={{ background: '#FF5757' }}
                  >
                    Bi
                  </div>
                  <h2 className="text-base font-bold text-primary">
                    Perché mi piace
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-secondary">
                  "{reviewText}"
                </p>
                {!isItalian && (
                  <p className="text-xs text-secondary/60 italic">
                    {t('restaurant.originalItalian')}
                  </p>
                )}
              </motion.div>
            )}

            {/* Il tip di Bi — red left border accent */}
            {tipText && (
              <motion.div variants={itemVariants}>
                <p className="text-sm font-bold mb-2" style={{ color: '#FF5757' }}>
                  Il tip di Bi
                </p>
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: '#FFF8F0',
                    borderLeft: '3px solid #FF5757',
                  }}
                >
                  <p className="text-sm leading-relaxed text-primary">
                    "{tipText}"
                  </p>
                  {!isItalian && (
                    <p className="text-xs text-secondary/60 mt-2 italic">
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* TikTok/Instagram video embed */}
            {(restaurant.instagram_reel || restaurant.tiktok_url) && (
              <motion.div variants={itemVariants}>
                <a
                  href={restaurant.tiktok_url || restaurant.instagram_reel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative overflow-hidden rounded-2xl bg-gray-900 flex items-center gap-4 p-4 shadow-sm group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 text-white flex-shrink-0">
                    {restaurant.tiktok_url ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.64V6.69h3.77z"/>
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">
                      {restaurant.tiktok_url ? 'Guarda su TikTok' : 'Guarda su Instagram'}
                    </p>
                    <p className="text-white/60 text-xs mt-0.5">
                      Il video di Bi su {restaurant.name}
                    </p>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white group-hover:bg-white/20 transition-colors flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </a>
              </motion.div>
            )}

            {/* Community reviews */}
            <motion.div variants={itemVariants}>
              <ReviewSection restaurantId={restaurant.id} />
            </motion.div>

            {/* Discount banner (inline, scrollable) */}
            <motion.div variants={itemVariants} data-discount-banner>
              <DiscountBanner restaurantId={restaurant.id} />
            </motion.div>

            {/* Recommended for tags */}
            {restaurant.recommended_for && restaurant.recommended_for.length > 0 && (
              <motion.div className="flex flex-col gap-2" variants={itemVariants}>
                <h2
                  className="text-lg font-semibold text-primary"
                  style={{ fontWeight: 700 }}
                >
                  Consigliato per
                </h2>
                <div className="flex flex-wrap gap-2">
                  {restaurant.recommended_for.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Info details */}
            <motion.div className="flex flex-col gap-3" variants={itemVariants}>
              <h2
                className="text-lg font-semibold text-primary"
                style={{ fontWeight: 700 }}
              >
                {t('restaurant.info')}
              </h2>

              <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-sm">
                {restaurant.address && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-left">
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <span className="text-sm leading-snug text-primary">{restaurant.address}</span>
                  </a>
                )}

                {restaurant.phone && (
                  <a href={phoneUrl} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    </span>
                    <span className="text-sm text-primary">{restaurant.phone}</span>
                  </a>
                )}

                {restaurant.website && (
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                      </svg>
                    </span>
                    <span className="text-sm text-accent underline truncate">{restaurant.website}</span>
                  </a>
                )}
              </div>
            </motion.div>

            {/* Nearby restaurants */}
            <motion.div variants={itemVariants}>
              <NearbySection
                currentRestaurant={restaurant}
                allRestaurants={allRestaurants}
                onSelect={onSelectNearby}
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Sticky discount bar — 3 states */}
        {discount && (() => {
          const isRedeemed = redemption?.status === 'redeemed'
          const isGenerated = redemption?.status === 'generated'
          const redeemedDate = redemption?.redeemed_at
            ? new Date(redemption.redeemed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
            : null

          return (
            <motion.div
              className="absolute bottom-0 left-0 right-0 z-20 border-t px-5 py-3"
              style={{
                background: isRedeemed ? '#f3f4f6' : 'rgba(255,255,255,0.95)',
                backdropFilter: isRedeemed ? 'none' : 'blur(16px)',
                WebkitBackdropFilter: isRedeemed ? 'none' : 'blur(16px)',
                borderColor: isRedeemed ? '#e5e7eb' : 'rgba(234,231,224,0.5)',
              }}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 25 }}
            >
              {isRedeemed ? (
                /* State 3: Already used */
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-500">
                      Sconto utilizzato ✓
                    </p>
                    <p className="text-xs text-gray-400">
                      Usato il {redeemedDate}
                    </p>
                  </div>
                </div>
              ) : isGenerated ? (
                /* State 2: Active QR — show "Mostra QR" */
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-secondary">Il tuo sconto</p>
                    <p className="text-sm font-bold text-accent">{discount.discount_value}</p>
                  </div>
                  <button
                    onClick={() => {
                      const banner = scrollRef.current?.querySelector('[data-discount-banner]')
                      if (banner) banner.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white flex-shrink-0 shadow-sm"
                  >
                    Mostra QR
                  </button>
                </div>
              ) : !user ? (
                /* State 1: Not registered — "Sblocca" outlined */
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-secondary">Sconto esclusivo Bi</p>
                    <p className="text-sm font-bold text-accent">{discount.discount_value}</p>
                  </div>
                  <button
                    onClick={() => navigate('/login', { state: { from: window.location.pathname, discount: true } })}
                    className="rounded-xl border-2 border-accent px-5 py-2 text-xs font-bold text-accent flex-shrink-0"
                  >
                    Sblocca
                  </button>
                </div>
              ) : (
                /* State 1b: Registered but not yet generated */
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-secondary">Sconto esclusivo Bi</p>
                    <p className="text-sm font-bold text-accent">{discount.discount_value}</p>
                  </div>
                  <button
                    onClick={() => {
                      const banner = scrollRef.current?.querySelector('[data-discount-banner]')
                      if (banner) banner.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white flex-shrink-0 shadow-sm"
                  >
                    Scopri
                  </button>
                </div>
              )}
            </motion.div>
          )
        })()}
      </motion.div>
    </div>
  )
}
