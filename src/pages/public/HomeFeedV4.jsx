import { useState, useMemo, useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getPublicCategoryNames } from '../../lib/hooks/useCategories'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { getCurrentMoment, isOpenForMoment } from '../../lib/hours'
import { proxyImg, proxyImgSrcSet } from '../../lib/supabase'
import MetaTags from '../../components/SEO/MetaTags'
import JsonLd from '../../components/SEO/JsonLd'
import SaveButton from '../../components/Restaurant/SaveButton'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import AdSlot from '../../components/Ads/AdBanner'
import TimeContextHero from '../../components/Home/TimeContextHero'
import MomentTabs from '../../components/Home/MomentTabs'
import MomentResultsGrid from '../../components/Home/MomentResultsGrid'
import AskBiChat from '../../components/Home/AskBiChat'
import BiLogoMark from '../../components/UI/BiLogoMark'
import Reveal from '../../components/UI/Reveal'
import { STAGGER, staggerDelay } from '../../lib/motion'
import { formatDiscountValue } from '../../lib/utils/discountFormat'
import DropCard from '../../components/Discount/DropCard'
import { filterActive, filterActiveDrops, sortByExpiry } from '../../lib/discounts'
import { formatPrice } from '../../lib/utils/price'


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
  //
  // Il listener passa da un rAF: prima chiamava setScrolled a ogni evento
  // di scroll (decine al secondo su iOS), e la pill anima gap/padding/
  // max-width, cioè layout — la roba più cara da ricalcolare proprio
  // mentre il thread principale sta già scrollando. Ora il valore viene
  // letto una volta per frame e lo stato cambia solo quando la soglia
  // viene davvero attraversata.
  const [scrolled, setScrolled] = useState(false)
  const rafId = useRef(0)
  useEffect(() => {
    const read = () => {
      rafId.current = 0
      setScrolled((prev) => {
        const next = window.scrollY > 12
        return next === prev ? prev : next
      })
    }
    const onScroll = () => {
      if (rafId.current) return
      rafId.current = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
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
          transition: 'gap var(--dur-menu) var(--ease-out), padding var(--dur-menu) var(--ease-out)',
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
              transition: 'opacity var(--dur-menu) var(--ease-out)',
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
              transition: 'opacity var(--dur-menu) var(--ease-out)',
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
            transition: 'max-width var(--dur-menu) var(--ease-out), opacity var(--dur-pop) var(--ease-out)',
          }}
        >
          Chiedi a Bi
        </span>
      </Link>
    </div>
  )
}

/**
 * Il drop in home — la vetrina, non il catalogo.
 *
 * La home è l'unico posto dove una selezione è corretta: mostra un drop in
 * evidenza e, se ce ne sono altri, una riga a scorrimento sotto. Tutto il
 * resto sta in Bi Club, che li mostra tutti (Blocco 0).
 *
 * La card è quella condivisa del Blocco 1: prima qui viveva una seconda
 * implementazione con badge, barra e conteggi calcolati a modo suo, che si
 * era già allontanata da quella del Bi Club.
 */
function HomeDrop({ featured, onUnlock, onDiscover }) {
  if (!featured) return null
  return (
    <div className="hfv4-drop-wrap hfv4-rise" style={{ '--rise-y': '12px', '--rise-opacity': 0.55 }}>
      <DropCard
        deal={featured}
        size="large"
        onUnlock={() => onUnlock(featured)}
        onDiscover={() => onDiscover(featured)}
      />

    </div>
  )
}

/**
 * Gli altri sconti attivi.
 *
 * Blocco separato dal drop perché cambia posto tra i due layout: su mobile
 * sta subito sotto al drop, su desktop scende accanto a "Ultimi aggiunti"
 * (Blocco 3). Stesso nodo nel DOM in entrambi i casi — si sposta con la
 * griglia, non duplicandolo.
 */
function DropOthers({ others, onOpen }) {
  if (!others || others.length === 0) return null
  return (
    <div className="hfv4-drop-others">
      <div className="hfv4-drop-others-head">
        <strong>Altri sconti attivi</strong>
        <Link to="/sconti" className="hfv4-drop-others-all">Tutti →</Link>
      </div>
      {/* Su mobile scorrono in orizzontale, su desktop diventano una lista
          verticale: su schermo largo una lista si legge e si clicca tutta
          senza trascinare. */}
      <div className="hfv4-drop-others-row">
        {others.map((d) => (
          <DropCard key={d.id} deal={d} size="mini" onUnlock={() => onOpen(d)} />
        ))}
      </div>
      <Link to="/sconti" className="hfv4-drop-others-hook">
        🔒 Registrati per prenderli · gratis, 20 secondi
      </Link>
    </div>
  )
}


