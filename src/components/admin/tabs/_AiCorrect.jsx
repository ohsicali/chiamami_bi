import { useState } from 'react'

/**
 * AiCorrectButton + SuggestionBox — small inline AI text corrector.
 *
 * Legacy feature migrated from RestaurantForm.jsx (handleAiCorrect).
 * Calls POST /api/correct-text with { text, context } and returns
 * { corrected, changed }. If the AI found a different text, we show
 * the corrected version and let the admin Accept/Reject.
 *
 * Usage inside a tab (e.g. DettagliTab):
 *
 *   const [ai, setAi] = useAiCorrect()
 *   ...
 *   <FField label={<span>Racconto <AiCorrectButton ai={ai} field="our_review"
 *     getText={() => form.our_review} context="restaurant review" /></span>}>
 *     <FTextarea value={form.our_review} ... />
 *     <AiSuggestionBox ai={ai} field="our_review" onAccept={(t) => onChange({our_review: t})} />
 *   </FField>
 */

export function useAiCorrect() {
  const [loadingField, setLoadingField] = useState(null)
  const [suggestion, setSuggestion] = useState(null) // { field, original, corrected }
  const [error, setError] = useState(null)

  async function run(field, text, context) {
    if (!text || !text.trim()) {
      setError('Scrivi prima il testo da correggere.')
      setTimeout(() => setError(null), 2500)
      return
    }
    setLoadingField(field)
    setSuggestion(null)
    setError(null)
    try {
      const resp = await fetch('/api/correct-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context }),
      })
      const data = await resp.json()
      if (data?.error) {
        setError(data.error)
      } else if (data?.corrected && data.changed) {
        setSuggestion({ field, original: text, corrected: data.corrected })
      } else {
        setError('Il testo sembra già corretto ✓')
        setTimeout(() => setError(null), 2000)
      }
    } catch (err) {
      setError('Errore: ' + err.message)
    } finally {
      setLoadingField(null)
    }
  }

  function clear() {
    setSuggestion(null)
    setError(null)
  }

  return { loadingField, suggestion, error, run, clear }
}

export function AiCorrectButton({ ai, field, getText, context }) {
  const loading = ai.loadingField === field
  return (
    <button
      type="button"
      onClick={() => ai.run(field, getText(), context)}
      disabled={loading}
      title="Correggi errori grammaticali e ortografici (l'AI non cambia tono né stile)"
      style={{
        marginLeft: 8,
        background: 'transparent',
        border: '1px solid var(--color-line, #EAE3D7)',
        color: 'var(--color-corallo, #E8453C)',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {loading ? '…' : '✨ Correggi'}
    </button>
  )
}

export function AiSuggestionBox({ ai, field, onAccept }) {
  const sug = ai.suggestion
  if (!sug || sug.field !== field) {
    if (ai.error && ai.loadingField === null) {
      return (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--color-cream, #F5F0E4)',
            color: 'var(--color-ink-70, rgba(34,24,28,0.7))',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {ai.error}
        </div>
      )
    }
    return null
  }
  return (
    <div
      style={{
        marginTop: 10,
        padding: 14,
        borderRadius: 12,
        background: 'var(--color-corallo-wash, #FDEDEB)',
        border: '1px solid var(--color-corallo-soft, #F6B7B1)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--color-corallo, #E8453C)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        ✨ Proposta correzione
      </div>
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 10,
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--color-ink, #22181C)',
          whiteSpace: 'pre-wrap',
          marginBottom: 10,
        }}
      >
        {sug.corrected}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={ai.clear}
          style={{
            background: 'transparent',
            border: '1px solid var(--color-line, #EAE3D7)',
            color: 'var(--color-ink, #22181C)',
            padding: '7px 14px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Rifiuta
        </button>
        <button
          type="button"
          onClick={() => {
            onAccept(sug.corrected)
            ai.clear()
          }}
          style={{
            background: 'var(--color-corallo, #E8453C)',
            border: 0,
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
          }}
        >
          ✓ Applica
        </button>
      </div>
    </div>
  )
}
