/**
 * Badge — primitivo v4 (audit design 2026-06).
 *
 * `tone` usa i token di brand con coppie a contrasto adeguato. Il vecchio prop
 * `color` (colore libero, reso a 20% di sfondo) resta supportato per non
 * rompere eventuali chiamate esistenti, ma per il nuovo codice preferire `tone`.
 */

const TONES = {
  neutral: { bg: 'var(--color-cream)', fg: 'var(--color-ink)' },
  corallo: { bg: 'var(--color-corallo-wash)', fg: 'var(--color-corallo-ink)' },
  ink:     { bg: 'var(--color-ink)', fg: '#fff' },
  ok:      { bg: 'var(--color-ok-bg)', fg: 'var(--color-ok)' },
  warn:    { bg: 'var(--color-warn-bg)', fg: 'var(--color-warn)' },
  danger:  { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger)' },
}

export default function Badge({
  children,
  tone = 'neutral',
  color = null, // legacy: colore libero
  size = 'md',
  className = '',
  style,
}) {
  const t = TONES[tone] || TONES.neutral
  const bg = color ? `${color}20` : t.bg
  const fg = color || t.fg
  const pad = size === 'sm' ? '2px 8px' : '3px 10px'
  const fs = size === 'sm' ? 'var(--fs-xs)' : 12

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: pad, borderRadius: 'var(--radius-pill)',
        fontSize: fs, fontWeight: 700, lineHeight: 1.3,
        background: bg, color: fg,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
