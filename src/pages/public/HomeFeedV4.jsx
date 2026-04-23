import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import SaveButton from '../../components/Restaurant/SaveButton'
import { proxyImg } from '../../lib/supabase'

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
  { key: 'piemontese', emoji: '🍝', label: 'Piemontese' },
  { key: 'pizza', emoji: '🍕', label: 'Pizza' },
  { key: 'giapponese', emoji: '🍣', label: 'Giapponese' },
  { key: 'pesce', emoji: '🐟', label: 'Pesce' },
  { key: 'colazione', emoji: '☕', label: 'Colazione' },
  { key: 'carne', emoji: '🥩', label: 'Carne' },
]

const TIME_TABS = [
  { key: 'colazione', emoji: '☕', label: 'Colazione' },
  { key: 'pranzo', emoji: '🥪', label: 'Pranzo' },
  { key: 'aperitivo', emoji: '🥂', label: 'Aperitivo' },
  { key: 'cena-carne', emoji: '🥩', label: 'Cena carne' },
  { key: 'cena-pesce', emoji: '🐟', label: 'Cena pesce' },
  { key: 'dopo-cena', emoji: '🍸', label: 'Dopo cena' },
]

function getTimeSlot() {
  const h = new Date().getHours()
  if (h >= 6 && h < 11) return 'colazione'
  if (h >= 11 && h < 15) return 'pranzo'
  if (h >= 15 && h < 20) return 'aperitivo'
  if (h >= 20 && h < 23) return 'cena-carne'
  return 'dopo-cena'
}

function getTimeLabel(slot) {
  const map = {
    colazione: 'Colazione a Torino',
    pranzo: 'Pranzo a Torino',
    aperitivo: 'Aperitivo a Torino',
    'cena-carne': 'Cena a Torino',
    'cena-pesce': 'Cena a Torino',
    'dopo-cena': 'Dopo cena a Torino',
  }
  return map[slot] || 'A Torino adesso'
}

