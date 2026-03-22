import { motion, AnimatePresence } from 'framer-motion'
import { useRef } from 'react'
import PhotoCarousel from './PhotoCarousel'
import RatingStars from './RatingStars'
import NearbySection from './NearbySection'
import Badge from '../UI/Badge'
import { CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const sheetVariants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 28,
      stiffness: 300,
      mass: 0.8,
    },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
  },
}

const contentVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export default function RestaurantSheet({
  restaurant,
  onClose,
  allRestaurants = [],
  onSelectNearby,
}) {
  const scrollRef = useRef(null)

  if (!restaurant) return null

  const category = CUISINE_CATEGORIES.find(
    (c) => c.name === restaurant.cuisine_type
  )

  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''

  const mapsUrl = restaurant.google_maps_url
    || (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null)

  const phoneUrl = restaurant.phone
    ? `tel:${restaurant.phone.replace(/\s/g, '')}`
    : null

  const reviewText = restaurant.our_review || ''
  const tipText = restaurant.our_tip || null

  return (
    <AnimatePresence>
      {restaurant && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="relative mt-12 flex flex-1 flex-col overflow-hidden rounded-t-3xl bg-bg"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Back button */}
            <motion.button
              className="glass absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md"
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 20 }}
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

            {/* Scrollable content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">
              {/* Photo carousel */}
              <PhotoCarousel photos={restaurant.photos || []} height="300px" />

              {/* Content */}
              <motion.div
                className="flex flex-col gap-5 px-5 pt-5 pb-10"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Name */}
                <motion.h1
                  className="font-display text-2xl font-bold text-primary"
                  variants={itemVariants}
                >
                  {restaurant.name}
                </motion.h1>

                {/* Category badges */}
                <motion.div
                  className="flex flex-wrap items-center gap-2"
                  variants={itemVariants}
                >
                  {category && (
                    <Badge color={category.color}>
                      {category.emoji} {category.name}
                    </Badge>
                  )}
                  {priceLabel && (
                    <span className="text-sm font-semibold text-secondary">
                      {priceLabel}
                    </span>
                  )}
                </motion.div>

                {/* Rating */}
                {restaurant.our_rating != null && (
                  <motion.div
                    className="flex items-center gap-2"
                    variants={itemVariants}
                  >
                    <RatingStars rating={restaurant.our_rating} size="md" animated />
                    <span className="text-sm font-semibold text-primary">
                      {restaurant.our_rating.toFixed(1)}
                    </span>
                  </motion.div>
                )}

                {/* La recensione di Bi */}
                {reviewText && (
                  <motion.div
                    className="flex flex-col gap-2"
                    variants={itemVariants}
                  >
                    <h2 className="font-display text-lg font-semibold text-primary">
                      La recensione di Bi
                    </h2>
                    <div className="rounded-2xl bg-card p-4 shadow-sm">
                      <p className="text-sm leading-relaxed text-secondary">
                        {reviewText}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Il tip di Bi */}
                {tipText && (
                  <motion.div
                    className="flex flex-col gap-2"
                    variants={itemVariants}
                  >
                    <h2 className="font-display text-lg font-semibold text-primary">
                      Il tip di Bi
                    </h2>
                    <div className="rounded-2xl bg-accent-light px-4 py-3.5">
                      <p className="text-sm font-medium leading-relaxed text-accent">
                        {tipText}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Info section */}
                <motion.div
                  className="flex flex-col gap-3"
                  variants={itemVariants}
                >
                  <h2 className="font-display text-lg font-semibold text-primary">
                    Info
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
                    Apri in Google Maps
                  </motion.a>
                )}

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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
