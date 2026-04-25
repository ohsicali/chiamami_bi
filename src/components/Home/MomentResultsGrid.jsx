import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { isOpenForMoment, MOMENT_SLOTS } from '../../lib/hours'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { proxyImg } from '../../lib/supabase'

/**
 * MomentResultsGrid · card scroll orizzontale filtrate per momento giornata.
 * Ogni card mostra: foto, open-pill verde con closing time, nome, categoria·zona·prezzo.
 * L'ultima card è una "+" ink che porta a `/esplora?moment={active}`.
 */
export default function MomentResultsGrid({
  restaurants,
  activeMoment,
  onCardClick,
  isSaved,
  toggleSave,
}) {
  const slot = MOMENT_SLOTS[activeMoment]

  const filtered = useMemo(() => {
    if (!Array.isArray(restaurants)) return []
    return restaurants
      .filter((r) => r.is_published !== false)
      .map((r) => {
        const match = isOpenForMoment(r.hours_cache, activeMoment)
        return { r, match }
      })
      .filter(({ match }) => match.match)
      .slice(0, 10)
  }, [restaurants, activeMoment])

  const visibleCards = filtered.slice(0, 3)
  const remaining = Math.max(0, filtered.length - visibleCards.length)

  return (
    <section className="hfv4-results" style={{ paddingTop: 4 }}>
      <div
        className="hfv4-results-head"
        style={{
          padding: '4px 20px 10px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          {slot ? `${slot.label} ora · aperti nella fascia` : 'Locali per te adesso'}
        </h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-ink-40, rgba(34,24,28,.4))',
            letterSpacing: '0.04em',
          }}
        >
          {filtered.length} locali
        </span>
      </div>

      <div
        className="hfv4-results-row"
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          padding: '0 20px 12px 20px',
          scrollSnapType: 'x mandatory',
          scrollPaddingLeft: 20,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {visibleCards.map(({ r, match }) => (
          <Lcard
            key={r.id}
            r={r}
            closesAt={match.closesAt}
            onClick={() => onCardClick?.(r)}
            saved={isSaved ? isSaved(r.id) : false}
            onToggleSave={toggleSave ? () => toggleSave(r.id) : undefined}
          />
        ))}

        <Link
          to={`/esplora?moment=${activeMoment}`}
          className="hfv4-results-more"
          style={{
            flex: '0 0 60%',
            scrollSnapAlign: 'start',
            background: 'linear-gradient(135deg,#22181C 0%,#3d2f36 100%)',
            color: '#fff',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            padding: '32px 18px',
            textDecoration: 'none',
            textAlign: 'center',
            minHeight: 220,
          }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--color-corallo)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
              fontWeight: 700,
              color: '#fff',
              boxShadow: '0 8px 20px rgba(232,69,60,.4)',
            }}
          >
            +
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
            }}
          >
            {remaining > 0 ? `Vedi gli altri ${remaining}` : 'Vedi tutti'}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.5)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Sulla mappa
          </span>
        </Link>
      </div>
    </section>
  )
}

function Lcard({ r, closesAt, onClick, saved, onToggleSave }) {
  const catName = (Array.isArray(r.category) && r.category[0]) || r.cuisine_type || ''
  const cat = getCategoryInfo(catName)
  const zone = (r.address || '').split(',')[0].trim()
  const priceLabel = '€'.repeat(r.price_range || 2)
  const photo = proxyImg(r.photos?.[0]?.photo_url || r.photos?.[0]?.thumb_url)

  return (
    <a
      href={`/restaurant/${r.slug}`}
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
      }}
      className="hfv4-lcard"
      style={{
        flex: '0 0 72%',
        scrollSnapAlign: 'start',
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid var(--color-ink-05)',
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
        display: 'block',
      }}
    >
      <div style={{ position:'relative', width:'100%', aspectRatio:'16/11', background: `linear-gradient(135deg, ${cat?.color || '#E8CFA8'} 0%, rgba(34,24,28,.15) 100%)`, overflow:'hidden' }}>
        {/* Fallback emoji SEMPRE sotto la foto — se img non carica, si vede */}
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', fontSize:46, opacity:0.55 }}>
          {cat?.emoji || '🍽️'}
        </div>
        {/* Foto su top se disponibile — onError nasconde l'img lasciando il fallback sotto */}
        {photo && (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }}
          />
        )}
        <OpenPill closesAt={closesAt} />
        {onToggleSave && (
          <div
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave() }}
            style={{ position:'absolute', top:10, right:10, width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,.88)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color: saved ? 'var(--color-corallo)' : 'var(--color-ink-70)', cursor:'pointer' }}
            aria-label={saved ? 'Rimuovi dai salvati' : 'Salva'}
          >
            {saved ? '♥' : '♡'}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
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
          {r.name}
        </div>
        {r.tagline && (
          <div style={{ fontSize: 12, color: 'var(--color-ink-70)', marginTop: 3, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {r.tagline}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--color-ink-70)',
            marginTop: 4,
            flexWrap: 'wrap',
          }}
        >
          {catName && (
            <span
              style={{
                background: 'var(--color-corallo-soft, #FDEBEA)',
                color: 'var(--color-corallo-ink, #C6372F)',
                fontWeight: 700,
                fontSize: 10,
                padding: '3px 7px',
                borderRadius: 999,
              }}
            >
              {cat?.name || catName}
            </span>
          )}
          {zone && <><span style={{ opacity: 0.4 }}>·</span>{zone}</>}
          <span style={{ opacity: 0.4 }}>·</span>
          {priceLabel}
        </div>
      </div>
    </a>
  )
}

function OpenPill({ closesAt }) {
  const text = closesAt ? `Aperto · fino ${closesAt}` : 'Aperto'
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        padding: '5px 10px',
        background: 'rgba(255,255,255,.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        color: '#137C3E',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#137C3E' }} />
      {text}
    </span>
  )
}
