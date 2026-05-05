import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { getCurrentMoment } from '../../lib/hours'
import { proxyImg } from '../../lib/supabase'
import SaveButton from '../../components/Restaurant/SaveButton'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import SponsorBanner from '../../components/Home/SponsorBanner'
import TimeContextHero from '../../components/Home/TimeContextHero'
import MomentTabs from '../../components/Home/MomentTabs'
import MomentResultsGrid from '../../components/Home/MomentResultsGrid'
import AskBiChat from '../../components/Home/AskBiChat'
import BiLogoMark from '../../components/UI/BiLogoMark'

function formatCountdown(endsAt) {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return null
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}g ${hours}h`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m`
}

const CATEGORIES = [
  { key: 'aperitivo', emoji: '🥂', label: 'Aperitivo' },
  { key: 'piemontese', emoji: '🍷', label: 'Piemontese' },
  { key: 'pizza', emoji: '🍕', label: 'Pizza' },
  { key: 'giapponese', emoji: '🍣', label: 'Giapponese' },
  { key: 'pesce', emoji: '🐟', label: 'Pesce' },
  { key: 'colazione', emoji: '☕', label: 'Colazione' },
  { key: 'carne', emoji: '🥩', label: 'Carne' },
  { key: 'italiana', emoji: '🍝', label: 'Italiana' },
  { key: 'vegano', emoji: '🥬', label: 'Vegano' },
  { key: 'cocktail', emoji: '🍸', label: 'Cocktail' },
]

function TopBar() {
  // Scroll-aware: la pill destra parte espansa "Chiedi a Bi" e si comprime
  // sul B circolare appena l'utente scrolla (header diventa sticky).
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="hfv4-topbar"
      style={{
        padding: '12px 20px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--color-page, #FAF7F2)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
      }}
    >
      <Link
        to="/"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 0.92,
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 18,
            letterSpacing: '0.02em',
            color: 'var(--color-corallo)',
          }}
        >
          LA GUIDA DI BI
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: '0.15em',
            color: 'var(--color-ink-40, rgba(34,24,28,.4))',
            marginTop: 3,
            textTransform: 'uppercase',
          }}
        >
          by Chiamami Bi
        </span>
      </Link>

      {/* PR20b §1 — pill "Chiedi a Bi" coral. Espansa a top, si comprime
         in solo cerchio B quando l'utente scrolla (header sticky).
         Cerchio interno: bianco/B-coral espanso → coral/B-bianco sticky. */}
      <Link
        to="/chiedi"
        aria-label="Chiedi a Bi"
        style={{
          marginLeft: 'auto',
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: scrolled ? 0 : 8,
          padding: scrolled ? 5 : '5px 16px 5px 5px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, var(--color-corallo) 0%, var(--color-corallo-ink, #C6372F) 100%)',
          color: '#fff',
          textDecoration: 'none',
          boxShadow: '0 6px 14px rgba(232,69,60,.35)',
          border: '2px solid #fff',
          flexShrink: 0,
          transition: 'gap .3s cubic-bezier(.4,0,.2,1), padding .3s cubic-bezier(.4,0,.2,1)',
          overflow: 'visible',
        }}
      >
        <span
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {/* Due "frame" sovrapposti, ognuno coerente al 100% (bg + colore SVG
             matchano sempre). Crossfade solo via opacity → niente più colore
             intermedio mismatched durante la transizione. */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: '#fff',
              color: 'var(--color-corallo, #E8453C)',
              opacity: scrolled ? 0 : 1,
              transition: 'opacity .3s cubic-bezier(.4,0,.2,1)',
            }}
          >
            <BiLogoMark style={{ width: '88%', height: '88%' }} />
          </span>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: 'transparent',
              color: '#fff',
              opacity: scrolled ? 1 : 0,
              transition: 'opacity .3s cubic-bezier(.4,0,.2,1)',
            }}
          >
            <BiLogoMark style={{ width: '88%', height: '88%' }} />
          </span>
          {/* sparkle oro: SOPRA il bordo bianco della pill in entrambi gli
             stati. Border bianco per fondersi col bordo della pill, z-index
             per stare sopra. Fuori dal clipper così non viene tagliato. */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -9,
              right: -9,
              width: 14,
              height: 14,
              background: 'var(--color-oro, #B08954)',
              borderRadius: '50%',
              border: '2px solid #fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.18)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 7,
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1,
              zIndex: 2,
            }}
          >
            ✦
          </span>
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 13.5,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            display: 'inline-block',
            overflow: 'hidden',
            maxWidth: scrolled ? 0 : 120,
            opacity: scrolled ? 0 : 1,
            transition: 'max-width .3s cubic-bezier(.4,0,.2,1), opacity .25s ease',
          }}
        >
          Chiedi a Bi
        </span>
      </Link>
    </div>
  )
}

