import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  checkValidity,
  formatShortPill,
  formatSlots,
  computeNextValidWindow,
} from '../../lib/validity'
import ValidityPill from './ValidityPill'
import { formatDiscountBadge, formatDiscountValue, isBareDiscountValue, pickPerk } from '../../lib/utils/discountFormat'
import { perkBeyondValue } from '../../../api/_email/content.js'
import { hasDayTiers } from '../../lib/dayTiers'
import './DiscountDetailPopup.css'
import DiscountRules from './DiscountRules'
import { QRPassSheet } from './QRPass'

/* ============================================================================
   Helpers
   ============================================================================ */

function shortAddress(addr) {
  if (!addr) return ''
  return addr.split(',')[0].trim()
}

/**
 * La riga accanto al badge: cosa ottieni, detto in parole.
 *
 * Il titolo solo se aggiunge qualcosa al numero già scritto grande
 * (`perkBeyondValue`, la stessa regola delle email: "−20%" e sotto
 * "20% di sconto" dice lo sconto due volte). Se no, "Sconto sul conto":
 * non "sul totale", che con "bevande escluse" nelle condizioni sarebbe
 * falso. Uno sconto a fasce prende il titolo solo se è senza cifre, come
 * vuole la regola delle fasce: le cifre le dice la settimana qui sotto, e
 * un "fino al 30%" è proprio la frase che non si deve leggere.
 */
function offerPerk(deal) {
  if (!deal) return ''
  const title = String(deal.title || '').trim()
  if (deal.discount_type === 'freebie' || deal.discount_type === 'special_price') {
    // Il titolo è già il badge: qui va solo una descrizione diversa.
    const d = String(deal.description || '').trim()
    return d && d !== title ? d : ''
  }
  const value = formatDiscountValue(deal)
  const perk = hasDayTiers(deal)
    ? (/\d/.test(title) ? '' : title)
    : perkBeyondValue(pickPerk(deal, value), value)
  return perk || 'Sconto sul conto'
}

function compactCountdown(targetIso, now = Date.now()) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - now
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}g ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/* ============================================================================
   Main popup
   ============================================================================ */
