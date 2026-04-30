import { motion, useAnimate, AnimatePresence } from 'framer-motion'
import { Fragment, useRef, useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import PhotoCarousel from './PhotoCarousel'
import NearbySection from './NearbySection'
import Footer from '../Layout/Footer'
import SaveButton from './SaveButton'
import OrariLocale from './OrariLocale'
import HoursPill from '../HoursPill'
import { useOrariStatus } from '../../lib/hooks/useOrariStatus'
import QRCodeDisplay from '../Discount/QRCodeDisplay'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useActiveDiscounts, useRestaurantDiscount, useUserRedemption } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'

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

  const displaySub = isRedeemed ? t('discount.alreadyUsed') : 'Sconto attivo'

  return (
    <>
      <motion.div
        className="rs-sticky-disc"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          position: 'fixed',
          left: 14, right: 14,
          bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
          height: 68,
          borderRadius: 999,
          zIndex: 40,
          display: 'flex', alignItems: 'center',
          gap: 10,
          padding: '0 8px 0 20px',
          background: 'linear-gradient(135deg, #A3E635 0%, #4ADE80 100%)',
          boxShadow: '0 8px 24px rgba(74,222,128,.40), 0 2px 10px rgba(0,0,0,.10)',
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Chiudi"
          style={{
            position: 'absolute', top: -8, right: 4, zIndex: 1,
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--color-ink, #22181C)', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 6px rgba(34,24,28,.2)',
            padding: 0,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 14.5,
            letterSpacing: '-0.01em', color: '#22181C',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {displayTitle}
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 700,
            color: 'rgba(34,24,28,.72)', marginTop: 2, letterSpacing: '0.02em',
          }}>
            {displaySub}
          </span>
        </div>

        {isRedeemed ? (
          <span style={{
            flex: '0 0 auto', fontSize: 12, fontWeight: 700,
            color: 'rgba(34,24,28,.55)', padding: '0 14px',
          }}>
            {t('discount.alreadyUsed')}
          </span>
        ) : isGenerated ? (
          <button
            onClick={() => setShowQR(true)}
            style={{
              flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 44, padding: '0 18px',
              background: '#22181C', color: '#fff',
              borderRadius: 999, border: 'none',
              fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 13,
              letterSpacing: '-0.01em', cursor: 'pointer',
            }}
          >
            Mostra QR
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </button>
        ) : (
          <button
            onClick={handleUnlock}
            disabled={generating || redemptionLoading}
            style={{
              flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 44, padding: '0 18px',
              background: '#22181C', color: '#fff',
              borderRadius: 999, border: 'none',
              fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 13,
              letterSpacing: '-0.01em', cursor: 'pointer',
              opacity: generating ? 0.5 : 1,
            }}
          >
            {generating ? '...' : 'Usa sconto'}
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
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
  const [newsletterStatus, setNewsletterStatus] = useState(null)
  const inlineDiscount = activeDiscounts.find(d => d.restaurant_id === restaurant?.id)
  const { redemption: inlineRedemption, loading: inlineRedemptionLoading, generateRedemption: inlineGenerateRedemption } = useUserRedemption(inlineDiscount?.id, user?.id)
  const { status: orariStatus } = useOrariStatus(restaurant)

  // Desktop detection for animation direction (reactive — updates on resize)
  const isDesktop = useIsDesktop()

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

  // Sticky header detection (photo is now in-flow inside scroll — no parallax needed)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        // Sticky header threshold: 45vh-60 on mobile, 480px on desktop (after hero 520)
        const photoH = isDesktop ? 480 : el.clientHeight * 0.45 - 60
        setShowStickyHeader(el.scrollTop > photoH)
        ticking = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [isDesktop])

  const handleClose = useCallback(async () => {
    const exitAnim = isDesktop
      ? animateSheet(sheetScope.current, { opacity: 0, y: 8 }, { duration: 0.2, ease: [0.4, 0, 0.7, 0.2] })
      : Promise.all([
          animateBackdrop(backdropScope.current, { opacity: 0 }, { duration: 0.2, ease: 'easeOut' }),
          animateSheet(sheetScope.current, { y: '100%', opacity: 0 }, { duration: 0.28, ease: [0.4, 0, 0.7, 0.2] }),
        ])
    await exitAnim
    onClose()
  }, [onClose, animateBackdrop, animateSheet, backdropScope, sheetScope, isDesktop])

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
    <div className="fixed inset-0 z-50 flex flex-col restaurant-sheet-root">
      <style>{`
        @media (min-width: 768px) {
          /* Full-page scheda: v4-desktop-pagine.html §1115-1290
             Hero 520px full-width + 2-col grid (1.4/1) + sticky sconto pill */
          .restaurant-sheet-root {
            top: 56px !important;
            background: var(--color-page, #FAF7F2) !important;
          }
          .restaurant-sheet-root .rs-backdrop { display: none !important; }
          .restaurant-sheet-root .rs-sheet {
            pointer-events: auto !important;
            width: 100% !important;
            max-width: none !important;
            height: 100% !important;
            overflow: hidden !important;
            background: var(--color-page, #FAF7F2) !important;
          }
          /* Mobile photo carousel hidden — desktop uses dedicated hero */
          .restaurant-sheet-root .rs-photo-area { display: none !important; }
          .restaurant-sheet-root .rs-scroll {
            flex: 1 1 0% !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding-bottom: 110px !important;
          }
          /* Desktop hero 520px — photo con rounded corners (mockup §375-386) */
          .restaurant-sheet-root .rs-desktop-hero-wrap {
            max-width: 1280px;
            margin: 0 auto;
            padding: 24px 40px 28px;
          }
          .restaurant-sheet-root .rs-desktop-hero {
            display: block !important;
            position: relative;
            height: 520px;
            border-radius: 28px;
            overflow: hidden;
            box-shadow: var(--shadow-md);
          }
          .restaurant-sheet-root .rs-desktop-hero::after {
            content: "";
            position: absolute; inset: 0;
            background: linear-gradient(180deg, rgba(0,0,0,.25) 0%, transparent 30%, transparent 70%, rgba(0,0,0,.55) 100%);
            pointer-events: none;
            z-index: 2;
          }
          .restaurant-sheet-root .rs-content-card {
            margin-top: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            padding-top: 0 !important;
          }
          .restaurant-sheet-root .rs-motion-content {
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 40px 40px !important;
            background: transparent !important;
            border-radius: 0 !important;
            display: grid !important;
            grid-template-columns: 1.4fr 1fr;
            column-gap: 40px;
            row-gap: 0;
          }
          /* Section placement on desktop grid */
          .restaurant-sheet-root .sec-name,
          .restaurant-sheet-root .sec-addr,
          .restaurant-sheet-root .sec-chips,
          .restaurant-sheet-root .sec-cta,
          .restaurant-sheet-root .sec-sconto,
          .restaurant-sheet-root .sec-secondobi,
          .restaurant-sheet-root .sec-oro,
          .restaurant-sheet-root .sec-video { grid-column: 1; }
          .restaurant-sheet-root .sec-orari,
          .restaurant-sheet-root .sec-ciao,
          .restaurant-sheet-root .sec-nearby { grid-column: 2; }
          .restaurant-sheet-root .sec-footer { grid-column: 1 / -1; }
          /* Desktop typography: left-aligned name 52px */
          .restaurant-sheet-root .sec-name {
            text-align: left !important;
            font-size: 52px !important;
            line-height: 1 !important;
            letter-spacing: -0.03em !important;
            margin-top: 0 !important;
            margin-bottom: 10px !important;
          }
          .restaurant-sheet-root .sec-addr {
            justify-content: flex-start !important;
            text-align: left !important;
            font-size: 14px !important;
            margin-bottom: 18px !important;
          }
          .restaurant-sheet-root .sec-chips {
            justify-content: flex-start !important;
            margin-bottom: 22px !important;
          }
          .restaurant-sheet-root .sec-divider { display: none !important; }
          .restaurant-sheet-root .sec-cta { justify-content: flex-start !important; margin-bottom: 22px !important; }
          /* Hide floating buttons on desktop — sticky header handles back/share/save */
          .restaurant-sheet-root .rs-back-btn { display: none !important; }
          .restaurant-sheet-root .rs-top-actions { display: none !important; }
          .restaurant-sheet-root .rs-side-map { display: none !important; }
          /* Sticky header: full width on desktop */
          .restaurant-sheet-root .rs-sticky-header {
            top: 56px !important;
            z-index: 39 !important;
          }
          /* Sticky sconto pill: min-width 460 on desktop (mockup §413-439) */
          .restaurant-sheet-root .rs-sticky-disc {
            min-width: 460px !important;
            bottom: 22px !important;
          }
          /* Show desktop hero wrap that is display:none inline */
          .restaurant-sheet-root .rs-desktop-hero-wrap {
            display: block !important;
          }
        }
      `}</style>

      {/* Backdrop — mobile only */}
      <motion.div
        ref={backdropScope}
        className="absolute inset-0 bg-black/50 rs-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
      />

      {/* Full page sheet — slides from bottom on mobile, from left on desktop */}
      <motion.div
        ref={sheetScope}
        className="relative flex flex-1 flex-col overflow-hidden bg-white rs-sheet"
        initial={isDesktop ? { opacity: 0, y: 12 } : { y: '100%', opacity: 0 }}
        animate={isDesktop ? { opacity: 1, y: 0 } : { y: 0, opacity: 1 }}
        transition={isDesktop
          ? { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }
          : { type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }
        }
      >
        {/* Back button — above scroll content (hidden once sticky header appears) */}
        <button
          className="rs-back-btn"
          onClick={handleClose}
          style={{
            position: 'absolute', top: 'calc(14px + env(safe-area-inset-top, 0px))', left: 14, zIndex: 20,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'saturate(180%) blur(10px)',
            WebkitBackdropFilter: 'saturate(180%) blur(10px)',
            boxShadow: '0 4px 14px rgba(34, 24, 28, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(34, 24, 28, 0.08)', cursor: 'pointer', color: '#22181C',
            opacity: showStickyHeader ? 0 : 1,
            pointerEvents: showStickyHeader ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>

        {/* Share + Save — above scroll content (hidden once sticky header appears) */}
        <div className="rs-top-actions" style={{
          position: 'absolute', top: 'calc(14px + env(safe-area-inset-top, 0px))', right: 14, zIndex: 20,
          display: 'flex', gap: 10,
          opacity: showStickyHeader ? 0 : 1,
          pointerEvents: showStickyHeader ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}>
          <button
            onClick={handleShare}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'saturate(180%) blur(10px)',
              WebkitBackdropFilter: 'saturate(180%) blur(10px)',
              boxShadow: '0 4px 14px rgba(34, 24, 28, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(34, 24, 28, 0.08)', cursor: 'pointer', color: '#22181C',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
          {onSaveToggle && <SaveButton saved={saved} onClick={onSaveToggle} size="md" />}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none rs-scroll" style={{ position: 'relative', zIndex: 1, paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>

          {/* Mobile photo carousel — inside scroll so horizontal swipes hit useDrag
              and vertical swipes bubble up to the scroll container. Renderizzato
              SOLO su mobile: prima conviveva nel DOM con la DesktopPhotoGrid
              raddoppiando il numero di <img> + istanziando gesture handler
              inutilmente quando invisibile. */}
          {!isDesktop && (
            <div ref={photoRef} className="rs-photo-area" style={{ height: '45vh', overflow: 'hidden', position: 'relative', zIndex: 0 }}>
              <PhotoCarousel photos={restaurant.photos || []} height="45vh" restaurantName={restaurant.name} city={restaurant.city} dotsPosition="right" hideDots onIndexChange={setPhotoIndex} />
            </div>
          )}

          {/* Sticky header bar — appears when scrolled past photo */}
          <div className="rs-sticky-header" style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            background: '#fff',
            padding: `calc(10px + env(safe-area-inset-top, 0px)) 14px 10px`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: (isDesktop || showStickyHeader) ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
            transform: (isDesktop || showStickyHeader) ? 'translateY(0)' : 'translateY(-100%)',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
            pointerEvents: (isDesktop || showStickyHeader) ? 'auto' : 'none',
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

          {/* Desktop hero — full-width 520px photo with corallo radius (mockup §1138-1151) */}
          {isDesktop && (restaurant.photos || []).length > 0 && (
            <div className="rs-desktop-hero-wrap" style={{ display: 'none' }}>
              <div className="rs-desktop-hero">
                <PhotoCarousel
                  photos={restaurant.photos}
                  height="520px"
                  restaurantName={restaurant.name}
                  city={restaurant.city}
                  dotsPosition="center"
                  showArrows
                  showCounter
                />
              </div>
            </div>
          )}

          {/* White content card — scrolls up over photo */}
          <div className="rs-content-card" style={{
            background: '#fff',
            borderRadius: '20px 20px 0 0',
            marginTop: -24,
            position: 'relative', zIndex: 2,
          }}>

            {/* Photo counter — anchored to white card, mobile only */}
            {!isDesktop && photoCount > 1 && (
              <div style={{
                position: 'absolute', top: -36, right: 16, zIndex: 3,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                borderRadius: 14, padding: '4px 10px',
                fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: 0.5,
              }}>
                {photoIndex + 1} / {photoCount}
              </div>
            )}

            <motion.div
              className="flex flex-col rs-motion-content"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              style={{
                padding: '28px 24px 0px',
                background: '#fff',
                borderRadius: '20px 20px 0 0',
              }}
            >
              {/* Restaurant name — centered, Poppins 700 (max loaded weight) */}
              <motion.h1 className="sec-name" variants={itemVariants} style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 900,
                fontSize: 28,
                color: 'var(--color-ink, #22181C)',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                textAlign: 'center',
                marginBottom: 10,
                marginTop: 6,
              }}>
                {restaurant.name}
              </motion.h1>

              {/* Address */}
              <motion.div className="sec-addr" variants={itemVariants} style={{
                fontSize: 12.5, color: 'var(--color-ink-70, rgba(34,24,28,.7))',
                textAlign: 'center', lineHeight: 1.4,
                fontWeight: 500, marginBottom: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>{restaurant.address}</span>
                {distance != null && (
                  <span style={{ color: 'var(--color-ink-40)' }}> · {formatDistance(distance)}</span>
                )}
              </motion.div>

              {/* Categories + price — pills */}
              <motion.div className="sec-chips" variants={itemVariants} style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: 6, flexWrap: 'wrap', marginBottom: 20,
              }}>
                {categories.map((cat) => (
                  <span key={cat.name} style={{
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--color-corallo-ink)',
                    border: '1.5px solid var(--color-corallo)',
                    background: '#fff',
                    padding: '6px 12px', borderRadius: 999,
                    letterSpacing: '-0.01em',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    {cat.emoji} {cat.name}
                  </span>
                ))}
                {priceLabel && (
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--color-ink)',
                    background: 'var(--color-ink-05)',
                    padding: '6px 12px', borderRadius: 999,
                  }}>
                    {priceLabel}
                  </span>
                )}
                {orariStatus && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
                    color: orariStatus.openNow ? '#2E7D5B' : 'var(--color-ink-55)',
                    background: orariStatus.openNow ? '#E5F3EA' : 'var(--color-ink-05)',
                    padding: '6px 12px', borderRadius: 999,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: orariStatus.openNow ? '#2E7D5B' : '#9a8e84',
                    }} />
                    {orariStatus.openNow
                      ? (orariStatus.closesAt ? `Aperto · chiude ${orariStatus.closesAt}` : 'Aperto ora')
                      : 'Chiuso ora'}
                  </span>
                )}
              </motion.div>

              {/* Divider */}
              <div className="sec-divider" style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 20 }} />

              {/* CTA row — beige main + heart ghost */}
              <motion.div className="sec-cta" variants={itemVariants} style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center', alignItems: 'center' }}>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, maxWidth: 280, padding: '13px 18px', borderRadius: 999,
                    textAlign: 'center',
                    fontSize: 14, fontWeight: 800, textDecoration: 'none',
                    background: '#F2EDE1', color: 'var(--color-ink)',
                    border: 'none', letterSpacing: '-0.01em',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                    </svg>
                    Indicazioni
                  </a>
                )}
                {phoneUrl && (
                  <a href={phoneUrl} style={{
                    width: 46, height: 46, borderRadius: '50%',
                    background: '#fff', border: '1px solid var(--color-ink-05)',
                    display: 'grid', placeItems: 'center',
                    textDecoration: 'none', color: 'var(--color-ink)',
                    flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                  </a>
                )}
                {restaurant.website && (
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer" style={{
                    width: 46, height: 46, borderRadius: '50%',
                    background: '#fff', border: '1px solid var(--color-ink-05)',
                    display: 'grid', placeItems: 'center',
                    textDecoration: 'none', color: 'var(--color-ink)',
                    flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                    </svg>
                  </a>
                )}
              </motion.div>

              {/* ── Sconto banner (mockup §289-302 `.sconto-link`) ── */}
              {discount && (
                <motion.button
                  className="sec-sconto"
                  variants={itemVariants}
                  onClick={async () => {
                    if (!user) {
                      navigate('/login', { state: { from: window.location.pathname, discount: true } })
                      return
                    }
                    if (inlineRedemption?.status === 'redeemed') return
                    if (inlineRedemption?.status === 'generated') {
                      setInlineShowQR(true)
                      return
                    }
                    setInlineGenerating(true)
                    try {
                      const result = await inlineGenerateRedemption()
                      if (result) setInlineShowQR(true)
                    } finally {
                      setInlineGenerating(false)
                    }
                  }}
                  style={{
                    display: 'block', width: '100%',
                    border: '1px solid var(--color-ink-05)', background: '#fff',
                    borderRadius: 14, overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
                    textAlign: 'left', padding: 0, marginBottom: 20,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {/* Banner verde 135° 2-stop */}
                  <div style={{
                    height: 48, padding: '0 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #A3E635, #4ADE80)',
                    color: 'var(--color-ink)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em',
                  }}>
                    <span>{discount.title || discount.discount_value}</span>
                    {discount.valid_days_label && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                        background: 'rgba(255,255,255,0.55)', color: 'var(--color-ink)',
                        padding: '3px 8px', borderRadius: 999,
                      }}>
                        {discount.valid_days_label}
                      </span>
                    )}
                  </div>
                  {/* Body */}
                  <div style={{ padding: '11px 16px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-ink)', letterSpacing: '-0.01em' }}>
                        {discount.description || 'Sconto attivo'}
                      </div>
                      {inlineRedemption?.status === 'redeemed' && (
                        <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2, fontWeight: 500 }}>
                          Già utilizzato
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 800, color: 'var(--color-ink)',
                      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                    }}>
                      {inlineRedemption?.status === 'redeemed'
                        ? '✓'
                        : inlineRedemption?.status === 'generated'
                          ? 'Mostra →'
                          : 'Usa →'}
                    </span>
                  </div>
                </motion.button>
              )}

              {/* ── Secondo Bi ── */}
              {reviewText && (
                <motion.div className="sec-secondobi" variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--color-corallo-ink)', textTransform: 'uppercase', marginBottom: 10 }}>
                    Secondo Bi
                  </div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-ink)', fontWeight: 500 }}>
                    {reviewText}
                  </p>
                  <div style={{ marginTop: 12, fontFamily: 'var(--font-hand, "Caveat", cursive)', fontSize: 22, color: 'var(--color-corallo-ink)', lineHeight: 1 }}>
                    — Bi
                  </div>
                  {!isItalian && (
                    <p style={{ fontSize: 12, color: 'var(--color-ink-70)', marginTop: 8, fontStyle: 'italic' }}>
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Orari Google Places (dopo Secondo Bi come nel mockup) ── */}
              <motion.div className="sec-orari" variants={itemVariants} style={{ marginBottom: 20 }}>
                <OrariLocale restaurant={restaurant} />
              </motion.div>

              {/* ── Cosa prendere — oro gradient card ── */}
              {tipText && (
                <motion.div className="sec-oro" variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{
                    borderRadius: 14, padding: '16px 18px',
                    background: 'linear-gradient(135deg, var(--color-oro, #B08954) 0%, var(--color-oro-deep, #8E6B3E) 100%)',
                    color: '#fff',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🍴</span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.01em', marginBottom: 4, color: '#fff' }}>
                        Cosa prendere
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.92)', fontWeight: 500 }}>
                        {tipText}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Video links — "Ho fatto un video" */}
              {(restaurant.instagram_reel || restaurant.tiktok_url) && (
                <motion.div className="sec-video" variants={itemVariants} style={{ marginBottom: 20 }}>
                  <div style={{
                    borderRadius: 16, padding: '16px 18px',
                    background: '#fff',
                    border: '1px solid #E8E0D6',
                    boxShadow: '0 2px 8px rgba(34,24,28,0.04)',
                  }}>
                    <p style={{
                      fontSize: 14, fontWeight: 700, color: '#22181C',
                      margin: '0 0 12px', lineHeight: 1.4,
                    }}>
                      Ho fatto un video in questo posto, guardalo!
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {restaurant.instagram_reel && (
                        <a href={restaurant.instagram_reel} target="_blank" rel="noopener noreferrer" style={{
                          flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '10px 14px', borderRadius: 10,
                          background: '#F0EBE3', textDecoration: 'none',
                          border: 'none',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#22181C' }}>Reel</span>
                        </a>
                      )}
                      {restaurant.tiktok_url && (
                        <a href={restaurant.tiktok_url} target="_blank" rel="noopener noreferrer" style={{
                          flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '10px 14px', borderRadius: 10,
                          background: '#F0EBE3', textDecoration: 'none',
                          border: 'none',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#22181C">
                            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.69a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.12z"/>
                          </svg>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#22181C' }}>TikTok</span>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}


              {/* Ciao sono Bi */}
              <motion.div className="sec-ciao" variants={itemVariants} style={{ marginBottom: 20 }}>
                <div style={{
                  background: 'var(--color-cream-deep, #F1EBE0)',
                  borderRadius: 20, padding: '20px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  border: '1px solid rgba(176,137,84,.2)',
                }}>
                  <div style={{
                    width: 54, height: 54, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #F4E7CC, #E8453C)',
                    color: '#fff', display: 'grid', placeItems: 'center',
                    fontWeight: 900, fontSize: 20, flexShrink: 0,
                    border: '2px solid #fff',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                  }}>
                    <img src="/bi-photo.JPG" alt="Bi" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = 'B' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Ciao, sono Bi</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-ink-70)', marginTop: 2, marginBottom: 8 }}>La tua guida a Torino</div>
                    <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-ink)', marginBottom: 10 }}>
                      Consiglio solo posti dove tornerei. Niente sponsorizzazioni, niente fuffa — solo i locali che amo davvero.
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <a href="https://instagram.com/chiamamibi" target="_blank" rel="noopener noreferrer" style={{
                        padding: '6px 10px', background: '#fff', border: '1px solid var(--color-ink-05)',
                        borderRadius: 999, fontSize: 11, fontWeight: 700, color: 'var(--color-ink)',
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        📷 Instagram
                      </a>
                      <a href="https://tiktok.com/@chiamamibi" target="_blank" rel="noopener noreferrer" style={{
                        padding: '6px 10px', background: '#fff', border: '1px solid var(--color-ink-05)',
                        borderRadius: 999, fontSize: 11, fontWeight: 700, color: 'var(--color-ink)',
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        🎵 TikTok
                      </a>
                    </div>
                    <button
                      onClick={() => navigate('/about')}
                      style={{
                        display: 'inline-block', marginTop: 8,
                        fontSize: 12, fontWeight: 800, color: 'var(--color-corallo-ink)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        textDecoration: 'none',
                      }}
                    >
                      Scopri di più →
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Nearby restaurants */}
              <motion.div className="sec-nearby" variants={itemVariants}>
                <NearbySection
                  currentRestaurant={restaurant}
                  allRestaurants={allRestaurants}
                  onSelect={onSelectNearby}
                />
              </motion.div>

              {/* Footer */}
              <motion.div className="sec-footer" variants={itemVariants} style={{ marginTop: 8 }}>
                <Footer />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Desktop side map panel — hidden on mobile, shown on ≥768px */}
        <div className="rs-side-map" style={{ display: 'none' }}>
          {restaurant.latitude && restaurant.longitude && (
            <div style={{ flex: 1, position: 'relative' }}>
              <img
                src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+E8453C(${restaurant.longitude},${restaurant.latitude})/${restaurant.longitude},${restaurant.latitude},15,0/400x600@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN || ''}`}
                alt="Mappa"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #E8E5DE',
            display: 'flex', gap: 10,
            background: '#fff',
          }}>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                flex: 1, padding: '12px 0', borderRadius: 12, textAlign: 'center',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                background: '#E8453C', color: '#fff', border: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                Indicazioni
              </a>
            )}
            {phoneUrl && (
              <a href={phoneUrl} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, textAlign: 'center',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                background: '#F0EBE3', color: '#22181C', border: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
                Chiama
              </a>
            )}
          </div>
        </div>

        {/* Floating discount bar — Airbnb style white bottom bar */}
        <FloatingDiscountBar discount={discount} restaurantId={restaurant.id} />

        {/* Inline QR modal — triggered by in-page sconto banner click */}
        <AnimatePresence>
          {inlineShowQR && inlineRedemption && inlineDiscount && (
            <QRCodeDisplay
              qrCode={inlineRedemption.qr_code}
              discountTitle={inlineDiscount.title}
              discountValue={inlineDiscount.discount_value}
              onClose={() => setInlineShowQR(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
