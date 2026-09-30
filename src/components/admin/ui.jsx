import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './admin-ui.css'

/*
 * I pezzi del kit grafico del pannello (stili in admin-ui.css).
 * Piccoli apposta: niente logica, solo il disegno comune, così una pagina
 * che li usa si legge per quello che fa e non per come si colora.
 */

/** Etichetta + campo + riga d'aiuto. */
export function Field({ label, hint, help, htmlFor, children, style }) {
  return (
    <div className="adm-field" style={style}>
      {label && (
        <label className="adm-label" htmlFor={htmlFor}>
          <span>{label}</span>
          {hint && <small>{hint}</small>}
        </label>
      )}
      {children}
      {help && <p className="adm-help">{help}</p>}
    </div>
  )
}

/** Card bianca con titolo, icona e riga d'aiuto facoltativi. */
export function Card({ title, hint, icon, iconBg, tone, id, children, style, aside }) {
  const cls = ['adm-card', tone === 'cream' ? 'adm-card--cream' : '', tone === 'flat' ? 'adm-card--flat' : ''].filter(Boolean).join(' ')
  return (
    <section className={cls} id={id} style={style}>
      {(title || icon) && (
        <div className="adm-card__head">
          {icon && <span className="adm-card__icon" style={iconBg ? { background: iconBg } : undefined} aria-hidden>{icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <h3 className="adm-card__title">{title}</h3>}
            {hint && <p className="adm-card__hint">{hint}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Riga con interruttore: tutta la riga si tocca. `children` compare sotto
 * solo quando è accesa (es. la data dell'uscita programmata).
 */
export function ToggleRow({ icon, title, text, checked, onChange, disabled, children }) {
  const cls = ['adm-toggle-row', checked ? 'is-on' : '', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls} style={children && checked ? { flexWrap: 'wrap' } : undefined}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {icon && <span className="adm-toggle-row__icon" aria-hidden>{icon}</span>}
        <span className="adm-toggle-row__text">
          <b>{title}</b>
          {text && <span>{text}</span>}
        </span>
        <span className="adm-switch">
          <input
            type="checkbox"
            role="switch"
            checked={!!checked}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.checked)}
          />
          <span />
        </span>
      </label>
      {children && checked && <div className="adm-toggle-row__extra" style={{ width: '100%' }}>{children}</div>}
    </div>
  )
}

/** Gruppo di scelte grandi (radio). `options`: [{ id, emoji, title, hint, variant }] */
export function Choices({ options, value, onChange, cols = 3, colsSm = 1, label }) {
  return (
    <div className="adm-choices" role="radiogroup" aria-label={label} style={{ '--cols': cols, '--cols-sm': colsSm }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`adm-choice${o.variant ? ` adm-choice--${o.variant}` : ''}`}
          onClick={() => onChange(o.id)}
          disabled={o.disabled}
        >
          <span className="adm-choice__check" aria-hidden>✓</span>
          {o.emoji && <span className="adm-choice__emoji" aria-hidden>{o.emoji}</span>}
          <span className="adm-choice__title">{o.title}</span>
          {o.hint && <span className="adm-choice__hint">{o.hint}</span>}
        </button>
      ))}
    </div>
  )
}

/** Anello di completamento ("4/6"). */
export function Ring({ done, total, size = 52, stroke = 5 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  const color = pct >= 1 ? 'var(--adm-ok)' : 'var(--adm-coral)'
  return (
    <div className="adm-ring" style={{ width: size, height: size }} aria-label={`${done} su ${total}`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--adm-cream-deep)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 480ms var(--adm-ease)' }}
        />
      </svg>
      <b>{pct >= 1 ? '✓' : `${done}/${total}`}</b>
    </div>
  )
}

/** Passi numerati in cima a un percorso guidato. */
export function Steps({ steps, current }) {
  return (
    <ol className="adm-steps">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span>{i < current ? '✓' : i + 1}</span>
          <em>{s}</em>
        </li>
      ))}
    </ol>
  )
}

/** Avviso che scende dall'alto e sparisce da solo. */
export function Toast({ toast, onDone, ms = 2600 }) {
  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => onDone?.(), toast.kind === 'err' ? Math.max(ms, 4200) : ms)
    return () => clearTimeout(id)
  }, [toast, onDone, ms])
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.text}
          role="status"
          className={`adm-toast${toast.kind === 'err' ? ' adm-toast--err' : ''}`}
          initial={{ opacity: 0, y: -16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -16, x: '-50%' }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Foglio dal basso (telefono) / finestra al centro (computer). */
export function Sheet({ open, onClose, title, children, labelledBy = 'adm-sheet-title' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="adm adm-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="adm-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="adm-sheet__grip" aria-hidden />
            {title && <h2 className="adm-sheet__title" id={labelledBy}>{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
