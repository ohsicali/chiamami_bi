import { Link } from 'react-router-dom'
import { proxyImg } from '../../lib/supabase'
import { getHoursStatus } from '../../lib/hours'
import { formatDiscountValue } from '../../lib/utils/discountFormat'
import { formatPrice } from '../../lib/utils/price'
import { useAdSlot, adHref } from '../../lib/hooks/useAds'
import { useAdImpression, trackAdClick } from '../../lib/hooks/useAdTracking'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { getSlot } from '../../lib/adSlots'

/**
 * Banner pubblicitari · tre formati, un contenuto.
 *
 *   hero    → foto a tutto campo, la posizione premium della home
 *   inline  → card con la stessa impronta delle card ristorante, vive nel feed
 *   compact → riga orizzontale per gli elenchi verticali
 *
 * Il formato lo decide la posizione (registro in lib/adSlots.js), il contenuto
 * lo decide la campagna: ogni formato sa mostrare sia un ristorante che un
 * brand. La label "Annuncio" è sempre visibile, in tutti e tre.
 */

export default function AdSlot({ slot }) {
  const { ad } = useAdSlot(slot)
  const meta = getSlot(slot)
  if (!meta) return null

  // La home resta viva anche senza campagne vendute: se non c'è nessun
  // annuncio nello slot grande, promuoviamo un drop attivo. Comportamento
  // già presente prima del circuito banner, qui conservato.
  if (!ad && slot === 'home_hero') return <HeroDropFallback />
  if (!ad) return null

  const content = resolveAd(ad)
  if (!content) return null

  if (meta.format === 'hero') return <AdHero content={content} slot={slot} />
  if (meta.format === 'inline') return <AdInline content={content} slot={slot} />
  return <AdCompact content={content} slot={slot} />
}

/* ============================================================
   Contenuto: da riga DB a cosa si vede
   ============================================================ */

