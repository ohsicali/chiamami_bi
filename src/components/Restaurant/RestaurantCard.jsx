import { motion } from 'framer-motion'
import { DUR, EASE_OUT, SPRING_SNAP, staggerDelay } from '../../lib/motion'
import { memo, useEffect, useRef, useState } from 'react'
import SaveButton from './SaveButton'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getPublicCategoryNames } from '../../lib/hooks/useCategories'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { proxyImg, proxyImgSrcSet } from '../../lib/supabase'
import SmartImage from '../UI/SmartImage'
import { CityBadge } from '../UI/CityBadge'
import { formatAddress } from '../../lib/utils/formatAddress'
import { formatPrice } from '../../lib/utils/price'

// Entrata della card. Era 500ms con stagger fino a 300ms: l'ultima card
// di una riga arrivava 800ms dopo la prima, quando l'utente aveva già
// iniziato a scorrere. Ora 280ms con lo stagger che si ferma a 240ms —
// abbastanza da leggere l'ordine, non abbastanza da aspettare.
const cardVariants = {
  hidden: { opacity: 0, transform: 'translateY(14px)' },
  visible: (i) => ({
    opacity: 1,
    transform: 'translateY(0px)',
    transition: {
      delay: staggerDelay(i),
      duration: DUR.reveal,
      ease: EASE_OUT,
    },
  }),
}


/**
 * La riga in fondo a una card `tile` (nei Salvati: le liste del locale).
 *
 * Sta fuori dalla zona che apre la scheda, e in più ferma il `pointerdown`
 * prima che arrivi alla card: il `whileTap` di Framer Motion è sulla card
 * intera, e senza questo premere la riga la faceva rimpicciolire come se si
 * stesse aprendo il ristorante. Il listener è nativo perché Framer ascolta
 * direttamente sull'elemento, prima che React veda l'evento.
 */
function TileFooter({ dense, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (e) => e.stopPropagation()
    el.addEventListener('pointerdown', stop)
    return () => el.removeEventListener('pointerdown', stop)
  }, [])
  return (
    <div ref={ref} style={{ padding: dense ? '0 11px' : '0 15px' }}>
      {children}
    </div>
  )
}

