/**
 * v4 Home feed — segue docs/mockups/v4-mobile-home.html
 *
 * Montato temporaneamente su /v4 per anteprima. Struttura:
 *  - Topbar: logo + city pill + geo button
 *  - Hero promo card corallo (featured drop/sconto)
 *  - Categorie bubble carousel
 *  - Sezione "Ultimi aggiunti" card scroll-snap
 *  - Sponsor banner ink
 *  - Sezione time-based (Aperitivo / Colazione / ...)
 *  - Blocco "Cosa ti consiglio" oro gradient
 *  - Card "Suggerisci un posto" ink + corallo
 *
 * Data wiring: incrementale — per ora alcuni blocchi usano placeholder
 * mentre altri (ultimi aggiunti, sconti) vengono dai hooks reali.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { proxyImg } from '../../lib/supabase'

const CATEGORIES = [
  { key: 'aperitivo', emoji: '🥂', label: 'Aperitivo' },
  { key: 'piemontese', emoji: '🍝', label: 'Piemontese' },
  { key: 'pizza', emoji: '🍕', label: 'Pizza' },
  { key: 'giapponese', emoji: '🍣', label: 'Giapponese' },
  { key: 'pesce', emoji: '🐟', label: 'Pesce' },
  { key: 'colazione', emoji: '☕', label: 'Colazione' },
  { key: 'carne', emoji: '🥩', label: 'Carne' },
]

function TopBar() {
  return (
    <div
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
  if (!featured) return null
  return (
    <div style={{ padding: '4px 16px 22px' }}>
      <div
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
          boxShadow: '0 4px 14px rgba(34,24,28,.08)',
        }}
      >
        <div>
          <span
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
            DROP LIVE
          </span>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 30,
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: '#fff',
              marginBottom: 8,
            }}
          >
            {featured.title}
          </div>
          {featured.subtitle && (
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,.85)',
                lineHeight: 1.4,
                marginBottom: 14,
                maxWidth: 180,
              }}
            >
              {featured.subtitle}
            </div>
          )}
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
        </div>
        {featured.photo && (
          <div
            style={{
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
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryBubbles({ activeKey, onSelect }) {
  return (
    <div
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
  )
}

function SectionHead({ title, trailing }) {
  return (
    <div
      style={{
        padding: '0 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
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
      {trailing}
    </div>
  )
}

function Rcard({ restaurant, discount, onClick }) {
  const cat = getCategoryInfo(restaurant.cuisine_type || (restaurant.category && restaurant.category[0]))
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0 ? restaurant.photos[0] : null
  const photoUrl = proxyImg(firstPhoto ? (typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url) : null)
  const priceStr = restaurant.price_range != null ? '€'.repeat(restaurant.price_range) : null
  const discLabel = discount?.discount_value
    ? (discount.discount_type === 'percentage' ? `-${String(discount.discount_value).replace('%','')}%` : `-${discount.discount_value}€`)
    : null

  return (
    <button
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

function SuggestCard() {
  const navigate = useNavigate()
  return (
    <div style={{ padding: '24px 16px 36px' }}>
      <div
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
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 18, lineHeight: 1.15, letterSpacing: '-0.01em', marginBottom: 6, maxWidth: 200 }}>
            Conosci un posto che manca?
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.35, maxWidth: 220 }}>
            Scrivici nome + zona. Bi ci va a mangiare. Se è buono, entra.
          </div>
        </div>
        <button
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
  useSavedRestaurants(user?.id)

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
    const photo = proxyImg(photos ? (typeof photos === 'string' ? photos : photos?.thumb_url || photos?.photo_url) : null)
    const label = drop.discount_type === 'percentage' ? `-${String(drop.discount_value).replace('%','')}%` : `-${drop.discount_value}€`
    return {
      title: `${label}\nda ${r.name}.`,
      subtitle: drop.description || drop.title,
      cta: 'Vai al drop',
      href: `/restaurant/${r.slug}`,
      photo,
    }
  }, [discounts, restaurants])

  const onCardClick = (r) => navigate(`/restaurant/${r.slug}`)

  return (
    <div style={{ background: 'var(--color-page)', minHeight: '100dvh', paddingBottom: 100 }}>
      <TopBar />
      <HeroPromo featured={featuredDrop} />
      <CategoryBubbles onSelect={(k) => navigate(`/list?cat=${encodeURIComponent(k)}`)} />

      <section style={{ padding: '8px 0 4px' }}>
        <SectionHead
          title="Ultimi aggiunti"
          trailing={
            <Link
              to="/list"
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
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              padding: '0 20px 12px',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {recent.map((r) => (
              <Rcard key={r.id} restaurant={r} discount={discountByRestaurant[r.id]} onClick={onCardClick} />
            ))}
          </div>
        )}
      </section>

      <SuggestCard />
    </div>
  )
}
