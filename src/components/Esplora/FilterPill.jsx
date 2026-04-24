// FilterPill — pill filtro per la pagina Esplora (mockup v4).
//
// Varianti:
//   default         : white bg, ink-15 border, ink text
//   on              : come default ma fontWeight 800 (usato per pill "on" senza highlight corallo)
//   active-highlight: bg corallo-wash + border corallo + text corallo-ink (es. Sconti attivo)
//
// Props:
//   icon     — ReactNode opzionale (SVG 15×15, currentColor)
//   children — label
//   badge    — numero opzionale (conteggio filtri attivi) → pill corallo
//   chevron  — boolean, mostra ▾ alla fine
//   variant  — 'default' | 'on' | 'active-highlight'
//   onClick, as — render as <button> (default) o <a>
export default function FilterPill({
  icon,
  children,
  badge,
  chevron = false,
  variant = 'default',
  onClick,
  as = 'button',
  ariaPressed,
  className,
  style,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: variant === 'on' ? 800 : 700,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    cursor: 'pointer',
    border: '1.5px solid',
    WebkitTapHighlightColor: 'transparent',
    flex: '0 0 auto',
    background: 'var(--color-white, #FFFFFF)',
    color: 'var(--color-ink, #22181C)',
    borderColor: 'rgba(34,24,28,0.12)',
  }
  if (variant === 'on') {
    // mockup .fp.on: border-color ink opaco, color ink, bg white, font-weight 800
    base.borderColor = 'var(--color-ink, #22181C)'
  }
  if (variant === 'active-highlight') {
    base.background = 'var(--color-corallo-wash, #FDF2F0)'
    base.borderColor = 'var(--color-corallo, #E8453C)'
    base.color = 'var(--color-corallo-ink, #C6372F)'
  }

  const Tag = as
  return (
    <Tag
      onClick={onClick}
      aria-pressed={ariaPressed}
      className={className}
      style={{ ...base, ...style }}
      {...rest}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center', color: 'currentColor' }}>{icon}</span>}
      <span>{children}</span>
      {badge != null && badge !== 0 && (
        <span style={{
          background: 'var(--color-corallo, #E8453C)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 800,
          padding: '2px 6px',
          borderRadius: 999,
          minWidth: 18,
          textAlign: 'center',
          marginLeft: -2,
        }}>{badge}</span>
      )}
      {chevron && (
        <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
      )}
    </Tag>
  )
}
