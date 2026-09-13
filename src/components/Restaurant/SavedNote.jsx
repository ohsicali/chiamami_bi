import { useState } from 'react'
import { NOTE_MAX } from '../../lib/utils/savedNote'

/**
 * La nota personale su un locale salvato.
 *
 * Serve a una cosa sola: ricordarsi perché quel posto è lì dentro. Sei mesi
 * dopo, "Bomaki" da solo non dice niente; "il tacos di tonno, e chiedi il
 * tavolo dietro" sì.
 *
 * Sta sotto la card e non dentro un pannello a parte perché va letta insieme
 * al nome, non cercata. Quando non c'è, l'invito è piccolo e grigio: chi
 * salva e basta non deve sentirsi in difetto per un campo vuoto.
 *
 * La nota è UNA per locale, non una per lista: vive sul salvataggio, quindi
 * resta anche se si cancella la lista in cui il locale stava. Va via solo
 * quando si toglie il cuore.
 *
 * Niente Caveat qui: il corsivo a mano è la voce di Bi, e questa è la voce
 * di chi legge. Un corsivo normale basta a dire "questo l'hai scritto tu".
 */


export default function SavedNote({ note, onSave, compact = false }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note || '')
  const [busy, setBusy] = useState(false)

  const open = () => { setDraft(note || ''); setEditing(true) }

  const commit = async () => {
    setBusy(true)
    await onSave(draft)
    setBusy(false)
    setEditing(false)
  }

  // L'editor è un foglio sopra la pagina e non un campo dentro la card: le
  // card stanno in griglie a due o quattro colonne, e una textarea larga
  // 170px è un posto dove non si scrive niente. Così lo spazio per scrivere è
  // lo stesso ovunque compaia la nota.
  const editor = editing ? (
    <div
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-label="La tua nota"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) setEditing(false) }}
    >
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          La tua nota
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-ink-70)', margin: '0 0 12px', lineHeight: 1.45 }}>
          La leggi solo tu. Serve a ricordarti perché questo posto è qui.
        </p>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX))}
          placeholder="Cosa prendere, con chi tornarci, il tavolo giusto…"
          rows={4}
          aria-label="La tua nota su questo locale"
          style={{
            width: '100%', resize: 'vertical', minHeight: 96,
            padding: '12px 13px', borderRadius: 12,
            border: '1px solid var(--color-ink-15, rgba(34,24,28,.15))',
            background: '#fff', color: 'var(--color-ink)',
            fontFamily: 'inherit', fontSize: 15, lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <button type="button" onClick={commit} disabled={busy} style={{ ...pill, background: 'var(--color-ink)', color: '#fff', opacity: busy ? .5 : 1 }}>
            {busy ? 'Salvo…' : 'Salva'}
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy} style={{ ...pill, background: 'transparent', color: 'var(--color-ink-70)' }}>
            Annulla
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--color-ink-55)', fontVariantNumeric: 'tabular-nums' }}>
            {draft.length}/{NOTE_MAX}
          </span>
        </div>
      </div>
    </div>
  ) : null

  if (!note) {
    return (
      <>
      {editor}
      <button
        type="button"
        onClick={open}
        style={{
          background: 'none', border: 'none', padding: compact ? '4px 0 0' : '6px 0 0',
          cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 600, color: 'var(--color-ink-55)',
        }}
      >
        ＋ Aggiungi una nota
      </button>
      </>
    )
  }

  return (
    <>
    {editor}
    <button
      type="button"
      onClick={open}
      aria-label="Modifica la tua nota"
      style={{
        ...wrap,
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        border: 'none', borderLeft: '3px solid var(--color-corallo)',
        background: 'var(--color-cream, #F5F0E4)',
        fontFamily: 'inherit', fontStyle: 'italic', fontWeight: 500,
        fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-ink-70)',
      }}
    >
      {note}
    </button>
    </>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 2000,
  background: 'rgba(34,24,28,.45)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  padding: 0,
}

const sheet = {
  width: '100%', maxWidth: 440,
  background: 'var(--color-page, #FAF7F2)',
  borderRadius: '22px 22px 0 0',
  padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
  boxShadow: '0 -10px 40px rgba(34,24,28,.20)',
  cursor: 'default',
  textAlign: 'left',
}

const wrap = {
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 12,
}

const pill = {
  padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
}
