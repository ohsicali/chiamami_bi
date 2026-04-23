/**
 * Lightweight field primitives used inside the 6 drawer tabs.
 * FRow: 2-column grid (or 1 column if prop `one` is set).
 * FField: label + control wrapper.
 * FInput / FTextarea / FSelect: styled form controls with consistent look.
 */

export function FRow({ one, style, children }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: one ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function FField({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      {label && (
        <label
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </label>
      )}
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontWeight: 500 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const controlStyle = {
  border: '1px solid var(--color-line, #EAE3D7)',
  borderRadius: 10,
  padding: '10px 12px',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-ink, #22181C)',
  background: '#fff',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border 0.15s, box-shadow 0.15s',
}

export function FInput({ value, onChange, onBlur, maxLength, placeholder, type = 'text', readOnly, style }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={(e) => {
        e.target.style.borderColor = 'var(--color-line, #EAE3D7)'
        e.target.style.boxShadow = 'none'
        onBlur?.(e)
      }}
      maxLength={maxLength}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{ ...controlStyle, ...(readOnly ? { background: 'var(--color-cream, #F5F0E4)', cursor: 'default' } : {}), ...style }}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--color-corallo, #E8453C)'
        e.target.style.boxShadow = '0 0 0 3px rgba(244,181,176,0.35)'
      }}
    />
  )
}

export function FTextarea({ value, onChange, onBlur, rows = 4, placeholder, maxLength }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={(e) => {
        e.target.style.borderColor = 'var(--color-line, #EAE3D7)'
        e.target.style.boxShadow = 'none'
        onBlur?.(e)
      }}
      rows={rows}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{ ...controlStyle, resize: 'vertical', minHeight: 80, fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--color-corallo, #E8453C)'
        e.target.style.boxShadow = '0 0 0 3px rgba(244,181,176,0.35)'
      }}
    />
  )
}

export function FSelect({ value, onChange, children }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        ...controlStyle,
        appearance: 'none',
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='%2322181C' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: 32,
        cursor: 'pointer',
      }}
    >
      {children}
    </select>
  )
}

export function CharCounter({ value, max, warnAt }) {
  const len = (value || '').length
  const warn = warnAt ?? max
  const over = max && len > max
  const near = !over && warn && len > warn * 0.9
  const color = over ? 'var(--color-danger, #C0392B)' : near ? 'var(--color-oro, #B08954)' : 'var(--color-ink-55, rgba(34,24,28,0.55))'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color }}>
      {len}{max ? ` / ${max}` : ''}
    </span>
  )
}
