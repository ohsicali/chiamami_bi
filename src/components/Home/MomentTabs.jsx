import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { MOMENT_KEYS, MOMENT_SLOTS } from '../../lib/hours'

/**
 * MomentTabs · 5 pill in scroll orizzontale (mobile) o wrap inline (desktop via CSS).
 *
 * ── Perché due copie della stessa fila ──────────────────────────────
 * Il primo tentativo faceva scivolare la pill scura con `layoutId` e
 * cambiava il colore del testo con una transizione CSS. Sono due sistemi
 * diversi — una molla JS e una transizione CSS — e non arrivano insieme.
 * Misurato: per ~150ms dopo il tap l'etichetta era già bianca mentre la
 * pill scura non era ancora sotto, cioè testo bianco su fondo chiaro,
 * illeggibile; e specularmente la vecchia diventava scura mentre la pill
 * era ancora sopra di lei.
 *
 * Qui il colore non si anima affatto. Ci sono due file sovrapposte:
 * quella sotto è tutta in versione "spenta", quella sopra è tutta in
 * versione "accesa" (pill scura, testo bianco) e viene RITAGLIATA con
 * clip-path sul solo riquadro della fascia attiva. Muovendo il ritaglio
 * si muove la pill, e il testo bianco esiste solo dentro il ritaglio:
 * il colore è legato alla geometria, non al tempo, quindi non può
 * desincronizzarsi per costruzione.
 *
 * La fila di sopra è aria-hidden e non riceve il puntatore: per lo
 * screen reader e per la tastiera esistono solo i bottoni veri di sotto.
 */
export default function MomentTabs({ activeKey, onChange, className = '' }) {
  const reduce = useReducedMotion()
  const trackRef = useRef(null)
  const btnRefs = useRef([])
  const [clip, setClip] = useState(null)

  const measure = useCallback(() => {
    const track = trackRef.current
    const idx = MOMENT_KEYS.indexOf(activeKey)
    const el = btnRefs.current[idx]
    if (!track || !el) return
    const t = track.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setClip({
      top: b.top - t.top,
      right: t.right - b.right,
      bottom: t.bottom - b.bottom,
      left: b.left - t.left,
    })
  }, [activeKey])

  useLayoutEffect(() => { measure() }, [measure])

  // Il riquadro cambia quando la fila va a capo (desktop), quando il
  // font finisce di caricare o quando si ruota il telefono.
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    btnRefs.current.forEach((el) => el && ro.observe(el))
    return () => ro.disconnect()
  }, [measure])

  const clipPath = clip
    ? `inset(${clip.top}px ${clip.right}px ${clip.bottom}px ${clip.left}px round var(--mt-radius, 14px))`
    // Prima della misura il livello acceso è completamente ritagliato via:
    // si vede solo la fila spenta, mai una pill nel posto sbagliato.
    : 'inset(0 100% 0 0 round var(--mt-radius, 14px))'

  // Il ritaglio si SPOSTA sullo schermo → ease-in-out (non ease-out, che
  // è per chi entra o esce). 220ms: sotto i 300 del budget UI.
  const clipTransition = reduce
    ? 'none'
    : 'clip-path var(--dur-menu) var(--ease-in-out)'

  const tabStyle = {
    position: 'relative',
    flex: '0 0 auto',
    minWidth: 76,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '12px 10px',
    borderRadius: 14,
    border: '1px solid transparent',
    // Esplicito su entrambi i livelli: il default font-family di <button>
    // non è quello del body, e le due file devono misurare identiche.
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }
  const emojiStyle = { fontSize: 22, lineHeight: 1 }
  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      className={`hfv4-moment-tabs-scroll ${className}`}
      style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '18px 20px 16px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      <div ref={trackRef} className="hfv4-moment-tabs mt-row" style={{ position: 'relative', display: 'flex', gap: 8 }}>
        {/* Livello 1 — la fila spenta. Sono questi i bottoni veri. */}
        {MOMENT_KEYS.map((key, i) => {
          const slot = MOMENT_SLOTS[key]
          return (
            <button
              key={key}
              ref={(el) => { btnRefs.current[i] = el }}
              type="button"
              role="tab"
              aria-selected={key === activeKey}
              onClick={() => onChange?.(key)}
              className="hfv4-moment-tab press"
              style={{
                ...tabStyle,
                background: 'var(--color-ink-05)',
                color: 'var(--color-ink)',
                cursor: 'pointer',
              }}
            >
              <span style={emojiStyle}>{slot.emoji}</span>
              <span style={{ ...labelStyle, color: 'var(--color-ink-70)' }}>{slot.label}</span>
            </button>
          )
        })}

        {/* Livello 2 — la stessa fila accesa, ritagliata sulla sola
            fascia attiva. <span> e non <button>: niente doppioni per la
            tastiera e per lo screen reader. */}
        <div
          aria-hidden="true"
          className="mt-row mt-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            gap: 8,
            pointerEvents: 'none',
            clipPath,
            WebkitClipPath: clipPath,
            transition: clipTransition,
          }}
        >
          {MOMENT_KEYS.map((key) => {
            const slot = MOMENT_SLOTS[key]
            return (
              <span
                key={key}
                className="hfv4-moment-tab"
                style={{
                  ...tabStyle,
                  background: 'var(--color-ink)',
                  color: '#fff',
                  boxShadow: '0 8px 18px rgba(34,24,28,.18)',
                }}
              >
                <span style={emojiStyle}>{slot.emoji}</span>
                <span style={{ ...labelStyle, color: 'rgba(255,255,255,.85)' }}>{slot.label}</span>
              </span>
            )
          })}
        </div>
      </div>
      <span className="hfv4-scroll-spacer" aria-hidden="true" />
    </div>
  )
}