function CategoryBubbles({ onSelect, onAltro }) {
  const reduce = useReducedMotion()
  const bubbleStyle = () => ({ width:64, height:64, borderRadius:'50%', background:'var(--color-ink-05)', display:'grid', placeItems:'center', fontSize:28 })
  const labelStyle = () => ({ fontSize:11, fontWeight:700, color:'var(--color-ink)', maxWidth:72, textAlign:'center', lineHeight:1.15 })
  const btnStyle = { flex:'0 0 auto', display:'flex', flexDirection:'column', alignItems:'center', gap:6, background:'transparent', border:'none', scrollSnapAlign:'start', cursor:'pointer', padding:0 }

  // Le bolle entrano da sinistra a destra, 40ms l'una dall'altra — CSS
  // (.hfv4-rise), non Framer. Con 11 bottoni che animano nello stesso
  // istante in cui la pagina sta ancora montando, 11 animazioni JS in
  // parallelo perdevano frame: misurato, gruppi di bolle che saltavano
  // da 0 a 0.11 di colpo invece di seguire il proprio ritardo. React
  // sceglie qui solo i due numeri (quanto sale, quanto aspetta), il
  // motore CSS del browser fa il resto. `.press` (globals.css) dà
  // l'affondamento al tocco in pura CSS, niente whileTap.
  const rise = (i) => ({
    '--rise-y': reduce ? '0px' : '10px',
    '--rise-delay': `${Math.round(staggerDelay(i, 0.04) * 1000)}ms`,
  })

  return (
    <div className="hfv4-cats-wrap">
      <div className="hfv4-cats-row" style={{ display:'flex', gap:10, overflowX:'auto', padding:'6px 20px 20px 20px', WebkitOverflowScrolling:'touch', scrollSnapType:'x mandatory', scrollPaddingLeft:20, scrollbarWidth:'none' }}>
        {CATEGORIES.map((c, i) => (
          <button key={c.key} onClick={() => onSelect?.(c)} className="press hfv4-rise" style={{ ...btnStyle, ...rise(i) }}>
            <span className="hfv4-cat-bubble" style={bubbleStyle()}>{c.emoji}</span>
            <span className="hfv4-cat-label" style={labelStyle()}>{c.label}</span>
          </button>
        ))}
        <button onClick={onAltro} className="press hfv4-rise" style={{ ...btnStyle, ...rise(CATEGORIES.length) }}>
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

function Rcard({ restaurant, index = 0, discount, onClick, saved, onToggleSave }) {
  const cat = getCategoryInfo(getPublicCategoryNames(restaurant)[0] || restaurant.cuisine_type)
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0 ? restaurant.photos[0] : null
  // Card is 72% viewport width on mobile (~280px), 16:11 ratio → 600w covers DPR 2.
  // Keep srcset tight (2 widths) so we minimize unique /api/img cold-cache misses.
  const photoRaw = firstPhoto ? (typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url) : null
  const photoUrl = proxyImg(photoRaw, { w: 600 })
  const photoSrcSet = proxyImgSrcSet(photoRaw, [400, 800])
  // First card visible on screen → eager load so it doesn't pop in.
  const isAboveFold = index < 2
  const priceStr = formatPrice(restaurant.price_range)
  const discLabel = discount?.discount_value ? formatDiscountValue(discount) : null
  return (
    // CSS, non Framer: questa card è dentro <Reveal> (whileInView), che
    // essendo la sezione sopra la piega scatta nello stesso istante del
    // mount — due orchestrazioni JS sullo stesso pezzo di schermo, per
    // fino a 8 card in fila. `.hfv4-rise` gira sul motore nativo del
    // browser e non compete con il resto del mount.
    <button
      className="hfv4-rcard press hfv4-rise"
      onClick={() => onClick?.(restaurant)}
      style={{ flex:'0 0 72%', scrollSnapAlign:'start', background:'#fff', borderRadius:20, overflow:'hidden', border:'1px solid var(--color-ink-05)', textAlign:'left', color:'inherit', boxShadow:'0 1px 3px rgba(34,24,28,.06)', cursor:'pointer', padding:0, fontFamily:'inherit', '--rise-delay': `${Math.round(staggerDelay(index, STAGGER, 0.2) * 1000)}ms` }}>
      <div style={{ position:'relative', width:'100%', aspectRatio:'16/11', background:'var(--color-ink-05)', overflow:'hidden' }}>
        {photoUrl
          ? <img src={photoUrl} srcSet={photoSrcSet} sizes="(max-width: 768px) 72vw, 320px" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading={isAboveFold ? 'eager' : 'lazy'} fetchpriority={isAboveFold ? 'high' : 'auto'} decoding="async" />
          : <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', fontSize:28 }}>{cat?.emoji || '🍽️'}</div>
        }
        {discLabel && (
          <span style={{ position:'absolute', top:10, left:10, background:'linear-gradient(135deg, #A3E635, #4ADE80)', color:'#1a4731', fontSize:11, fontWeight:800, padding:'4px 9px', borderRadius:999, letterSpacing:'0.02em' }}>{discLabel}</span>
        )}
        <div style={{ position:'absolute', top:10, right:10 }}>
          <SaveButton saved={saved} onClick={onToggleSave} size="sm" />
        </div>
      </div>
      {/* Colonna flessibile: l'indirizzo va in fondo con `margin-top: auto`,
          così in griglia gli indirizzi di tutte le card si allineano fra
          loro invece di seguire ognuno la propria tagline. */}
      <div style={{ padding:'10px 14px 14px', display:'flex', flexDirection:'column', height:'100%' }}>
        {/* Due righe e non una: "Pasticceria Caffetteria Duò" o "Duccio Smash
            Mob" a una riga sola diventano "Pasticceria Caffe…", e il nome è
            l'unica cosa che distingue una card dall'altra. */}
        <div style={{ fontFamily:'var(--font-sans)', fontWeight:800, fontSize:16, lineHeight:1.2, letterSpacing:'-0.01em', color:'var(--color-ink)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{restaurant.name}</div>
        {restaurant.tagline && (
          <div style={{ fontSize:12, color:'var(--color-ink-70)', marginTop:3, lineHeight:1.35, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{restaurant.tagline}</div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
          {cat?.name && <span style={{ background:`${cat.color || '#E8453C'}20`, color:cat.color || '#E8453C', fontWeight:800, fontSize:10, padding:'3px 7px', borderRadius:999, letterSpacing:'0.02em', textTransform:'uppercase' }}>{cat.emoji} {cat.name}</span>}
          {priceStr && <span style={{ fontSize:11, fontWeight:700, color:'var(--color-ink-70)' }}>{priceStr}</span>}
        </div>
        {restaurant.address && (
          <div style={{ fontSize:12, color:'var(--color-ink-70)', marginTop:'auto', paddingTop:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
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
          className="hfv4-suggest-cta press"
          style={{ width: '100%', padding: '12px 16px', background: 'var(--color-cta)', color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em', position: 'relative', zIndex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 14px rgba(232,69,60,.35)' }}
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
  // Nove e non otto: su desktop la griglia è a tre colonne e con otto card
  // l'ultima riga restava orfana, due card su tre.
  const recent = useMemo(
    () => [...(restaurants || [])]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 9),
    [restaurants]
  )

  // La selezione della vetrina: un drop in evidenza (il più vicino a
  // scadere, quello che ha davvero fretta) e gli altri sconti attivi nella
  // riga sotto. È l'unica pagina che seleziona — vedi HomeDrop.
  const activeDeals = useMemo(() => sortByExpiry(filterActive(discounts)), [discounts])
  const featuredDrop = useMemo(
    () => filterActiveDrops(activeDeals)[0] || activeDeals[0] || null,
    [activeDeals]
  )
  // Tutti gli altri, non i primi otto: su desktop è una lista verticale che
  // fa da spalla a "Ultimi aggiunti", e tagliarla lasciava la mezza pagina
  // destra vuota per 300px. Su mobile è una riga che scorre, quindi la coda
  // non costa altezza.
  const otherDeals = useMemo(
    () => activeDeals.filter((d) => d.id !== featuredDrop?.id),
    [activeDeals, featuredDrop]
  )

  const onCardClick = (r) => navigate(`/restaurant/${r.slug}`)

  // Il drop in home porta alla scheda del locale: da lì si sblocca, con la
  // scheda sotto agli occhi. Mandare direttamente a /sconti farebbe perdere
  // il locale, che è il motivo per cui uno clicca.
  const goToDeal = (deal) => {
    const r = deal?.restaurant || deal?.restaurants
    if (r?.slug) navigate(`/restaurant/${r.slug}`)
    else navigate('/sconti')
  }

  // Quanti locali risultano aperti nella fascia corrente: il numero che il
  // blocco momento dichiara ("9 locali aperti adesso"). Conta gli stessi
  // locali che la riga sotto mostra, altrimenti il numero mente.
  const openNowCount = useMemo(() => {
    if (!Array.isArray(restaurants)) return 0
    return restaurants.filter(
      (r) => r.is_published !== false && isOpenForMoment(r.hours_cache, activeMoment, undefined, r.moments).match
    ).length
  }, [restaurants, activeMoment])

  const topRestaurants = useMemo(
    () => (restaurants || [])
      .filter(r => r.slug || r.name)
      .slice(0, 20)
      .map(r => ({
        name: r.name,
        url: `https://chiamamibi.com/restaurant/${r.slug || ''}`,
      })),
    [restaurants]
  )

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
      <MetaTags
        title="Dove mangiare a Torino — I migliori ristoranti consigliati da ChiamamiBi"
        description="La guida personale di Bi ai migliori ristoranti, bar e locali di Torino. Mappa interattiva, recensioni curate, sconti esclusivi e i drop del giorno."
        url="https://chiamamibi.com/"
        canonical="https://chiamamibi.com/"
        type="website"
      />
      {topRestaurants.length > 0 && (
        <JsonLd
          type="itemList"
          items={topRestaurants}
        />
      )}
      <h1
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Dove mangiare a Torino — Guida ai migliori ristoranti consigliati da Bi
      </h1>
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
        .hfv4-moment-tabs-scroll::-webkit-scrollbar,
        .hfv4-cats-row::-webkit-scrollbar,
        .hfv4-cards-row::-webkit-scrollbar { display: none; }

        /* ── BLOCCO 2/3 — banda momento + aperti ora + drop ───────────── */
        /* Su mobile è una colonna (momento, riga aperti, drop); su desktop
           diventa una banda a due colonne — vedi il blocco ≥1024px. */
        .hfv4-band { display: block; }

        /* Il momento: scuro, con un alone corallo che scalda l'angolo in
           alto a destra senza illuminare il testo.

           È una CARD con i suoi margini, non una fascia a tutta larghezza:
           nel mockup (.moment) sta dentro la pagina crema come il drop, e
           i due blocchi pieni si leggono come due card sorelle. A tutta
           larghezza sembrava invece un'intestazione di sistema. */
        .hfv4-moment {
          /* Stessa scala del drop (vedi --dc-k in DropCard.css): il mockup
             disegna il telefono a 314px, non a 390, quindi i suoi numeri
             vanno moltiplicati per 390/314 = 1.24 per pesare sullo schermo
             vero come pesano nel disegno. */
          --mk: 1.24px;
          background: var(--color-ink, #22181c);
          color: #fff;
          border-radius: calc(17 * var(--mk));
          /* Compatto per obbligo, non per gusto: su 390x844 il momento e la
             riga dei locali aperti decidono se il bottone "Sblocca sconto"
             del drop finisce sopra o sotto la piega. Misurato: con 16px di
             padding e l'orologio a 38 la CTA cadeva 53px sotto. */
          padding: calc(13 * var(--mk)) calc(15 * var(--mk));
          position: relative;
          overflow: hidden;
        }
        .hfv4-moment::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 85% 15%, rgba(232,69,60,.35), transparent 60%);
        }
        .hfv4-moment > * { position: relative; }

        /* Testo mint, non una pill: il tag è una riga di contesto, e dentro
           una pill diventa un bottone che non si può premere. */
        .hfv4-moment-tag {
          margin: 0;
          font-size: calc(8.5 * var(--mk));
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: #aef3c2;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .hfv4-moment-tag i {
          width: calc(5 * var(--mk)); height: calc(5 * var(--mk)); border-radius: 50%;
          background: #aef3c2;
          animation: dropcard-blink 1.5s infinite;
        }
        .hfv4-moment-clock {
          display: block;
          font-family: var(--font-sans);
          font-size: calc(31 * var(--mk));
          font-weight: 800;
          letter-spacing: calc(-1.5 * var(--mk));
          line-height: 1;
          margin-top: calc(4 * var(--mk));
          font-variant-numeric: tabular-nums;
        }
        .hfv4-moment-q {
          font-family: var(--font-sans);
          font-weight: 700;
          font-size: calc(14 * var(--mk));
          line-height: 1.25;
          margin: calc(5 * var(--mk)) 0 0;
          max-width: 26ch;
        }
        .hfv4-moment-sub {
          margin: calc(3 * var(--mk)) 0 0;
          font-size: calc(9.5 * var(--mk));
          line-height: 1.35;
          opacity: .75;
        }

        /* Le chip fascia stanno dentro il blocco scuro: sono il filtro del
           momento, non una barra a sé. */
        .hfv4-band-moment { padding: 8px 12px 0; }
        /* Le chip sono dentro la card scura, quindi la loro riga non ha
           padding proprio: lo dà il padding della card. */
        .hfv4-moment .hfv4-moment-tabs-scroll { padding: calc(8 * var(--mk)) 0 0 !important; overflow-x: auto; }
        /* Dentro il blocco scuro le chip sono pillole in riga, non i
           quadrotti con l'emoji sopra della barra chiara: nel mockup
           (.moment .chips span) sono alte ~26px e stanno tutte e cinque
           sulla larghezza dello schermo. Lo stesso override va su entrambi
           i livelli (fila spenta + overlay ritagliato), altrimenti le due
           file non misurano identiche e il clip-path taglia storto. */
        .hfv4-moment .hfv4-moment-tab {
          flex-direction: row !important;
          align-items: center !important;
          min-width: 0 !important;
          gap: calc(5 * var(--mk)) !important;
          padding: calc(5 * var(--mk)) calc(11 * var(--mk)) !important;
          border-radius: 99px !important;
        }
        .hfv4-moment .hfv4-moment-tab > span:first-child { font-size: calc(11 * var(--mk)) !important; }
        .hfv4-moment .hfv4-moment-tab > span:last-child { font-size: calc(9.5 * var(--mk)) !important; font-weight: 600 !important; }

        /* Le chip nascono per fondo chiaro: testo ink su ink-05, e la fascia
           attiva ink pieno su bianco. Sul blocco scuro sparivano tutte e
           cinque. Qui la tavolozza si inverte tenendo lo stesso meccanismo
           delle due file sovrapposte ritagliate (vedi MomentTabs): !important
           perché i colori là sono stili inline. */
        .hfv4-band-moment .hfv4-moment-tab {
          background: rgba(255,255,255,.10) !important;
          color: #fff !important;
        }
        .hfv4-band-moment .hfv4-moment-tab span { color: rgba(255,255,255,.72) !important; }
        .hfv4-band-moment .mt-overlay .hfv4-moment-tab {
          background: #fff !important;
          box-shadow: 0 6px 16px rgba(0,0,0,.35) !important;
        }
        .hfv4-band-moment .mt-overlay .hfv4-moment-tab,
        .hfv4-band-moment .mt-overlay .hfv4-moment-tab span {
          color: var(--color-ink) !important;
        }

        /* La riga "aperti adesso": mini-card orizzontali, una riga sola.
           Con le card intere (foto 16/11 + tagline + meta) la riga era alta
           quasi 300px e da sola spingeva il drop sotto la piega su 390px. */
        .hfv4-band-open { padding-top: 4px; }
        .hfv4-band-open .hfv4-results { padding-top: 0 !important; }
        /* Stessa ragione del momento qui sopra: ogni riga tolta qui è una
           riga di drop guadagnata sopra la piega. */
        .hfv4-band-open .hfv4-results-head { padding: 0 20px 6px !important; }
        .hfv4-band-open .hfv4-results-row { padding-bottom: 6px !important; }

        /* Le mini-card dei locali aperti: VERTICALI come .mcard nel
           mockup — foto sopra con la pill "aperto", nome e meta sotto.
           Le avevo fatte orizzontali (foto a sinistra): ci stavano più
           strette, ma non è quello che il progetto dice. */
        .hfv4-lcard--compact {
          /* Stessa scala del momento e del drop: i numeri sono quelli di
             .mcard nel mockup, il calc li porta dai 314px del telefono
             disegnato ai 390 di quello vero. */
          --mk: 1.24px;
          display: flex;
          flex-direction: column;
          width: calc(112 * var(--mk));
          flex: 0 0 calc(112 * var(--mk));
          scroll-snap-align: start;
          background: #fff;
          border: 1px solid var(--color-line, rgba(34,24,28,.10));
          border-radius: 13px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
        }
        .hfv4-lcard--compact .hfv4-lcard-photo {
          position: relative;
          height: calc(56 * var(--mk));
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .hfv4-lcard--compact .hfv4-lcard-photo img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .hfv4-lcard--compact .hfv4-lcard-emoji { font-size: calc(22 * var(--mk)); opacity: .55; }
        .hfv4-lcard--compact .hfv4-lcard-open {
          position: absolute;
          left: calc(5 * var(--mk)); top: calc(5 * var(--mk));
          z-index: 2;
          background: rgba(255,255,255,.94);
          color: #3f9d63;
          font-size: calc(7 * var(--mk));
          font-weight: 800;
          border-radius: 99px;
          padding: calc(2 * var(--mk)) calc(6 * var(--mk));
          max-width: calc(100% - 10px);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hfv4-lcard--compact .hfv4-lcard-body { padding: calc(7 * var(--mk)) calc(8 * var(--mk)); min-width: 0; }
        .hfv4-lcard--compact .hfv4-lcard-name {
          display: block;
          font-size: calc(10 * var(--mk));
          font-weight: 700;
          line-height: 1.2;
          color: var(--color-ink);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hfv4-lcard--compact .hfv4-lcard-sub {
          display: block;
          font-size: calc(8 * var(--mk));
          color: rgba(34,24,28,.55);
          margin-top: 1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* La card "+N" nella riga compatta: senza questo il suo minHeight di
           220px stira tutte le mini-card all'altezza sua. */
        .hfv4-results-more--compact {
          min-height: 0 !important;
          flex: 0 0 112px !important;
          border-radius: 13px !important;
          padding: 10px 8px !important;
          gap: 4px !important;
        }
        .hfv4-results-more--compact > span:first-child {
          width: 24px !important; height: 24px !important;
          font-size: 14px !important;
          box-shadow: none !important;
        }
        .hfv4-results-more--compact > span:nth-child(2) { font-size: 10px !important; }
        .hfv4-results-more--compact > span:nth-child(3) { font-size: 8px !important; }

        /* ── Il drop e gli altri sconti ────────────────────────────────── */

        /* Il drop ha i margini della card (8px 12px nel mockup): senza,
           tocca i bordi dello schermo e smette di leggersi come card. */
        .hfv4-drop-wrap { padding: 8px 12px 0; }

        .hfv4-drop-others { margin-top: 16px; }
        .hfv4-drop-others-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }
        .hfv4-drop-others-head strong {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: var(--color-ink);
        }
        .hfv4-drop-others-all {
          font-size: 9px;
          font-weight: 700;
          color: var(--color-corallo);
          text-decoration: none;
          white-space: nowrap;
        }
        .hfv4-drop-others-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 4px;
        }
        .hfv4-drop-others-row::-webkit-scrollbar { display: none; }

        /* Il gancio alla registrazione (Blocco 5): dice il beneficio e il
           costo — gratis, venti secondi — invece di "Registrati per
           continuare", che non promette niente. */
        .hfv4-drop-others-hook {
          display: block;
          margin-top: 12px;
          padding: 9px 10px;
          border-radius: 10px;
          background: var(--color-cream, #f5f0e4);
          font-size: 9px;
          font-weight: 700;
          color: var(--color-oro-deep, #8e6b3e);
          text-decoration: none;
          text-align: center;
        }

        /* Mobile: nessuna griglia, esce nell'ordine del DOM. */
        .hfv4-lower { display: block; }
        .hfv4-lower-deals { padding: 0 12px 4px; }

        .hfv4-cats-wrap { position: relative; }        .hfv4-cats-wrap { position: relative; }
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
          /* C2 — Variante B: foto piena in alto, poi il corpo. La gerarchia
             diventa foto → nome → vantaggio, con la % come badge sulla foto. */
          .hfv4-hero-card {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 0 !important;
            padding: 0 !important;
            align-items: stretch !important;
          }
          .hfv4-hero-photo {
            order: 0 !important;
            width: 100% !important;
            height: 140px !important;
            min-height: 0 !important;
            align-self: stretch !important;
            border-radius: 0 !important;
          }
          .hfv4-mob-badge { display: inline-flex !important; }
          .hfv4-hero-body { padding: 12px 15px 15px !important; min-width: 0 !important; }
          /* la percentuale ora è il badge sulla foto */
          .hfv4-mob-pct { display: none !important; }
          /* il vantaggio ("Gelato a 2€") va letto in mezzo secondo:
             Poppins bold bianco, niente corsivo, niente Caveat. */
          .hfv4-hero-sub {
            font-weight: 700 !important;
            font-size: 13px !important;
            color: #fff !important;
            margin-bottom: 10px !important;
          }
          .hfv4-hero-chip {
            position: static !important;
            margin-bottom: 8px !important;
            background: rgba(255,255,255,.18) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
          }
          .hfv4-hero-title { display: none !important; }
          .hfv4-mob-pct { display: block !important; font-size: 30px !important; margin-bottom: 2px !important; }
          .hfv4-mob-loc { display: block !important; font-size: 19px !important; margin-bottom: 4px !important; }
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

        /* Resta solo la chat: il momento e i suoi risultati sono saliti nella
           banda in cima (Blocco 2/3), e la colonna "a" non esiste più. */
        .hfv4-main { display: block; }

        /* La barra con logo e "Chiedi a Bi" è quella mobile: la navbar vera
           (DesktopNavbar) compare da 768px in su con md:block, e finché
           questa spariva solo a 1024 su un iPad in verticale si vedevano
           due intestazioni sovrapposte. */
        @media (min-width: 768px) {
          .hfv4-topbar { display: none !important; }
        }

        @media (min-width: 1024px) {
          .hfv4-root { min-height: calc(100dvh - 80px) !important; }
          /* Gli ultimi due blocchi stavano su una griglia tutta loro: 730 e
             760px centrati in mezzo a una pagina larga 1240, con il resto
             della home allineato al bordo. Sembravano di un'altra pagina.
             width:100% serve perché .hfv4-root è una colonna flex e
             centra i figli sulla loro larghezza di contenuto: senza, il
             max-width non ha niente da limitare. */
          .hfv4-main {
            width: 100%;
            max-width: 1240px;
            margin: 0 auto;
            padding: 8px 40px 40px;
          }
          .hfv4-zone-b { display: flex; flex-direction: column; gap: 20px; }
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
            width: 100%;
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

          /* ── BLOCCO 3 — la piega desktop, impilata ────────────────────
             Prima erano due blocchi saturi affiancati: il momento scuro
             (675×424) e il drop corallo (465×415), 1240×428 di colore pieno
             tutto insieme. Su mobile funziona perché li vedi in sequenza; su
             desktop li vedi nello stesso istante e si annullano — nessuno dei
             due diventa il fuoco. E i locali aperti, annidati dentro il
             blocco scuro, lo trasformavano in un contenitore affollato
             invece che in un'affermazione.

             Ora un fuoco alla volta, dall'alto: il momento apre leggero (è
             un contesto, non un contenuto), i locali aperti danno subito
             qualcosa di utile, il drop arriva dopo e ha lo spazio per essere
             forte. */
          .hfv4-band {
            display: flex;
            flex-direction: column;
            gap: 22px;
            max-width: 1240px;
            margin: 0 auto 28px;
            padding: 4px 40px 0;
          }
          /* I due figli di .hfv4-band-left salgono nel flusso della banda:
             il raggruppamento serve solo a mobile, dove momento e locali
             aperti stanno nello stesso blocco scuro. */
          .hfv4-band-left { display: contents; }

          /* 1. La striscia del momento: alta ~160px, tutto su una riga.
                Orologio e tag a sinistra, domanda al centro, chip a destra.
                Niente card dentro. */
          .hfv4-band-moment { padding: 0 !important; }
          .hfv4-moment {
            --mk: 1px;
            display: grid;
            grid-template-columns: auto minmax(190px, 1fr) auto;
            grid-template-areas:
              "tag   q    chips"
              "clock sub  chips";
            column-gap: 34px;
            row-gap: 2px;
            align-items: start;
            padding: 26px 32px;
            border-radius: 26px;
          }
          .hfv4-moment::before {
            background: radial-gradient(60% 130% at 92% 10%, rgba(232,69,60,.38), transparent 62%);
          }
          .hfv4-moment-tag { grid-area: tag; align-self: end; font-size: 10.5px; }
          .hfv4-moment-tag i { width: 6px; height: 6px; }
          .hfv4-moment-clock { grid-area: clock; font-size: 56px; margin-top: 4px; }
          .hfv4-moment-q {
            grid-area: q;
            align-self: end;
            font-size: 25px;
            max-width: 22ch;
            margin: 0;
          }
          .hfv4-moment-sub { grid-area: sub; font-size: 13.5px; margin-top: 6px; }
          .hfv4-band-moment .hfv4-moment-tabs-scroll {
            grid-area: chips;
            align-self: center;
            padding: 0 !important;
            overflow: visible !important;
            /* Larga abbastanza da tenere le cinque fasce su una riga sola:
               a 470px "Dopo cena" andava a capo da sola. */
            max-width: 620px;
          }
          .hfv4-band-moment .mt-row { flex-wrap: wrap !important; justify-content: flex-end; }
          .hfv4-moment .hfv4-moment-tab { padding: 9px 14px !important; }
          .hfv4-moment .hfv4-moment-tab > span:first-child { font-size: 14px !important; }
          .hfv4-moment .hfv4-moment-tab > span:last-child { font-size: 12px !important; }
        }

        /* Fra 1024 e 1279 la striscia è larga ~944px: orologio, domanda e
           cinque chip non ci stanno alle misure piene e le chip andavano a
           capo, portando la striscia a 177px. Qui tutto rientra su una riga
           sola restando leggibile. */
        @media (min-width: 1024px) and (max-width: 1279px) {
          /* Le chip scendono su una riga propria, allineate a destra: a
             questa larghezza, tenute di fianco, o andavano a capo loro o
             mandavano a capo la domanda. Sotto ci stanno tutte e cinque e
             la striscia resta dentro i 170px. */
          .hfv4-moment {
            grid-template-columns: auto minmax(0, 1fr);
            grid-template-areas:
              "tag   q"
              "clock sub"
              "chips chips";
            column-gap: 24px;
            padding: 20px 26px;
          }
          .hfv4-moment-clock { font-size: 44px; }
          .hfv4-moment-q { font-size: 21px; max-width: none; }
          .hfv4-moment-sub { font-size: 12.5px; }
          .hfv4-band-moment .hfv4-moment-tabs-scroll {
            max-width: none;
            justify-self: end;
            padding-top: 14px !important;
          }
          .hfv4-moment .hfv4-moment-tab { padding: 8px 12px !important; gap: 5px !important; }
          .hfv4-moment .hfv4-moment-tab > span:first-child { font-size: 13px !important; }
          .hfv4-moment .hfv4-moment-tab > span:last-child { font-size: 11.5px !important; }
        }

        @media (min-width: 1024px) {

          /* 2. I locali aperti escono dal blocco scuro e vivono sulla pagina:
                card bianche su crema, a tutta larghezza, sei più il richiamo
                alla mappa. Dentro il blocco erano una riga da trascinare in
                un contenitore già pieno. */
          .hfv4-band-open { padding: 0; }
          .hfv4-band-open .hfv4-results { padding-top: 0 !important; }
          .hfv4-band-open .hfv4-results-head { padding: 0 0 12px !important; }
          .hfv4-band-open .hfv4-results-row {
            display: grid !important;
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
            padding: 0 !important;
            overflow: visible !important;
            gap: 14px !important;
          }
          .hfv4-band-open .hfv4-lcard--compact {
            --mk: 1px;
            width: auto !important;
            flex: 1 1 auto !important;
          }
          .hfv4-band-open .hfv4-lcard--compact .hfv4-lcard-photo { height: 96px; }
          .hfv4-band-open .hfv4-lcard--compact .hfv4-lcard-name { font-size: 13px; }
          .hfv4-band-open .hfv4-lcard--compact .hfv4-lcard-sub { font-size: 11px; }
          .hfv4-band-open .hfv4-lcard--compact .hfv4-lcard-open { font-size: 9.5px; padding: 3px 7px; }
          .hfv4-band-open .hfv4-lcard--compact .hfv4-lcard-body { padding: 10px 11px 12px; }
          .hfv4-band-open .hfv4-results-more--compact {
            flex: 1 1 auto !important;
            width: auto !important;
            padding: 14px 10px !important;
          }

          /* 3. Il drop hero prende tutta la riga: la card si sdraia da sola
                sopra i 420px di contenitore (vedi .dropcard in DropCard.css). */
          .hfv4-band-drop { display: block; }
          .hfv4-drop-wrap { padding: 0; width: 100%; }

          /* Sotto la banda: categorie a tutta larghezza, poi due colonne —
             "Ultimi aggiunti" a sinistra, la lista sconti a destra. */
          .hfv4-lower {
            display: grid;
            grid-template-columns: 1.45fr 1fr;
            grid-template-areas:
              "cats cats"
              "recent deals";
            column-gap: 20px;
            max-width: 1240px;
            margin: 0 auto;
            padding: 0 40px;
            align-items: start;
          }
          .hfv4-lower-cats { grid-area: cats; }
          .hfv4-lower-recent { grid-area: recent; }
          /* Tre colonne, non quattro: nella colonna di sinistra della griglia
             inferiore quattro card stanno a ~150px l'una e ogni nome diventa
             "La Piaz…". */
          .hfv4-lower-recent .hfv4-cards-row {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          /* La colonna destra è più corta per natura (una lista contro una
             griglia di card): ferma lasciava 310px di mezza pagina vuota
             sotto di sé. Sticky la fa accompagnare lo scorrimento finché
             la colonna sinistra non finisce. */
          .hfv4-lower-deals {
            grid-area: deals;
            padding: 0;
            position: sticky;
            top: 96px;
          }

          /* Gli altri sconti su desktop sono una LISTA verticale, non uno
             scorrimento: su schermo largo una lista si legge e si clicca
             tutta senza trascinare. */
          .hfv4-drop-others-row {
            flex-direction: column;
            overflow-x: visible;
            scroll-snap-type: none;
            gap: 0;
          }

          /* Nella colonna desktop la mini-card si stende in una RIGA di
             lista (.sideli nel mockup): miniatura quadrata, nome e meta
             accanto, freccia a destra, righe separate da un tratteggio.
             Stessa card, stesso markup: cambia solo la disposizione.
             Impilare le card verticali riempiva mezza colonna con tre foto
             e basta. */
          .hfv4-drop-others-row > .dropcard--mini {
            --dc-k: 1px;
            width: 100%;
            flex-direction: row;
            align-items: center;
            gap: 10px;
            background: none;
            border: 0;
            border-bottom: 1px dashed var(--color-line, rgba(34,24,28,.10));
            border-radius: 0;
            box-shadow: none;
            /* Il francobollo sconto sporge di 4px a sinistra della
               miniatura: senza questo margine finisce tagliato dal bordo
               della colonna. */
            padding: 9px 0 9px 5px;
          }
          .hfv4-drop-others-row > .dropcard--mini:last-child { border-bottom: 0; }
          .hfv4-drop-others-row > .dropcard--mini .dropcard__photo {
            width: 44px;
            height: 44px;
            flex: none;
            border-radius: 9px;
            font-size: 18px;
          }
          .hfv4-drop-others-row > .dropcard--mini .dropcard__photo img { border-radius: 9px; }
          .hfv4-drop-others-row > .dropcard--mini .dropcard__badge {
            left: -4px;
            bottom: -4px;
            font-size: 9.5px;
            border-radius: 6px;
            padding: 1px 5px;
            border-width: 1.5px;
          }
          /* Nome e "dove" restano incolonnati a sinistra, lo stato si
             sposta a destra sulla stessa riga: in una lista lo stato in
             terza riga raddoppiava l'altezza di ogni voce. */
          .hfv4-drop-others-row > .dropcard--mini .dropcard__body {
            padding: 0;
            min-width: 0;
            flex: 1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas: "name status" "where status";
            align-items: center;
            column-gap: 10px;
          }
          .hfv4-drop-others-row > .dropcard--mini .dropcard__name {
            grid-area: name;
            font-size: 13.5px;
          }
          .hfv4-drop-others-row > .dropcard--mini .dropcard__where {
            grid-area: where;
            font-size: 11px;
            margin-top: 2px;
          }
          .hfv4-drop-others-row > .dropcard--mini .dropcard__status {
            grid-area: status;
            margin: 0;
            font-size: 11px;
          }
          /* La freccina di fine riga: è la lista a dire "si clicca", non
             un bottone. */
          .hfv4-drop-others-row > .dropcard--mini::after {
            content: "›";
            flex: none;
            font-size: 15px;
            line-height: 1;
            opacity: .35;
          }

          /* === SuggestCard full-width e grande === */
          .hfv4-suggest-outer {
            width: 100%;
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
          /* Il bottone non si stira per 1160px: resta largo quanto serve a
             premerlo, come tutti gli altri della pagina. */
          .hfv4-suggest-cta {
            padding: 16px 28px !important;
            font-size: 14px !important;
            width: fit-content !important;
            min-width: 260px;
          }

        }
      `}</style>

      <TopBar />

      {/* BLOCCO 2 — la sequenza della home, dall'alto:
            momento → locali aperti adesso → drop → altri sconti
            → categorie → ultimi aggiunti

          Prima il drop apriva la pagina e il momento stava a metà schermata.
          Chi apre l'app di sera però cerca un posto, non uno sconto: il
          momento risponde alla domanda vera, e il drop subito dopo arriva a
          persona già dentro invece di sembrare pubblicità in apertura.

          Il ritmo è scuro (momento) → bianco (aperti ora) → corallo (drop)
          → bianco: i due blocchi a colore pieno si prendono l'occhio da soli.
          Per questo il momento deve restare compatto — se cresce, il drop
          finisce sotto la piega su uno schermo da 390px. */}
      <div className="hfv4-band">
        <div className="hfv4-band-left">
          {/* La card scura è qui e non dentro TimeContextHero perché deve
              contenere anche le chip: nel mockup stanno dentro il blocco. */}
          <div className="hfv4-band-moment">
            <div className="hfv4-moment">
              <TimeContextHero activeMomentKey={activeMoment} openCount={openNowCount} />
              <MomentTabs activeKey={activeMoment} onChange={setActiveMoment} />
            </div>
          </div>

          <div className="hfv4-band-open">
          {loading ? (
            <div style={{ padding: '0 20px', color: 'var(--color-ink-70)' }}>Caricamento…</div>
          ) : (
            <MomentResultsGrid
              restaurants={restaurants}
              activeMoment={activeMoment}
              onCardClick={onCardClick}
              isSaved={isSaved}
              toggleSave={toggleSave}
              compact
            />
          )}
          </div>
        </div>

        <div className="hfv4-band-drop">
          <HomeDrop featured={featuredDrop} onUnlock={goToDeal} onDiscover={goToDeal} />
        </div>
      </div>

      {/* Un solo contenitore per altri-sconti, categorie e "Ultimi aggiunti":
          sono gli stessi tre nodi in entrambi i layout, e a spostarli è la
          griglia. Su mobile escono nell'ordine del DOM (altri sconti sotto il
          drop, poi categorie, poi ultimi aggiunti); su desktop le aree
          mettono le categorie in cima a tutta larghezza e sotto due colonne,
          ultimi aggiunti a sinistra e la lista sconti a destra. */}
      <div className="hfv4-lower">
        <div className="hfv4-lower-deals">
          <DropOthers others={otherDeals} onOpen={goToDeal} />
        </div>

        <div className="hfv4-lower-cats">
          <CategoryBubbles
            onSelect={(c) => navigate('/esplora', { state: { initialCategory: c.label } })}
            onAltro={() => navigate('/esplora')}
          />
        </div>

      {/* Da qui in giù le sezioni entrano quando arrivano a schermo.
          Non è decorazione: il feed carica in modo asincrono e questi
          blocchi comparivano di colpo, spostando quello che c'era sotto.
          `once` è true — si vedono scendendo, non ogni volta che si
          risale, altrimenti diventano rumore.

          ECCEZIONE: "Ultimi aggiunti" non è dentro <Reveal>. È la prima
          sezione sotto la hero, quindi praticamente sempre già in vista
          al mount — whileInView scattava nello stesso istante in cui
          ogni sua card animava già per conto proprio (CSS, sotto), due
          orchestrazioni sullo stesso pezzo di schermo. Le card bastano
          da sole. */}
      <section className="hfv4-section hfv4-lower-recent" style={{ padding: '8px 0 4px' }}>
        <SectionHead
          kicker="Nuovi in guida"
          title="Ultimi aggiunti"
          subtitle="Gli ultimi posti che ho provato e inserito in guida."
          trailing={
            <Link to="/list" className="hfv4-sec-head-all press" style={{ width:32, height:32, borderRadius:'50%', background:'var(--color-ink-05)', display:'grid', placeItems:'center', fontSize:14, fontWeight:700, color:'var(--color-ink)', textDecoration:'none' }}>→</Link>
          }
        />
        {loading ? (
          <div style={{ padding: '0 20px', color: 'var(--color-ink-70)' }}>Caricamento...</div>
        ) : (
          <div className="hfv4-cards-row" style={{ display:'flex', gap:12, overflowX:'auto', padding:'0 20px 12px 20px', scrollSnapType:'x mandatory', scrollPaddingLeft:20, WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
            {recent.map((r, i) => (
              <Rcard key={r.id} restaurant={r} index={i} discount={discountByRestaurant[r.id]} onClick={onCardClick} saved={isSaved(r.id)} onToggleSave={() => toggleSave(r.id)} />
            ))}
          </div>
        )}
      </section>
      </div>

      {/* Banner sponsor: full-width su desktop, fuori dalla griglia 2-col */}
      <Reveal className="hfv4-spon-outer" fade={1} y={10}>
        <AdSlot slot="home_hero" />
      </Reveal>

      {/* La chat resta sotto: il momento e i suoi risultati sono saliti in
          cima, quindi qui rimane solo "oppure chiedimelo a voce". */}
      <div className="hfv4-main">
        <div className="hfv4-zone-b">
          <AskBiChat currentMoment={activeMoment} />
        </div>
      </div>

      {/* SuggestCard full-width sotto la griglia */}
      <Reveal className="hfv4-suggest-outer" fade={1} y={10}>
        <SuggestCard />
      </Reveal>

      <div style={{ marginTop: 'auto' }}>
        <Footer />
      </div>
    </div>
  )
}
