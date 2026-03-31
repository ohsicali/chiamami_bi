import { motion, useAnimate, AnimatePresence } from 'framer-motion'
import { Fragment, useRef, useCallback, useState, useEffect } from 'react'
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
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
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

/* ── Video Buttons (Instagram Reel / TikTok) ── */

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
  const [dismissed, setDismissed] = useState(false)

  if (!discount && discountLoading) return null
  if (!discount) return null
  const isExpired = new Date(discount.valid_until) < new Date()
  const isMaxed = discount.max_redemptions && discount.total_redeemed >= discount.max_redemptions
  if (isExpired || isMaxed || dismissed) return null

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
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', left: 16, right: 16, zIndex: 30,
          background: 'rgba(20,20,20,0.55)',
          backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)',
          color: '#fff',
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: 20,
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: 'absolute', top: -8, right: -8, zIndex: 1,
            width: 24, height: 24, borderRadius: '50%',
            background: '#22181C', border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Sconto esclusivo da Bi</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{displayTitle}</p>
        </div>

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
              background: 'linear-gradient(135deg, #a3e635, #4ade80)', color: '#000', border: 'none',
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const isItalian = i18n.language === 'it' || i18n.language?.startsWith('it-')
  const scrollRef = useRef(null)
  const photoRef = useRef(null)
  const [backdropScope, animateBackdrop] = useAnimate()
  const [sheetScope, animateSheet] = useAnimate()
  const { handleShare } = useShare(restaurant, t)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const { position } = useGeolocation()
  const [photoIndex, setPhotoIndex] = useState(0)
  const [showStickyHeader, setShowStickyHeader] = useState(false)
  const [inlineShowQR, setInlineShowQR] = useState(false)
  const [inlineGenerating, setInlineGenerating] = useState(false)
  const [newsletterStatus, setNewsletterStatus] = useState(null) // null | 'loading' | 'success' | 'exists'
  const inlineDiscount = activeDiscounts.find(d => d.restaurant_id === restaurant?.id)
  const { redemption: inlineRedemption, loading: inlineRedemptionLoading, generateRedemption: inlineGenerateRedemption } = useUserRedemption(inlineDiscount?.id, user?.id)

  // Match Safari toolbar to white bottom bar
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const original = meta?.getAttribute('content')
    if (meta) meta.setAttribute('content', '#ffffff')
    return () => { if (meta && original) meta.setAttribute('content', original) }
  }, [])

  // Scroll to top when restaurant changes (e.g. nearby click)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [restaurant?.id])

  // Parallax + sticky header detection
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
        const photoH = el.clientHeight * 0.45 - 60
        setShowStickyHeader(el.scrollTop > photoH)
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none" style={{ position: 'relative' }}>

          {/* Sticky header bar — appears when scrolled past photo */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            background: '#fff',
            padding: `calc(10px + env(safe-area-inset-top, 0px)) 14px 10px`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: showStickyHeader ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
            transform: showStickyHeader ? 'translateY(0)' : 'translateY(-100%)',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
            pointerEvents: showStickyHeader ? 'auto' : 'none',
          }}>
            <button
              onClick={handleClose}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#F0EBE3',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', color: '#22181C',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </button>

            <p style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              fontSize: 15, fontWeight: 700, color: '#22181C',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '55%', textAlign: 'center',
            }}>
              {restaurant.name}
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleShare}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#F0EBE3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer', color: '#22181C',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </button>
              {onSaveToggle && <SaveButton saved={saved} onClick={onSaveToggle} size="md" />}
            </div>
          </div>

          {/* Photo — sticky, stays in place while content scrolls over it */}
          <div style={{ position: 'sticky', top: 0, zIndex: 0, overflow: 'hidden', height: '45vh' }}>
            <div ref={photoRef} style={{ willChange: 'transform' }}>
              <PhotoCarousel photos={restaurant.photos || []} height="48vh" restaurantName={restaurant.name} city={restaurant.city} dotsPosition="right" hideDots onIndexChange={setPhotoIndex} />
            </div>

            {/* Back button — white circle */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute', top: 'calc(14px + env(safe-area-inset-top, 0px))', left: 14, zIndex: 10,
                width: 36, height: 36, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', color: '#22181C',
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
                  border: 'none', cursor: 'pointer', color: '#22181C',
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
                fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: 0.5,
              }}>
                {photoIndex + 1} / {photoCount}
              </div>
            )}

            {/* Discount strip — lime glow bar */}
            {discountTitle && (
              <div style={{
                position: 'relative',
                borderRadius: '20px 20px 0 0',
              }}>
                {/* Glow — subtle, close to strip */}
                <div style={{
                  position: 'absolute', top: -30, left: 0, right: 0, height: 30,
                  background: 'rgba(163,230,53,0.25)',
                  filter: 'blur(16px)',
                  pointerEvents: 'none', zIndex: 0,
                }} />

                {/* Content */}
                <div style={{
                  position: 'relative', zIndex: 1,
                  padding: '12px 18px',
                  borderRadius: '20px 20px 0 0',
                  background: 'linear-gradient(135deg, #a3e635 0%, #4ade80 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                  <span style={{
                    fontSize: 15, fontWeight: 700, color: '#000',
                    letterSpacing: 0.3,
                  }}>
                    {discountTitle}
                  </span>
                </div>
              </div>
            )}

            {/* Green background behind rounded corners */}
            {discountTitle && (
              <div style={{ background: 'linear-gradient(135deg, #a3e635 0%, #4ade80 100%)' }}>
                <div style={{ height: 16, borderRadius: '16px 16px 0 0', background: '#fff' }} />
              </div>
            )}

            <motion.div
              className="flex flex-col"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              style={{
                padding: `${discountTitle ? 12 : 28}px 24px 100px`,
                background: '#fff',
                ...(!discountTitle && { borderRadius: '20px 20px 0 0' }),
              }}
            >
              {/* Restaurant name — centered */}
              <motion.h1 variants={itemVariants} style={{
                fontFamily: "'TAN Songbird', serif",
                fontSize: 24, fontWeight: 700, color: '#22181C',
                lineHeight: 1.7, textAlign: 'center',
                marginBottom: 10,
              }}>
                {restaurant.name}
              </motion.h1>

              {/* Address — prominent */}
              <motion.p variants={itemVariants} style={{
                fontSize: 16, color: '#333', textAlign: 'center', lineHeight: 1.5,
                fontWeight: 500, marginBottom: 10,
              }}>
                {restaurant.address}
                {distance != null && (
                  <span style={{ color: '#888', fontWeight: 400 }}> · {formatDistance(distance)}</span>
                )}
              </motion.p>

              {/* Categories + price — pills */}
              <motion.div variants={itemVariants} style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: 6, flexWrap: 'wrap', marginBottom: 20,
              }}>
                {categories.map((cat) => (
                  <span key={cat.name} style={{
                    fontSize: 13, fontWeight: 600,
                    color: cat.color, border: `1px solid ${cat.color}`,
                    padding: '4px 12px', borderRadius: 20,
                  }}>
                    {cat.emoji} {cat.name}
                  </span>
                ))}
                {priceLabel && (
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: '#555',
                    border: '1px solid rgba(0,0,0,0.15)',
                    padding: '4px 12px', borderRadius: 20,
                  }}>
                    {priceLabel}
                  </span>
                )}
              </motion.div>

              {/* Recommended for */}
              {restaurant.recommended_for?.length > 0 && (
                <motion.div variants={itemVariants} style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  gap: 6, flexWrap: 'wrap', marginBottom: 10, marginTop: -10,
                }}>
                  {restaurant.recommended_for.map((tag, i) => (
                    <Fragment key={tag}>
                      {i > 0 && <span style={{ fontSize: 12, color: '#ccc' }}>-</span>}
                      <span style={{ fontSize: 12, color: '#999' }}>{tag}</span>
                    </Fragment>
                  ))}
                </motion.div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 20 }} />

              {/* Action buttons — with icons */}
              <motion.div variants={itemVariants} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    background: '#F0EBE3', color: '#22181C', border: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                    </svg>
                    Indicazioni
                  </a>
                )}
                {phoneUrl && (
                  <a href={phoneUrl} style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    background: '#F0EBE3', color: '#22181C', border: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                    Chiama
                  </a>
                )}
                {restaurant.website && (
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    background: '#F0EBE3', color: '#22181C', border: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                    </svg>
                    Sito
                  </a>
                )}
              </motion.div>

              {/* ── Secondo Bi — plain text ── */}
              {reviewText && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20, padding: '0 18px' }}>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: '#22181C', fontWeight: 600 }}>
                    {reviewText}
                  </p>
                  {!isItalian && (
                    <p style={{ fontSize: 12, color: '#A89A86', marginTop: 8, fontStyle: 'italic' }}>
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Cosa prendere — gold card ── */}
              {tipText && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{
                    borderRadius: 16, padding: '20px 18px',
                    background: '#C4A265',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
                      </svg>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Cosa prendere</span>
                    </div>
                    <p style={{ fontSize: 16, lineHeight: 1.8, color: 'rgba(255,255,255,0.95)' }}>
                      {tipText}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Video links — "Guarda i miei video" */}
              {(restaurant.instagram_reel || restaurant.tiktok_url) && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{
                    borderRadius: 16, padding: '18px 18px',
                    background: '#22181C',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M8 5.14v13.72a.5.5 0 00.77.42l10.38-6.86a.5.5 0 000-.84L8.77 4.72A.5.5 0 008 5.14z" fill="#fff"/>
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>
                          Guarda i miei video
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.3 }}>
                          La recensione di Bi
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {restaurant.instagram_reel && (
                        <a href={restaurant.instagram_reel} target="_blank" rel="noopener noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '8px 14px', borderRadius: 10,
                          background: 'rgba(255,255,255,0.1)',
                          textDecoration: 'none',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <defs>
                              <linearGradient id="igVid" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#F58529"/>
                                <stop offset="50%" stopColor="#DD2A7B"/>
                                <stop offset="100%" stopColor="#8134AF"/>
                              </linearGradient>
                            </defs>
                            <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#igVid)" strokeWidth="2" fill="none"/>
                            <circle cx="12" cy="12" r="5" stroke="url(#igVid)" strokeWidth="2" fill="none"/>
                            <circle cx="17.5" cy="6.5" r="1.5" fill="#DD2A7B"/>
                          </svg>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Reel</span>
                        </a>
                      )}
                      {restaurant.tiktok_url && (
                        <a href={restaurant.tiktok_url} target="_blank" rel="noopener noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '8px 14px', borderRadius: 10,
                          background: 'rgba(255,255,255,0.1)',
                          textDecoration: 'none',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.69a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.12z"/>
                          </svg>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>TikTok</span>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Discount Section ── */}
              {discount && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  {user ? (
                    /* ── Logged-in user: unlock / show QR ── */
                    <div style={{
                      background: 'linear-gradient(145deg, #22181C 0%, #2a2025 100%)',
                      borderRadius: 16, padding: '24px 20px',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      {/* Badge */}
                      <div style={{
                        display: 'flex', justifyContent: 'center', marginBottom: 14,
                      }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'rgba(163,230,53,0.12)', padding: '5px 12px', borderRadius: 20,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#a3e635"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z"/></svg>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#a3e635', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                            Sconto esclusivo da Bi
                          </span>
                        </div>
                      </div>

                      {/* Discount title */}
                      <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6, textAlign: 'center' }}>
                        {discount.title || discount.discount_value}
                      </h3>
                      {discount.description && (
                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 16, textAlign: 'center' }}>
                          {discount.description}
                        </p>
                      )}

                      {inlineRedemption?.status === 'redeemed' ? (
                        /* Already used */
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: 'rgba(255,255,255,0.08)', padding: '10px 20px', borderRadius: 12,
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Sconto già utilizzato</span>
                          </div>
                        </div>
                      ) : inlineRedemption?.status === 'generated' ? (
                        /* QR ready — show it */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            background: '#fff', borderRadius: 12, padding: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inlineRedemption.qr_code)}`}
                              alt="QR Code"
                              style={{ width: 160, height: 160 }}
                            />
                          </div>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                            Mostra questo QR in cassa per ottenere lo sconto
                          </p>
                        </div>
                      ) : (
                        /* Not yet unlocked — unlock button */
                        <button
                          onClick={async () => {
                            setInlineGenerating(true)
                            try { await inlineGenerateRedemption() } catch (e) { console.error(e) }
                            finally { setInlineGenerating(false) }
                          }}
                          disabled={inlineGenerating || inlineRedemptionLoading}
                          style={{
                            width: '100%', padding: '14px 20px', borderRadius: 12,
                            background: 'linear-gradient(135deg, #a3e635, #4ade80)', color: '#000', border: 'none',
                            fontSize: 15, fontWeight: 700, cursor: 'pointer',
                            opacity: inlineGenerating ? 0.5 : 1,
                          }}
                        >
                          {inlineGenerating ? 'Sblocco in corso...' : 'Sblocca il tuo sconto'}
                        </button>
                      )}

                      {/* Newsletter CTA */}
                      <AnimatePresence mode="wait">
                        {newsletterStatus === 'success' || newsletterStatus === 'exists' ? (
                          <motion.div
                            key="subscribed"
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              marginTop: 14, padding: '10px 0',
                            }}
                          >
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.1, type: 'spring', stiffness: 500, damping: 15 }}
                              style={{
                                width: 24, height: 24, borderRadius: '50%',
                                background: 'rgba(163,230,53,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </motion.div>
                            <span style={{ fontSize: 13, color: '#a3e635', fontWeight: 600 }}>
                              {newsletterStatus === 'exists' ? 'Sei già iscritto!' : 'Newsletter attivata!'}
                            </span>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="subscribe"
                            exit={{ opacity: 0 }}
                            onClick={async () => {
                              if (!user?.email) return
                              setNewsletterStatus('loading')
                              if (!isSupabaseConfigured()) {
                                setTimeout(() => setNewsletterStatus('success'), 500)
                                return
                              }
                              const { error } = await supabase
                                .from('newsletter_subscribers')
                                .insert({ email: user.email.trim().toLowerCase() })
                              if (error?.code === '23505') {
                                setNewsletterStatus('exists')
                              } else if (error) {
                                setNewsletterStatus(null)
                              } else {
                                setNewsletterStatus('success')
                              }
                            }}
                            disabled={newsletterStatus === 'loading'}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600,
                              marginTop: 14, width: '100%', padding: 0,
                              opacity: newsletterStatus === 'loading' ? 0.5 : 1,
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                            </svg>
                            {newsletterStatus === 'loading' ? 'Iscrizione...' : 'Resta aggiornato sui nuovi sconti'}
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    /* ── Not logged in: FOMO design ── */
                    <motion.div
                      animate={{ boxShadow: ['0 0 0 0 rgba(163,230,53,0)', '0 0 24px 4px rgba(163,230,53,0.12)', '0 0 0 0 rgba(163,230,53,0)'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        background: 'linear-gradient(145deg, #22181C 0%, #2a2025 100%)',
                        borderRadius: 16, padding: '24px 20px',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {/* Animated shimmer */}
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                        style={{
                          position: 'absolute', top: 0, left: 0,
                          width: '50%', height: '100%',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
                          pointerEvents: 'none', zIndex: 1,
                        }}
                      />

                      {/* Decorative glow */}
                      <div style={{
                        position: 'absolute', top: -40, right: -40,
                        width: 140, height: 140,
                        background: 'radial-gradient(circle, rgba(163,230,53,0.12) 0%, transparent 70%)',
                        borderRadius: '50%', pointerEvents: 'none',
                      }} />

                      {/* Badge */}
                      <div style={{
                        display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2,
                        marginBottom: 14,
                      }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'rgba(163,230,53,0.12)', padding: '5px 12px', borderRadius: 20,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#a3e635"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z"/></svg>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#a3e635', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                            Sconto esclusivo da Bi
                          </span>
                        </div>
                      </div>

                      {/* Discount title */}
                      <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6, position: 'relative', zIndex: 2, textAlign: 'center' }}>
                        {discount.title || discount.discount_value}
                      </h3>
                      {discount.description && (
                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 4, position: 'relative', zIndex: 2, textAlign: 'center' }}>
                          {discount.description}
                        </p>
                      )}

                      {/* Blurred QR + Lock */}
                      <div
                        onClick={() => navigate('/login', { state: { from: window.location.pathname, discount: true } })}
                        style={{
                          position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                          margin: '20px 0 8px', cursor: 'pointer', zIndex: 2,
                        }}
                      >
                        <div style={{
                          width: 140, height: 140, position: 'relative',
                          filter: 'blur(8px)', opacity: 0.35,
                        }}>
                          <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
                            {[0,1,2,3,4,5,6].map(row =>
                              [0,1,2,3,4,5,6].map(col => {
                                const on = (row + col) % 3 !== 0 || (row < 3 && col < 3) || (row < 3 && col > 3) || (row > 3 && col < 3)
                                return on ? (
                                  <rect key={`${row}-${col}`} x={col * 20} y={row * 20} width="16" height="16" rx="2" fill="#fff" />
                                ) : null
                              })
                            )}
                            <rect x="0" y="0" width="52" height="52" rx="4" stroke="#fff" strokeWidth="4" fill="none" />
                            <rect x="88" y="0" width="52" height="52" rx="4" stroke="#fff" strokeWidth="4" fill="none" />
                            <rect x="0" y="88" width="52" height="52" rx="4" stroke="#fff" strokeWidth="4" fill="none" />
                            <rect x="12" y="12" width="28" height="28" rx="2" fill="#fff" />
                            <rect x="100" y="12" width="28" height="28" rx="2" fill="#fff" />
                            <rect x="12" y="100" width="28" height="28" rx="2" fill="#fff" />
                          </svg>
                        </div>

                        {/* Lock icon overlay */}
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none',
                        }}>
                          <motion.div
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                              width: 52, height: 52, borderRadius: '50%',
                              background: 'rgba(163,230,53,0.15)',
                              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: '1px solid rgba(163,230,53,0.25)',
                            }}
                          >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                          </motion.div>
                        </div>
                      </div>

                      {/* How it works — 3 steps */}
                      <div style={{
                        display: 'flex', gap: 12, margin: '16px 0 20px',
                        position: 'relative', zIndex: 2,
                      }}>
                        {[
                          { icon: (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                          ), text: 'Iscriviti gratis' },
                          { icon: (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                          ), text: 'Sblocca il QR' },
                          { icon: (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                            </svg>
                          ), text: 'Mostralo in cassa' },
                        ].map((step, i, arr) => (
                          <Fragment key={i}>
                            <div style={{
                              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                            }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: 'rgba(163,230,53,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {step.icon}
                              </div>
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textAlign: 'center' }}>
                                {step.text}
                              </span>
                            </div>
                            {i < arr.length - 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 20 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 18l6-6-6-6"/>
                                </svg>
                              </div>
                            )}
                          </Fragment>
                        ))}
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => navigate('/login', { state: { from: window.location.pathname, discount: true } })}
                        style={{
                          width: '100%', padding: '14px 20px', borderRadius: 12,
                          background: 'linear-gradient(135deg, #a3e635, #4ade80)', color: '#000', border: 'none',
                          fontSize: 15, fontWeight: 700, cursor: 'pointer',
                          position: 'relative', zIndex: 2,
                        }}
                      >
                        Iscriviti gratis per sbloccare
                      </button>

                      {/* Social proof */}
                      {discount.total_redeemed > 0 && (
                        <p style={{
                          fontSize: 12, color: 'rgba(255,255,255,0.25)',
                          textAlign: 'center', marginTop: 10,
                          position: 'relative', zIndex: 2,
                        }}>
                          {discount.total_redeemed} {discount.total_redeemed === 1 ? 'persona ha' : 'persone hanno'} già sbloccato
                        </p>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 20 }} />

              {/* Chi è Bi */}
              <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                <div style={{
                  background: '#F0EBE3', borderRadius: 16, padding: '24px 20px',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <img
                      src="/bi-photo.JPG"
                      alt="Bi"
                      style={{
                        width: 52, height: 52, borderRadius: '50%',
                        objectFit: 'cover', flexShrink: 0,
                        border: '2px solid rgba(232,69,60,0.2)',
                      }}
                    />
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#22181C' }}>Ciao, sono Bi</p>
                      <p style={{ fontSize: 13, color: '#8C7A62', marginTop: 1 }}>La tua guida a Torino</p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: '#3D3428', marginBottom: 16 }}>
                    Consiglio solo posti dove tornerei. Niente sponsorizzazioni, niente fuffa — solo i locali che amo davvero, provati e riprovati.
                  </p>

                  {/* Social links + About */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href="https://instagram.com/chiamamibi" target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: '8px 14px',
                      textDecoration: 'none', color: '#22181C', fontSize: 13, fontWeight: 600,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22181C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                      </svg>
                      Instagram
                    </a>
                    <a href="https://tiktok.com/@chiamamibi" target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: '8px 14px',
                      textDecoration: 'none', color: '#22181C', fontSize: 13, fontWeight: 600,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#22181C">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 00-.82-.05A6.34 6.34 0 003.15 15a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.8a8.25 8.25 0 004.76 1.5V6.86a4.84 4.84 0 01-1-.17z"/>
                      </svg>
                      TikTok
                    </a>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => navigate('/about')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#E8453C', fontSize: 13, fontWeight: 700, padding: '8px 0',
                      }}
                    >
                      Scopri di più
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  </div>
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
        </div>

        {/* Floating discount bar — Airbnb style white bottom bar */}
        <FloatingDiscountBar discount={discount} restaurantId={restaurant.id} />
      </motion.div>
    </div>
  )
}