function HeroPromo({ featured }) {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(() => formatCountdown(featured?.endsAt))
  useEffect(() => {
    if (!featured?.endsAt) { setCountdown(null); return }
    setCountdown(formatCountdown(featured.endsAt))
    const id = setInterval(() => setCountdown(formatCountdown(featured.endsAt)), 60000)
    return () => clearInterval(id)
  }, [featured?.endsAt])
  if (!featured) return null

  const chipLabel = countdown ? `DROP LIVE · ${countdown}` : 'DROP LIVE'
  const claimedCount = featured.claimedCount || 0
  const maxQuantity = featured.maxQuantity || null
  const expiresLabel = featured.expiresLabel || null
  const progressPct = maxQuantity ? Math.min(100, Math.round(claimedCount / maxQuantity * 100)) : null
  const showProgress = progressPct != null || !!countdown || !!expiresLabel
  const mobCountdown = [
    maxQuantity != null ? `${claimedCount} / ${maxQuantity}` : null,
    countdown || expiresLabel,
  ].filter(Boolean).join(' · ')

  return (
    <div className="hfv4-hero-wrap" style={{ padding: '4px 20px 22px' }}>
      <div
        className="hfv4-hero-card"
        style={{
          position: 'relative', background: 'var(--color-corallo)', borderRadius: 28,
          padding: '22px', display: 'grid', gridTemplateColumns: '1fr 108px', gap: 14,
          color: '#fff', overflow: 'hidden', boxShadow: '0 8px 24px rgba(34,24,28,.08)',
        }}
      >
        {/* Body: col sinistra desktop, sotto la foto su mobile */}
        <div className="hfv4-hero-body">
          <span
            className="hfv4-hero-chip"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', background: 'rgba(255,255,255,.18)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              marginBottom: 10, width: 'fit-content',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'hero-pulse 1.4s infinite' }} />
            {chipLabel}
          </span>
          {/* Desktop: titolo pre-line 30→72px */}
          <div
            className="hfv4-hero-title"
            style={{
              fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 30,
              lineHeight: 1.02, letterSpacing: '-0.02em', color: '#fff',
              marginBottom: 8, whiteSpace: 'pre-line',
            }}
          >
            {featured.title}
          </div>
          {/* Mobile-only: sconto 42px + ristorante 24px separati */}
          <div className="hfv4-mob-pct" style={{ display: 'none', fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.025em', marginBottom: 4 }}>
            {featured.discountLabel}
          </div>
          <div className="hfv4-mob-loc" style={{ display: 'none', fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 24, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 10, opacity: 0.95 }}>
            da {featured.restaurantName}
          </div>
          {featured.restLine && (
            <div className="hfv4-hero-rest-line" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.9)', marginBottom: 6 }}>
              {featured.restLine}
            </div>
          )}
          {featured.subtitle && (
            <div className="hfv4-hero-sub" style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', lineHeight: 1.4, marginBottom: 14, maxWidth: 220, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {featured.subtitle}
            </div>
          )}
          {/* Mobile-only: progress bar nel body */}
          {maxQuantity != null && (
            <div
              className="hfv4-mob-progress"
              style={{ display: 'none', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginBottom: 16, padding: '10px 12px', background: 'rgba(255,255,255,.08)', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)' }}
            >
              <span>{claimedCount} riscatti</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct || 0}%`, background: '#fff', borderRadius: 999 }} />
              </div>
              <span style={{ color: '#fff' }}>{maxQuantity} posti</span>
            </div>
          )}
          <div className="hfv4-hero-ctas" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(featured.href)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--color-ink)', color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              {featured.cta} →
            </button>
            {/* Desktop: bottone secondario con nome completo */}
            {featured.secondaryCta && (
              <button
                className="hfv4-hero-cta-ghost hfv4-cta-desk"
                onClick={() => navigate(featured.href)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {featured.secondaryCta}
              </button>
            )}
            {/* Mobile-only: bottone secondario compatto */}
            <button
              className="hfv4-hero-cta-ghost hfv4-cta-mob"
              onClick={() => navigate(featured.href)}
              style={{ display: 'none', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Scopri
            </button>
          </div>
        </div>

        {/* Photo: col destra desktop (108px), sopra il body su mobile (order:-1) */}
        <div
          className="hfv4-hero-photo"
          style={{
            position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #C48745 0%, #7C4A20 55%, #3C2312 100%)',
            minHeight: 160,
          }}
        >
          {featured.photo && (
            <img
              src={featured.photo}
              alt=""
              fetchpriority="high"
              decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(34,24,28,.75) 100%)' }} />

          {/* Mobile-only: countdown pill top-right */}
          {mobCountdown && (
            <span
              className="hfv4-mob-countdown"
              style={{
                display: 'none', position: 'absolute', top: 14, right: 14, zIndex: 2,
                padding: '6px 11px', background: 'rgba(255,255,255,.15)',
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                borderRadius: 999, fontSize: 11, fontWeight: 800, color: '#fff',
                border: '1px solid rgba(255,255,255,.15)',
              }}
            >
              {mobCountdown}
            </span>
          )}
          {/* Mobile-only: categoria + zona bottom-left */}
          {(featured.catEmoji || featured.catName || featured.neighborhood) && (
            <span
              className="hfv4-mob-cat"
              style={{
                display: 'none', position: 'absolute', bottom: 14, left: 14, zIndex: 2,
                fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,.85)', alignItems: 'center', gap: 6,
              }}
            >
              {featured.catEmoji && <span style={{ fontSize: 14, letterSpacing: 0 }}>{featured.catEmoji}</span>}
              {[featured.catName, featured.neighborhood].filter(Boolean).join(' · ')}
            </span>
          )}

          {showProgress && (
            <div
              className="hfv4-hero-progress"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(0deg, rgba(34,24,28,.7), transparent)', color: '#fff' }}
            >
              {progressPct != null && (
                <div style={{ height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: '#fff', borderRadius: 999 }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>
                <span>{maxQuantity ? `${claimedCount} / ${maxQuantity} sbloccati` : (countdown ? `Scade tra ${countdown}` : '')}</span>
                {expiresLabel && <span>{expiresLabel}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryBubbles({ onSelect, onAltro }) {
  const bubbleStyle = () => ({ width:64, height:64, borderRadius:'50%', background:'var(--color-ink-05)', display:'grid', placeItems:'center', fontSize:28 })
  const labelStyle = () => ({ fontSize:11, fontWeight:700, color:'var(--color-ink)', maxWidth:72, textAlign:'center', lineHeight:1.15 })
  const btnStyle = { flex:'0 0 auto', display:'flex', flexDirection:'column', alignItems:'center', gap:6, background:'transparent', border:'none', scrollSnapAlign:'start', cursor:'pointer', padding:0 }
  return (
    <div className="hfv4-cats-wrap">
      <div className="hfv4-cats-row" style={{ display:'flex', gap:10, overflowX:'auto', padding:'6px 20px 20px 20px', WebkitOverflowScrolling:'touch', scrollSnapType:'x mandatory', scrollPaddingLeft:20, scrollbarWidth:'none' }}>
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => onSelect?.(c)} style={btnStyle}>
            <span className="hfv4-cat-bubble" style={bubbleStyle()}>{c.emoji}</span>
            <span className="hfv4-cat-label" style={labelStyle()}>{c.label}</span>
          </button>
        ))}
        <button onClick={onAltro} style={btnStyle}>
          <span className="hfv4-cat-bubble" style={{ width:64, height:64, borderRadius:'50%', background:'var(--color-ink-05)', display:'grid', placeItems:'center', fontSize:22, fontWeight:800, color:'var(--color-ink)' }}>+</span>
          <span className="hfv4-cat-label" style={labelStyle()}>Altro</span>
        </button>
      </div>
    </div>
  )
}

function SectionHead({ title, kicker, subtitle, trailing }) {
  return (
    <div className="hfv4-sec-head" style={{ padding:'0 20px 12px', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {kicker && <span className="hfv4-sec-head-kicker" style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'var(--color-corallo-ink)', textTransform:'uppercase', display:'none' }}>{kicker}</span>}
        <h2 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:22, letterSpacing:'-0.02em', lineHeight:1.1, color:'var(--color-ink)', margin:0 }}>{title}</h2>
        {subtitle && <div className="hfv4-sec-head-sub" style={{ fontSize:12, color:'var(--color-ink-70)', marginTop:2, display:'none' }}>{subtitle}</div>}
      </div>
      {trailing}
    </div>
  )
}

function Rcard({ restaurant, discount, onClick, saved, onToggleSave }) {
  const cat = getCategoryInfo(restaurant.cuisine_type || (restaurant.category && restaurant.category[0]))
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0 ? restaurant.photos[0] : null
  const photoUrl = proxyImg(firstPhoto ? (typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url) : null, { w: 800 })
  const priceStr = restaurant.price_range != null ? '€'.repeat(restaurant.price_range) : null
  const discLabel = discount?.discount_value
    ? (discount.discount_type === 'percentage' ? `-${String(discount.discount_value).replace('%','')}%` : `-${discount.discount_value}€`)
    : null
  return (
    <button className="hfv4-rcard" onClick={() => onClick?.(restaurant)} style={{ flex:'0 0 72%', scrollSnapAlign:'start', background:'#fff', borderRadius:20, overflow:'hidden', border:'1px solid var(--color-ink-05)', textAlign:'left', color:'inherit', boxShadow:'0 1px 3px rgba(34,24,28,.06)', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
      <div style={{ position:'relative', width:'100%', aspectRatio:'16/11', background:'var(--color-ink-05)', overflow:'hidden' }}>
        {photoUrl
          ? <img src={photoUrl} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" decoding="async" />
          : <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', fontSize:28 }}>{cat?.emoji || '🍽️'}</div>
        }
        {discLabel && (
          <span style={{ position:'absolute', top:10, left:10, background:'linear-gradient(135deg, #A3E635, #4ADE80)', color:'#1a4731', fontSize:11, fontWeight:800, padding:'4px 9px', borderRadius:999, letterSpacing:'0.02em' }}>{discLabel}</span>
        )}
        <div style={{ position:'absolute', top:10, right:10 }}>
          <SaveButton saved={saved} onClick={onToggleSave} size="sm" />
        </div>
      </div>
      <div style={{ padding:'10px 14px 14px' }}>
        <div style={{ fontFamily:'var(--font-sans)', fontWeight:800, fontSize:16, lineHeight:1.2, letterSpacing:'-0.01em', color:'var(--color-ink)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{restaurant.name}</div>
        {restaurant.tagline && (
          <div style={{ fontSize:12, color:'var(--color-ink-70)', marginTop:3, lineHeight:1.35, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{restaurant.tagline}</div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
          {cat?.name && <span style={{ background:`${cat.color || '#E8453C'}20`, color:cat.color || '#E8453C', fontWeight:800, fontSize:10, padding:'3px 7px', borderRadius:999, letterSpacing:'0.02em', textTransform:'uppercase' }}>{cat.emoji} {cat.name}</span>}
          {priceStr && <span style={{ fontSize:11, fontWeight:700, color:'var(--color-ink-70)' }}>{priceStr}</span>}
        </div>
        {restaurant.address && (
          <div style={{ fontSize:12, color:'var(--color-ink-70)', marginTop:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {restaurant.address.split(',')[0]}
          </div>
        )}
      </div>
    </button>
  )
}

function SuggestCard() {
  const { user } = useAuth()
  const [showSuggest, setShowSuggest] = useState(false)
  return (
    <>
    <div className="hfv4-suggest-wrap" style={{ padding: '10px 20px 36px' }}>
      <div
        className="hfv4-suggest"
        style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-ink)', color: '#fff', borderRadius: 28, padding: 22, display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}
      >
        <span aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, background: 'radial-gradient(circle, rgba(232,69,60,.25), transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="hfv4-suggest-title" style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 18, lineHeight: 1.15, letterSpacing: '-0.01em', marginBottom: 6 }}>
            Conosci un posto che manca?
          </div>
          <div className="hfv4-suggest-sub" style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.4 }}>
            Scrivimi nome + zona. Se è buono, entra nella guida.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSuggest(true)}
          className="hfv4-suggest-cta"
          style={{ width: '100%', padding: '12px 16px', background: 'var(--color-corallo)', color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em', position: 'relative', zIndex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 14px rgba(232,69,60,.35)' }}
        >
          Suggerisci →
        </button>
      </div>
    </div>
    {showSuggest && (
      <SuggestRestaurantSheet
        userId={user?.id}
        userEmail={user?.email ?? null}
        userName={user?.user_metadata?.full_name ?? null}
        onClose={() => setShowSuggest(false)}
      />
    )}
    </>
  )
}

export default function HomeFeedV4() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { restaurants, loading } = useRestaurants(null)
  const { discounts } = useActiveDiscounts()
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)

  const { active: autoActive, next: autoNext } = getCurrentMoment()
  const [activeMoment, setActiveMoment] = useState(autoActive || autoNext || 'aperitivo')

  const discountByRestaurant = useMemo(
    () => Object.fromEntries((discounts || []).map((d) => [d.restaurant_id, d])),
    [discounts]
  )
  // Hook default-sorts by name; section is "Ultimi aggiunti" so sort
  // explicitly by created_at desc.
  const recent = useMemo(
    () => [...(restaurants || [])]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 8),
    [restaurants]
  )

  const featuredDrop = useMemo(() => {
    const drop = (discounts || []).find((d) => d.is_drop)
    if (!drop) return null
    const r = (restaurants || []).find((x) => x.id === drop.restaurant_id)
    if (!r) return null
    const photos = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null
    const photo = proxyImg(photos ? (typeof photos === 'string' ? photos : photos?.photo_url || photos?.thumb_url) : null, { w: 1600 })
    const label = drop.discount_type === 'percentage' ? `-${String(drop.discount_value).replace('%','')}%` : `-${drop.discount_value}€`
    const catName = r.category?.[0] || r.cuisine_type || ''
    const catInfo = getCategoryInfo(catName)
    const neighborhood = r.address ? r.address.split(',')[0].trim() : ''
    const tagline = r.tagline || ''
    const restLine = [catInfo?.name || catName, neighborhood, tagline].filter(Boolean).slice(0, 3).join(' · ')
    const claimedCount = drop.claimed_count || drop.total_redeemed || 0
    const maxQuantity = drop.max_quantity || null
    const expiresAt = drop.drop_ends_at || drop.ends_at || drop.valid_until || null
    let expiresLabel = null
    if (expiresAt) {
      const exp = new Date(expiresAt)
      const diffHours = (exp - Date.now()) / 3_600_000
      if (diffHours > 0) {
        if (diffHours < 24) {
          expiresLabel = `scade alle ${String(exp.getHours()).padStart(2, '0')}:${String(exp.getMinutes()).padStart(2, '0')}`
        } else {
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
          if (exp.toDateString() === tomorrow.toDateString()) expiresLabel = 'scade domani'
          else { const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']; expiresLabel = `scade il ${exp.getDate()} ${months[exp.getMonth()]}` }
        }
      }
    }
    const subtitleParts = [drop.description || drop.title, drop.conditions].filter(Boolean)
    return {
      title: `${label}\nda ${r.name}.`,
      discountLabel: label,
      restaurantName: r.name,
      restLine,
      subtitle: subtitleParts.join(' · '),
      cta: 'Sblocca sconto',
      secondaryCta: `Scopri ${r.name}`,
      href: `/restaurant/${r.slug}`,
      photo,
      endsAt: drop.drop_ends_at || drop.ends_at || null,
      claimedCount,
      maxQuantity,
      expiresLabel,
      catEmoji: catInfo?.emoji || '',
      catName: catInfo?.name || catName,
      neighborhood,
    }
  }, [discounts, restaurants])

  const onCardClick = (r) => navigate(`/restaurant/${r.slug}`)

  return (
    <div
      className="hfv4-root"
      style={{
        background: 'var(--color-page)',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes hero-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.3); }
        }
        @keyframes drop-live-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.4); }
          60% { box-shadow: 0 0 0 5px rgba(255,255,255,.0); }
        }
        .hfv4-results-row::-webkit-scrollbar,
        .hfv4-moment-tabs::-webkit-scrollbar,
        .hfv4-cats-row::-webkit-scrollbar,
        .hfv4-cards-row::-webkit-scrollbar { display: none; }

        .hfv4-cats-wrap { position: relative; }
        .hfv4-cats-wrap::after {
          content: "";
          position: absolute;
          right: 0; top: 0; bottom: 20px;
          width: 48px;
          background: linear-gradient(90deg, transparent 0%, var(--color-page, #FAF7F2) 90%);
          pointer-events: none;
        }

        /* Mobile <1024px: hero compatto, foto quadrata a destra, body a sinistra. */
        @media (max-width: 1023px) {
          .hfv4-hero-card {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
            padding: 16px !important;
            align-items: stretch !important;
          }
          .hfv4-hero-photo {
            order: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            align-self: stretch !important;
            border-radius: 14px !important;
          }
          .hfv4-hero-body { padding: 0 !important; min-width: 0 !important; }
          .hfv4-hero-chip {
            position: static !important;
            margin-bottom: 8px !important;
            background: rgba(255,255,255,.18) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
          }
          .hfv4-hero-title { display: none !important; }
          .hfv4-mob-pct { display: block !important; font-size: 30px !important; margin-bottom: 2px !important; }
          .hfv4-mob-loc { display: block !important; font-size: 17px !important; margin-bottom: 6px !important; }
          .hfv4-hero-progress { display: none !important; }
          .hfv4-mob-progress { display: flex !important; }
          .hfv4-hero-sub { max-width: none !important; -webkit-line-clamp: 2 !important; display: -webkit-box !important; overflow: hidden !important; }
          .hfv4-hero-ctas {
            display: grid !important;
            grid-template-columns: 1fr auto !important;
            gap: 8px !important;
          }
          .hfv4-cta-desk { display: none !important; }
          .hfv4-cta-mob { display: inline-flex !important; }
          /* Sulla miniatura quadrata gli overlay non si leggono più, li nascondo. */
          .hfv4-mob-countdown { display: none !important; }
          .hfv4-mob-cat { display: none !important; }
        }

        /* Desktop ≥1024px per sezioni originali (hero, cats, Ultimi aggiunti) */
        @media (min-width: 1024px) {
          .hfv4-section,
          .hfv4-hero-wrap,
          .hfv4-cats-wrap {
            max-width: 1240px;
            margin-left: auto; margin-right: auto;
            padding-left: 40px !important; padding-right: 40px !important;
          }
          .hfv4-hero-wrap { padding-top: 16px !important; }
          .hfv4-hero-card {
            grid-template-columns: 1.05fr .95fr !important;
            min-height: 380px !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          .hfv4-hero-body { padding: 52px 56px !important; display: flex; flex-direction: column; justify-content: center; gap: 18px !important; }
          .hfv4-hero-chip { font-size: 12px !important; padding: 7px 13px !important; margin-bottom: 0 !important; animation: drop-live-ring 2s ease-out infinite !important; }
          .hfv4-hero-title { font-size: 72px !important; line-height: .98 !important; letter-spacing: -.03em !important; margin-bottom: 0 !important; white-space: pre-line !important; }
          .hfv4-hero-sub { font-size: 15px !important; max-width: 340px !important; }
          .hfv4-hero-photo { min-height: 0 !important; }
          .hfv4-cats-row {
            overflow-x: visible !important;
            flex-wrap: nowrap !important;
            gap: 22px !important;
            padding: 6px 0 38px !important;
            justify-content: center !important;
          }
          .hfv4-cat-bubble { width: 80px !important; height: 80px !important; font-size: 36px !important; background: #fff !important; border: 1px solid var(--color-ink-05) !important; }
          .hfv4-cat-label { font-size: 13px !important; }
          .hfv4-cards-row {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 18px !important;
            overflow: visible !important;
            padding-left: 0 !important; padding-right: 0 !important;
          }
          /* Grid cells stretch to tallest. Make the card a flex column so
             its body absorbs the extra space — every photo keeps the
             16/11 aspect at the top, no white gap below the address. */
          .hfv4-rcard {
            flex: 1 1 auto !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .hfv4-rcard > div:last-child { flex: 1 1 auto !important; }
          .hfv4-sec-head { padding-left: 0 !important; padding-right: 0 !important; margin-bottom: 22px; }
          .hfv4-sec-head h2 { font-size: 32px !important; letter-spacing: -.02em !important; }
        }

        /* Grid layout: mobile single-column, desktop 2-col con chat sticky a destra */
        .hfv4-main {
          display: grid;
          grid-template-areas: "a" "b";
          grid-template-columns: 1fr;
        }
        .hfv4-zone-a { grid-area: a; }
        .hfv4-zone-b { grid-area: b; }

        @media (min-width: 1024px) {
          .hfv4-root { min-height: calc(100dvh - 80px) !important; }
          .hfv4-topbar { display: none !important; }
          .hfv4-main {
            max-width: 1240px;
            margin: 0 auto;
            padding: 20px 40px 60px;
            grid-template-areas: "a b";
            grid-template-columns: 1fr 360px;
            column-gap: 40px;
            row-gap: 0;
            align-items: start;
          }
          .hfv4-zone-b {
            position: sticky;
            top: 100px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .hfv4-zone-b .hfv4-ai-divider { display: none; }
          .hfv4-zone-b .hfv4-ai-wrap { padding: 0 !important; }
          .hfv4-zone-b .hfv4-ai-output { padding: 0 !important; }

          .hfv4-timehero { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-results-head { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-results-row {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            overflow: visible !important;
            padding-left: 0 !important; padding-right: 0 !important;
            gap: 16px !important;
          }
          .hfv4-lcard, .hfv4-results-more { flex: unset !important; min-height: 0 !important; }

          /* === Banner sponsor full-width === */
          .hfv4-spon-outer {
            max-width: 1240px;
            margin: 0 auto;
            padding: 0 40px 24px;
          }
          .hfv4-spon-outer .hfv4-spon-wrap { padding: 0 !important; }
          .hfv4-spon-banner {
            display: grid !important;
            grid-template-columns: 440px 1fr !important;
          }
          .hfv4-spon-banner .spon-photo { height: auto !important; min-height: 280px !important; }
          .hfv4-spon-banner .spon-title { font-size: 48px !important; letter-spacing: -.025em !important; line-height: 1 !important; }
          .hfv4-spon-banner-body { padding: 40px 44px !important; justify-content: center !important; }

          /* === Box bianco orologio + moment tabs === */
          .hfv4-time-box {
            background: #fff;
            border: 1px solid rgba(234,227,215,1);
            border-radius: 28px;
            padding: 28px 32px 24px;
            box-shadow: 0 1px 2px rgba(34,24,28,.04), 0 4px 12px rgba(34,24,28,.04);
            margin-bottom: 24px;
          }
          .hfv4-time-box .hfv4-timehero {
            display: grid !important;
            grid-template-columns: auto 1fr !important;
            column-gap: 28px;
            padding: 0 !important;
            margin-bottom: 22px;
            text-align: left;
          }
          .hfv4-time-box .hfv4-timehero-tag { grid-column: 1; grid-row: 1; align-self: start; margin-bottom: 10px; }
          .hfv4-time-box .hfv4-timehero-clock { grid-column: 1; grid-row: 2 / 4; align-self: center; font-size: 88px !important; margin-bottom: 0 !important; }
          .hfv4-time-box .hfv4-timehero-q { grid-column: 2; grid-row: 2; align-self: end; font-size: 28px !important; max-width: none !important; }
          .hfv4-time-box .hfv4-timehero-sub { grid-column: 2; grid-row: 3; align-self: start; max-width: none; margin-top: 6px; }
          .hfv4-time-box .hfv4-moment-tabs {
            overflow-x: visible !important;
            flex-wrap: wrap !important;
            padding: 0 !important;
            gap: 10px !important;
          }
          .hfv4-time-box .hfv4-moment-tab {
            flex-direction: row !important;
            min-width: auto !important;
            gap: 10px !important;
            padding: 12px 18px !important;
            border-radius: 999px !important;
          }

          /* === SuggestCard full-width e grande === */
          .hfv4-suggest-outer {
            max-width: 1240px;
            margin: 0 auto;
            padding: 0 40px 60px;
          }
          .hfv4-suggest-outer .hfv4-suggest-wrap { padding: 0 !important; }
          .hfv4-suggest {
            padding: 48px 56px !important;
            border-radius: 28px !important;
          }
          .hfv4-suggest-title {
            font-size: 36px !important;
            max-width: none !important;
            letter-spacing: -.02em !important;
            line-height: 1.05 !important;
          }
          .hfv4-suggest-sub {
            font-size: 15px !important;
            max-width: 520px !important;
            margin-top: 10px !important;
          }
          .hfv4-suggest-cta {
            padding: 16px 28px !important;
            font-size: 14px !important;
          }

        }
      `}</style>

      <TopBar />

      <HeroPromo featured={featuredDrop} />

      <CategoryBubbles
        onSelect={(c) => navigate('/esplora', { state: { initialCategory: c.label } })}
        onAltro={() => navigate('/esplora')}
      />

      <section className="hfv4-section" style={{ padding: '8px 0 4px' }}>
        <SectionHead
          kicker="Nuovi in guida"
          title="Ultimi aggiunti"
          subtitle="Gli ultimi posti che ho provato e inserito in guida."
          trailing={
            <Link to="/list" className="hfv4-sec-head-all" style={{ width:32, height:32, borderRadius:'50%', background:'var(--color-ink-05)', display:'grid', placeItems:'center', fontSize:14, fontWeight:700, color:'var(--color-ink)', textDecoration:'none' }}>→</Link>
          }
        />
        {loading ? (
          <div style={{ padding: '0 20px', color: 'var(--color-ink-70)' }}>Caricamento...</div>
        ) : (
          <div className="hfv4-cards-row" style={{ display:'flex', gap:12, overflowX:'auto', padding:'0 20px 12px 20px', scrollSnapType:'x mandatory', scrollPaddingLeft:20, WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
            {recent.map((r) => (
              <Rcard key={r.id} restaurant={r} discount={discountByRestaurant[r.id]} onClick={onCardClick} saved={isSaved(r.id)} onToggleSave={() => toggleSave(r.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Sponsor banner: full-width su desktop, fuori dalla griglia 2-col */}
      <div className="hfv4-spon-outer">
        <SponsorBanner />
      </div>

      <div className="hfv4-main">
        {/* Zone A: contenuto principale sopra la chat */}
        <div className="hfv4-zone-a">
          {/* Box bianco orologio + tabs su desktop */}
          <div className="hfv4-time-box">
            <TimeContextHero activeMomentKey={activeMoment} />
            <MomentTabs activeKey={activeMoment} onChange={setActiveMoment} />
          </div>

          {loading ? (
            <div style={{ padding: '20px', color: 'var(--color-ink-70)' }}>Caricamento…</div>
          ) : (
            <MomentResultsGrid
              restaurants={restaurants}
              activeMoment={activeMoment}
              onCardClick={onCardClick}
              isSaved={isSaved}
              toggleSave={toggleSave}
            />
          )}
        </div>

        {/* Zone B: chat AI (inline su mobile, sticky right col su desktop via CSS grid-area) */}
        <div className="hfv4-zone-b">
          <AskBiChat currentMoment={activeMoment} />
        </div>
      </div>

      {/* SuggestCard full-width sotto la griglia */}
      <div className="hfv4-suggest-outer">
        <SuggestCard />
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Footer />
      </div>
    </div>
  )
}
