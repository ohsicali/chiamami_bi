import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { getCurrentMoment, isOpenForMoment } from '../../lib/hours'
import { proxyImg } from '../../lib/supabase'
import SaveButton from '../../components/Restaurant/SaveButton'
import SponsorBanner from '../../components/Home/SponsorBanner'
import TimeContextHero from '../../components/Home/TimeContextHero'
import MomentTabs from '../../components/Home/MomentTabs'
import MomentResultsGrid from '../../components/Home/MomentResultsGrid'
import MapCta from '../../components/Home/MapCta'
import AskBiChat from '../../components/Home/AskBiChat'

function formatCountdown(endsAt) {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return null
  const totalMinutes = Math.floor(diff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
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

function TopBar({ user }) {
  const initials = user
    ? (user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()
    : null
  return (
    <div
      className="hfv4-topbar"
      style={{
        padding: '12px 20px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
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
            fontSize: 15,
            letterSpacing: '0.02em',
            color: 'var(--color-corallo)',
          }}
        >
          CHIAMAMI BI
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
          la guida di bi
        </span>
      </Link>

      <div
        className="hfv4-city-pill"
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          padding: '10px 16px 10px 14px',
          background: 'var(--color-ink-05)',
          border: '1px solid var(--color-ink-15, rgba(34,24,28,.12))',
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '-0.01em',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--color-corallo)',
            boxShadow: '0 0 0 3px rgba(232,69,60,.15)',
          }}
        />
        Torino
        <span style={{ fontSize: 10, color: 'var(--color-ink-40, rgba(34,24,28,.4))', marginLeft: 2 }}>▾</span>
      </div>

      {user ? (
        <Link
          to="/profile"
          aria-label="Profilo"
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-corallo) 0%, var(--color-corallo-ink, #C6372F) 100%)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 16,
            boxShadow: '0 6px 14px rgba(232,69,60,.3)',
            border: '2px solid #fff',
            textDecoration: 'none',
          }}
        >
          {initials}
        </Link>
      ) : (
        <Link
          to="/login"
          style={{
            padding: '10px 16px',
            background: 'var(--color-ink)',
            color: '#fff',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Accedi
        </Link>
      )}
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
  return (
    <div className="hfv4-hero-wrap" style={{ padding: '4px 16px 22px' }}>
      <div className="hfv4-hero-card" style={{ position:'relative', background:'var(--color-corallo)', borderRadius:28, padding:'22px', display:'grid', gridTemplateColumns:'1fr 108px', gap:14, color:'#fff', overflow:'hidden', boxShadow:'0 8px 24px rgba(34,24,28,.08)' }}>
        <div className="hfv4-hero-body">
          <span className="hfv4-hero-chip" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', background:'rgba(255,255,255,.18)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', borderRadius:999, fontSize:11, fontWeight:700, letterSpacing:'0.06em', marginBottom:10, width:'fit-content' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff', animation:'hero-pulse 1.4s infinite' }} />
            {chipLabel}
          </span>
          <div className="hfv4-hero-title" style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:30, lineHeight:1.02, letterSpacing:'-0.02em', color:'#fff', marginBottom:8, whiteSpace:'pre-line' }}>
            {featured.title}
          </div>
          {featured.subtitle && (
            <div className="hfv4-hero-sub" style={{ fontSize:13, color:'rgba(255,255,255,.85)', lineHeight:1.4, marginBottom:14, maxWidth:180, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
              {featured.subtitle}
            </div>
          )}
          <div className="hfv4-hero-ctas" style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => navigate(featured.href)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'10px 16px', background:'var(--color-ink)', color:'#fff', borderRadius:999, fontSize:13, fontWeight:700, border:'none', cursor:'pointer' }}>
              {featured.cta} →
            </button>
          </div>
        </div>
        {featured.photo && (
          <div className="hfv4-hero-photo" style={{ position:'relative', overflow:'hidden', background:'#333', minHeight:160 }}>
            <img src={featured.photo} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          </div>
        )}
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
      <div className="hfv4-cats-row" style={{ display:'flex', gap:10, overflowX:'auto', padding:'6px 20px 20px', WebkitOverflowScrolling:'touch', scrollSnapType:'x proximity', scrollbarWidth:'none' }}>
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
  const photoUrl = proxyImg(firstPhoto ? (typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url) : null)
  const priceStr = restaurant.price_range != null ? '€'.repeat(restaurant.price_range) : null
  const discLabel = discount?.discount_value
    ? (discount.discount_type === 'percentage' ? `-${String(discount.discount_value).replace('%','')}%` : `-${discount.discount_value}€`)
    : null
  return (
    <button className="hfv4-rcard" onClick={() => onClick?.(restaurant)} style={{ flex:'0 0 70%', scrollSnapAlign:'start', background:'#fff', borderRadius:20, overflow:'hidden', border:'1px solid var(--color-ink-05)', textAlign:'left', color:'inherit', boxShadow:'0 1px 3px rgba(34,24,28,.06)', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
      <div style={{ position:'relative', width:'100%', aspectRatio:'16/11', background:'#ddd', overflow:'hidden' }}>
        {photoUrl
          ? <img src={photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy" />
          : <div style={{ width:'100%', height:'100%', display:'grid', placeItems:'center', fontSize:28 }}>{cat?.emoji || '🍽️'}</div>
        }
        {discLabel
          ? <span style={{ position:'absolute', top:10, left:10, background:'var(--color-corallo)', color:'#fff', fontSize:11, fontWeight:700, padding:'4px 9px', borderRadius:999, letterSpacing:'0.02em' }}>{discLabel}</span>
          : <span style={{ position:'absolute', top:10, left:10, background:'var(--color-ink)', color:'#fff', fontSize:10, fontWeight:700, padding:'4px 9px', borderRadius:999, letterSpacing:'0.04em' }}>NEW</span>
        }
        <div style={{ position:'absolute', top:10, right:10 }}>
          <SaveButton saved={saved} onClick={onToggleSave} size="sm" />
        </div>
      </div>
      <div style={{ padding:'10px 14px 14px' }}>
        <div style={{ fontFamily:'var(--font-sans)', fontWeight:800, fontSize:16, lineHeight:1.2, letterSpacing:'-0.01em', color:'var(--color-ink)' }}>{restaurant.name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--color-ink-70)', marginTop:4, flexWrap:'wrap' }}>
          {cat?.name && <span style={{ background:'var(--color-corallo-soft)', color:'var(--color-corallo-ink)', fontWeight:700, fontSize:10, padding:'3px 7px', borderRadius:999, letterSpacing:'0.02em', textTransform:'uppercase' }}>{cat.name}</span>}
          {restaurant.address && <span>{restaurant.address.split(',')[0]}</span>}
          {priceStr && <><span style={{ color:'var(--color-ink-40)' }}>·</span><span>{priceStr}</span></>}
        </div>
      </div>
    </button>
  )
}

/**
 * CosaConsiglio · "Secondo Bi" editorial (blocco gradient oro preservato).
 * Mostra un ristorante featured con tip handwriting.
 */
function CosaConsiglio({ restaurant }) {
  const navigate = useNavigate()
  if (!restaurant) return null

  const tips = Array.isArray(restaurant.recommended_for) && restaurant.recommended_for.length > 0
    ? restaurant.recommended_for.slice(0, 3)
    : null

  return (
    <div className="hfv4-consiglio-wrap" style={{ padding: '14px 16px 24px' }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(140deg,#FEF6E4 0%,#F4E7CC 100%)',
          border: '1px solid rgba(176,137,84,.35)',
          borderRadius: 28,
          padding: '22px 20px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--color-ink)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
              fontSize: 16,
            }}
          >
            B
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700 }}>
              Bi — dalla guida
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-70)' }}>
              Secondo Bi
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--color-oro, #B08954)',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Settimana del {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: 10,
          }}
        >
          Questa settimana passerei da {restaurant.name}.
        </div>
        <div
          style={{
            fontFamily: 'var(--font-hand, "Caveat", cursive)',
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.35,
            color: 'var(--color-ink)',
            maxWidth: 280,
          }}
        >
          {restaurant.our_tip || restaurant.tagline || 'Uno dei posti di cui non mi stanco mai.'}
        </div>
        {tips && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            {tips.map((t) => (
              <span
                key={t}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(176,137,84,.18)',
                  color: 'var(--color-ink)',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate(`/restaurant/${restaurant.slug}`)}
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'var(--color-ink)',
            color: '#fff',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            border: 0,
            cursor: 'pointer',
          }}
        >
          Vai alla scheda →
        </button>
      </div>
    </div>
  )
}