function TopBar() {
  return (
    <div
      className="hfv4-topbar"
      style={{
        padding: '10px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Link to="/" style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.92, textDecoration: 'none' }}>
        <span
          style={{
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 15,
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

      <div
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 12px',
          background: 'var(--color-ink-05)',
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-corallo)' }} />
        Torino
        <svg viewBox="0 0 10 10" width="10" height="10">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      <button
        aria-label="Geolocalizza"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--color-ink-05)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" />
        </svg>
      </button>
    </div>
  )
}

function HeroPromo({ featured }) {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(() => formatCountdown(featured?.endsAt))

  useEffect(() => {
    if (!featured?.endsAt) {
      setCountdown(null)
      return
    }
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

  return (
    <div className="hfv4-hero-wrap" style={{ padding: '4px 16px 22px' }}>
      <div
        className="hfv4-hero-card"
        style={{
          position: 'relative',
          background: 'var(--color-corallo)',
          borderRadius: 28,
          padding: '22px',
          display: 'grid',
          gridTemplateColumns: '1fr 108px',
          gap: 14,
          color: '#fff',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(34,24,28,.08)',
        }}
      >
        <div className="hfv4-hero-body">
          <span
            className="hfv4-hero-chip"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: 'rgba(255,255,255,.18)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              marginBottom: 10,
              width: 'fit-content',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#fff',
                animation: 'hero-pulse 1.4s infinite',
              }}
            />
            {chipLabel}
          </span>
          <div
            className="hfv4-hero-title"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 30,
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: '#fff',
              marginBottom: 8,
              whiteSpace: 'pre-line',
            }}
          >
            {featured.title}
          </div>
          {featured.restLine && (
            <div
              className="hfv4-hero-rest-line"
              style={{
                display: 'none',
                alignItems: 'center',
                gap: 10,
                fontSize: 15,
                fontWeight: 600,
                color: 'rgba(255,255,255,.9)',
                marginBottom: 4,
              }}
            >
              {featured.restLine}
            </div>
          )}
          {featured.subtitle && (
            <div
              className="hfv4-hero-sub"
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,.85)',
                lineHeight: 1.4,
                marginBottom: 14,
                maxWidth: 180,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {featured.subtitle}
            </div>
          )}
          <div className="hfv4-hero-ctas" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(featured.href)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                background: 'var(--color-ink)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {featured.cta} →
            </button>
            {featured.secondaryCta && (
              <button
                className="hfv4-hero-cta-ghost"
                onClick={() => navigate(featured.href)}
                style={{
                  display: 'none',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,.18)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#fff',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {featured.secondaryCta}
              </button>
            )}
          </div>
        </div>
        {featured.photo && (
          <div
            className="hfv4-hero-photo"
            style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              background: '#333',
              alignSelf: 'stretch',
              minHeight: 160,
            }}
          >
            <img
              src={featured.photo}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {showProgress && (
              <div
                className="hfv4-hero-progress"
                style={{
                  display: 'none',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '16px 20px',
                  background: 'linear-gradient(0deg, rgba(34,24,28,.7), transparent)',
                  color: '#fff',
                }}
              >
                {progressPct != null && (
                  <div style={{ height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, background: '#fff', borderRadius: 999 }} />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>
                  <span>
                    {maxQuantity ? `${claimedCount} / ${maxQuantity} sbloccati` : (countdown ? `Scade tra ${countdown}` : '')}
                  </span>
                  {expiresLabel && <span>{expiresLabel}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryBubbles({ activeKey, onSelect }) {
  return (
    <div className="hfv4-cats-wrap">
      <div
        className="hfv4-cats-row"
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          padding: '6px 20px 20px',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x proximity',
          scrollbarWidth: 'none',
        }}
      >
        {CATEGORIES.map((c) => {
          const active = c.key === activeKey
          return (
            <button
              key={c.key}
              onClick={() => onSelect?.(c.key)}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                scrollSnapAlign: 'start',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                className="hfv4-cat-bubble"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: active ? 'var(--color-corallo)' : 'var(--color-ink-05)',
                  boxShadow: active ? '0 6px 16px rgba(232,69,60,0.35)' : 'none',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 28,
                }}
              >
                {c.emoji}
              </span>
              <span
                className="hfv4-cat-label"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: active ? 'var(--color-corallo-ink)' : 'var(--color-ink)',
                  maxWidth: 72,
                  textAlign: 'center',
                  lineHeight: 1.15,
                }}
              >
                {c.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionHead({ title, kicker, subtitle, trailing }) {
  return (
    <div
      className="hfv4-sec-head"
      style={{
        padding: '0 20px 12px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {kicker && (
          <span className="hfv4-sec-head-kicker" style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--color-corallo-ink)',
            textTransform: 'uppercase',
            display: 'none',
          }}>
            {kicker}
          </span>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <div className="hfv4-sec-head-sub" style={{
            fontSize: 12,
            color: 'var(--color-ink-70)',
            marginTop: 2,
            display: 'none',
          }}>
            {subtitle}
          </div>
        )}
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
    <button
      className="hfv4-rcard"
      onClick={() => onClick?.(restaurant)}
      style={{
        flex: '0 0 70%',
        scrollSnapAlign: 'start',
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid var(--color-ink-05)',
        textAlign: 'left',
        color: 'inherit',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(34,24,28,.06))',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/11', background: '#ddd', overflow: 'hidden' }}>
        {photoUrl ? (
          <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 28 }}>{cat?.emoji || '🍽️'}</div>
        )}
        {discLabel ? (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: 'var(--color-corallo)', color: '#fff',
            fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999,
            letterSpacing: '0.02em',
          }}>
            {discLabel}
          </span>
        ) : (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: 'var(--color-ink)', color: '#fff',
            fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 999,
            letterSpacing: '0.04em',
          }}>
            NEW
          </span>
        )}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <SaveButton saved={saved} onClick={onToggleSave} size="sm" />
        </div>
      </div>
      <div style={{ padding: '10px 14px 14px' }}>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 16,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
          }}
        >
          {restaurant.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-ink-70)', marginTop: 4, flexWrap: 'wrap' }}>
          {cat?.name && (
            <span
              style={{
                background: 'var(--color-corallo-soft)',
                color: 'var(--color-corallo-ink)',
                fontWeight: 700,
                fontSize: 10,
                padding: '3px 7px',
                borderRadius: 999,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              {cat.name}
            </span>
          )}
          {restaurant.address && <span>{restaurant.address.split(',')[0]}</span>}
          {priceStr && (
            <>
              <span style={{ color: 'var(--color-ink-40)' }}>·</span>
              <span>{priceStr}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

function SponsorBanner() {
  return (
    <div className="hfv4-spon-wrap" style={{ padding: '14px 16px 0' }}>
      <div
        className="hfv4-spon-banner"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '72px 1fr auto',
          gap: 14,
          alignItems: 'center',
          background: 'var(--color-ink)',
          color: '#fff',
          borderRadius: 20,
          padding: '14px 16px',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'rgba(255,255,255,.5)',
            textTransform: 'uppercase',
          }}
        >
          Sponsorizzato
        </span>

        <div
          className="spon-img"
          style={{
            width: 72,
            height: 72,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #D9A441, #8A5A1F)',
          }}
        />

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-oro)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            Partner · Vini Crosetti
          </div>
          <div
            className="spon-title"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 15,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              marginBottom: 3,
              color: '#fff',
            }}
          >
            20% sulle Barbera biologiche
          </div>
          <div className="spon-sub" style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', lineHeight: 1.3 }}>
            Consegna 24h · codice BI20
          </div>
        </div>

        <button
          style={{
            padding: '8px 12px',
            background: 'var(--color-corallo)',
            color: '#fff',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            alignSelf: 'center',
          }}
        >
          Attiva
        </button>
      </div>
    </div>
  )
}

