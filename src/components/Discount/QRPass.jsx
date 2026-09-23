import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import ShortCodeCard from './ShortCodeCard'
import { formatDiscountBadge, formatDiscountValue } from '../../lib/utils/discountFormat'
import { formatShortCode, isShortCode, normalizeShortCode } from '../../lib/shortCode'
import { useDiscountPdf } from '../../lib/hooks/useDiscountPdf'
import {
  effectiveValidDays,
  todayDayOfWeek,
  formatSlots,
  DAY_SHORT_LABELS,
} from '../../lib/validity'
import './QRPass.css'

/**
 * Lo sconto sbloccato: l'unico modo in cui il sito mostra un QR.
 *
 * Prima c'erano tre disegni per la stessa cosa — il popup del Bi Club con
 * il banner corallo e il QR piccolo, il popup della pagina del locale con
 * un titolo e un QR nudo, e il PDF — con badge di colori diversi e il
 * codice da dettare che finiva sotto il bordo dello schermo. Adesso i due
 * popup montano `QRPassSheet`, e il PDF (api/discount-pdf.js) ne ricopia
 * la forma.
 *
 * È la variante "A · Selettore" scelta il 22/09 fra quattro proposte:
 * - in testa il locale (foto, nome, riga sotto) e la X per chiudere;
 * - una card con badge e, in piccolo accanto, vantaggio, giorni e fascia in
 *   cui vale e la prima condizione (poi "Scade tra…" in corallo se è un
 *   drop); dentro la card un
 *   selettore "QR / Codice": le due strade per farsi riconoscere al banco
 *   stanno a un tocco l'una dall'altra, nello stesso riquadro, che non
 *   cambia altezza passando dall'una all'altra;
 * - sotto, due bottoni grandi uguali: "Info sconto" (pannello dal basso) e
 *   "Scarica PDF". Niente da cercare scorrendo.
 *
 * Il QR si tocca per portarlo a tutto schermo su bianco pieno (con lo
 * schermo tenuto acceso), che è quello che serve alla fotocamera del
 * locale. Il badge è verde come in tutto il sito (`--gradient-sconto`); il
 * corallo compare solo sui drop, col countdown — la stessa regola delle
 * email (vedi CLAUDE.md, "il colore dice il tipo di sconto"). Niente più
 * pillola "Sempre valido": al suo posto i giorni e la fascia in cui vale.
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

/* ── Icone ─────────────────────────────────────────────────────────────── */
const ICONS = {
  qr: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3" /></>,
  code: <path d="M9 4L7 20M17 4l-2 16M4 9h17M3 15h17" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></>,
  download: <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M20 6L9 17l-5-5" />,
}
function Icon({ name, size = 18, stroke = 2.2 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

/* ── Quando vale, in piccolo accanto al badge ──────────────────────────── */
/* I sette giorni come lettere (quelli buoni accesi, oggi sottolineato) e la
   fascia o l'orario. È la domanda che il cliente si fa al tavolo — "vale
   adesso?" — e prima la risposta stava solo dentro "Info sconto"; al suo
   posto c'era una pillola "Sempre valido" che non diceva quando. */
function ValidityLine({ deal }) {
  const days = effectiveValidDays(deal)
  const today = todayDayOfWeek()
  const allDays = days.length === 7
  const when = windowText(deal) || (allDays ? 'Tutti i giorni' : 'Tutto il giorno')
  const label = allDays
    ? `Valido tutti i giorni, ${when.toLowerCase()}`
    : `Valido ${days.map((d) => DAY_FULL[d - 1]).join(', ')}, ${when.toLowerCase()}`

  return (
    <p className="qrp-when" aria-label={label}>
      <span className="qrp-days" aria-hidden="true">
        {DAY_SHORT_LABELS.map((letter, i) => {
          const dow = i + 1
          return (
            <span
              key={dow}
              className={`qrp-day ${days.includes(dow) ? 'is-on' : ''} ${dow === today ? 'is-today' : ''}`}
            >
              {letter}
            </span>
          )
        })}
      </span>
      <span className="qrp-when-txt" aria-hidden="true">{when}</span>
    </p>
  )
}

const DAY_FULL = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

/** "19:00–23:00", "Pranzo · Cena", o null se lo sconto non guarda l'ora. */
function windowText(deal) {
  if (deal?.valid_time_from && deal?.valid_time_to) {
    return `${deal.valid_time_from.slice(0, 5)}–${deal.valid_time_to.slice(0, 5)}`
  }
  const slots = Array.isArray(deal?.valid_meal_slots) ? deal.valid_meal_slots : []
  return slots.length > 0 ? formatSlots(slots) : null
}

function splitConditions(conditions) {
  if (!conditions) return []
  return String(conditions)
    .split(/\n+|·|•|;/g)
    .map((t) => t.trim().replace(/^[-–—]\s*/, ''))
    .filter(Boolean)
}

/* ── La card: badge, selettore QR / Codice, riquadro ──────────────────── */
export default function QRPass({ deal, qrValue, shortCode, restaurantName }) {
  const hasCode = isShortCode(shortCode)
  const [mode, setMode] = useState('qr')
  const [presenting, setPresenting] = useState(false)
  const badge = formatDiscountBadge(deal)
  const name = restaurantName || deal?.restaurant?.name || deal?.title || ''
  // Il vantaggio in chiaro accanto al badge ("20% sul totale"); il titolo
  // dello sconto se dice qualcosa in più, se no il valore formattato.
  const title = deal?.title?.trim()
  const value = formatDiscountValue(deal)
  const perk = title && ![name, badge].includes(title) ? title : value
  const isDrop = !!deal?.is_drop
  const cd = useDropCountdown(deal)
  // La prima condizione ("Non cumulabile…"), su una riga: le altre sono in
  // "Info sconto". Stesso taglio di DiscountRules.
  const note = splitConditions(deal?.conditions)[0] || null
  const showCode = hasCode && mode === 'code'

  return (
    <>
      <article className="qrp" aria-label={`Sconto ${badge} da ${name}`}>
        <div className="qrp-top">
          {badge && <span className="qrp-badge">{badge}</span>}
          <div className="qrp-top-txt">
            {perk && perk !== badge && <p className="qrp-perk">{perk}</p>}
            <ValidityLine deal={deal} />
            {note && <p className="qrp-note">{note}</p>}
            {isDrop && (
              <p className="qrp-drop">{cd ? `Scade tra ${cd}` : 'Drop live'}</p>
            )}
          </div>
        </div>

        {hasCode && (
          <div className="qrp-seg" role="tablist" aria-label="Come mostrarlo al ristoratore">
            <button
              type="button"
              role="tab"
              aria-selected={!showCode}
              className={`qrp-seg-btn ${!showCode ? 'is-on' : ''}`}
              onClick={() => setMode('qr')}
            >
              <Icon name="qr" size={17} />QR
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showCode}
              className={`qrp-seg-btn ${showCode ? 'is-on' : ''}`}
              onClick={() => setMode('code')}
            >
              <Icon name="code" size={17} />Codice
            </button>
          </div>
        )}

        {/* Stessa altezza per QR e codice: passando dall'uno all'altro non
            salta niente sotto, i bottoni restano dove il pollice li aspetta. */}
        <div className="qrp-stage" role="tabpanel">
          {showCode ? (
            <div className="qrp-stage-in" key="code">
              <ShortCodeCard code={shortCode} divider={false} />
            </div>
          ) : (
            <div className="qrp-stage-in" key="qr">
              <button
                type="button"
                className="qrp-code"
                onClick={() => qrValue && setPresenting(true)}
                disabled={!qrValue}
                aria-label="Ingrandisci il QR"
              >
                <span className="qrp-corners" aria-hidden="true"><i /><i /><i /><i /></span>
                {qrValue
                  ? <QRCodeSvg value={qrValue} />
                  : <span className="qrp-svg is-loading" aria-hidden="true" />}
              </button>
              <p className="qrp-instr">Fallo inquadrare al ristoratore</p>
              <p className="qrp-hint">Tocca il QR per ingrandirlo</p>
            </div>
          )}
        </div>
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
 * Quello che si vede dopo "Sblocca sconto" in tutti e due i popup
 * (`DiscountDetailPopup` sul Bi Club, `DiscountQuickPopup` sulla pagina del
 * locale). Il contenitore — bottom sheet o card centrata — resta del popup;
 * da qui in giù è identico. `children` è il contenuto di "Info sconto".
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
        <div className="qrp-thumb">
          {photoUrl
            ? <img src={photoUrl} alt="" loading="lazy" decoding="async" />
            : <span aria-hidden="true">{(name || 'B').charAt(0)}</span>}
        </div>
        <div className="qrp-sheet-titles">
          <h2 className="qrp-sheet-title">{name}</h2>
          {subtitle && <p className="qrp-sheet-sub">{subtitle}</p>}
        </div>
        <button type="button" className="qrp-sheet-close" aria-label="Chiudi" onClick={onClose}>
          <Icon name="close" size={16} stroke={2.4} />
        </button>
      </div>

      <div className="qrp-sheet-body">
        <QRPass
          deal={deal}
          qrValue={qrValue}
          shortCode={redemption?.short_code}
          restaurantName={name}
        />

        <p className={`qrp-once ${justUnlocked ? 'is-new' : ''}`}>
          {justUnlocked && <span className="qrp-once-ok" aria-hidden="true"><Icon name="check" size={11} stroke={3.4} /></span>}
          {justUnlocked ? 'Sbloccato e salvato in I miei vantaggi' : 'Valido una sola volta · in I miei vantaggi'}
        </p>

        <div className="qrp-actions">
          {children && (
            <button type="button" className="qrp-action" onClick={() => setShowInfo(true)}>
              <Icon name="info" size={19} />Info sconto
            </button>
          )}
          {redemption?.id && (
            <button type="button" className="qrp-action" onClick={pdf.download} disabled={pdf.busy}>
              <Icon name="download" size={19} />{pdf.busy ? 'Preparo il PDF…' : 'Scarica PDF'}
            </button>
          )}
        </div>
        {pdf.error && <p className="qrp-pdf-error" role="status">{pdf.error}</p>}
      </div>

      {showInfo && children && (
        <QRInfoDrawer onClose={() => setShowInfo(false)}>{children}</QRInfoDrawer>
      )}
    </div>
  )
}

/* ── Info sconto: pannello dal basso ───────────────────────────────────── */
/* Sopra a tutto (portal su <body>, come lo schermo pieno): chi apre le info
   le legge e torna al QR con un tocco fuori o sulla X, senza perdere il
   punto in cui era. */
function QRInfoDrawer({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className="qrp-drawer-wrap" role="dialog" aria-modal="true" aria-label="Info sconto">
      <button type="button" className="qrp-drawer-scrim" aria-label="Chiudi info" onClick={onClose} />
      <div className="qrp-drawer">
        <div className="qrp-drawer-grip" aria-hidden="true" />
        <div className="qrp-drawer-head">
          <h3>Info sconto</h3>
          <button type="button" className="qrp-sheet-close" aria-label="Chiudi" onClick={onClose}>
            <Icon name="close" size={16} stroke={2.4} />
          </button>
        </div>
        <div className="qrp-drawer-body">{children}</div>
      </div>
    </div>,
    document.body,
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