function RestaurantCard({
  restaurant,
  index = 0,
  userPosition,
  onClick,
  saved,
  onSaveToggle,
  hasDiscount,
  discountTitle,
  activeCity = 'Torino',
  variant = 'default', // 'default' (row) | 'tile' | 'hero'
  dense = false, // tile: versione compatta per griglie strette (mobile 2 col)
  // Riga in fondo alla card, decisa da chi la usa. Serve ai Salvati, che ci
  // mettono le liste in cui sta il locale: la card non sa cosa sia una lista
  // e non deve saperlo, riceve del contenuto e gli lascia il posto.
  footer = null,
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const categories = getPublicCategoryNames(restaurant)
    .map(name => getCategoryInfo(name))
    .filter(Boolean)
  const category = categories[0]

  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0]
    : null
  const photoRaw = firstPhoto
    ? typeof firstPhoto === 'string'
      ? firstPhoto
      : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null
  // Hero spans the viewport width (~360-400px mobile, ~700px desktop);
  // default card photo is 100×100 mobile / 72×72 desktop. Use proper widths
  // so the browser doesn't pull a 1200w image into a 72px slot. For the
  // tiny default slot a single 300w variant covers DPR 3 — no srcset.
  const isHero = variant === 'hero'
  // tile = foto 4:3 a piena larghezza colonna (~280-360px) → 600w copre DPR 2.
  const photoWidth = isHero ? 900 : variant === 'tile' ? 600 : 300
  const photoUrl = proxyImg(photoRaw, { w: photoWidth })
  const photoSrcSet = isHero ? proxyImgSrcSet(photoRaw, [600, 900, 1400]) : undefined
  const photoSizes = isHero ? '(max-width: 768px) 100vw, 720px' : undefined
  // First few cards (index < 3) are above the fold in most lists — load eagerly.
  const isAboveFold = index < 3
  // Mostra la foto solo se l'URL esiste e non ha dato errore (404 → fallback).
  const showPhoto = photoUrl && !imgError

  const distance =
    userPosition && restaurant.latitude && restaurant.longitude
      ? getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude)
      : null

  const priceStr = formatPrice(restaurant.price_range)
  // Il distintivo della città compare solo fuori dalla città attiva: la
  // stessa regola sta dentro CityBadge, qui serve a sapere in anticipo se la
  // riga del "dove" ha qualcosa da mostrare quando l'indirizzo manca.
  const showCity = !!restaurant.city
    && restaurant.city.trim().toLowerCase() !== String(activeCity || '').trim().toLowerCase()

  // TILE VARIANT — foto 4:3 in alto, corpo sotto.
  // Unifica le card verticali che ogni pagina si era riscritta (Salvati,
  // vicini, griglie risultati): una sola proporzione foto, un solo raggio,
  // skeleton + fallback emoji da SmartImage.
  if (variant === 'tile') {
    return (
      <motion.div
        className="w-full text-left relative"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-ink-05)',
          borderRadius: dense ? 'var(--radius-md)' : 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
        }}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        custom={index}
        whileTap={{ transform: 'scale(0.98)' }}
        transition={SPRING_SNAP}
      >
        {/* La zona che apre la scheda: foto e testo, NON la riga in fondo.
            Prima il bottone-lenzuolo copriva tutta la card e la riga ci
            stava sopra con uno z-index più alto: col mouse e in Chromium
            bastava, ma Safari su iPhone "aggiusta" il tocco verso l'elemento
            cliccabile che gli sembra più probabile, e fra una riga alta 28px
            e un bottone grande quanto la card sceglieva spesso il secondo:
            "Metti in una lista" apriva il ristorante, o non faceva niente.
            Con la riga fuori da questa zona, sotto di lei non c'è
            nient'altro da toccare. */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Il bottone che apre la scheda copre la zona senza contenerla: il
            cuore è un secondo bottone, e un <button> dentro un altro è HTML
            non valido (in lettura vocale diventa un comando solo). */}
        <button
          type="button"
          className="rcard-hit"
          aria-label={`Apri la scheda di ${restaurant.name}`}
          onClick={() => onClick?.(restaurant)}
          style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        />
        <SmartImage
          src={photoUrl}
          alt={restaurant.name}
          emoji={category?.emoji || '🍽️'}
          gradient={category?.color
            ? `linear-gradient(135deg, ${category.color}44, ${category.color}18)`
            : undefined}
          eager={isAboveFold}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          fallbackFontSize="2.6em"
          style={{ width: '100%', aspectRatio: '4 / 3' }}
        >
          {/* Il francobollo verde dello sconto, nello stesso posto in cui sta
              in tutto il resto del sito: angolo alto a sinistra della foto,
              gradiente verde e inchiostro scuro. Prima, sulle card dei
              Salvati, era una pillola rossa infilata di fianco al nome: si
              leggeva come un avviso invece che come un vantaggio, e rubava
              spazio al nome del locale, che finiva troncato a metà. */}
          {hasDiscount && discountTitle && (
            <span
              className="absolute"
              style={{
                top: 8, left: 8, zIndex: 3,
                maxWidth: 'calc(100% - 58px)',
                background: 'var(--gradient-sconto)', color: 'var(--color-sconto-ink)',
                fontSize: 'var(--fs-xs)', fontWeight: 800, letterSpacing: '0.02em',
                padding: '4px 9px', borderRadius: 'var(--radius-pill)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                boxShadow: '0 1px 4px rgba(34,24,28,.18)',
              }}
            >
              {discountTitle}
            </span>
          )}
          {onSaveToggle && (
            <div
              className="absolute"
              style={{ top: 8, right: 8, zIndex: 3 }}
              onClick={(e) => { e.stopPropagation(); onSaveToggle() }}
            >
              <SaveButton saved={saved} onClick={onSaveToggle} size="sm" />
            </div>
          )}
        </SmartImage>

        {/* Le stesse informazioni, nello stesso ordine, delle card di
            "Ultimi aggiunti" in home: nome, tagline, categoria + prezzo,
            indirizzo. Erano due card diverse per lo stesso locale — in home
            si leggeva cosa fosse il posto, nei Salvati restava un nome e una
            pillola.

            Nome e tagline si prendono due righe ciascuno SEMPRE, anche quando
            ne riempiono una sola o nessuna: in una riga di griglia le card
            prendono l'altezza della più alta, e basta un nome lungo perché
            tutte le altre si ritrovino spazio da riempire. Riservandolo, le
            card vengono alte uguali per costruzione e gli indirizzi si
            allineano da soli. */}
        <div style={{
          padding: dense ? '10px 11px 11px' : '13px 15px 15px',
          display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          <h3 style={{
            fontFamily: 'var(--font-sans)', fontWeight: 800,
            fontSize: dense ? 'var(--fs-sm)' : 'var(--fs-base)', letterSpacing: '-0.01em',
            color: 'var(--color-ink)', lineHeight: 1.2, minWidth: 0,
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1,
            overflow: 'hidden', minHeight: '1.2em',
          }}>
            {restaurant.name}
          </h3>

          {/* Renderizzata anche vuota: è lo spazio riservato che tiene in riga
              le card dei locali senza tagline. Una sola riga anche su
              desktop: due righe fisse lasciavano un vuoto sotto ogni nome o
              tagline corta, ed erano la maggioranza dei casi. */}
          <div style={{
            fontSize: dense ? 11.5 : 12, color: 'var(--color-ink-70)',
            marginTop: 2, lineHeight: 1.35,
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1,
            overflow: 'hidden', minHeight: '1.35em',
          }}>
            {restaurant.tagline || ''}
          </div>

          {/* Categoria e prezzo come in home: la pillola prende il colore
              della categoria, non un corallo uguale per tutte. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
            flexWrap: 'nowrap', overflow: 'hidden', minWidth: 0,
          }}>
            {category && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, minWidth: 0,
                padding: '3px 7px', borderRadius: 'var(--radius-pill)',
                background: `${category.color || '#E8453C'}20`, color: category.color || '#E8453C',
                fontSize: 10, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {category.emoji} {category.name}
              </span>
            )}
            {priceStr && (
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--color-ink-70)' }}>{priceStr}</span>
            )}
            {distance != null && (
              <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--color-ink-70)' }}>{formatDistance(distance)}</span>
            )}
          </div>

          {/* Il "dove", tutto su una riga: la città quando è un'altra, poi
              via e quartiere. "Via Bonafous 7 · Vanchiglia" dice in che zona
              si va, che è quello che si guarda scegliendo fra cinque posti
              salvati.

              La città sta qui e non in mezzo a categoria e prezzo: in una
              card a mezza colonna quei tre pezzi insieme non ci stanno, e il
              nome della cucina finiva tagliato a metà. Su questa riga il
              distintivo ha il posto che gli serve, e a cedere è la via — che
              per un locale in un'altra città conta meno del fatto che sia in
              un'altra città. */}
          {(showCity || restaurant.address) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0,
              fontSize: dense ? 11.5 : 12, color: 'var(--color-ink-70)',
            }}>
              <CityBadge city={restaurant.city} activeCity={activeCity} style={{ flexShrink: 0 }} />
              {restaurant.address && (
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatAddress(restaurant.address, restaurant.neighborhood) || restaurant.address}
                </span>
              )}
            </div>
          )}
        </div>
        </div>
        {footer && <TileFooter dense={dense}>{footer}</TileFooter>}
      </motion.div>
    )
  }

  // HERO VARIANT — dark featured card
  if (variant === 'hero') {
    return (
      <motion.button
        className="w-full text-left relative overflow-hidden h-[200px] md:h-[160px]"
        // `data-motion-loop`: il respiro infinito dell'ombra è puro
        // ornamento, quindi sparisce con "riduci movimento" (globals.css).
        data-motion-loop
        style={{ borderRadius: 22, animation: 'hero-pulse 3s ease-in-out infinite' }}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        custom={index}
        whileTap={{ transform: 'scale(0.98)' }}
        transition={SPRING_SNAP}
        onClick={() => onClick?.(restaurant)}
      >
        {/* Background */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1e1520, #2e2228, #22181C)' }}>
          {!showPhoto && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 64, opacity: 0.28 }}>
              {category?.emoji || '🍽️'}
            </div>
          )}
          {showPhoto && (
            <img
              src={photoUrl}
              srcSet={photoSrcSet}
              sizes={photoSizes}
              alt={restaurant.name}
              loading={isAboveFold ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImgError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-40' : 'opacity-0'}`}
            />
          )}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
          }} />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(232, 69, 60,0.12), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(176,137,84,0.1), transparent 50%)',
          }} />
          {/* Shimmer — single light sweep */}
          {imageLoaded && (
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 22 }}>
              <div style={{
                position: 'absolute', inset: 0,
                width: '40%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                animation: 'hero-shimmer 1.2s ease-out 0.3s forwards',
                transform: 'translateX(-100%) skewX(-15deg)',
              }} />
            </div>
          )}
        </div>

        {/* Top left badges: Discount only (TOP badge removed) */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasDiscount && discountTitle && (
            <div style={{
              background: 'var(--gradient-sconto)', color: 'var(--color-sconto-ink)',
              fontSize: 11, fontWeight: 800,
              padding: '5px 12px', borderRadius: 10,
            }}>
              {discountTitle}
            </div>
          )}
        </div>

        {/* Heart — top right, glassmorphic with white border */}
        {onSaveToggle && (
          <div
            className="absolute z-10"
            style={{ top: 16, right: 16 }}
            onClick={(e) => { e.stopPropagation(); onSaveToggle() }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid rgba(255,255,255,0.25)',
              cursor: 'pointer',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill={saved ? '#E8453C' : 'none'}
                stroke={saved ? '#E8453C' : '#fff'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
          </div>
        )}

        {/* Content — bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-2">
          {/* Name */}
          <h3 style={{
            fontFamily: "var(--font-sans)", fontWeight: 800,
            fontSize: 18, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.015em',
            marginBottom: restaurant.tagline ? 4 : 8,
          }}>
            {restaurant.name}
          </h3>

          {/* Tagline */}
          {restaurant.tagline && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginBottom: 8 }}>
              {restaurant.tagline}
            </p>
          )}

          {/* Info row: category colored · recommended_for · price · distance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)', flexWrap: 'wrap' }}>
            {category && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: `${category.color}30`,
                color: '#fff', fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 20,
              }}>
                {category.emoji} {category.name}
              </span>
            )}
            {restaurant.recommended_for?.length > 0 && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                <span>{restaurant.recommended_for[0]}</span>
              </>
            )}
            {priceStr && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                <span style={{ fontWeight: 600 }}>{priceStr}</span>
              </>
            )}
            {distance != null && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                <span>{formatDistance(distance)}</span>
              </>
            )}
          </div>
        </div>
      </motion.button>
    )
  }

  // DEFAULT VARIANT — horizontal compact card
  return (
    <motion.div
      className="rcard w-full text-left relative rounded-[18px] md:rounded-[14px]"
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileTap={{ transform: 'scale(0.98)' }}
      transition={SPRING_SNAP}
    >
      {/* Il bottone che apre la scheda copre la card senza contenerla: il
          cuore è un secondo bottone, e un <button> dentro un altro è HTML
          non valido (in lettura vocale diventa un comando solo). */}
      <button
        type="button"
        className="rcard-hit"
        aria-label={`Apri la scheda di ${restaurant.name}`}
        onClick={() => onClick?.(restaurant)}
        style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      />

      {/* Discount strip on top (verde sfumato) */}
      {hasDiscount && discountTitle && (
        <div className="rcard-discount-strip" style={{
          background: 'var(--gradient-sconto)',
          color: 'var(--color-sconto-ink)',
          fontSize: 10, fontWeight: 800,
          padding: '5px 10px',
          textAlign: 'center',
          letterSpacing: 0.5,
        }}>
          {discountTitle}
        </div>
      )}

      <div className="rcard-inner flex w-full items-center gap-3.5" style={{ padding: 14 }}>
      {/* Photo */}
      <div className="rcard-photo relative flex-shrink-0 overflow-hidden w-[100px] h-[100px] md:w-[72px] md:h-[72px] rounded-[14px] md:rounded-[10px]">
        <div
          className="absolute inset-0"
          style={{ background: category?.color ? `linear-gradient(135deg, ${category.color}40, ${category.color}20)` : 'linear-gradient(135deg, #e8d5c0, #d4c0a8)' }}
        />
        {showPhoto && !imageLoaded && (
          <div className="skeleton absolute inset-0" aria-hidden="true" />
        )}
        {showPhoto ? (
          <img
            src={photoUrl}
            srcSet={photoSrcSet}
            sizes={photoSizes}
            alt={restaurant.name}
            loading={isAboveFold ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 32, opacity: 0.6 }}>
            {category?.emoji || '🍽️'}
          </div>
        )}
        {/* Desktop-only discount badge on photo (verde sfumato) */}
        {hasDiscount && discountTitle && (
          <div className="rcard-photo-badge hidden md:block" style={{
            position: 'absolute', top: 6, left: 6,
            background: 'var(--gradient-sconto)', color: 'var(--color-sconto-ink)',
            fontSize: 9, fontWeight: 800,
            padding: '3px 8px', borderRadius: 999,
            letterSpacing: 0.3,
          }}>
            {discountTitle}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="rcard-body flex-1 min-w-0 flex flex-col justify-center">
        {/* Name */}
        <h3 className="rcard-name" style={{
          fontFamily: "var(--font-sans)", fontWeight: 800,
          fontSize: 14, color: '#22181C',
          lineHeight: 1.5, marginBottom: 3,
        }}>
          {restaurant.name}
        </h3>

        {/* Tagline */}
        {restaurant.tagline && (
          <p className="rcard-tagline" style={{ fontSize: 12, color: '#8A8680', fontWeight: 500, marginBottom: 4 }}>
            {restaurant.tagline}
          </p>
        )}

        {/* Category badges — max 2 visible */}
        <div className="rcard-cats" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          {categories.slice(0, 2).map(cat => (
            <span
              key={cat.name}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: `${cat.color}20`,
                color: cat.color,
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 20,
              }}
            >
              {cat.emoji} {cat.name}
            </span>
          ))}
          {categories.length > 2 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)',
              fontSize: 10, fontWeight: 700, color: '#8A8680',
            }}>
              +{categories.length - 2}
            </span>
          )}
        </div>

        {/* Recommended + Price + Distance row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8A8680', fontWeight: 500 }}>
          {restaurant.recommended_for?.length > 0 && (
            <>
              <span>{restaurant.recommended_for[0]}</span>
              {(priceStr || distance != null) && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />}
            </>
          )}
          {priceStr && <span style={{ fontWeight: 600 }}>{priceStr}</span>}
          {distance != null && (
            <>
              {priceStr && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                {formatDistance(distance)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Save heart */}
      {onSaveToggle && (
        <div className="absolute bottom-3.5 right-3.5" style={{ zIndex: 3 }}>
          <SaveButton saved={saved} onClick={onSaveToggle} size="sm" />
        </div>
      )}
      </div>
    </motion.div>
  )
}

export default memo(RestaurantCard)
