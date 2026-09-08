import { useEffect, useState, useMemo } from 'react'
import { proxyImg, proxyImgSrcSet } from '../../lib/supabase'
import { formatDiscountValue } from '../../lib/utils/discountFormat'
import { formatAddress } from '../../lib/utils/formatAddress'
import { claimedCount, maxQuantity, remainingCount, formatCountdown, isDrop } from '../../lib/discounts'
import './DropCard.css'

/**
 * DropCard — la card del drop, un componente solo in tre taglie (Blocco 1).
 *
 *   size="large"   home mobile a tutta larghezza · Bi Club con 1 drop
 *   size="narrow"  colonna desktop accanto al momento · Bi Club con 2-3 drop
 *   size="mini"    righe "altri sconti attivi" — tutta la card è cliccabile
 *
 * Prende la riga sconto così com'è dal DB (con `restaurant` in join) e si
 * arrangia: formattazione del valore, foto, indirizzo, countdown. Chi la usa
 * passa i dati grezzi e due callback, non un oggetto pre-masticato — è quello
 * che permette alle tre pagine di mostrare la stessa card senza tre
 * normalizzazioni diverse che poi divergono.
 *
 * La struttura sta in DropCard.css, dove c'è anche la nota su cosa NON
 * reintrodurre.
 */
export default function DropCard({
  deal,
  size = 'large',
  onUnlock,
  onDiscover,
  taken = false,
  split = false,
  ctaLabel,
  ctaDisabled = false,
  validityNote,
  className = '',
  style,
}) {
  // Il countdown scende da solo: una pill che dice "6G 19H" e resta ferma per
  // tutta la sessione è peggio che non averla.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const view = useMemo(() => buildView(deal, now), [deal, now])
  if (!view) return null

  const isMini = size === 'mini'
  const classes = [
    'dropcard',
    `dropcard--${size}`,
    split ? 'dropcard--split' : '',
    taken ? 'dropcard--taken' : '',
    className,
  ].filter(Boolean).join(' ')

  const inner = (
    <>
      <div className="dropcard__photo">
        {view.photo
          ? (
            <img
              src={view.photo}
              srcSet={view.photoSrcSet}
              sizes={isMini ? '64px' : '(max-width: 768px) 100vw, 420px'}
              alt=""
              loading={isMini ? 'lazy' : 'eager'}
              decoding="async"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )
          : <span aria-hidden>{view.emoji}</span>}
      </div>

      {view.valueLabel && <span className="dropcard__badge">{view.valueLabel}</span>}

      <div className="dropcard__body">
        <span className="dropcard__pill">
          <i aria-hidden />
          {view.pillLabel}
        </span>

        <h3 className="dropcard__name">{view.restaurantName}</h3>

        <div className="dropcard__perk">
          {view.perk}
          {view.subline && <small>{view.subline}</small>}
        </div>

        {/* Validità (giorni/fasce, da PR23): sta qui e non in una pill sopra
            perché è una condizione d'uso, non uno stato del drop — chi legge
            "Solo a cena" lo deve leggere accanto al vantaggio, non accanto al
            countdown. */}
        {validityNote && <div className="dropcard__validity">{validityNote}</div>}

        {view.showProgress && (
          <div className="dropcard__progress">
            <div
              className="dropcard__bar"
              role="progressbar"
              aria-valuenow={view.claimed}
              aria-valuemin={0}
              aria-valuemax={view.max}
              aria-label={`${view.claimed} presi su ${view.max}`}
            >
              <i style={{ width: `${view.progressPct}%` }} />
            </div>
            <div className="dropcard__counts">
              <span>{view.claimed} {view.claimed === 1 ? 'preso' : 'presi'}</span>
              <span><b>{view.remaining} rimasti</b></span>
            </div>
          </div>
        )}

        {!isMini && (
          <div className="dropcard__cta">
            <button
              type="button"
              className="dropcard__btn dropcard__btn--primary"
              onClick={(e) => { e.stopPropagation(); onUnlock?.(deal) }}
              disabled={ctaDisabled || !onUnlock}
            >
              {ctaLabel || (taken ? 'Apri il QR' : '🔓 Sblocca sconto')}
            </button>
            <button
              type="button"
              className="dropcard__btn dropcard__btn--ghost"
              onClick={(e) => { e.stopPropagation(); onDiscover?.(deal) }}
              disabled={!onDiscover}
            >
              Scopri
            </button>
          </div>
        )}
      </div>
    </>
  )

  // Nella taglia mini l'intera card è il bersaglio: un <button> vero, così
  // funziona anche da tastiera senza reinventare focus e Invio a mano.
  if (isMini) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={() => (onUnlock || onDiscover)?.(deal)}
      >
        {inner}
      </button>
    )
  }

  return <div className={classes} style={style}>{inner}</div>
}

