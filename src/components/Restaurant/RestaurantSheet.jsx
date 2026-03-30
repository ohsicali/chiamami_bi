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

/* ── Floating Discount Bar (Airbnb-style white bottom bar) ── */
function FloatingDiscountBar({ discount: discountFromParent, restaurantId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
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
        transition={{ delay: 1, type: 'spring', stiffness: 300, damping: 26 }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: '#fff',
          padding: '14px 20px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>Sconto esclusivo Bi</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#111', marginTop: 1 }}>{displayTitle}</p>
        </div>

        {isRedeemed ? (
          <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>
            {t('discount.alreadyUsed')}
          </span>
        ) : isGenerated ? (
          <button
            onClick={() => setShowQR(true)}
            style={{
              background: '#E8453C', color: '#fff', border: 'none',
              padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
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
              background: '#E8453C', color: '#fff', border: 'none',
              padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
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
  const photoRef = useRef(null)
  const [backdropScope, animateBackdrop] = useAnimate()
  const [sheetScope, animateSheet] = useAnimate()
  const { handleShare } = useShare(restaurant, t)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const { position } = useGeolocation()
  const [photoIndex, setPhotoIndex] = useState(0)

  // Match Safari toolbar to white bottom bar
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const original = meta?.getAttribute('content')
    if (meta) meta.setAttribute('content', '#ffffff')
    return () => { if (meta && original) meta.setAttribute('content', original) }
  }, [])

  // Parallax — photo drifts up at 0.3x scroll speed
  useEffect(() => {
    const el = scrollRef.current
    const photo = photoRef.current
    if (!el || !photo) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        photo.style.transform = `translateY(${-el.scrollTop * 0.15}px)`
        ticking = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
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

  const photoCount = (restaurant.photos || []).length

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

      {/* Full page sheet */}
      <motion.div
        ref={sheetScope}
        className="relative flex flex-1 flex-col overflow-hidden bg-white"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
      >
        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">

          {/* Photo — sticky, stays in place while content scrolls over it */}
          <div style={{ position: 'sticky', top: 0, zIndex: 0, overflow: 'hidden', height: '38vh' }}>
            <div ref={photoRef} style={{ willChange: 'transform' }}>
              <PhotoCarousel photos={restaurant.photos || []} height="42vh" restaurantName={restaurant.name} city={restaurant.city} dotsPosition="right" hideDots onIndexChange={setPhotoIndex} />
            </div>

            {/* Back button — white circle */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute', top: 'calc(14px + env(safe-area-inset-top, 0px))', left: 14, zIndex: 10,
                width: 36, height: 36, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', color: '#111',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </button>

            {/* Share + Save — white circles, top right */}
            <div style={{ position: 'absolute', top: 'calc(14px + env(safe-area-inset-top, 0px))', right: 14, zIndex: 10, display: 'flex', gap: 10 }}>
              <button
                onClick={handleShare}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer', color: '#111',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </button>
              {onSaveToggle && <SaveButton saved={saved} onClick={onSaveToggle} size="md" />}
            </div>
          </div>

          {/* White content card — scrolls up over sticky photo */}
          <div style={{
            background: '#fff',
            borderRadius: '20px 20px 0 0',
            marginTop: -24,
            position: 'relative', zIndex: 2,
            minHeight: '100vh',
          }}>
            {/* Photo counter — anchored to white card, moves with it */}
            {photoCount > 1 && (
              <div style={{
                position: 'absolute', top: -36, right: 16, zIndex: 3,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                borderRadius: 14, padding: '4px 10px',
                fontSize: 12, fontWeight: 600, color: '#fff', letterSpacing: 0.5,
              }}>
                {photoIndex + 1} / {photoCount}
              </div>
            )}

            {/* Green discount strip following the card's rounded corners */}
            {discountTitle && (
              <div style={{
                background: '#4ADE80', color: '#fff',
                fontSize: 11, fontWeight: 700,
                padding: '6px 14px',
                textAlign: 'center',
                letterSpacing: 0.5,
                borderRadius: '20px 20px 0 0',
              }}>
                {discountTitle}
              </div>
            )}

            <motion.div
              className="flex flex-col"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              style={{ padding: '28px 24px 100px' }}
            >
              {/* Restaurant name — centered */}
              <motion.h1 variants={itemVariants} style={{
                fontFamily: "'TAN Songbird', serif",
                fontSize: 24, fontWeight: 700, color: '#111',
                lineHeight: 1.35, textAlign: 'center',
                marginBottom: 8,
              }}>
                {restaurant.name}
              </motion.h1>

              {/* Subtitle — address, categories, price */}
              <motion.p variants={itemVariants} style={{
                fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5,
                marginBottom: 4,
              }}>
                {restaurant.address}
                {distance != null && ` · ${formatDistance(distance)}`}
              </motion.p>
              <motion.div variants={itemVariants} style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: 4, flexWrap: 'wrap', marginBottom: 24,
              }}>
                {categories.map((cat, i) => (
                  <span key={cat.name} style={{ fontSize: 13, color: '#666' }}>
                    {cat.emoji} {cat.name}{i < categories.length - 1 ? ' · ' : ''}
                  </span>
                ))}
                {priceLabel && (
                  <span style={{ fontSize: 13, color: '#666' }}>
                    {categories.length > 0 ? ' · ' : ''}{priceLabel}
                  </span>
                )}
              </motion.div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 24 }} />

              {/* Action buttons row */}
              <motion.div variants={itemVariants} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    background: '#111', color: '#fff',
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
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: '#E8453C', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800,
                    }}>Bi</span>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Recensione di Bi</p>
                      <p style={{ fontSize: 12, color: '#888' }}>La guida di Bi</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: '#333' }}>
                    "{reviewText}"
                  </p>
                  {!isItalian && (
                    <p style={{ fontSize: 11, color: '#aaa', marginTop: 6, fontStyle: 'italic' }}>
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Il tip di Bi */}
              {tipText && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{
                    background: '#FEF3C7',
                    borderLeft: '3px solid #E8453C',
                    borderRadius: '0 12px 12px 0',
                    padding: '14px 16px',
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#E8453C', marginBottom: 4 }}>Il tip di Bi</p>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: '#78350F', fontWeight: 500 }}>
                      "{tipText}"
                    </p>
                  </div>
                  {!isItalian && (
                    <p style={{ fontSize: 11, color: '#aaa', marginTop: 6, fontStyle: 'italic' }}>
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 20 }} />

              {/* Recommended for */}
              {restaurant.recommended_for?.length > 0 && (
                <motion.div variants={itemVariants} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
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
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
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
              <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
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
        </div>

        {/* Floating discount bar — Airbnb style white bottom bar */}
        <FloatingDiscountBar discount={discount} restaurantId={restaurant.id} />
      </motion.div>
    </div>
  )
}
