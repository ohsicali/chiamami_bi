import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import BirthDateInput from '../UI/BirthDateInput'
import { birthDateError, toIsoDate } from '../../lib/birthDate'
import { supabase } from '../../lib/supabase'
import './BirthDatePrompt.css'

/**
 * "Quando è il tuo compleanno?" — il popup per chi l'account ce l'aveva già
 * prima che la registrazione chiedesse la data di nascita (o è entrato con
 * Google). Lo apre BirthDateGate; le regole stanno in src/lib/birthDate.js.
 *
 * Si chiude con "Salva" o con "Più tardi" (anche Esc). Un tocco fuori no:
 * chi sta scegliendo il mese e sbaglia di un dito non deve perdere tutto.
 */
export default function BirthDatePrompt({ userId, name, onSaved, onLater }) {
  const [value, setValue] = useState({ day: '', month: '', year: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const laterRef = useRef(onLater)
  useEffect(() => { laterRef.current = onLater }, [onLater])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') laterRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    const problem = birthDateError(value)
    if (problem) { setError(problem); return }
    setSaving(true)
    setError('')
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ birth_date: toIsoDate(value) })
      .eq('id', userId)
    setSaving(false)
    if (dbError) {
      setError('Non sono riuscito a salvarla. Riprova fra un attimo.')
      return
    }
    // Un grazie che si legge, poi via: chiudere nello stesso istante del
    // tocco sembrava un popup sparito per errore.
    setDone(true)
    setTimeout(() => onSaved(), 900)
  }

  return (
    <div className="bdp-veil ph-no-capture" role="dialog" aria-modal="true" aria-labelledby="bdp-title">
      <form className="bdp-card" onSubmit={handleSave} noValidate>
        <div className="bdp-badge" aria-hidden="true">{done ? '🎉' : '🎂'}</div>
        <h2 id="bdp-title">
          {done ? 'Grazie!' : name ? `${name}, quando è il tuo compleanno?` : 'Quando è il tuo compleanno?'}
        </h2>
        {done ? (
          <p>Fatto, l&rsquo;ho segnato.</p>
        ) : (
          <>
            <p>
              Giorno, mese e anno: ci aiuta a capire chi usa la guida di Bi.
              Non la vede nessun altro, neanche i locali.
            </p>
            <BirthDateInput
              idPrefix="bdp-birth"
              value={value}
              onChange={(v) => { setValue(v); if (error) setError('') }}
              invalid={!!error}
              style={{ width: '100%', textAlign: 'left' }}
            />
            <div className="bdp-error" role="alert">{error}</div>
            <button type="submit" className="bdp-save" disabled={saving} aria-busy={saving}>
              {saving ? 'Salvo…' : 'Salva'}
            </button>
            <button type="button" className="bdp-later" onClick={onLater}>
              Più tardi
            </button>
            <div style={{ fontSize: 11, color: 'var(--color-ink-55)', marginTop: 2 }}>
              Come trattiamo i dati: <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }} onClick={onLater}>Privacy</Link>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