function SuggestCard() {
  const navigate = useNavigate()
  return (
    <div className="hfv4-suggest-wrap" style={{ padding: '10px 16px 36px' }}>
      <div
        className="hfv4-suggest"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--color-ink)',
          color: '#fff',
          borderRadius: 28,
          padding: 22,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            background: 'radial-gradient(circle, rgba(232,69,60,.25), transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 18,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              marginBottom: 6,
              maxWidth: 220,
            }}
          >
            Conosci un posto che manca?
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.35, maxWidth: 240 }}>
            Scrivici nome + zona. Bi ci va a mangiare. Se è buono, entra.
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          style={{
            padding: '11px 14px',
            background: 'var(--color-corallo)',
            color: '#fff',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            position: 'relative',
            zIndex: 1,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Suggerisci →
        </button>
      </div>
    </div>
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
  const recent = (restaurants || []).slice(0, 8)

  const featuredDrop = useMemo(() => {
    const drop = (discounts || []).find((d) => d.is_drop)
    if (!drop) return null
    const r = (restaurants || []).find((x) => x.id === drop.restaurant_id)
    if (!r) return null
    const photos = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null
    const photo = proxyImg(photos ? (typeof photos === 'string' ? photos : photos?.photo_url || photos?.thumb_url) : null)
    const label = drop.discount_type === 'percentage' ? `-${String(drop.discount_value).replace('%','')}%` : `-${drop.discount_value}€`
    return {
      title: `${label}\nda ${r.name}.`,
      subtitle: drop.description || drop.title || '',
      cta: 'Vai al drop',
      href: `/restaurant/${r.slug}`,
      photo,
      endsAt: drop.drop_ends_at || drop.ends_at || null,
    }
  }, [discounts, restaurants])

  const featuredForEditorial = useMemo(() => {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return null
    return restaurants.find((r) => r.featured)
      || restaurants.find((r) => (r.our_tip && r.our_tip.length > 30))
      || restaurants[0]
  }, [restaurants])

  const momentCount = useMemo(() => {
    if (!Array.isArray(restaurants)) return 0
    return restaurants.filter((r) => r.is_published !== false && isOpenForMoment(r.hours_cache, activeMoment).match).length
  }, [restaurants, activeMoment])

  const onCardClick = (r) => navigate(`/restaurant/${r.slug}`)

  return (
    <div
      className="hfv4-root"
      style={{
        background: 'var(--color-page)',
        minHeight: '100dvh',
        paddingBottom: 100,
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
          .hfv4-hero-title { font-size: 72px !important; line-height: .98 !important; letter-spacing: -.03em !important; margin-bottom: 0 !important; }
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
          .hfv4-rcard { flex: 1 1 auto !important; }
          .hfv4-sec-head { padding-left: 0 !important; padding-right: 0 !important; margin-bottom: 22px; }
          .hfv4-sec-head h2 { font-size: 32px !important; letter-spacing: -.02em !important; }
        }

        /* Grid layout: mobile single-column, desktop 2-col con chat sticky a destra */
        .hfv4-main {
          display: grid;
          grid-template-areas: "a" "b" "c";
          grid-template-columns: 1fr;
        }
        .hfv4-zone-a { grid-area: a; }
        .hfv4-zone-b { grid-area: b; }
        .hfv4-zone-c { grid-area: c; }

        @media (min-width: 1024px) {
          .hfv4-root { padding-bottom: 0; }
          .hfv4-topbar { display: none !important; }
          .hfv4-main {
            max-width: 1240px;
            margin: 0 auto;
            padding: 20px 40px 80px;
            grid-template-areas: "a b" "c b";
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

          .hfv4-spon-wrap { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-timehero { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-moment-tabs {
            overflow-x: visible !important;
            flex-wrap: wrap !important;
            padding-left: 0 !important; padding-right: 0 !important;
          }
          .hfv4-results-head { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-results-row {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            overflow: visible !important;
            padding-left: 0 !important; padding-right: 0 !important;
            gap: 16px !important;
          }
          .hfv4-lcard, .hfv4-results-more { flex: unset !important; min-height: 0 !important; }
          .hfv4-mapcta-wrap, .hfv4-consiglio-wrap, .hfv4-suggest-wrap {
            padding-left: 0 !important; padding-right: 0 !important;
          }
          .hfv4-timehero-clock { font-size: 128px !important; }
          .hfv4-timehero-q { font-size: 32px !important; max-width: 480px !important; }
          .hfv4-spon-banner {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
          }
          .hfv4-spon-banner .spon-photo { height: auto !important; min-height: 320px !important; }
        }
      `}</style>

      <TopBar user={user} />

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
          <div className="hfv4-cards-row" style={{ display:'flex', gap:12, overflowX:'auto', padding:'0 20px 12px', scrollSnapType:'x proximity', scrollPaddingLeft:20, WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
            {recent.map((r) => (
              <Rcard key={r.id} restaurant={r} discount={discountByRestaurant[r.id]} onClick={onCardClick} saved={isSaved(r.id)} onToggleSave={() => toggleSave(r.id)} />
            ))}
          </div>
        )}
      </section>

      <div className="hfv4-main">
        {/* Zone A: contenuto principale sopra la chat */}
        <div className="hfv4-zone-a">
          <SponsorBanner />

          <TimeContextHero activeMomentKey={activeMoment} />

          <MomentTabs activeKey={activeMoment} onChange={setActiveMoment} />

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

          <MapCta activeMoment={activeMoment} count={momentCount} />
        </div>

        {/* Zone B: chat AI (inline su mobile, sticky right col su desktop via CSS grid-area) */}
        <div className="hfv4-zone-b">
          <AskBiChat currentMoment={activeMoment} />
        </div>

        {/* Zone C: Secondo Bi editorial + suggest (sotto chat su mobile, sotto zone-a su desktop) */}
        <div className="hfv4-zone-c">
          <CosaConsiglio restaurant={featuredForEditorial} />
          <SuggestCard />
        </div>
      </div>
    </div>
  )
}