function TimeBasedSection({ restaurants, discountByRestaurant, onCardClick, isSaved, toggleSave }) {
  const [activeTab, setActiveTab] = useState(getTimeSlot)

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const filtered = useMemo(() => {
    return (restaurants || []).slice(0, 8)
  }, [restaurants])

  return (
    <section className="hfv4-section" style={{ paddingTop: 22 }}>
      <div className="hfv4-sec-head" style={{ padding: '0 20px 10px' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--color-corallo-ink)',
            textTransform: 'uppercase',
            marginBottom: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-corallo)',
              animation: 'hero-pulse 1.4s infinite',
            }}
          />
          Adesso · {timeStr}
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          {getTimeLabel(activeTab)}
        </h2>
        <div style={{ fontSize: 12, color: 'var(--color-ink-70)', marginTop: 4 }}>
          {filtered.length} locali · filtra per momento
        </div>
      </div>

      <div
        className="hfv4-time-tabs"
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '14px 20px 12px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {TIME_TABS.map((t) => {
          const active = t.key === activeTab
          return (
            <button
              key={t.key}
              className="hfv4-time-tab"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: '0 0 auto',
                padding: '9px 13px',
                borderRadius: 999,
                background: active ? 'var(--color-ink)' : 'var(--color-ink-05)',
                fontSize: 13,
                fontWeight: 700,
                color: active ? '#fff' : 'var(--color-ink-70)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t.emoji} {t.label}
            </button>
          )
        })}
      </div>

      <div
        className="hfv4-cards-row"
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          padding: '0 20px 12px',
          scrollSnapType: 'x proximity',
          scrollPaddingLeft: 20,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {filtered.map((r) => (
          <Rcard
            key={r.id}
            restaurant={r}
            discount={discountByRestaurant[r.id]}
            onClick={onCardClick}
            saved={isSaved ? isSaved(r.id) : false}
            onToggleSave={toggleSave ? () => toggleSave(r.id) : undefined}
          />
        ))}
      </div>
    </section>
  )
}

