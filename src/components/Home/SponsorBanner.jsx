import { Link } from 'react-router-dom'
import { getHoursStatus } from '../../lib/hours'
import { proxyImg } from '../../lib/supabase'
import { useSponsoredPlacement } from '../../lib/hooks/useSponsoredPlacement'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

/**
 * SponsorBanner · 3 variant (DB-driven da sponsored_placements):
 *   - 'restaurant_discount' → foto hero + CTA duale [Attiva sconto -N%] [Scopri]
 *   - 'restaurant_plain'    → foto hero + CTA duale [Scopri di più] [♡ salva]
 *   - 'brand'               → layout compact logo 72x72 + testo + CTA singolo
 *
 * Tutte le variant mostrano SEMPRE il label "Annuncio" in alto-sx (trust/legal).
 *
 * Fallback: se non c'è nessun placement admin-created ma esiste un drop
 * attivo (discounts.is_drop=true), costruiamo un placement virtuale di
 * variant `restaurant_discount` per mantenere la home vivace senza
 * richiedere doppio data-entry all'admin.
 */
export default function SponsorBanner() {
  const { placement } = useSponsoredPlacement()
  const { activeDrops } = useActiveDiscounts()

  // Demo placement abilitato via env var `VITE_DEMO_SPONSOR=smashers` o
  // query string `?demo=smashers` — Augusto può testarlo su Vercel preview.
  const demo = getDemoPlacement()

  const effective = placement || buildVirtualFromDrop(activeDrops) || demo
  if (!effective) return null

  if (effective.variant === 'brand') return <BrandVariant p={effective} />
  return <RestaurantVariant p={effective} />
}

function getDemoPlacement() {
  if (typeof window === 'undefined') return null
  const envDemo = import.meta.env.VITE_DEMO_SPONSOR
  const qsDemo = new URLSearchParams(window.location.search).get('demo')
  const active = qsDemo || envDemo
  if (active !== 'smashers') return null
  return {
    variant: 'restaurant_discount',
    restaurant: {
      id: 'demo-smashers',
      slug: 'smashers',
      name: 'Smashers',
      cuisine_type: 'Burger',
      category: ['Burger'],
      price_range: 2,
      address: 'Vanchiglia, Torino',
      tagline: 'Smash burger senza compromessi. Doppio con cheddar la cosa da prendere, secondo me.',
      hours_cache: null,
      photos: [],
    },
    discount: {
      id: 'demo-smashers-discount',
      title: 'Sconto Smashers',
      description: 'Smash burger senza compromessi. Doppio con cheddar la cosa da prendere, secondo me.',
      discount_type: 'percentage',
      discount_value: '15',
    },
    headline: 'Smashers',
    subtitle: 'Smash burger senza compromessi. Doppio con cheddar la cosa da prendere, secondo me.',
    cta_label: 'Attiva sconto',
    cover_image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
  }
}

function buildVirtualFromDrop(activeDrops) {
  if (!Array.isArray(activeDrops) || activeDrops.length === 0) return null
  const drop = activeDrops[0]
  const r = drop.restaurant
  if (!r) return null
  return {
    variant: 'restaurant_discount',
    restaurant: r,
    discount: drop,
    headline: null,
    subtitle: drop.description || drop.title,
    cta_label: null,
    cover_image_url: null,
  }
}

function AdLabel({ dark = true }) {
  return (
    <span
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        padding: '5px 10px',
        background: dark ? 'rgba(255,255,255,.16)' : 'rgba(34,24,28,.06)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        color: dark ? 'rgba(255,255,255,.9)' : 'var(--color-ink-70)',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'var(--color-ink-05)'}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 2,
      }}
    >
      <span style={{ color: 'var(--color-oro)' }}>✦</span>
      Annuncio
    </span>
  )
}

