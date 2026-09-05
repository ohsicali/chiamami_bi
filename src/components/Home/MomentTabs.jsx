import { motion, useReducedMotion } from 'framer-motion'
import { MOMENT_KEYS, MOMENT_SLOTS } from '../../lib/hours'
import { SPRING_SNAP, TR_MENU } from '../../lib/motion'

/**
 * MomentTabs · 5 pill in scroll orizzontale (mobile) o wrap inline (desktop via CSS).
 * Ink pieno per active, grigio per inactive — coerente con navbar.
 *
 * Movimento: la pill scura non appare e sparisce, SCIVOLA da una fascia
 * all'altra (`layoutId`). È l'unico modo per far vedere che le cinque pill
 * sono un solo selettore e non cinque bottoni indipendenti — e mostra da
 * dove sei arrivato quando la riga è scrollata e la scelta precedente è
 * mezza fuori schermo. L'indicatore sta in un livello sotto al contenuto,
 * così il testo non viene ridisegnato dall'animazione di layout.
 */
export default function MomentTabs({ activeKey, onChange, className = '' }) {
  const reduce = useReducedMotion()

  return (
    <div
      className={`hfv4-moment-tabs ${className}`}
      role="tablist"
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '18px 20px 16px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {MOMENT_KEYS.map((key) => {
        const slot = MOMENT_SLOTS[key]
        const active = key === activeKey
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(key)}
            className="hfv4-moment-tab press"
            style={{
              position: 'relative',
              flex: '0 0 auto',
              minWidth: 76,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 10px',
              borderRadius: 14,
              background: active ? 'transparent' : 'var(--color-ink-05)',
              color: active ? '#fff' : 'var(--color-ink)',
              border: '1px solid transparent',
              cursor: 'pointer',
              // Il colore del testo si accende/spegne mentre la pill scura
              // scivola sotto: stessa durata, così arrivano insieme.
              transition: `color var(--dur-menu) var(--ease-out)`,
            }}
          >
            {active && (
              <motion.span
                layoutId={reduce ? undefined : 'moment-tab-indicator'}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 14,
                  background: 'var(--color-ink)',
                  boxShadow: '0 8px 18px rgba(34,24,28,.18)',
                  zIndex: 0,
                }}
                transition={reduce ? { duration: TR_MENU.duration } : SPRING_SNAP}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, fontSize: 22, lineHeight: 1 }}>
              {slot.emoji}
            </span>
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                color: active ? 'rgba(255,255,255,.85)' : 'var(--color-ink-70)',
                transition: 'color var(--dur-menu) var(--ease-out)',
              }}
            >
              {slot.label}
            </span>
          </button>
        )
      })}
      <span className="hfv4-scroll-spacer" aria-hidden="true" />
    </div>
  )
}
