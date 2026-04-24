// CategoryBubble — bubble rotondo per la griglia categorie del filter sheet (mockup v4).
//
// Grid 4-col del filter sheet. Bubble 64×64 con emoji centrata + label sotto.
// Stato on → bg corallo + shadow, label colore corallo-ink.
//
// Props:
//   emoji    — string (es. '🍝')
//   label    — string (es. 'Italiana')
//   on       — boolean
//   onClick
export default function CategoryBubble({ emoji, label, on = false, onClick, ariaPressed, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed ?? on}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        color: 'inherit',
      }}
      {...rest}
    >
      <span style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 28,
        lineHeight: 1,
        transition: 'all .15s ease',
        background: on ? 'var(--color-corallo, #E8453C)' : 'var(--color-white, #FFFFFF)',
        border: '1.5px solid ' + (on ? 'var(--color-corallo, #E8453C)' : 'rgba(34,24,28,0.12)'),
        boxShadow: on
          ? '0 6px 16px rgba(232,69,60,0.4)'
          : '0 1px 2px rgba(34,24,28,.04), 0 4px 12px rgba(34,24,28,.04)',
        color: on ? '#fff' : 'inherit',
      }}>
        {emoji}
      </span>
      <span style={{
        fontSize: 11.5,
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.15,
        maxWidth: 72,
        color: on ? 'var(--color-corallo-ink, #C6372F)' : 'var(--color-ink, #22181C)',
      }}>
        {label}
      </span>
    </button>
  )
}