function RestaurantVariant({ p }) {
  const r = p.restaurant
  if (!r) return null

  const cover = p.cover_image_url
    || proxyImg(r.photos?.[0]?.photo_url || r.photos?.[0]?.thumb_url)
  const status = getHoursStatus(r.hours_cache)
  const catName = (Array.isArray(r.category) && r.category[0]) || r.cuisine_type || ''
  const zone = (r.address || '').split(',')[0].trim()
  const priceLabel = '€'.repeat(r.price_range || 2)

  const hasDiscount = p.variant === 'restaurant_discount' && p.discount
  const discountLabel = hasDiscount
    ? (p.discount.discount_type === 'percentage'
        ? `-${String(p.discount.discount_value).replace('%', '')}%`
        : `-${p.discount.discount_value}€`)
    : null

  const title = p.headline || r.name
  const subtitle = p.subtitle || p.discount?.description || r.tagline || ''
  const ctaLabel = p.cta_label || (hasDiscount ? `Attiva sconto` : 'Scopri di più')

  return (
    <div className="hfv4-spon-wrap" style={{ padding: '8px 16px 18px' }}>
      <div
        className="hfv4-spon-banner"
        style={{
          position: 'relative',
          background: 'var(--color-ink)',
          color: '#fff',
          borderRadius: 28,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(34,24,28,.08)',
        }}
      >
        {/* Photo */}
        <div
          className="spon-photo"
          style={{
            position: 'relative',
            height: 178,
            background: cover
              ? `linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(34,24,28,.85) 100%), url(${cover}) center/cover`
              : 'linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(34,24,28,.85) 100%), linear-gradient(135deg,#C48E4E 0%,#7D5230 60%,#3C2312 100%)',
          }}
        >
          <AdLabel dark />
          <button
            type="button"
            aria-label="Salva"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'rgba(0,0,0,.4)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              color: '#fff',
              fontSize: 16,
              border: '1px solid rgba(255,255,255,.14)',
              cursor: 'pointer',
              zIndex: 2,
            }}
          >
            ♡
          </button>
          {(catName || zone) && (
            <span
              style={{
                position: 'absolute',
                bottom: 14,
                left: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.85)',
                zIndex: 2,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-corallo)' }} />
              {[catName, zone].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '18px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            className="spon-title"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 26,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: '#fff',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="spon-sub" style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.45 }}>
              {subtitle}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>
            {priceLabel}
            {status.state !== 'unknown' && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{status.message}</span>
              </>
            )}
          </div>

          {/* CTAs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              marginTop: 6,
            }}
          >
            <Link
              to={`/restaurant/${r.slug}`}
              style={{
                padding: '13px 14px',
                background: hasDiscount ? 'var(--color-corallo)' : '#fff',
                color: hasDiscount ? '#fff' : 'var(--color-ink)',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                textAlign: 'center',
                textDecoration: 'none',
                boxShadow: hasDiscount ? '0 8px 20px rgba(232,69,60,.35)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                letterSpacing: '-0.01em',
              }}
            >
              {ctaLabel}
              {hasDiscount && discountLabel && (
                <span
                  style={{
                    background: 'rgba(255,255,255,.25)',
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {discountLabel}
                </span>
              )}
            </Link>
            <Link
              to={`/restaurant/${r.slug}`}
              style={{
                padding: '13px 16px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.18)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'center',
              }}
            >
              {hasDiscount ? 'Scopri' : '♡ Salva'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandVariant({ p }) {
  const href = p.cta_url || '#'
  const external = href.startsWith('http')
  const Tag = external ? 'a' : Link
  const tagProps = external
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { to: href }
  const logo = p.logo_image_url

  return (
    <div className="hfv4-spon-wrap" style={{ padding: '8px 16px 18px' }}>
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg,#F5EEE2 0%,#E8DCC6 100%)',
          border: '1px solid rgba(176,137,84,.3)',
          borderRadius: 28,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '72px 1fr',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <AdLabel dark={false} />
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 14,
            background: logo ? `url(${logo}) center/cover, #fff` : '#fff',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 14,
            color: 'var(--color-ink)',
            letterSpacing: '0.02em',
            textAlign: 'center',
            lineHeight: 1.05,
            boxShadow: '0 2px 6px rgba(34,24,28,.06)',
          }}
        >
          {!logo && (p.brand_name || 'BRAND').slice(0, 14)}
        </div>
        <div style={{ paddingTop: 22 /* spazio per il label */, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: '-0.01em',
              color: 'var(--color-ink)',
              marginBottom: 3,
            }}
          >
            {p.headline || p.brand_name}
          </div>
          {(p.subtitle || p.brand_subtitle) && (
            <div style={{ fontSize: 12, color: 'var(--color-ink-70)', lineHeight: 1.4, marginBottom: 10 }}>
              {p.subtitle || p.brand_subtitle}
            </div>
          )}
          <Tag
            {...tagProps}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              background: 'var(--color-ink)',
              color: '#fff',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            {p.cta_label || 'Scopri il brand'} →
          </Tag>
        </div>
      </div>
    </div>
  )
}
