import { motion } from 'framer-motion'

/**
 * Button — primitivo v4 (audit design 2026-06).
 *
 * Sostituisce le vecchie primitive basate su #FF5757 (pre-v4, fuori brand,
 * importate da 0 file) e i ~432 bottoni stilati inline. Usa i token di brand
 * e — per il testo bianco — il corallo a contrasto AA (`--color-cta`), non il
 * corallo brillante che fallisce WCAG come fill testuale. Il focus da tastiera
 * è gestito globalmente da `:focus-visible` in globals.css.
 *
 * Varianti: primary (CTA corallo) · ink (CTA scuro) · ghost · soft · danger.
 * Dimensioni: sm · md · lg. Rendi come <a> con `as="a"` + href.
 */

const VARIANTS = {
  primary: { background: 'var(--color-cta)', color: '#fff', border: '1px solid transparent' },
  ink:     { background: 'var(--color-ink)', color: '#fff', border: '1px solid transparent' },
  ghost:   { background: 'transparent', color: 'var(--color-ink)', border: '1.5px solid var(--color-line)' },
  soft:    { background: 'var(--color-cream)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' },
  danger:  { background: 'var(--color-danger)', color: '#fff', border: '1px solid transparent' },
}

const SIZES = {
  sm: { padding: '8px 14px', fontSize: 'var(--fs-sm)' },
  md: { padding: '11px 18px', fontSize: 14 },
  lg: { padding: '14px 22px', fontSize: 'var(--fs-base)' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  as = 'button',
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  disabled = false,
  className = '',
  style,
  children,
  ...rest
}) {
  const Tag = as === 'a' ? motion.a : motion.button
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md

  return (
    <Tag
      className={className}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      aria-disabled={as === 'a' ? disabled || undefined : undefined}
      disabled={as === 'button' ? disabled : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        fontFamily: 'var(--font-sans)', fontWeight: 700, lineHeight: 1,
        borderRadius: 'var(--radius-pill)', cursor: disabled ? 'not-allowed' : 'pointer',
        textDecoration: 'none', whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? '100%' : undefined,
        ...v, ...s, ...style,
      }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </Tag>
  )
}
