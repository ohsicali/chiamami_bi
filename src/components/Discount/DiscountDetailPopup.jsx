import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  checkValidity,
  formatDays,
  formatSlots,
  formatShortPill,
  computeNextValidWindow,
} from '../../lib/validity'
import ValidityPill from './ValidityPill'
import { formatDiscountValue } from '../../lib/utils/discountFormat'
import './DiscountDetailPopup.css'

/* ============================================================================
   Helpers
   ============================================================================ */
function slugify(name) {
  return (name || 'sconto').toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sconto'
}

function shortAddress(addr) {
  if (!addr) return ''
  return addr.split(',')[0].trim()
}

function pctNum(deal) {
  return formatDiscountValue(deal)
}

function pctLabel(deal) {
  if (!deal) return ''
  if (deal.discount_type === 'percentage') return 'sul totale'
  if (deal.discount_type === 'fixed') return 'di sconto'
  if (deal.discount_type === 'freebie') return 'in regalo'
  if (deal.discount_type === 'special_price') return 'prezzo speciale'
  return ''
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
   QR canvas
   ============================================================================ */
function QRCanvas({ value, size = 170 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    })
  }, [value, size])
  return <canvas ref={ref} />
}

/* ============================================================================
   Main popup
   ============================================================================ */
export default function DiscountDetailPopup({
  deal,
  initialUnlocked = false,
  initialRedemption = null, // { id, qr_code } se già preso
  photoUrl,
  restaurantUrl, // /restaurant/<slug>
  onClaim,       // async: ritorna { id, qr_code } | null se AuthGate
  onClose,
  claiming = false,
}) {
  const [unlocked, setUnlocked] = useState(initialUnlocked)
  const [redemption, setRedemption] = useState(initialRedemption)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState(null)

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
    }
  }

  async function handleDownload() {
    if (pdfBusy || !redemption?.id) return
    setPdfBusy(true)
    setPdfError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('not_authenticated')
      const res = await fetch(`/api/discount-pdf?id=${encodeURIComponent(redemption.id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const ctype = res.headers.get('content-type') || ''
      if (!res.ok || !ctype.includes('application/pdf')) {
        let detail = `HTTP ${res.status}`
        try {
          if (ctype.includes('application/json')) detail = (await res.json())?.error || detail
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sconto-${slugify(deal?.restaurant?.name)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download failed:', err)
      setPdfError('Non sono riuscito a generare il PDF, riprova.')
    } finally {
      setPdfBusy(false)
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
            onClose={onClose}
            onDownloadPDF={handleDownload}
            pdfBusy={pdfBusy}
            pdfError={pdfError}
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
  const numText = pctNum(deal)
  const labelText = pctLabel(deal)
  const isDrop = !!deal?.is_drop
  const claimed = deal?.claimed_count || deal?.total_redeemed || 0
  const max = deal?.max_quantity || deal?.max_redemptions || 0
  const remaining = max > 0 ? Math.max(0, max - claimed) : null
  const progressPct = max > 0 ? Math.min(100, Math.round((claimed / max) * 100)) : 0

  const endIso = deal?.drop_ends_at || deal?.valid_until
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!isDrop) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isDrop])
  const cd = isDrop ? compactCountdown(endIso, now) : null

  const validityPillText = formatShortPill(deal, status)
  const daysText = formatDays(deal?.valid_days)
  const slotsText = formatSlots(deal?.valid_meal_slots)
  const hasValidityRestriction =
    (Array.isArray(deal?.valid_days) && deal.valid_days.length > 0 && deal.valid_days.length < 7) ||
    (Array.isArray(deal?.valid_meal_slots) && deal.valid_meal_slots.length > 0) ||
    !!(deal?.valid_time_from && deal?.valid_time_to)

  // Block validità (verde / giallo / rosso) sotto al header
  const validityVariant = status === 'valid_now' ? 'ok'
    : status === 'valid_today_later' ? 'warn'
    : 'bad'
  const validityHeadline = status === 'valid_now'
    ? 'Valido ora'
    : status === 'valid_today_later'
      ? `Solo ${slotsText.toLowerCase()}`
      : (Array.isArray(deal?.valid_days) && deal.valid_days.length && deal.valid_days.length < 7)
        ? `Oggi non valido · Da ${formatDays(deal.valid_days).split(' · ')[0].split('–')[0]}`
        : 'Oggi non valido'
  const validityCopy = (() => {
    if (status === 'valid_now') return 'Mostralo al ristoratore al momento del conto.'
    const next = computeNextValidWindow(deal)
    if (status === 'valid_today_later') {
      return next ? `Si attiva ${next}.` : 'Si attiva più tardi oggi.'
    }
    return `Si attiva ${daysText.toLowerCase().includes('tutti') ? '' : daysText + ', '}fascia ${slotsText.toLowerCase()}.`
  })()

  const description = deal?.description || deal?.title
  const conditionLines = (deal?.conditions || '')
    .split(/\n+|•/g).map((s) => s.trim()).filter(Boolean)

  return (
    <>
      {/* HERO foto fullbleed con percentuale overlay */}
      <div className="ddp-grip" aria-hidden="true" />
      <div className="ddp-photo">
        {photoUrl ? (
          <img src={photoUrl} alt={r?.name || ''} loading="lazy" decoding="async" />
        ) : (
          <div className="ddp-photo-fallback">🍽️</div>
        )}
        <div className="ddp-photo-grad" aria-hidden="true" />

        {isDrop && <span className="ddp-live-pill">drop live</span>}
        <button type="button" className="ddp-close" aria-label="Chiudi" onClick={onClose}>✕</button>

        {numText && (
          <div className="ddp-pct-overlay">
            <div className="ddp-pct-num">{numText}</div>
            {labelText && <div className="ddp-pct-lbl">{labelText}</div>}
          </div>
        )}
      </div>

      {/* BODY scrollable */}
      <div className="ddp-body">
        <div className="ddp-meta">
          {[cuisine, address].filter(Boolean).join(' · ')}
        </div>
        <h2 className="ddp-name">{r?.name || deal?.title}</h2>
        <div className="ddp-where">
          <ValidityPill status={status} text={validityPillText} />
        </div>

        {/* Validity block */}
        {hasValidityRestriction && (
          <div className={`ddp-validity-block is-${validityVariant}`}>
            <div className="ddp-validity-ic" aria-hidden="true">
              {status === 'valid_now' ? (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
              )}
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

        {/* Specs */}
        <div className="ddp-specs">
          {hasValidityRestriction && (
            <div className="ddp-spec-row">
              <div className="ddp-spec-ic">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
              </div>
              <div className="ddp-spec-info">
                <strong>Quando</strong>
                <div className="ddp-spec-v">{daysText}</div>
              </div>
            </div>
          )}
          {(Array.isArray(deal?.valid_meal_slots) && deal.valid_meal_slots.length) || (deal?.valid_time_from && deal?.valid_time_to) ? (
            <div className="ddp-spec-row">
              <div className="ddp-spec-ic">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </div>
              <div className="ddp-spec-info">
                <strong>Fascia</strong>
                <div className="ddp-spec-v">{
                  deal.valid_time_from && deal.valid_time_to
                    ? `${deal.valid_time_from.slice(0, 5)} – ${deal.valid_time_to.slice(0, 5)}`
                    : slotsText
                }</div>
              </div>
            </div>
          ) : null}
          {description && (
            <div className="ddp-spec-row">
              <div className="ddp-spec-ic">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7L9 18l-5-5" /></svg>
              </div>
              <div className="ddp-spec-info">
                <strong>Cosa ottieni</strong>
                <div className="ddp-spec-v">{description}</div>
              </div>
            </div>
          )}
          {conditionLines.length > 0 && (
            <div className="ddp-spec-row">
              <div className="ddp-spec-ic">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
              </div>
              <div className="ddp-spec-info">
                <strong>Da sapere</strong>
                <div className="ddp-spec-v">{conditionLines.join(' · ')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Scopri ristorante */}
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
   Stato 2: UNLOCKED — QR inline
   ============================================================================ */
function UnlockedQRView({ deal, redemption, photoUrl, onClose, onDownloadPDF, pdfBusy, pdfError }) {
  const r = deal?.restaurant
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const address = shortAddress(r?.address)
  const isDrop = !!deal?.is_drop
  const endIso = deal?.drop_ends_at || deal?.valid_until
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!isDrop) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isDrop])
  const cd = isDrop ? compactCountdown(endIso, now) : null

  const qrPayload = redemption?.qr_code
    ? `${window.location.origin}/verify?code=${redemption.qr_code}`
    : null

  const reassuranceText = isDrop && cd
    ? `Salvato in I miei vantaggi · Scade in ${cd}`
    : 'Salvato in I miei vantaggi · Sempre valido'

  return (
    <>
      <div className="ddp-grip" aria-hidden="true" />

      {/* Banner success */}
      <div className="ddp-unlock-banner">
        <div className="ddp-ub-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div className="ddp-ub-txt">
          <strong>Sbloccato!</strong>
          <p>L'ho aggiunto ai tuoi vantaggi. Mostralo al ristoratore.</p>
        </div>
        <button type="button" className="ddp-close ddp-close-on-banner" aria-label="Chiudi" onClick={onClose}>✕</button>
      </div>

      {/* QR section */}
      <div className="ddp-qr-section">
        <div className="ddp-qr-place">
          {photoUrl && (
            <div className="ddp-qrp-thumb">
              <img src={photoUrl} alt="" loading="lazy" decoding="async" />
            </div>
          )}
          <div className="ddp-qrp-info">
            <h3>{r?.name || deal?.title}</h3>
            <div className="ddp-qrp-meta">{[cuisine, address].filter(Boolean).join(' · ')}</div>
          </div>
          <span className="ddp-qrp-pct">{pctNum(deal)}</span>
        </div>

        <div className="ddp-qr-frame">
          {qrPayload ? <QRCanvas value={qrPayload} size={170} /> : <div className="ddp-qr-loading">Genero QR…</div>}
        </div>

        <div className="ddp-qr-hint">Mostra al ristoratore</div>
        <div className="ddp-qr-info">
          Lui scansiona il codice e <strong>attiva lo sconto</strong>.<br />
          Codice valido una sola volta.
        </div>

        <div className="ddp-reassurance">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          {reassuranceText}
        </div>
      </div>

      <div className="ddp-footer-actions">
        <button
          type="button"
          className="ddp-pdf-btn"
          onClick={onDownloadPDF}
          disabled={pdfBusy}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" /></svg>
          {pdfBusy ? 'Genero PDF…' : 'Scarica PDF'}
          {!pdfBusy && <small>stampa o salva sul telefono</small>}
        </button>
        {pdfError && <div className="ddp-pdf-error" role="status">{pdfError}</div>}
        <button type="button" className="ddp-close-link" onClick={onClose}>Chiudi</button>
      </div>
    </>
  )
}
