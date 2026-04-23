/**
 * FGroup — field group card used inside drawer tabs.
 * White bg, rounded 16, subtle border + uppercase title with optional count.
 * Variant "corallo" → gradient peach background + corallo-soft border (used for
 * the PIN credentials box).
 */
export default function FGroup({ title, count, variant, children, footer }) {
  const isCorallo = variant === 'corallo'
  return (
    <div
      style={{
        background: isCorallo ? 'linear-gradient(135deg, #FFF1EF, #FCE4E1)' : '#fff',
        border: `1px solid ${isCorallo ? 'var(--color-corallo-soft, #F6B7B1)' : 'var(--color-line, #EAE3D7)'}`,
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
      }}
    >
      {title && (
        <h4
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 0 12px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isCorallo ? 'var(--color-corallo, #E8453C)' : 'var(--color-ink-55, rgba(34,24,28,0.55))',
          }}
        >
          {title}
          {count && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0,
                textTransform: 'none',
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              }}
            >
              {count}
            </span>
          )}
        </h4>
      )}
      {children}
      {footer && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px dashed ${isCorallo ? 'rgba(232,69,60,0.25)' : 'var(--color-line, #EAE3D7)'}`,
            fontSize: 11,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            fontWeight: 600,
            lineHeight: 1.55,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