export default function DiscountDetailPopup({
  deal,
  initialUnlocked = false,
  initialRedemption = null, // { id, qr_code, short_code } se già preso
  photoUrl,
  restaurantUrl, // /restaurant/<slug>
  onClaim,       // async: ritorna { id, qr_code, short_code } | null se AuthGate
  onClose,
  claiming = false,
}) {
  const [unlocked, setUnlocked] = useState(initialUnlocked)
  const [redemption, setRedemption] = useState(initialRedemption)
  // Appena sbloccato qui (non riaperto da "I miei vantaggi"): la testa del
  // pass lo festeggia con la spunta invece di dire solo "il tuo sconto".
  const [justUnlocked, setJustUnlocked] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const status = useMemo(() => checkValidity(deal), [deal])

  async function handleUnlock() {
    if (claiming) return
    const result = await onClaim?.()
    if (result?.id) {
      setRedemption(result)
      setUnlocked(true)
      setJustUnlocked(true)
    }
  }

  return (
    <div
      className="ddp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Dettagli sconto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`ddp-sheet ${unlocked ? 'is-unlocked' : ''}`}>
        {!unlocked ? (
          <DetailLockedView
            deal={deal}
            status={status}
            photoUrl={photoUrl}
            restaurantUrl={restaurantUrl}
            onClose={onClose}
            onUnlock={handleUnlock}
            unlocking={claiming}
          />
        ) : (
          <UnlockedQRView
            deal={deal}
            redemption={redemption}
            photoUrl={photoUrl}
            restaurantUrl={restaurantUrl}
            justUnlocked={justUnlocked}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

/* ============================================================================
   Stato 1: LOCKED
   ============================================================================ */
function DetailLockedView({ deal, status, photoUrl, restaurantUrl, onClose, onUnlock, unlocking }) {
  const r = deal?.restaurant
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const address = shortAddress(r?.address)
  const badge = formatDiscountBadge(deal)
  // Sconto a fasce: la cifra grande è quella di oggi, e lo dice. Le altre
  // stanno subito sotto, nella settimana di DiscountRules.
  const tiered = hasDayTiers(deal)
  const perk = offerPerk(deal)
  // "2x1" o "−20%" stanno grandi; un omaggio scritto in parole
  // ("Cannolo gratis") a quella misura andrebbe a capo a ogni parola.
  const longBadge = !isBareDiscountValue(formatDiscountValue(deal)) && badge.length > 5
  const isDrop = !!deal?.is_drop
  const claimed = deal?.claimed_count || deal?.total_redeemed || 0
  const max = deal?.max_quantity || deal?.max_redemptions || 0
  const remaining = max > 0 ? Math.max(0, max - claimed) : null
  const progressPct = max > 0 ? Math.min(100, Math.round((claimed / max) * 100)) : 0

  const endIso = deal?.drop_ends_at || deal?.valid_until
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isDrop) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isDrop])
  const cd = isDrop ? compactCountdown(endIso, now) : null

  const validityPillText = formatShortPill(deal, status)

  // Il blocco di avviso esce solo quando c'è un avviso da dare: se lo sconto
  // è usabile adesso lo dicono già la pillola in testa e i giorni accesi
  // dentro DiscountRules, e un terzo riquadro verde che ripete "Valido ora"
  // è rumore fra il nome del locale e le regole vere.
  const showValidityWarning = status !== 'valid_now'
  const validityVariant = status === 'valid_today_later' ? 'warn' : 'bad'

  // Una frase per stato, scritta per intero.
  //
  // Prima la frase si costruiva a pezzi incollando `formatDays` e
  // `formatSlots`, e su uno sconto con i giorni ma senza fascia usciva
  // "Si attiva Lun–Gio, fascia qualsiasi fascia": `formatSlots([])` risponde
  // "Qualsiasi fascia" — giusto come etichetta a sé, incollato dentro una
  // frase no. Il caso è esattamente quello dei sei sconti a catalogo con i
  // giorni scritti a mano.
  const { validityHeadline, validityCopy } = (() => {
    if (status === 'expired') {
      return {
        validityHeadline: 'Sconto scaduto',
        validityCopy: 'Questo sconto non è più disponibile.',
      }
    }
    const next = computeNextValidWindow(deal)
    if (status === 'valid_today_later') {
      // Con una sola fascia il nome si può dire ("a cena"): è l'informazione
      // che serve per decidere se aspettare, non solo l'orario nudo.
      const slots = Array.isArray(deal?.valid_meal_slots) ? deal.valid_meal_slots : []
      const slotLabel = slots.length === 1 ? formatSlots(slots) : null
      return {
        validityHeadline: slotLabel ? `Valido solo a ${slotLabel.toLowerCase()}` : 'Non ancora attivo',
        validityCopy: next ? `Si attiva ${next}.` : 'Si attiva più tardi oggi.',
      }
    }
    // valid_other_day: `computeNextValidWindow` qui dà il nome del prossimo
    // giorno buono ("giovedì"), che è l'unica cosa che serve sapere.
    return {
      validityHeadline: 'Oggi non valido',
      validityCopy: next ? `Torna ${next}: i giorni validi sono qui sotto.` : 'Guarda qui sotto i giorni in cui vale.',
    }
  })()

  // La descrizione esce solo se aggiunge qualcosa: quando è uguale al titolo
  // o è già la riga accanto al badge (o manca, che è il caso di quasi tutti
  // gli sconti a catalogo) ripeterebbe una cosa già scritta.
  const description = deal?.description && deal.description !== deal.title && deal.description !== perk
    ? deal.description
    : null

  return (
    <>
      {/* Testa: il locale, con la foto piccola e nitida accanto al nome.
          Fino al 16/10 qui c'era la foto a tutta larghezza (4:3) con la
          cifra sopra: era la miniatura da 400 px ingrandita, usciva sgranata,
          e da sola occupava metà dello schermo spingendo le regole sotto il
          bordo. Ora la testa è quella del pass del QR (QRPassSheet): dopo
          "Sblocca sconto" in alto non cambia niente. */}
      <div className="ddp-grip" aria-hidden="true" />
      <header className="ddp-head">
        <div className="ddp-head-photo">
          {photoUrl ? (
            <img src={photoUrl} alt={r?.name || ''} decoding="async" />
          ) : (
            <span aria-hidden="true">🍽️</span>
          )}
        </div>
        <div className="ddp-head-txt">
          {(cuisine || address) && (
            <div className="ddp-meta">{[cuisine, address].filter(Boolean).join(' · ')}</div>
          )}
          <h2 className="ddp-name">{r?.name || deal?.title}</h2>
        </div>
        <button type="button" className="ddp-close" aria-label="Chiudi" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      {/* BODY scrollable */}
      <div className="ddp-body">
        {/* L'offerta: il badge verde degli sconti (lo stesso del QR, delle
            card e della mappa), accanto cosa ottieni e se vale adesso. */}
        {(badge || perk) && (
          <section className="ddp-offer" aria-label="L'offerta">
            {badge && (
              <span className={`ddp-offer-badge ${longBadge ? 'is-long' : ''}`}>
                {badge}
                {tiered && <small>oggi</small>}
              </span>
            )}
            <div className="ddp-offer-txt">
              {isDrop && <span className="ddp-live-pill">drop live</span>}
              {perk && <p className="ddp-offer-perk">{perk}</p>}
              <ValidityPill status={status} text={validityPillText} />
            </div>
          </section>
        )}

        {description && <p className="ddp-lead">{description}</p>}

        {/* Avviso: esce solo quando lo sconto NON è usabile adesso */}
        {showValidityWarning && (
          <div className={`ddp-validity-block is-${validityVariant}`}>
            <div className="ddp-validity-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
            </div>
            <div className="ddp-validity-txt">
              <strong>{validityHeadline}</strong>
              <p>{validityCopy}</p>
            </div>
          </div>
        )}

        {/* Countdown drop ink */}
        {isDrop && cd && (
          <div className="ddp-countdown">
            <div className="ddp-cd-left">
              <strong>termina tra</strong>
              <div className="ddp-cd-v">{cd}</div>
            </div>
            {max > 0 && (
              <div className="ddp-cd-right">
                <strong>posti</strong>
                <div className="ddp-cd-v">{claimed}<small>/{max} presi</small></div>
              </div>
            )}
          </div>
        )}

        {/* Progress drop */}
        {isDrop && max > 0 && (
          <div className="ddp-progress">
            <div className="ddp-progress-bar"><i style={{ width: `${progressPct}%` }} /></div>
            <span>{remaining} ancora liberi</span>
          </div>
        )}

        {/* Cosa vale · quando · da sapere */}
        <DiscountRules deal={deal} className="ddp-rules" />

        {/* Scopri ristorante: la foto c'è già in testa, qui basta l'icona. */}
        {restaurantUrl && (
          <Link to={restaurantUrl} className="ddp-restaurant-link" onClick={onClose}>
            <div className="ddp-rl-thumb is-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10l1.5-5h13L20 10" /><path d="M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12.5V20h13v-7.5" /><path d="M10 20v-4h4v4" /></svg>
            </div>
            <div className="ddp-rl-info">
              <strong>Scopri il ristorante</strong>
              <div className="ddp-rl-name">{r?.name || ''}</div>
            </div>
            <div className="ddp-rl-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </Link>
        )}

        {/* Secondo Bi alla fine */}
        {(r?.tagline || r?.recommended_for) && (
          <div className="ddp-editorial">
            <div className="ddp-ed-av">
              <img className="ddp-ed-logo" src="/bi_logo_def_centrato.svg" alt="Bi" />
              <span className="ddp-ed-spark" aria-hidden="true">✦</span>
            </div>
            <div className="ddp-ed-txt">
              <strong>Secondo Bi</strong>
              <p>{r.tagline || r.recommended_for}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer sticky CTA */}
      <div className="ddp-footer">
        <button
          type="button"
          className="ddp-cta-unlock"
          onClick={onUnlock}
          disabled={unlocking}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          {unlocking ? 'Sblocco…' : 'Sblocca sconto'}
        </button>
      </div>
    </>
  )
}

/* ============================================================================
   Stato 2: UNLOCKED — il pass del QR (QRPassSheet, lo stesso della pagina
   del locale). Le info dello sconto restano a portata, chiuse di default:
   chi vuole ricontrollare giorni e condizioni prima di uscire di casa non
   deve chiudere il popup e riaprirlo dal catalogo.
   ============================================================================ */
function UnlockedQRView({ deal, redemption, photoUrl, restaurantUrl, justUnlocked, onClose }) {
  const r = deal?.restaurant
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const address = shortAddress(r?.address)
  const description = deal?.description && deal.description !== deal.title ? deal.description : null

  return (
    <>
      <div className="ddp-grip" aria-hidden="true" />
      <QRPassSheet
        deal={deal}
        redemption={redemption}
        restaurantName={r?.name || deal?.title}
        subtitle={[cuisine, address].filter(Boolean).join(' · ')}
        photoUrl={photoUrl}
        justUnlocked={justUnlocked}
        onClose={onClose}
      >
        {description && <p className="ddp-lead">{description}</p>}
        <DiscountRules deal={deal} className="ddp-rules" />
        {restaurantUrl && (
          <Link to={restaurantUrl} className="ddp-restaurant-link" onClick={onClose}>
            <div className="ddp-rl-thumb">
              {photoUrl && <img src={photoUrl} alt="" loading="lazy" decoding="async" />}
            </div>
            <div className="ddp-rl-info">
              <strong>Scopri il ristorante</strong>
              <div className="ddp-rl-name">{r?.name || ''}</div>
            </div>
            <div className="ddp-rl-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </Link>
        )}
      </QRPassSheet>
    </>
  )
}
