import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * AskBiChat · ingresso "Chiedi a Bi" sulla Home.
 *
 * PR20 §3.4 — la chat vive su /chiedi (pagina dedicata, URL condivisibile).
 * Da qui raccogliamo il messaggio iniziale e navighiamo a /chiedi passando
 * lo `state.initialMessage`: ChiediPage lo invia automaticamente al mount.
 *
 * Niente più chat inline sulla Home.
 */
// eslint-disable-next-line no-unused-vars
export default function AskBiChat({ currentMoment }) {
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  const submit = (promptText) => {
    const text = (promptText ?? input).trim()
    if (!text) {
      navigate('/chiedi')
      return
    }
    navigate('/chiedi', { state: { initialMessage: text } })
  }

  const canSubmit = input.trim().length > 0

  return (
    <div className="hfv4-ai">
      <div className="hfv4-ai-divider" style={dividerStyle}>
        <span style={{ flex: 1, height: 1, background: 'var(--color-ink-15, rgba(34,24,28,.12))' }} />
        <span>Oppure</span>
        <span style={{ flex: 1, height: 1, background: 'var(--color-ink-15, rgba(34,24,28,.12))' }} />
      </div>

      <div className="hfv4-ai-wrap" style={{ padding: '10px 20px 0' }}>
        <div
          className="hfv4-ai-card"
          style={{
            position: 'relative',
            background: '#fff',
            border: '1px solid var(--color-ink-05)',
            borderRadius: 28,
            padding: '22px 20px 20px',
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              background: 'radial-gradient(circle,rgba(232,69,60,.1),transparent 60%)',
              borderRadius: '50%',
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -80,
              left: -40,
              width: 180,
              height: 180,
              background: 'radial-gradient(circle,rgba(176,137,84,.08),transparent 60%)',
              borderRadius: '50%',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative' }}>
            <div
              style={{
                position: 'relative',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-corallo) 0%, var(--color-corallo-ink, #C6372F) 100%)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
                fontSize: 22,
                boxShadow: '0 6px 16px rgba(232,69,60,.35)',
                flex: '0 0 48px',
              }}
            >
              B
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 10,
                  height: 10,
                  background: 'var(--color-oro)',
                  borderRadius: '50%',
                  border: '2px solid #fff',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                  color: 'var(--color-ink)',
                }}
              >
                Chiedi a Bi
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-70)', marginTop: 3, lineHeight: 1.35 }}>
                Dimmi cosa ti va, ti suggerisco io.
              </div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.5, margin: '0 0 14px', position: 'relative' }}>
            Scrivimi di cosa hai voglia.{' '}
            <strong>Sushi? Pizza? Un piemontese economico in centro? Un locale per bere con gli amici?</strong>{' '}
            Scrivi qua sotto e ti suggerisco i locali più adatti.
          </p>

          <div style={{ position: 'relative', marginBottom: 12 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="es. un cinese aperto a cena che costi poco ma abbia una buona carta vini…"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--color-cream, #F5F0E4)',
                border: '1px solid var(--color-ink-15, rgba(34,24,28,.12))',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: 14,
                color: 'var(--color-ink)',
                resize: 'none',
                minHeight: 80,
                lineHeight: 1.4,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            <div style={{ flex: 1, fontSize: 11, color: 'var(--color-ink-40, rgba(34,24,28,.4))', fontWeight: 600 }}>
              Bi incrocia la tua voglia con la Guida
            </div>
            <button
              type="button"
              onClick={() => submit()}
              style={{
                padding: '11px 18px',
                background: 'var(--color-ink)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                border: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 6px 14px rgba(34,24,28,.2)',
                opacity: canSubmit ? 1 : 0.85,
              }}
              aria-label={canSubmit ? 'Apri la chat con Bi' : 'Apri Chiedi a Bi'}
            >
              Chiedi a Bi →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const dividerStyle = {
  margin: '20px 20px 4px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: 'var(--color-ink-40, rgba(34,24,28,.4))',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  padding: '14px 0',
}
