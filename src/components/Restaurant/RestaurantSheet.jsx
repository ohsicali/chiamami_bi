import { motion, useAnimate, AnimatePresence } from 'framer-motion'
import { useRef, useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import PhotoCarousel from './PhotoCarousel'
import NearbySection from './NearbySection'
import SaveButton from './SaveButton'
import ReviewSection from '../Review/ReviewSection'
import QRCodeDisplay from '../Discount/QRCodeDisplay'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useActiveDiscounts, useRestaurantDiscount, useUserRedemption } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { useGeolocation } from '../../lib/hooks/useGeolocation'

/* ── animation variants ── */
const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ── Share logic ── */
function useShare(restaurant, t) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/restaurant/${restaurant.slug || restaurant.id}`
  const handleShare = async () => {
    const shareData = { title: restaurant.name, text: t('share.shareText', { name: restaurant.name }), url: shareUrl }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return { handleShare, copied }
}

/* ── Sticky Discount Bar ── */
function StickyDiscountBar({ discount: discountFromParent, restaurantId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  // Use parent discount if available, otherwise fetch independently
  const { discount: fetchedDiscount, loading: discountLoading } = useRestaurantDiscount(restaurantId)
  const discount = discountFromParent || fetchedDiscount
  const { redemption, loading: redemptionLoading, generateRedemption } = useUserRedemption(discount?.id, user?.id)
  const [generating, setGenerating] = useState(false)
  const [showQR, setShowQR] = useState(false)

  if (!discount && discountLoading) return null
  if (!discount) return null
  const isExpired = new Date(discount.valid_until) < new Date()
  const isMaxed = discount.max_redemptions && discount.total_redeemed >= discount.max_redemptions
  if (isExpired || isMaxed) return null

  const isRedeemed = redemption?.status === 'redeemed'
  const isGenerated = redemption?.status === 'generated'

  const handleUnlock = async () => {
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname, discount: true } })
      return
    }
    setGenerating(true)
    try {
      const result = await generateRedemption()
      if (result) setShowQR(true)
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const displayTitle = discount.title || discount.discount_value

  return (
    <>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 25 }}
        style={{
          position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', left: 16, right: 16, zIndex: 30,
          background: '#111', color: '#fff',
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: 20,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, color: '#4ADE80', fontWeight: 600 }}>Sconto esclusivo Bi</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#E8453C' }}>{displayTitle}</span>
            {discount.title && discount.title !== discount.discount_value && (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{discount.discount_value}</span>
            )}
          </div>
        </div>

        {/* Action button */}
        {isRedeemed ? (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            {t('discount.alreadyUsed')}
          </span>
        ) : isGenerated ? (
          <button
            onClick={() => setShowQR(true)}
            style={{
              background: '#E8453C', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Mostra QR
          </button>
        ) : (
          <button
            onClick={handleUnlock}
            disabled={generating || redemptionLoading}
            style={{
              background: '#fff', color: '#111', border: 'none',
              padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', opacity: generating ? 0.5 : 1, flexShrink: 0,
            }}
          >
            {generating ? '...' : 'Sblocca'}
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {showQR && redemption && (
          <QRCodeDisplay
            qrCode={redemption.qr_code}
            discountTitle={discount.title}
            discountValue={discount.discount_value}
            onClose={() => setShowQR(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/* ══════════════════════════════════════════ */
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
  const { handleShare } = useShare(restaurant, t)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const { position } = useGeolocation()

  // White theme-color while sheet is open (match Safari toolbar)
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const original = meta?.getAttribute('content')
    if (meta) meta.setAttribute('content', '#FAF7F2')
    return () => { if (meta && original) meta.setAttribute('content', original) }
  }, [])

  const handleClose = useCallback(async () => {
    await Promise.all([
      animateBackdrop(backdropScope.current, { opacity: 0 }, { duration: 0.2, ease: 'easeOut' }),
      animateSheet(sheetScope.current, { y: '100%', opacity: 0 }, { duration: 0.28, ease: [0.4, 0, 0.7, 0.2] }),
    ])
    onClose()
  }, [onClose, animateBackdrop, animateSheet, backdropScope, sheetScope])

  if (!restaurant) return null

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name)).filter(Boolean)
  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''
  const mapsUrl = restaurant.google_maps_url || (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null)
  const phoneUrl = restaurant.phone ? `tel:${restaurant.phone.replace(/\s/g, '')}` : null
  const reviewText = restaurant.our_review || ''
  const tipText = restaurant.our_tip || null
  const discount = activeDiscounts.find(d => d.restaurant_id === restaurant.id)
  const discountTitle = discount?.title || discount?.discount_value
  const distance = position && restaurant.latitude && restaurant.longitude
    ? getDistance(position.lat, position.lng, restaurant.latitude, restaurant.longitude) : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <motion.div
        ref={backdropScope}
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
      />

      {/* Full page sheet — no mt, no rounded top */}
      <motion.div
        ref={sheetScope}
        className="relative flex flex-1 flex-col overflow-hidden bg-bg"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
      >
        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">

          {/* Photo area with overlay */}
          <div style={{ position: 'relative' }}>
            <PhotoCarousel photos={restaurant.photos || []} height="45vh" restaurantName={restaurant.name} city={restaurant.city} dotsPosition="right" />

            {/* Gradient overlay */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
              background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
              pointerEvents: 'none',
            }} />

            {/* Back button */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', left: 16, zIndex: 10,
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', color: '#fff',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </button>

            {/* Save + Share — top right */}
            <div style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16, zIndex: 10, display: 'flex', gap: 10 }}>
              {onSaveToggle && <SaveButton saved={saved} onClick={onSaveToggle} size="md" />}
              <button
                onClick={handleShare}
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer', color: '#fff',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </button>
            </div>

            {/* Info overlaid on photo bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 16px', zIndex: 5 }}>
              {/* Discount badge above name */}
              {discountTitle && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{
                    background: '#4ADE80', color: '#fff',
                    fontSize: 11, fontWeight: 700,
                    padding: '4px 10px', borderRadius: 8,
                    display: 'inline-block',
                  }}>
                    {discountTitle}
                  </span>
                </div>
              )}
              {/* Name */}
              <h1 style={{
                fontFamily: "'TAN Songbird', serif",
                fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.5,
                marginBottom: 8,
              }}>
                {restaurant.name}
              </h1>

              {/* Category badges + price */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                {categories.map(cat => (
                  <span key={cat.name} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    backgroundColor: `${cat.color}30`, color: '#fff',
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  }}>
                    {cat.emoji} {cat.name}
                  </span>
                ))}
                {priceLabel && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{priceLabel}</span>
                )}
              </div>

              {/* Address + distance */}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {restaurant.address && <span>{restaurant.address}</span>}
                {distance != null && (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', display: 'inline-block' }} />
                    <span>{formatDistance(distance)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Content below photo */}
          <motion.div
            className="flex flex-col gap-5"
            style={{ padding: '20px 20px 100px' }}
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Action buttons — squared pills */}
            <motion.div variants={itemVariants} style={{ display: 'flex', gap: 8 }}>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: '#111', color: '#fff', border: '1px solid #111',
                }}>Indicazioni</a>
              )}
              {phoneUrl && (
                <a href={phoneUrl} style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)',
                }}>Chiama</a>
              )}
              {restaurant.website && (
                <a href={restaurant.website} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)',
                }}>Sito</a>
              )}
            </motion.div>

            {/* Recensione di Bi */}
            {reviewText && (
              <motion.div variants={itemVariants}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#E8453C', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                  }}>Bi</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Recensione di Bi</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#444', paddingLeft: 36 }}>
                  "{reviewText}"
                </p>
                {!isItalian && (
                  <p style={{ fontSize: 11, color: '#aaa', marginTop: 6, paddingLeft: 36, fontStyle: 'italic' }}>
                    {t('restaurant.originalItalian')}
                  </p>
                )}
              </motion.div>
            )}

            {/* Il tip di Bi — yellow background with red left border */}
            {tipText && (
              <motion.div variants={itemVariants}>
                <div style={{
                  background: '#FEF3C7',
                  borderLeft: '3px solid #E8453C',
                  borderRadius: '0 12px 12px 0',
                  padding: '14px 16px',
                  marginLeft: 36,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#E8453C', marginBottom: 4 }}>Il tip di Bi</p>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: '#78350F', fontWeight: 500 }}>
                    "{tipText}"
                  </p>
                </div>
                {!isItalian && (
                  <p style={{ fontSize: 11, color: '#aaa', marginTop: 6, paddingLeft: 36, fontStyle: 'italic' }}>
                    {t('restaurant.originalItalian')}
                  </p>
                )}
              </motion.div>
            )}

            {/* Recommended for */}
            {restaurant.recommended_for?.length > 0 && (
              <motion.div variants={itemVariants} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {restaurant.recommended_for.map(tag => (
                  <span key={tag} style={{
                    fontSize: 12, fontWeight: 600, color: '#92700C',
                    background: '#FEF3C7', padding: '5px 12px', borderRadius: 20,
                  }}>{tag}</span>
                ))}
              </motion.div>
            )}

            {/* TikTok / Instagram video */}
            {(restaurant.instagram_reel || restaurant.tiktok_url) && (
              <motion.div variants={itemVariants}>
                <a
                  href={restaurant.tiktok_url || restaurant.instagram_reel}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: '#111', borderRadius: 12, padding: 14,
                    textDecoration: 'none', color: '#fff',
                  }}
                >
                  <span style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {restaurant.tiktok_url ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.64V6.69h3.77z"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{restaurant.tiktok_url ? 'Guarda su TikTok' : 'Guarda su Instagram'}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Il video di Bi su {restaurant.name}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, opacity: 0.6 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </a>
              </motion.div>
            )}

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

        {/* Floating discount bar */}
        <StickyDiscountBar discount={discount} restaurantId={restaurant.id} />
      </motion.div>
    </div>
  )
}
