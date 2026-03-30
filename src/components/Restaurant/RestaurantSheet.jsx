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
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
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
              background: '#4ADE80', color: '#fff', border: 'none',
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
                fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: 0.5,
              }}>
                {photoIndex + 1} / {photoCount}
              </div>
            )}

            {/* Green discount strip following the card's rounded corners */}
            {discountTitle && (
              <div style={{
                background: '#4ADE80', color: '#fff',
                fontSize: 13, fontWeight: 700,
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
                fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 1.5,
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
                  <span key={cat.name} style={{ fontSize: 15, color: '#666' }}>
                    {cat.emoji} {cat.name}{i < categories.length - 1 ? ' · ' : ''}
                  </span>
                ))}
                {priceLabel && (
                  <span style={{ fontSize: 15, color: '#666' }}>
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
                    fontSize: 15, fontWeight: 600, textDecoration: 'none',
                    background: '#111', color: '#fff',
                  }}>Indicazioni</a>
                )}
                {phoneUrl && (
                  <a href={phoneUrl} style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
                    fontSize: 15, fontWeight: 600, textDecoration: 'none',
                    background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)',
                  }}>Chiama</a>
                )}
                {restaurant.website && (
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
                    fontSize: 15, fontWeight: 600, textDecoration: 'none',
                    background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.15)',
                  }}>Sito</a>
                )}
              </motion.div>

              {/* Recensione di Bi — warm cream card */}
              {reviewText && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{
                    background: '#F5EDE3', borderRadius: 16, padding: '22px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#E8453C', color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, flexShrink: 0,
                      }}>Bi</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#2A2219' }}>Recensione di Bi</span>
                    </div>
                    <p style={{ fontSize: 16, lineHeight: 1.7, color: '#3D3428' }}>
                      "{reviewText}"
                    </p>
                    {!isItalian && (
                      <p style={{ fontSize: 13, color: '#A89A86', marginTop: 8, fontStyle: 'italic' }}>
                        {t('restaurant.originalItalian')}
                      </p>
                    )}

                    {/* Tip di Bi — inside the card */}
                    {tipText && (
                      <div style={{
                        marginTop: 16, paddingTop: 16,
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#E8453C', letterSpacing: 0.5, marginBottom: 6 }}>IL TIP DI BI</p>
                        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#3D3428', fontWeight: 500 }}>
                          "{tipText}"
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Tip di Bi standalone — only if there's a tip but no review */}
              {tipText && !reviewText && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{
                    background: '#F5EDE3', borderRadius: 16, padding: '22px 20px',
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#E8453C', letterSpacing: 0.5, marginBottom: 6 }}>IL TIP DI BI</p>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3D3428', fontWeight: 500 }}>
                      "{tipText}"
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Discount FOMO Section ── */}
              {discount && (
                <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(74,222,128,0)', '0 0 24px 4px rgba(74,222,128,0.12)', '0 0 0 0 rgba(74,222,128,0)'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      background: 'linear-gradient(145deg, #111 0%, #1a1a1a 100%)',
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
                      background: 'radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)',
                      borderRadius: '50%', pointerEvents: 'none',
                    }} />

                    {/* Badge */}
                    <div style={{
                      display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2,
                      marginBottom: 14,
                    }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'rgba(74,222,128,0.12)', padding: '5px 12px', borderRadius: 20,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#4ADE80"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z"/></svg>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ADE80', letterSpacing: 0.8, textTransform: 'uppercase' }}>
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
                      onClick={!user ? () => navigate('/login', { state: { from: window.location.pathname, discount: true } }) : undefined}
                      style={{
                        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        margin: '20px 0 8px', cursor: !user ? 'pointer' : 'default', zIndex: 2,
                      }}
                    >
                      {/* Fake QR grid — blurred */}
                      <div style={{
                        width: 140, height: 140, position: 'relative',
                        filter: 'blur(8px)', opacity: 0.35,
                      }}>
                        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
                          {/* QR-like pattern */}
                          {[0,1,2,3,4,5,6].map(row =>
                            [0,1,2,3,4,5,6].map(col => {
                              const on = (row + col) % 3 !== 0 || (row < 3 && col < 3) || (row < 3 && col > 3) || (row > 3 && col < 3)
                              return on ? (
                                <rect key={`${row}-${col}`} x={col * 20} y={row * 20} width="16" height="16" rx="2" fill="#fff" />
                              ) : null
                            })
                          )}
                          {/* Corner squares */}
                          <rect x="0" y="0" width="52" height="52" rx="4" stroke="#fff" strokeWidth="4" fill="none" />
                          <rect x="88" y="0" width="52" height="52" rx="4" stroke="#fff" strokeWidth="4" fill="none" />
                          <rect x="0" y="88" width="52" height="52" rx="4" stroke="#fff" strokeWidth="4" fill="none" />
                          <rect x="12" y="12" width="28" height="28" rx="2" fill="#fff" />
                          <rect x="100" y="12" width="28" height="28" rx="2" fill="#fff" />
                          <rect x="12" y="100" width="28" height="28" rx="2" fill="#fff" />
                        </svg>
                      </div>

                      {/* Lock icon overlay — wrapper handles centering, inner div animates */}
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
                            background: 'rgba(74,222,128,0.15)',
                            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(74,222,128,0.25)',
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        </motion.div>
                      </div>
                    </div>

                    {/* CTA text */}
                    {!user ? (
                      <button
                        onClick={() => navigate('/login', { state: { from: window.location.pathname, discount: true } })}
                        style={{
                          width: '100%', padding: '14px 20px', borderRadius: 12,
                          background: '#4ADE80', color: '#fff', border: 'none',
                          fontSize: 15, fontWeight: 700, cursor: 'pointer',
                          position: 'relative', zIndex: 2, marginTop: 4,
                        }}
                      >
                        Iscriviti gratis per sbloccare
                      </button>
                    ) : (
                      <p style={{
                        fontSize: 13, color: 'rgba(255,255,255,0.35)',
                        textAlign: 'center', marginTop: 4, position: 'relative', zIndex: 2,
                      }}>
                        Usa il bottone in basso per sbloccare il tuo sconto
                      </p>
                    )}

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
                </motion.div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 20 }} />

              {/* Recommended for */}
              {restaurant.recommended_for?.length > 0 && (
                <motion.div variants={itemVariants} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                  {restaurant.recommended_for.map(tag => (
                    <span key={tag} style={{
                      fontSize: 14, fontWeight: 600, color: '#92700C',
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
                      <p style={{ fontSize: 15, fontWeight: 600 }}>{restaurant.tiktok_url ? 'Guarda su TikTok' : 'Guarda su Instagram'}</p>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Il video di Bi su {restaurant.name}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, opacity: 0.6 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </a>
                </motion.div>
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
        </div>

        {/* Floating discount bar — Airbnb style white bottom bar */}
        <FloatingDiscountBar discount={discount} restaurantId={restaurant.id} />
      </motion.div>
    </div>
  )
}
