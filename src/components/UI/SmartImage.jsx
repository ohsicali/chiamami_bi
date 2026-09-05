import { useState } from 'react'
import { proxyImg, proxyImgSrcSet } from '../../lib/supabase'

// Helper immagini condiviso per il polish PR24 (Blocco A1).
// Riusa il proxy esistente (proxyImg → /api/img, resize sharp + WebP/AVIF,
// cache CDN) e garantisce che NESSUNA card resti grigia: skeleton shimmer
// finché la foto carica, ed emoji categoria su gradiente caldo se la foto
// manca o l'URL è morto (onError). I 404 vengono loggati per l'audit.

// Gradienti caldi (mirror delle classi .g1-.g4 dei mockup di riferimento).
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg,#f3c9a5,#d98e63)',
  'linear-gradient(135deg,#e8d9c2,#bba180)',
  'linear-gradient(135deg,#f6e3d0,#e0b18b)',
  'linear-gradient(135deg,#ddc9b8,#a98a72)',
]

// Gradiente stabile per nome: la stessa card mostra sempre lo stesso colore.
function pickGradient(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length]
}

// Estrae l'URL grezzo dalle varie forme usate nell'app: stringa oppure
// oggetto { thumb_url, photo_url }.
export function firstPhotoUrl(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return null
  const p = photos[0]
  if (typeof p === 'string') return p
  return p?.thumb_url || p?.photo_url || null
}

function warnDeadUrl(url) {
  if (url) console.warn('[SmartImage] foto non caricata (URL morto?):', url)
}

/**
 * PhotoOrEmoji — renderizza UN SOLO elemento (img o emoji), senza wrapper.
 * Pensato per i container già stilati via CSS (es. `.sc-ph`, `.sc-ph-mini`)
 * dove i selettori puntano a `img, > div:first-child` e i badge escono dal
 * box con `overflow:visible`. Sostituisce i ternari `photo ? <img> : <emoji>`
 * aggiungendo il fallback su `onError`.
 */
export function PhotoOrEmoji({
  src,
  emoji = '🍽️',
  alt = '',
  imgStyle,
  imgClassName,
  fallbackStyle,
  fallbackClassName,
  gradient,
}) {
  // ⚠️ Lo stato tiene l'URL che ha fallito, non un booleano.
  // `useState(!src)` si inizializzava al PRIMO render e non si aggiornava
  // mai piu: una card nata senza foto (src null, foto caricata dopo — è il
  // caso delle card di "Chiedi a Bi") restava sul fallback per sempre anche
  // quando l'URL arrivava. Confrontando l'URL, un src nuovo riparte pulito.
  const [failedSrc, setFailedSrc] = useState(null)
  const failed = !src || failedSrc === src

  if (failed) {
    return (
      <div
        className={fallbackClassName}
        style={{
          width: '100%', height: '100%',
          display: 'grid', placeItems: 'center',
          background: gradient || pickGradient(alt || emoji),
          fontSize: 'inherit',
          ...fallbackStyle,
        }}
        aria-hidden="true"
      >
        {emoji}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={imgClassName}
      loading="lazy"
      decoding="async"
      onError={() => { warnDeadUrl(src); setFailedSrc(src) }}
      style={imgStyle}
    />
  )
}

/**
 * SmartImage — box autonomo (position:relative) con skeleton + fallback emoji.
 * Per i layout che controlliamo direttamente. Passa `photos` (array grezzo,
 * il componente fa proxy+srcset) oppure `src` (URL già risolto). `children`
 * per gli overlay (badge, heart) sopra la foto.
 */
export default function SmartImage({
  photos,
  src,
  width = 400,
  srcSetWidths,
  sizes,
  alt = '',
  emoji = '🍽️',
  gradient,
  eager = false,
  fetchPriority,
  fallbackFontSize = '2.4em',
  className = '',
  style,
  imgStyle,
  children,
}) {
  const raw = src !== undefined ? src : firstPhotoUrl(photos)
  // Come in PhotoOrEmoji: lo stato è ancorato all'URL, così se `raw` cambia
  // (foto che arriva dopo il primo render) la nuova immagine riparte da
  // 'loading' invece di ereditare l'esito della precedente.
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [errorSrc, setErrorSrc] = useState(null)
  const state = !raw ? 'empty'
    : errorSrc === raw ? 'error'
      : loadedSrc === raw ? 'loaded' : 'loading'
  const failed = !raw || state === 'error'

  // Se `src` è passato è già risolto; con `photos` proxiamo noi.
  const url = src !== undefined ? raw : raw ? proxyImg(raw, { w: width }) : null
  const srcSet = src === undefined && raw && srcSetWidths ? proxyImgSrcSet(raw, srcSetWidths) : undefined

  return (
    <div
      className={className}
      style={{ position: 'relative', overflow: 'hidden', background: gradient || pickGradient(alt), ...style }}
    >
      {state === 'loading' && (
        <div className="skeleton" style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />
      )}
      {failed && (
        <div
          style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: fallbackFontSize, opacity: 0.7 }}
          aria-hidden="true"
        >
          {emoji}
        </div>
      )}
      {url && state !== 'error' && (
        <img
          src={url}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchpriority={fetchPriority}
          decoding="async"
          onLoad={() => setLoadedSrc(raw)}
          onError={() => { warnDeadUrl(raw); setErrorSrc(raw) }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: state === 'loaded' ? 1 : 0,
            transition: 'opacity .35s ease',
            ...imgStyle,
          }}
        />
      )}
      {children}
    </div>
  )
}