function CosaConsiglio({ restaurants }) {
  const navigate = useNavigate()
  const featured = (restaurants || []).find((r) => r.featured) || (restaurants || [])[0]
  if (!featured) return null

  const tips = Array.isArray(featured.recommended_for) && featured.recommended_for.length > 0
    ? featured.recommended_for.slice(0, 3)
    : null
  const cat = getCategoryInfo(featured.cuisine_type || (featured.category && featured.category[0]))

  return (
    <div className="hfv4-consiglio-wrap" style={{ padding: '24px 16px 4px' }}>
      <div
        className="hfv4-consiglio"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(140deg, #FEF6E4 0%, #F4E7CC 100%)',
          border: '1px solid rgba(176,137,84,.35)',
          borderRadius: 28,
          padding: '20px 20px 18px',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 140,
            height: 140,
            background: 'radial-gradient(circle, rgba(176,137,84,.3) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        <div className="hfv4-consiglio-l" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'relative' }}>
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
                Selezione della settimana
              </div>
            </div>
          </div>

          <div
            className="hfv4-consiglio-kicker"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'var(--color-oro)',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Cosa ti consiglio di prendere
          </div>

          <h2
            className="hfv4-consiglio-title"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 4,
            }}
          >
            Questa settimana vai da
          </h2>

          <div
            className="hfv4-consiglio-rest"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 28,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              marginBottom: 6,
            }}
          >
            {featured.name}
          </div>
          <div
            className="hfv4-consiglio-place"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-ink-70)',
              marginBottom: 14,
            }}
          >
            · {cat?.name || 'Italiana'} · {featured.address ? featured.address.split(',')[0] : 'Torino'}
          </div>

          <button
            onClick={() => navigate(`/restaurant/${featured.slug}`)}
            className="hfv4-consiglio-cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-ink)',
              padding: '9px 14px',
              background: 'rgba(255,255,255,.85)',
              borderRadius: 999,
              border: '1px solid rgba(176,137,84,.3)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Apri la scheda <span style={{ color: 'var(--color-corallo)' }}>→</span>
          </button>
        </div>

        <div className="hfv4-consiglio-r" style={{ position: 'relative', zIndex: 1, marginTop: 14 }}>
          {tips && tips.length > 0 && (
            <ul className="hfv4-consiglio-list" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {tips.map((tip, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,.65)',
                    borderRadius: 10,
                    border: '1px solid rgba(176,137,84,.2)',
                  }}
                >
                  <div
                    style={{
                      flex: '0 0 22px',
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--color-ink)',
                      color: '#fff',
                      fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    className="hfv4-consiglio-tip"
                    style={{
                      flex: 1,
                      fontFamily: 'var(--font-hand, "Caveat", cursive)',
                      fontSize: 18,
                      fontWeight: 600,
                      lineHeight: 1.2,
                    }}
                  >
                    {tip}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!tips && (
            <div
              style={{
                fontFamily: 'var(--font-hand, "Caveat", cursive)',
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.35,
                color: 'var(--color-ink)',
                padding: '10px 12px',
                background: 'rgba(255,255,255,.65)',
                borderRadius: 10,
                border: '1px solid rgba(176,137,84,.2)',
              }}
            >
              Vai, fidati. Prova il piatto del giorno e chiedi il consiglio dello chef.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SuggestCard() {
  const navigate = useNavigate()
  return (
    <div className="hfv4-suggest-wrap" style={{ padding: '24px 16px 36px' }}>
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
        <div
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
          <div className="hfv4-suggest-title" style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 18, lineHeight: 1.15, letterSpacing: '-0.01em', marginBottom: 6, maxWidth: 200 }}>
            Conosci un posto che manca?
          </div>
          <div className="hfv4-suggest-sub" style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.35, maxWidth: 220 }}>
            Scrivici nome + zona. Bi ci va a mangiare. Se è buono, entra.
          </div>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="hfv4-suggest-cta"
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

    // Use full-quality photo_url first, thumbnail as fallback
    const photos = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null
    const photo = proxyImg(photos ? (typeof photos === 'string' ? photos : photos?.photo_url || photos?.thumb_url) : null)

    const label = drop.discount_type === 'percentage' ? `-${String(drop.discount_value).replace('%','')}%` : `-${drop.discount_value}€`

    // restLine: Cuisine · Neighborhood · Tagline (not restaurant name, already in title)
    const catName = r.category?.[0] || r.cuisine_type || ''
    const catInfo = getCategoryInfo(catName)
    const neighborhood = r.address ? r.address.split(',')[0].trim() : ''
    const tagline = r.tagline || ''
    const restLine = [catInfo?.name || catName, neighborhood, tagline].filter(Boolean).slice(0, 3).join(' · ')

    // Progress bar data
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
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          if (exp.toDateString() === tomorrow.toDateString()) {
            expiresLabel = 'scade domani'
          } else {
            const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
            expiresLabel = `scade il ${exp.getDate()} ${months[exp.getMonth()]}`
          }
        }
      }
    }

    // Subtitle: description + conditions if present
    const subtitleParts = [drop.description || drop.title, drop.conditions].filter(Boolean)
    const subtitle = subtitleParts.join(' · ')

    return {
      title: `${label}\nda ${r.name}.`,
      restLine,
      subtitle,
      cta: 'Vai al drop',
      secondaryCta: `Scopri ${r.name}`,
      href: `/restaurant/${r.slug}`,
      photo,
      endsAt: drop.drop_ends_at || drop.ends_at || null,
      claimedCount,
      maxQuantity,
      expiresLabel,
    }
  }, [discounts, restaurants])

  const onCardClick = (r) => navigate(`/restaurant/${r.slug}`)

  return (
    <div className="hfv4-root" style={{ background: 'var(--color-page)', minHeight: '100dvh', paddingBottom: 100 }}>
      <style>{`
        @keyframes drop-live-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.4); }
          60% { box-shadow: 0 0 0 5px rgba(255,255,255,.0); }
        }
        /* v4 Home desktop (mockup v4-desktop-home.html) — kick in ≥1024px */
        @media (min-width: 1024px) {
          .hfv4-root { padding-bottom: 40px; }
          .hfv4-topbar { display: none !important; }
          .hfv4-section,
          .hfv4-hero-wrap,
          .hfv4-cats-wrap,
          .hfv4-spon-wrap,
          .hfv4-consiglio-wrap,
          .hfv4-suggest-wrap {
            max-width: 1240px;
            margin-left: auto; margin-right: auto;
            padding-left: 40px !important; padding-right: 40px !important;
          }
          /* Hero desktop: spacing from floating navbar + 2-col layout */
          .hfv4-hero-wrap { padding-top: 16px !important; }
          .hfv4-hero-card {
            grid-template-columns: 1.05fr .95fr !important;
            gap: 0 !important;
            min-height: 0 !important;
            padding: 0 !important;
            border-radius: 28px !important;
          }
          .hfv4-hero-body { padding: 22px 40px !important; display: flex; flex-direction: column; justify-content: center; gap: 6px !important; }
          .hfv4-hero-chip {
            font-size: 11px !important; letter-spacing: .07em !important;
            padding: 5px 10px !important; margin-bottom: 0 !important;
            animation: drop-live-ring 2s ease-out infinite !important;
          }
          .hfv4-hero-title { font-size: 44px !important; line-height: .98 !important; letter-spacing: -.03em !important; margin-bottom: 0 !important; }
          .hfv4-hero-rest-line { display: flex !important; font-size: 13px !important; }
          .hfv4-hero-sub { font-size: 13px !important; max-width: 300px !important; margin-bottom: 0 !important; -webkit-line-clamp: 1 !important; }
          .hfv4-hero-ctas { margin-top: 4px; }
          .hfv4-hero-cta-ghost { display: inline-flex !important; }
          .hfv4-hero-photo { min-height: 180px !important; border-radius: 0 !important; }
          .hfv4-hero-progress { display: block !important; }
          /* Category bubbles: 80px wrap grid, no scroll */
          .hfv4-cats-row {
            overflow-x: visible !important;
            flex-wrap: wrap !important;
            gap: 22px !important;
            padding: 6px 0 38px !important;
          }
          .hfv4-cat-bubble {
            width: 80px !important; height: 80px !important;
            font-size: 36px !important;
            background: #fff !important;
            border: 1px solid var(--color-ink-05) !important;
          }
          .hfv4-cat-label { font-size: 13px !important; }
          /* Card grids — 4 columns, no horizontal scroll */
          .hfv4-cards-row {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 18px !important;
            overflow: visible !important;
            padding-left: 0 !important; padding-right: 0 !important;
          }
          .hfv4-rcard { flex: 1 1 auto !important; }
          /* Section heads desktop: bigger + subtitle */
          .hfv4-sec-head { padding-left: 0 !important; padding-right: 0 !important; margin-bottom: 22px; }
          .hfv4-sec-head h2 { font-size: 32px !important; letter-spacing: -.02em !important; }
          .hfv4-sec-head-kicker {
            font-size: 11px !important; letter-spacing: .12em !important;
            display: inline-flex !important; align-items: center; gap: 6px;
          }
          .hfv4-sec-head-sub { font-size: 14px !important; display: block !important; }
          /* "Vedi tutti" pill replaces round → on desktop */
          .hfv4-sec-head-all {
            width: auto !important; height: auto !important; border-radius: 999px !important;
            padding: 10px 16px !important;
            background: var(--color-ink-05) !important;
            font-weight: 700 !important;
            color: var(--color-ink) !important;
            display: inline-flex !important; align-items: center !important; gap: 6px !important;
            font-size: 0 !important;
          }
          .hfv4-sec-head-all::before {
            content: 'Vedi tutti';
            font-size: 13px;
          }
          .hfv4-sec-head-all::after {
            content: '→';
            font-size: 14px; margin-left: 4px;
          }
          /* Sponsor banner wide */
          .hfv4-spon-banner {
            grid-template-columns: 108px 1fr auto !important;
            gap: 24px !important;
            padding: 20px 26px !important;
          }
          .hfv4-spon-banner .spon-img { width: 108px !important; height: 108px !important; }
          .hfv4-spon-banner .spon-title { font-size: 22px !important; }
          .hfv4-spon-banner .spon-sub { font-size: 13px !important; max-width: 520px; }
          /* Time tabs wrap, bigger */
          .hfv4-time-tabs {
            overflow: visible !important;
            flex-wrap: wrap !important;
            gap: 10px !important;
            padding: 14px 0 20px !important;
          }
          .hfv4-time-tab { padding: 10px 16px !important; font-size: 14px !important; }
          /* Consiglio: 2-col 1.1/.9 */
          .hfv4-consiglio {
            grid-template-columns: 1.1fr .9fr !important;
            gap: 48px !important;
            padding: 40px 48px !important;
            display: grid !important;
            align-items: center;
          }
          .hfv4-consiglio-title { font-size: 34px !important; }
          .hfv4-consiglio-rest { font-size: 48px !important; margin-bottom: 6px; }
          .hfv4-consiglio-list { gap: 12px !important; }
          .hfv4-consiglio-tip { font-size: 22px !important; }
          /* Consiglio tweaks for 2-col desktop */
          .hfv4-consiglio-r { margin-top: 0 !important; }
          .hfv4-consiglio-cta { margin-top: 8px; }
          /* Suggest desktop */
          .hfv4-suggest {
            grid-template-columns: 1fr auto !important;
            gap: 32px !important;
            padding: 40px 48px !important;
            border-radius: 28px !important;
          }
          .hfv4-suggest-title { font-size: 30px !important; max-width: 500px !important; }
          .hfv4-suggest-sub { font-size: 15px !important; max-width: 560px !important; }
          .hfv4-suggest-cta { padding: 14px 24px !important; font-size: 14px !important; }
          /* Footer desktop */
          .hfv4-foot {
            display: block !important;
            max-width: 1240px;
            margin: 60px auto 0;
            padding: 40px 40px 48px;
            border-top: 1px solid var(--color-ink-05);
          }
          .hfv4-foot-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }
          .hfv4-foot-links {
            display: flex;
            gap: 26px;
            flex-wrap: wrap;
          }
          .hfv4-foot-links a {
            font-size: 13px;
            font-weight: 600;
            color: var(--color-ink-70);
            text-decoration: none;
          }
          .hfv4-foot-links a:hover { color: var(--color-corallo); }
          .hfv4-foot-copy {
            font-size: 12px;
            color: var(--color-ink-40, rgba(34,24,28,.45));
          }
        }
      `}</style>
      <TopBar />
      <HeroPromo featured={featuredDrop} />
      <CategoryBubbles onSelect={(k) => navigate(`/list?cat=${encodeURIComponent(k)}`)} />

      <section className="hfv4-section" style={{ padding: '8px 0 4px' }}>
        <SectionHead
          kicker="Nuovi in guida"
          title="Ultimi aggiunti"
          subtitle="Gli ultimi posti che ho provato e inserito in guida."
          trailing={
            <Link
              to="/list"
              className="hfv4-sec-head-all"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--color-ink-05)',
                display: 'grid', placeItems: 'center',
                fontSize: 14, fontWeight: 700, color: 'var(--color-ink)',
                textDecoration: 'none',
              }}
            >
              →
            </Link>
          }
        />
        {loading ? (
          <div style={{ padding: '0 20px', color: 'var(--color-ink-70)' }}>Caricamento...</div>
        ) : (
          <div
            className="hfv4-cards-row"
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              padding: '0 20px 12px',
              scrollSnapType: 'x proximity',
              scrollPaddingLeft: 20,
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {recent.map((r) => (
              <Rcard
                key={r.id}
                restaurant={r}
                discount={discountByRestaurant[r.id]}
                onClick={onCardClick}
                saved={isSaved(r.id)}
                onToggleSave={() => toggleSave(r.id)}
              />
            ))}
          </div>
        )}
      </section>

      <SponsorBanner />

      <TimeBasedSection
        restaurants={restaurants}
        discountByRestaurant={discountByRestaurant}
        onCardClick={onCardClick}
        isSaved={isSaved}
        toggleSave={toggleSave}
      />

      <CosaConsiglio restaurants={restaurants} />

      <SuggestCard />

      <footer className="hfv4-foot" style={{ display: 'none' }}>
        <div className="hfv4-foot-inner">
          <Link to="/" className="hfv4-foot-wordmark" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', lineHeight: 0.92 }}>
            <span style={{
              fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
              fontSize: 18,
              letterSpacing: '0.02em',
              color: 'var(--color-corallo)',
            }}>
              LA GUIDA DI BI
            </span>
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 9,
              letterSpacing: '0.15em',
              color: 'var(--color-ink-40, rgba(34,24,28,.4))',
              marginTop: 4,
              textTransform: 'uppercase',
            }}>
              by Chiamami Bi
            </span>
          </Link>
          <nav className="hfv4-foot-links">
            <Link to="/about">Su di me</Link>
            <Link to="/about">Come scelgo</Link>
            <Link to="/partner">Per i locali</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Termini</Link>
          </nav>
        </div>
        <div className="hfv4-foot-copy">
          © {new Date().getFullYear()} Chiamami Bi · Torino, Italia
        </div>
      </footer>
    </div>
  )
}
