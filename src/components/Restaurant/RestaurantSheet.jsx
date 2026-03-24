import { motion, useAnimate } from 'framer-motion'
import { useRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PhotoCarousel from './PhotoCarousel'
import NearbySection from './NearbySection'
import SaveButton from './SaveButton'
import DiscountBanner from '../Discount/DiscountBanner'
import ReviewSection from '../Review/ReviewSection'
import Badge from '../UI/Badge'
import { CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'

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
      className="flex items-center justify-center gap-2 rounded-2xl bg-card px-5 py-3.5 font-sans text-sm font-semibold text-primary shadow-sm border border-gray-200"
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
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
  const isItalian = i18n.language === 'it' || i18n.language?.startsWith('it-')
  const scrollRef = useRef(null)
  const [backdropScope, animateBackdrop] = useAnimate()
  const [sheetScope, animateSheet] = useAnimate()

  const handleClose = useCallback(async () => {
    // Run both animations in parallel, then navigate
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
    .map(name => CUISINE_CATEGORIES.find(c => c.name === name))
    .filter(Boolean)

  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''

  const mapsUrl = restaurant.google_maps_url
    || (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null)

  const phoneUrl = restaurant.phone
    ? `tel:${restaurant.phone.replace(/\s/g, '')}`
    : null

  const reviewText = restaurant.our_review || ''
  const tipText = restaurant.our_tip || null

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
        className="relative mt-12 flex flex-1 flex-col overflow-hidden rounded-t-3xl bg-bg"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: 'spring',
          damping: 30,
          stiffness: 350,
          mass: 0.7,
        }}
      >
        {/* Back button */}
        <motion.button
          className="glass absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md"
          onClick={handleClose}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 20 }}
          aria-label="Chiudi"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </motion.button>

        {/* Save button — top right */}
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

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">
          {/* Photo carousel */}
          <PhotoCarousel photos={restaurant.photos || []} height="300px" restaurantName={restaurant.name} city={restaurant.city} />

          {/* Content */}
          <motion.div
            className="flex flex-col gap-5 px-5 pt-5 pb-10"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Name */}
            <motion.h1
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: "'TAN Songbird', serif" }}
              variants={itemVariants}
            >
              {restaurant.name}
            </motion.h1>

            {/* Category badges */}
            <motion.div
              className="flex flex-wrap items-center gap-2"
              variants={itemVariants}
            >
              {categories.map(cat => (
                <Badge key={cat.name} color={cat.color}>
                  {cat.emoji} {cat.name}
                </Badge>
              ))}
              {priceLabel && (
                <span className="text-sm font-semibold text-secondary">
                  {priceLabel}
                </span>
              )}
            </motion.div>

            {/* Recommended for tags */}
            {restaurant.recommended_for && restaurant.recommended_for.length > 0 && (
              <motion.div
                className="flex flex-col gap-2"
                variants={itemVariants}
              >
                <h2 className="font-display text-sm font-semibold text-secondary">
                  {t('recommended.recommendedFor')}
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

            {/* La recensione di Bi */}
            {reviewText && (
              <motion.div
                className="flex flex-col gap-2"
                variants={itemVariants}
              >
                <h2 className="font-display text-lg font-semibold text-primary">
                  {t('restaurant.reviewByBi')}
                </h2>
                <div className="rounded-2xl bg-card p-4 shadow-sm">
                  <p className="text-sm leading-relaxed text-secondary">
                    {reviewText}
                  </p>
                  {!isItalian && (
                    <p className="text-xs text-secondary/60 mt-2 italic">
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* I suggerimenti di Bi */}
            {tipText && (
              <motion.div
                className="flex flex-col gap-2"
                variants={itemVariants}
              >
                <h2 className="font-display text-lg font-semibold text-primary">
                  {t('restaurant.tipsByBi')}
                </h2>
                <div
                  className="rounded-2xl px-4 py-3.5"
                  style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a, #fcd34d)' }}
                >
                  <p className="text-sm font-medium leading-relaxed text-amber-900">
                    {tipText}
                  </p>
                  {!isItalian && (
                    <p className="text-xs text-amber-700/60 mt-2 italic">
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* TikTok/Instagram video embed */}
            {(restaurant.instagram_reel || restaurant.tiktok_url) && (
              <motion.div
                className="flex flex-col gap-2"
                variants={itemVariants}
              >
                <h2 className="font-display text-lg font-semibold text-primary">
                  {restaurant.tiktok_url ? t('tiktok.watchTiktok') : t('restaurant.watchReel')}
                </h2>
                <a
                  href={restaurant.tiktok_url || restaurant.instagram_reel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative overflow-hidden rounded-2xl bg-gray-900 flex items-center gap-4 p-4 shadow-sm group"
                >
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 text-white flex-shrink-0">
                    {restaurant.tiktok_url ? (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.64V6.69h3.77z"/>
                      </svg>
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
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

            {/* Discount banner */}
            <motion.div variants={itemVariants}>
              <DiscountBanner restaurantId={restaurant.id} />
            </motion.div>

            {/* Info section */}
            <motion.div
              className="flex flex-col gap-3"
              variants={itemVariants}
            >
              <h2 className="font-display text-lg font-semibold text-primary">
                {t('restaurant.info')}
              </h2>

              <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-sm">
                {/* Address */}
                {restaurant.address && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 text-left"
                  >
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <span className="text-sm leading-snug text-primary">
                      {restaurant.address}
                    </span>
                  </a>
                )}

                {/* Phone */}
                {restaurant.phone && (
                  <a
                    href={phoneUrl}
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    </span>
                    <span className="text-sm text-primary">
                      {restaurant.phone}
                    </span>
                  </a>
                )}

                {/* Website */}
                {restaurant.website && (
                  <a
                    href={restaurant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                      </svg>
                    </span>
                    <span className="text-sm text-accent underline">
                      {restaurant.website}
                    </span>
                  </a>
                )}

                {/* Instagram Reel */}
                {restaurant.instagram_reel && (
                  <a
                    href={restaurant.instagram_reel}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                    </span>
                    <span className="text-sm text-pink-500 underline">
                      {t('restaurant.watchReel')}
                    </span>
                  </a>
                )}

                {/* TikTok */}
                {restaurant.tiktok_url && (
                  <a
                    href={restaurant.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.64V6.69h3.77z"/>
                      </svg>
                    </span>
                    <span className="text-sm text-gray-900 underline">
                      {t('tiktok.watchTiktok')}
                    </span>
                  </a>
                )}
              </div>
            </motion.div>

            {/* Google Maps button */}
            {mapsUrl && (
              <motion.a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 font-sans text-sm font-semibold text-white shadow-sm"
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {t('restaurant.openInMaps')}
              </motion.a>
            )}

            {/* Share button */}
            <ShareButton restaurant={restaurant} t={t} />

            {/* Community reviews */}
            <motion.div variants={itemVariants}>
              <ReviewSection restaurantId={restaurant.id} />
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
      </motion.div>
    </div>
  )
}
