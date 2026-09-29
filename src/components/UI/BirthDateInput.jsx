import { useMemo } from 'react'
import { MONTHS, daysInMonth, selectableYears } from '../../lib/birthDate'

/**
 * Data di nascita come tre scelte — giorno, mese, anno — invece del
 * calendario nativo: su Android il calendario si apre sul mese di oggi, e
 * arrivare al 1994 voleva dire decine di tocchi all'indietro.
 *
 * `value` e `onChange` lavorano su { day, month, year } (stringhe, '' se non
 * scelto): la conversione in 'YYYY-MM-DD' e i controlli stanno in
 * src/lib/birthDate.js, così li usa uguali chi monta questo campo.
 */
const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2322181C' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"

const selectStyle = {
  width: '100%',
  minWidth: 0,
  background: 'var(--color-card)',
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  border: '1.5px solid var(--color-ink-15)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px 28px 14px 12px',
  fontSize: 14.5,
  color: 'var(--color-ink)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
}

export default function BirthDateInput({ value, onChange, invalid = false, idPrefix = 'birth', style }) {
  const years = useMemo(() => selectableYears(), [])
  const maxDay = daysInMonth(Number(value.month) || 0, Number(value.year) || 0)
  const set = (key) => (e) => {
    const next = { ...value, [key]: e.target.value }
    // Da 31 marzo a febbraio: il giorno che non esiste più si svuota, invece
    // di diventare una data impossibile che il modulo poi rifiuta.
    const cap = daysInMonth(Number(next.month) || 0, Number(next.year) || 0)
    if (next.day && Number(next.day) > cap) next.day = ''
    onChange(next)
  }
  const border = invalid ? { borderColor: 'var(--color-corallo)' } : null
  const muted = (v) => (v ? null : { color: 'var(--color-ink-55)' })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 8, ...style }}>
      <select
        id={`${idPrefix}-day`}
        aria-label="Giorno di nascita"
        autoComplete="bday-day"
        value={value.day}
        onChange={set('day')}
        style={{ ...selectStyle, ...border, ...muted(value.day) }}
      >
        <option value="">Giorno</option>
        {Array.from({ length: maxDay }, (_, i) => (
          <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
        ))}
      </select>
      <select
        id={`${idPrefix}-month`}
        aria-label="Mese di nascita"
        autoComplete="bday-month"
        value={value.month}
        onChange={set('month')}
        style={{ ...selectStyle, ...border, ...muted(value.month) }}
      >
        <option value="">Mese</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1)}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
        ))}
      </select>
      <select
        id={`${idPrefix}-year`}
        aria-label="Anno di nascita"
        autoComplete="bday-year"
        value={value.year}
        onChange={set('year')}
        style={{ ...selectStyle, ...border, ...muted(value.year) }}
      >
        <option value="">Anno</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  )
}
