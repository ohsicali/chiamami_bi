import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import ShortCodeCard from './ShortCodeCard'
import { formatDiscountBadge, formatDiscountValue } from '../../lib/utils/discountFormat'
import { formatShortCode, isShortCode, normalizeShortCode } from '../../lib/shortCode'
import { useDiscountPdf } from '../../lib/hooks/useDiscountPdf'
import './QRPass.css'

/**
 * Il pass dello sconto sbloccato: l'unico modo in cui il sito mostra un QR.
 *
 * Prima c'erano tre disegni per la stessa cosa — il popup del Bi Club con
 * il banner corallo e il QR piccolo, il popup della pagina del locale con
 * un titolo e un QR nudo, e il PDF — con badge di colori diversi e il
 * codice da dettare che finiva sotto il bordo dello schermo. Adesso i due
 * popup montano questo componente, e il PDF (api/discount-pdf.js) ne
 * ricopia la forma: intestazione del locale, strappo, QR, strappo, codice.
 *
 * Tre regole che il disegno tiene:
 * - il QR è la cosa più grande del foglio e si porta a tutto schermo con un
 *   tocco (su bianco pieno e a luminosità piena: è quello che serve alla
 *   fotocamera di chi lo legge, non uno sfondo sfocato);
 * - il codice a sei caratteri sta dentro il pass, nel "tagliando" sotto il
 *   QR, non in fondo alla pagina dove bisogna scorrere per trovarlo;
 * - il badge è verde come in tutto il sito (`--gradient-sconto`), mentre
 *   il tipo di sconto lo dice la pillola sotto il nome: corallo col
 *   countdown per i drop, oro "sempre valido" per le convenzioni — la stessa regola delle
 *   email (vedi CLAUDE.md, "il colore dice il tipo di sconto").
 */

/* ── QR in SVG ─────────────────────────────────────────────────────────── */
/* SVG e non canvas: resta nitido a qualsiasi misura (il pass e lo schermo
   pieno usano lo stesso disegno) e sui display retina il canvas a 170px
   usciva morbido — proprio quello che fa fallire la messa a fuoco. */
export function QRCodeSvg({ value, className = '' }) {
  const [svg, setSvg] = useState(null)
  useEffect(() => {
    if (!value) return undefined
    let alive = true
    QRCode.toString(value, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#22181C', light: '#FFFFFF' },
    })
      .then((out) => { if (alive) setSvg(out) })
      .catch(() => { if (alive) setSvg(null) })
    return () => { alive = false }
  }, [value])

  if (!svg) return <span className={`qrp-svg is-loading ${className}`} aria-hidden="true" />
  return (
    <span
      className={`qrp-svg ${className}`}
      aria-hidden="true"
      // Output di `qrcode`, non testo dell'utente: solo rect/path.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function compactCountdown(targetIso, now) {
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

/** Countdown del drop, aggiornato ogni 30s: sotto al minuto non serve. */
function useDropCountdown(deal) {
  const isDrop = !!deal?.is_drop
  const endIso = deal?.drop_ends_at || deal?.valid_until
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isDrop || !endIso) return undefined
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [isDrop, endIso])
  return isDrop ? compactCountdown(endIso, now) : null
}

