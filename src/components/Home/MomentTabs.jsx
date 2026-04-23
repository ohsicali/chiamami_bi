import { MOMENT_KEYS, MOMENT_SLOTS } from '../../lib/hours'

/**
 * MomentTabs · 5 pill in scroll orizzontale (mobile) o wrap inline (desktop via CSS).
 * Ink pieno per active, grigio per inactive — coerente con navbar.
 */
export default function MomentTabs({ activeKey, onChange, className = '' }) {
  return (
    <div
      className={`hfv4-moment-tabs ${className}`}
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
            onClick={() => onChange?.(key)}
            className="hfv4-moment-tab"
            style={{
              flex: '0 0 auto',
              minWidth: 76,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 10px',
              borderRadius: 14,
              background: active ? 'var(--color-ink)' : 'var(--color-ink-05)',
              color: active ? '#fff' : 'var(--color-ink)',
              boxShadow: active ? '0 8px 18px rgba(34,24,28,.18)' : 'none',
              border: '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{slot.emoji}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                color: active ? 'rgba(255,255,255,.85)' : 'var(--color-ink-70)',
              }}
            >
              {slot.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