/** Segnaposto quando manca il logo: due iniziali, mai un nome tagliato a metà. */
function initialsOf(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '★'
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function resolveAd(ad) {
  const link = adHref(ad)
  if (!link) return null

  const r = ad.restaurant
  const isBrand = ad.variant === 'brand'
  const hasDiscount = !!ad.discount && ad.variant === 'restaurant_discount'
  const discountLabel = hasDiscount ? formatDiscountValue(ad.discount) : null

  const catName = (Array.isArray(r?.category) && r.category[0]) || r?.cuisine_type || ''
  const zone = (r?.address || '').split(',')[0].trim()

  return {
    id: ad.id,
    isBrand,
    hasDiscount,
    discountLabel,
    title: ad.headline || (isBrand ? ad.brand_name : r?.name) || ad.brand_name || '',
    subtitle: ad.subtitle || ad.brand_subtitle || ad.discount?.description || r?.tagline || '',
    kicker: isBrand
      ? (ad.brand_name && ad.headline ? ad.brand_name : 'Partner')
      : [catName, zone].filter(Boolean).join(' · '),
    ctaLabel: ad.cta_label || (hasDiscount ? 'Attiva sconto' : link.external ? 'Scopri' : 'Scopri di più'),
    // Nella riga compatta il bottone è largo un paio di parole: "Attiva sconto
    // −15%" non ci sta, e lo sconto ha già il suo posto accanto al titolo.
    ctaShort: ad.cta_label || 'Scopri',
    initials: initialsOf(ad.headline || ad.brand_name || r?.name || ''),
    cover: ad.cover_image_url || proxyImg(r?.photos?.[0]?.photo_url || r?.photos?.[0]?.thumb_url, { w: 1200 }),
    logo: ad.logo_image_url || proxyImg(r?.photos?.[0]?.thumb_url || r?.photos?.[0]?.photo_url, { w: 320 }),
    priceLabel: formatPrice(r?.price_range),
    hours: getHoursStatus(r?.hours_cache),
    // Su una campagna esterna con ristorante collegato la scheda sul sito
    // resta raggiungibile come azione secondaria.
    secondary: link.external && r?.slug ? { href: `/restaurant/${r.slug}`, label: 'Vedi la scheda' } : null,
    ...link,
  }
}

/* ============================================================
   Pezzi condivisi
   ============================================================ */

function AdLabel({ dark = true, floating = true }) {
  return (
    <span
      style={{
        ...(floating
          ? { position: 'absolute', top: 12, left: 12, zIndex: 2 }
          : { position: 'static' }),
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
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--color-oro)' }} aria-hidden="true">✦</span>
      Annuncio
    </span>
  )
}

/**
 * Un link a pagamento verso l'esterno vuole rel="sponsored": senza, Google lo
 * legge come un endorsement editoriale e il sito ci rimette in reputazione.
 */
function AdLink({ content, slot, href, external, children, ...rest }) {
  const target = href ?? content.href
  const isExternal = external ?? content.external
  const onClick = () => trackAdClick(content.id, slot)

  if (isExternal) {
    return (
      <a href={target} target="_blank" rel="sponsored noopener noreferrer" onClick={onClick} {...rest}>
        {children}
      </a>
    )
  }
  return <Link to={target} onClick={onClick} {...rest}>{children}</Link>
}

// Il fondo di riserva sta SOTTO la foto, non al suo posto: se l'immagine del
// cliente non carica (link rotto, rete lenta) resta comunque una superficie
// scura su cui la label "Annuncio" e il testo bianco si leggono.
const OVERLAY = 'linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(34,24,28,.85) 100%)'
const COVER_FALLBACK = 'linear-gradient(135deg,#C48E4E 0%,#7D5230 60%,#3C2312 100%)'

const INLINE_FALLBACK = 'linear-gradient(140deg,#F0D9B8 0%,#D9A441 55%,#B08954 100%)'
const LOGO_FALLBACK = 'linear-gradient(135deg,#F5F0E4,#E3D3B4)'

const coverBg = (cover) =>
  cover
    ? `${OVERLAY}, url(${cover}) center/cover, ${COVER_FALLBACK}`
    : `${OVERLAY}, ${COVER_FALLBACK}`

/* ============================================================
   Formato 1 · Hero
   ============================================================ */

function AdHero({ content, slot }) {
  const { hours } = content
  const ref = useAdImpression(content.id, slot)
  return (
    <div ref={ref} className="hfv4-spon-wrap" style={{ padding: '8px 20px 18px' }}>
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
        <div
          className="spon-photo"
          style={{ position: 'relative', height: 178, background: coverBg(content.cover) }}
        >
          <AdLabel dark />
          {content.kicker && (
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
              {content.kicker}
            </span>
          )}
        </div>

        <div
          className="hfv4-spon-banner-body"
          style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
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
            {content.title}
          </div>
          {content.subtitle && (
            <div className="spon-sub" style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.45 }}>
              {content.subtitle}
            </div>
          )}
          {!content.isBrand && (content.priceLabel || hours?.state !== 'unknown') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>
              {content.priceLabel}
              {content.priceLabel && hours?.state !== 'unknown' && <span style={{ opacity: 0.4 }}>·</span>}
              {hours?.state !== 'unknown' && <span>{hours.message}</span>}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: content.secondary ? '1fr auto' : '1fr',
              gap: 8,
              marginTop: 6,
            }}
          >
            <AdLink
              content={content}
              slot={slot}
              className="press"
              style={{
                padding: '13px 14px',
                background: content.hasDiscount ? 'var(--color-cta)' : '#fff',
                color: content.hasDiscount ? '#fff' : 'var(--color-ink)',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                textAlign: 'center',
                textDecoration: 'none',
                boxShadow: content.hasDiscount ? '0 8px 20px rgba(232,69,60,.35)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                letterSpacing: '-0.01em',
              }}
            >
              {content.ctaLabel}
              {content.discountLabel && (
                <span
                  style={{
                    background: 'rgba(255,255,255,.25)',
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {content.discountLabel}
                </span>
              )}
            </AdLink>

            {content.secondary && (
              <Link
                to={content.secondary.href}
                className="press"
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
                  justifyContent: 'center',
                }}
              >
                {content.secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Formato 2 · Card inline (stessa impronta delle card ristorante)
   ============================================================ */

function AdInline({ content, slot }) {
  const ref = useAdImpression(content.id, slot)
  return (
    <AdLink
      ref={ref}
      content={content}
      slot={slot}
      className="hfv4-lcard hfv4-ad-inline press"
      style={{
        flex: '0 0 72%',
        scrollSnapAlign: 'start',
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid rgba(176,137,84,.35)',
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
        display: 'block',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/11',
          background: content.cover
            ? `url(${content.cover}) center/cover, ${INLINE_FALLBACK}`
            : INLINE_FALLBACK,
        }}
      >
        <AdLabel dark />
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        {content.kicker && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-oro-deep, #8E6B3E)',
              marginBottom: 3,
            }}
          >
            {content.kicker}
          </div>
        )}
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
          {content.title}
        </div>
        {content.subtitle && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-ink-70)',
              marginTop: 3,
              lineHeight: 1.35,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {content.subtitle}
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--color-corallo-ink, #C53A33)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {content.ctaLabel}
          {content.discountLabel && (
            <span
              style={{
                background: 'var(--color-corallo-wash, #FDEDEB)',
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {content.discountLabel}
            </span>
          )}
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </AdLink>
  )
}

/* ============================================================
   Formato 3 · Riga compatta
   ============================================================ */

function AdCompact({ content, slot }) {
  const ref = useAdImpression(content.id, slot)
  return (
    <AdLink
      ref={ref}
      content={content}
      slot={slot}
      className="ad-compact press"
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: '12px 13px',
        background: '#fff',
        border: '1px solid rgba(176,137,84,.35)',
        borderRadius: 16,
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: '0 1px 2px rgba(34,24,28,.04)',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          // Piastrella neutra + logo "contain": a differenza di un ritaglio a
          // copertura, un logo orizzontale (simbolo + nome affiancati, il
          // caso più comune) si vede intero invece di perdere i lati.
          background: content.logo ? '#fff' : LOGO_FALLBACK,
          border: content.logo ? '1px solid var(--color-ink-05)' : 'none',
          display: 'grid',
          placeItems: 'center',
          padding: content.logo ? 6 : 0,
          fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
          fontSize: 20,
          color: 'var(--color-oro-deep, #8E6B3E)',
          textAlign: 'center',
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}
      >
        {content.logo ? (
          <img
            src={content.logo}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          content.initials
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 4 }}>
          <AdLabel dark={false} floating={false} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: 14,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              color: 'var(--color-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {content.title}
          </span>
          {content.discountLabel && (
            <span
              style={{
                flexShrink: 0,
                background: 'var(--color-corallo-wash, #FDEDEB)',
                color: 'var(--color-corallo-ink, #C53A33)',
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 800,
              }}
            >
              {content.discountLabel}
            </span>
          )}
        </div>
        {content.subtitle && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--color-ink-70)',
              lineHeight: 1.4,
              marginTop: 2,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {content.subtitle}
          </div>
        )}
      </div>

      <span
        style={{
          background: 'var(--color-ink)',
          color: '#fff',
          borderRadius: 999,
          padding: '9px 14px',
          fontSize: 11.5,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        {content.ctaShort}
      </span>
    </AdLink>
  )
}

/* ============================================================
   Fallback home: nessuna campagna venduta → promuoviamo un drop
   ============================================================ */

function HeroDropFallback() {
  const { activeDrops } = useActiveDiscounts()
  const drop = Array.isArray(activeDrops) ? activeDrops[0] : null
  const r = drop?.restaurant
  if (!r?.slug) return null

  const content = resolveAd({
    id: `drop-${drop.id}`,
    variant: 'restaurant_discount',
    link_type: 'internal',
    restaurant: r,
    discount: drop,
    subtitle: drop.description || drop.title,
  })
  if (!content) return null
  return <AdHero content={content} />
}

/**
 * Anteprima per l'admin: rende una campagna non ancora salvata, senza passare
 * dal contesto degli annunci.
 */
export function AdPreview({ ad, format }) {
  const content = resolveAd(ad)
  if (!content) return null
  if (format === 'hero') return <AdHero content={content} />
  if (format === 'inline') return <AdInline content={content} />
  return <AdCompact content={content} />
}