/* ── Il pass ───────────────────────────────────────────────────────────── */
export default function QRPass({
  deal,
  qrValue,
  shortCode,
  restaurantName,
  subtitle,
  photoUrl,
}) {
  const [presenting, setPresenting] = useState(false)
  const badge = formatDiscountBadge(deal)
  const name = restaurantName || deal?.restaurant?.name || deal?.title || ''
  // Il titolo dello sconto solo se dice qualcosa in più del badge
  // ("-20%" / "20% sul totale" no, "Menu pranzo -20%" sì).
  const title = deal?.title?.trim()
  const perk = title && ![name, badge, formatDiscountValue(deal)].includes(title) ? title : null
  const isDrop = !!deal?.is_drop
  const cd = useDropCountdown(deal)
  const hasCode = isShortCode(shortCode)

  return (
    <>
      <article className={`qrp ${isDrop ? 'is-drop' : 'is-conv'}`} aria-label={`Sconto ${badge} da ${name}`}>
        <header className="qrp-head">
          <div className="qrp-thumb">
            {photoUrl
              ? <img src={photoUrl} alt="" loading="lazy" decoding="async" />
              : <span aria-hidden="true">{(name || 'B').charAt(0)}</span>}
          </div>
          <div className="qrp-id">
            <h3 className="qrp-name">{name}</h3>
            {subtitle && <div className="qrp-meta">{subtitle}</div>}
          </div>
          {badge && <span className="qrp-badge">{badge}</span>}
        </header>
        <div className="qrp-sub">
          <span className={`qrp-chip ${isDrop ? 'is-drop' : 'is-conv'}`}>
            {isDrop ? (cd ? `Scade tra ${cd}` : 'Drop live') : 'Sempre valido'}
          </span>
          {perk && <p className="qrp-perk">{perk}</p>}
        </div>

        <div className="qrp-tear" aria-hidden="true" />

        <div className="qrp-scan">
          <button
            type="button"
            className="qrp-code"
            onClick={() => qrValue && setPresenting(true)}
            disabled={!qrValue}
            aria-label="Mostra il QR a tutto schermo"
          >
            <span className="qrp-corners" aria-hidden="true"><i /><i /><i /><i /></span>
            {qrValue
              ? <QRCodeSvg value={qrValue} />
              : <span className="qrp-svg is-loading" aria-hidden="true" />}
          </button>
          <p className="qrp-instr">Mostralo al ristoratore</p>
          <button
            type="button"
            className="qrp-present-btn"
            onClick={() => setPresenting(true)}
            disabled={!qrValue}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
            Tutto schermo
          </button>
        </div>

        {hasCode && (
          <>
            <div className="qrp-tear" aria-hidden="true" />
            <div className="qrp-stub">
              <ShortCodeCard code={shortCode} divider={false} compact label="Non legge il QR? Detta il codice" />
              <p className="qrp-once">Codice valido una sola volta</p>
            </div>
          </>
        )}
        {!hasCode && <p className="qrp-once qrp-once-solo">Codice valido una sola volta</p>}
      </article>

      {presenting && qrValue && (
        <QRPresentMode
          qrValue={qrValue}
          shortCode={hasCode ? shortCode : null}
          name={name}
          badge={badge}
          onClose={() => setPresenting(false)}
        />
      )}
    </>
  )
}

/* ── La schermata intera ───────────────────────────────────────────────── */
/**
 * Testa, pass, info e bottoni: quello che si vede dopo "Sblocca sconto" in
 * tutti e due i popup (`DiscountDetailPopup` sul Bi Club,
 * `DiscountQuickPopup` sulla pagina del locale). Il contenitore — bottom
 * sheet o card centrata — resta del popup; da qui in giù è identico.
 *
 * Al posto del vecchio banner corallo a tutta larghezza (che ripeteva il
 * colore dei drop su qualunque sconto e si mangiava lo spazio del QR) una
 * testa leggera: spunta verde se è appena stato sbloccato, e dove ritrovarlo.
 * `children` è il contenuto di "Info sconto", chiuso di default.
 */