/* ------------------------------------------------------------------------ */
/*  Dalla riga del DB a ciò che si vede                                      */
/* ------------------------------------------------------------------------ */

function buildView(deal, now) {
  if (!deal) return null
  const r = deal.restaurant || deal.restaurants || null

  const photoRaw = pickPhoto(r)
  const claimed = claimedCount(deal)
  const max = maxQuantity(deal)
  const remaining = remainingCount(deal)
  const countdown = formatCountdown(deal, now)

  // "DROP LIVE · 6G 19H" per i drop; le convenzioni non hanno countdown né
  // posti e dicono quello che sono, senza fingersi urgenti.
  const drop = isDrop(deal)
  const pillLabel = drop
    ? (countdown ? `DROP LIVE · ${countdown}` : 'DROP LIVE')
    : 'SEMPRE VALIDO'

  const subline = [
    r?.cuisine_type || firstCategory(r),
    formatAddress(r?.address, r?.neighborhood) || r?.city,
  ].filter(Boolean).join(' · ')

  const valueLabel = formatDiscountValue(deal)

  return {
    restaurantName: r?.name || deal.title || 'Locale',
    valueLabel,
    perk: pickPerk(deal, valueLabel),
    subline,
    pillLabel,
    photo: proxyImg(photoRaw, { w: 900 }),
    photoSrcSet: proxyImgSrcSet(photoRaw, [300, 600, 900]),
    emoji: '🍽️',
    claimed,
    max,
    remaining,
    // La barra ha senso solo con un tetto: senza `max_quantity` non c'è un
    // "quanti ne restano" da mostrare, e una barra al 100% fissa mentirebbe.
    showProgress: max > 0 && remaining !== null,
    progressPct: max > 0 ? Math.min(100, Math.round((claimed / max) * 100)) : 0,
  }
}

/**
 * Il vantaggio in chiaro, quello che si legge in mezzo secondo.
 *
 * Non è sempre il titolo: sul DB metà dei titoli sono la percentuale e basta
 * ("50%", "20% sul pranzo"), e ripeterla sotto al badge che la mostra già
 * spreca la riga più importante della card. In quel caso vale di più la
 * condizione concreta ("Valido solo sull'acquisto del tramezzino base").
 */
function pickPerk(deal, valueLabel) {
  const candidates = [deal.description, deal.title, deal.conditions]
  const value = normalize(valueLabel)
  for (const c of candidates) {
    const text = String(c || '').trim()
    if (!text) continue
    // Scarta il candidato che è solo il valore già scritto nel badge.
    if (value && normalize(text) === value) continue
    return text
  }
  return deal.title || ''
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function pickPhoto(r) {
  const photos = Array.isArray(r?.photos) ? r.photos : []
  if (photos.length === 0) return null
  const sorted = [...photos].sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
  const p = sorted[0]
  if (!p) return null
  return typeof p === 'string' ? p : (p.photo_url || p.thumb_url || null)
}

function firstCategory(r) {
  const c = r?.category
  if (Array.isArray(c)) return c[0] || ''
  return c || ''
}
