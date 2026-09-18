import { useEffect, useRef, useState } from 'react'
import {
  SHORT_CODE_LENGTH,
  isValidShortCodeChar,
} from '../../lib/shortCode'
import './ShortCodeInput.css'

/**
 * Le sei caselle in cui il ristoratore digita il codice del cliente.
 *
 * Sei input separati e non uno solo: la prima casella apre la tastiera
 * alfabetica (è una lettera), le altre cinque il tastierino numerico. Con
 * un campo unico il locale si trova a cercare i numeri dentro la tastiera
 * delle lettere per cinque caratteri su sei, che al bancone con la fila
 * davanti è esattamente il tipo di attrito che questo codice doveva
 * togliere.
 *
 * Il resto è quello che ci si aspetta da un campo del genere: avanza da
 * solo, il backspace su una casella vuota torna indietro, incollare il
 * codice intero lo distribuisce, e quando è pieno parte la verifica senza
 * dover premere niente.
 *
 * `value` è la stringa a sei posizioni, con lo spazio per le caselle
 * ancora vuote (`"K4 213"`): serve a tenere il buco dov'è quando si
 * cancella una casella in mezzo, invece di far scalare a sinistra tutto
 * quello che viene dopo. `onComplete` riceve il codice pulito.
 */

const EMPTY = ' '

/** Dalla stringa alle sei caselle, scartando quello che non può starci. */
function toSlots(value) {
  const src = String(value || '').toUpperCase().slice(0, SHORT_CODE_LENGTH).split('')
  const slots = []
  for (let i = 0; i < SHORT_CODE_LENGTH; i += 1) {
    const c = src[i]
    slots.push(isValidShortCodeChar(c, i) ? c : EMPTY)
  }
  return slots
}

/** Dalle caselle alla stringa: i buchi in mezzo restano, la coda vuota no. */
function fromSlots(slots) {
  return slots.join('').replace(/\s+$/, '')
}

function isFull(slots) {
  return slots.every((c) => c !== EMPTY)
}

export default function ShortCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = true,
}) {
  const refs = useRef([])
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const slots = toSlots(value)

  useEffect(() => {
    if (!autoFocus || disabled) return undefined
    // Il ritardo lascia finire l'animazione di apertura: senza, su iOS la
    // tastiera sale mentre il pannello scorre e il campo finisce fuori
    // schermo.
    const id = setTimeout(() => refs.current[0]?.focus(), 120)
    return () => clearTimeout(id)
  }, [autoFocus, disabled])

  const focusCell = (i) => {
    const target = refs.current[Math.max(0, Math.min(SHORT_CODE_LENGTH - 1, i))]
    target?.focus()
    target?.select?.()
  }

  const commit = (nextSlots) => {
    onChange?.(fromSlots(nextSlots))
    if (isFull(nextSlots)) onComplete?.(nextSlots.join(''))
  }

  /** Scrive `text` a partire dalla casella `idx`, saltando i caratteri che
   *  in quella posizione non sono ammessi. Ritorna dove si è fermata. */
  const writeFrom = (idx, text) => {
    const next = [...slots]
    let pos = idx
    for (const raw of String(text).toUpperCase().replace(/[^A-Z0-9]/g, '')) {
      if (pos >= SHORT_CODE_LENGTH) break
      if (!isValidShortCodeChar(raw, pos)) {
        // Un codice incollato che parte con la lettera va bene anche se la
        // casella corrente è una cifra; il carattere sbagliato per questa
        // posizione lo lasciamo perdere e basta.
        continue
      }
      next[pos] = raw
      pos += 1
    }
    commit(next)
    return pos
  }

  const handleChange = (idx, raw) => {
    if (disabled) return
    const typed = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!typed) return
    const landed = writeFrom(idx, typed)
    if (landed > idx) focusCell(landed)
  }

  const handleKeyDown = (idx, e) => {
    if (disabled) return
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...slots]
      if (next[idx] !== EMPTY) {
        next[idx] = EMPTY
        commit(next)
      } else if (idx > 0) {
        next[idx - 1] = EMPTY
        commit(next)
        focusCell(idx - 1)
      }
      return
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); focusCell(idx - 1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); focusCell(idx + 1) }
  }

  const handlePaste = (idx, e) => {
    if (disabled) return
    const text = e.clipboardData?.getData('text')
    if (!text) return
    e.preventDefault()
    // Un codice incollato per intero si legge dalla prima casella, non da
    // quella che per caso aveva il fuoco.
    const start = /^\s*[A-HJ-NP-Za-hj-np-z]/.test(text) ? 0 : idx
    const landed = writeFrom(start, text)
    focusCell(landed)
  }

  return (
    <div
      className={`sc-code-input ${invalid ? 'is-invalid' : ''} ${disabled ? 'is-disabled' : ''}`}
      role="group"
      aria-label="Codice sconto a sei caratteri"
    >
      {slots.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className={[
            'sc-code-cell',
            i === 0 ? 'is-letter' : '',
            c !== EMPTY ? 'is-filled' : '',
            focusedIdx === i ? 'is-focused' : '',
          ].filter(Boolean).join(' ')}
          type="text"
          /* La prima è una lettera, le altre cifre: su telefono questo
             decide quale tastiera si apre, ed è il motivo per cui le
             caselle sono sei input separati. */
          inputMode={i === 0 ? 'text' : 'numeric'}
          maxLength={1}
          value={c === EMPTY ? '' : c}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => { setFocusedIdx(i); e.target.select() }}
          onBlur={() => setFocusedIdx((prev) => (prev === i ? -1 : prev))}
          disabled={disabled}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label={i === 0 ? 'Lettera iniziale' : `Cifra ${i}`}
        />
      ))}
    </div>
  )
}