export function QRPassSheet({
  deal,
  redemption,
  restaurantName,
  subtitle,
  photoUrl,
  justUnlocked = false,
  onClose,
  children,
}) {
  const name = restaurantName || deal?.restaurant?.name || deal?.title || ''
  const qrValue = redemption?.qr_code
    ? `${window.location.origin}/verify?code=${redemption.qr_code}`
    : null
  const pdf = useDiscountPdf(redemption?.id, name)
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="qrp-sheet">
      <div className="qrp-sheet-head">
        <div className={`qrp-sheet-icon ${justUnlocked ? 'is-new' : ''}`} aria-hidden="true">
          {justUnlocked ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z" /><path d="M14 5v2M14 11v2M14 17v2" /></svg>
          )}
        </div>
        <div className="qrp-sheet-titles">
          <h2 className="qrp-sheet-title">{justUnlocked ? 'Sconto sbloccato' : 'Il tuo sconto'}</h2>
          <p className="qrp-sheet-sub">
            {justUnlocked ? 'Salvato in I miei vantaggi' : 'Da I miei vantaggi'}
          </p>
        </div>
        <button type="button" className="qrp-sheet-close" aria-label="Chiudi" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className="qrp-sheet-body">
        <QRPass
          deal={deal}
          qrValue={qrValue}
          shortCode={redemption?.short_code}
          restaurantName={name}
          subtitle={subtitle}
          photoUrl={photoUrl}
        />

        {children && (
          <>
            <button
              type="button"
              className={`qrp-more ${showInfo ? 'is-open' : ''}`}
              aria-expanded={showInfo}
              onClick={() => setShowInfo((v) => !v)}
            >
              {showInfo ? 'Nascondi info sconto' : 'Info sconto e condizioni'}
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {showInfo && <div className="qrp-more-panel">{children}</div>}
          </>
        )}
      </div>

      <div className="qrp-sheet-foot">
        {redemption?.id && (
          <button type="button" className="qrp-pdf-btn" onClick={pdf.download} disabled={pdf.busy}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" /></svg>
            {pdf.busy ? 'Genero…' : 'PDF'}
          </button>
        )}
        <button type="button" className="qrp-done-btn" onClick={onClose}>Fatto</button>
        {pdf.error && <p className="qrp-pdf-error" role="status">{pdf.error}</p>}
      </div>
    </div>
  )
}

/* ── Tutto schermo ─────────────────────────────────────────────────────── */
/* Bianco pieno e niente altro che il QR: la fotocamera del locale mette a
   fuoco prima un codice grande su fondo uniforme, e lo schermo del cliente
   al massimo della sua luminosità "vede" il bianco. Il codice a sei
   caratteri resta sotto, grande, per chi lo detta a voce.

   In un portal su <body>: i popup che lo aprono stanno dentro contenitori
   animati con `transform`, che rendono `position: fixed` relativo a loro
   invece che allo schermo. */
function QRPresentMode({ qrValue, shortCode, name, badge, onClose }) {
  useEffect(() => {
    // Fase di cattura + stopImmediatePropagation: Escape chiude solo lo
    // schermo pieno, non il popup sotto (che ascolta lo stesso `document`).
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)

    // Lo schermo non si spegne mentre il cameriere cerca il telefono.
    // Dove non è supportato (Safari < 16.4, webview) si va avanti senza.
    let lock = null
    let released = false
    navigator.wakeLock?.request?.('screen')
      .then((l) => {
        if (released) l.release().catch(() => {})
        else lock = l
      })
      .catch(() => {})

    return () => {
      document.removeEventListener('keydown', onKey, true)
      released = true
      lock?.release().catch(() => {})
    }
  }, [onClose])

  const code = normalizeShortCode(shortCode)

  return createPortal(
    <div
      className="qrp-present"
      role="dialog"
      aria-modal="true"
      aria-label="QR a tutto schermo"
      onClick={onClose}
    >
      <button type="button" className="qrp-present-close" aria-label="Chiudi" onClick={onClose}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <div className="qrp-present-top">
        {badge && <span className="qrp-badge">{badge}</span>}
        <span className="qrp-present-name">{name}</span>
      </div>

      <div className="qrp-present-code">
        <QRCodeSvg value={qrValue} />
      </div>

      {code && (
        <div className="qrp-present-short" aria-label={`Codice ${code.split('').join(' ')}`}>
          <span className="qrp-present-short-label">Codice</span>
          <span className="qrp-present-short-value">
            <b>{code.charAt(0)}</b>{formatShortCode(code).slice(1)}
          </span>
        </div>
      )}

      <p className="qrp-present-hint">Tocca per chiudere</p>
    </div>,
    document.body,
  )
}
