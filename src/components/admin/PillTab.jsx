/**
 * PillTab — rounded toggle pill used in admin filter rows.
 * Used on the Ristoranti list (PR15b) and Sconti/Candidature (PR15d).
 *
 * Two styles:
 *   - default: cream border, ink text
 *   - active  (prop `active`): ink background, white text
 *
 * Props:
 *   active    → boolean
 *   onClick   → fn
 *   count     → optional numeric badge at end
 *   children  → label content
 */
export default function PillTab({ active = false, onClick, count, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? 'var(--color-ink, #22181C)' : '#fff',
        color: active ? '#fff' : 'var(--color-ink, #22181C)',
        border: `1px solid ${active ? 'var(--color-ink, #22181C)' : 'var(--color-line, #EAE3D7)'}`,
        borderRadius: 999,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans)',
        transition: 'background 0.15s, color 0.15s',
      }}
      {...rest}
    >
      {children}
      {count != null && count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: 10,
            background: active ? 'rgba(255,255,255,0.2)' : 'var(--color-cream-deep, #F1EBE0)',
            color: active ? '#fff' : 'var(--color-ink, #22181C)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
