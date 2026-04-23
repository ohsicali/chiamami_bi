import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks/useAuth'

const CHIPS_BY_MOMENT = {
  colazione: ['✨ cornetto croccante', '✨ brunch in zona', '✨ colazione vista panorama'],
  pranzo:    ['✨ pranzo veloce in Centro', '✨ sotto i 15€ con colleghi', '✨ pausa salutare'],
  aperitivo: ['✨ aperitivo con terrazza', '✨ vini naturali', '✨ tagliere abbondante'],
  cena:      ['✨ cena romantica', '✨ carne alla brace', '✨ pizzeria gourmet'],
  dopocena:  ['✨ cocktail bar autore', '✨ vinile dopo cena', '✨ birra artigianale'],
}

const DEFAULT_CHIPS = ['✨ un cinese aperto stasera', '✨ sotto i 20€', '✨ brunch San Salvario']

/**
 * AskBiChat · chat AI "Chiedi a Bi".
 *  - Input libero + 3 chip dinamici per momento.
 *  - POST /api/ai con conversation_id opzionale + current_moment.
 *  - Output: bolla con testo Bi + 2-3 result card + link "Scrivi a Bi per altri".
 */
export default function AskBiChat({ currentMoment }) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [response, setResponse] = useState(null)
  const [conversationId, setConversationId] = useState(null)

  const chips = CHIPS_BY_MOMENT[currentMoment] || DEFAULT_CHIPS

  const submit = async (promptText) => {
    const text = (promptText ?? input).trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const resp = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: text,
          conversation_id: conversationId || undefined,
          current_moment: currentMoment || undefined,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data.error || `Errore ${resp.status}`)
      }
      setResponse(data)
      if (data.conversation_id) setConversationId(data.conversation_id)
      setInput('')
    } catch (err) {
      setError(err.message || 'Qualcosa non ha funzionato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hfv4-ai">
      <div className="hfv4-ai-divider" style={dividerStyle}>
        <span style={{ position: 'relative', zIndex: 1, background: 'var(--color-page)', padding: '0 12px' }}>
          Oppure
        </span>
      </div>

      <div className="hfv4-ai-wrap" style={{ padding: '10px 16px 0' }}>
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

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px', position: 'relative' }}>
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => submit(chip.replace(/^✨\s*/, ''))}
                disabled={loading}
                style={{
                  padding: '7px 12px',
                  background: 'var(--color-corallo-wash, #FDF2F0)',
                  color: 'var(--color-corallo-ink, #C6372F)',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  border: '1px solid rgba(232,69,60,.18)',
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.55 : 1,
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', marginBottom: 12 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
              {loading ? 'Bi sta pensando…' : 'Bi incrocia la tua voglia con la Guida'}
            </div>
            <button
              type="button"
              onClick={() => submit()}
              disabled={loading || !input.trim()}
              style={{
                padding: '11px 18px',
                background: 'var(--color-ink)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                border: 0,
                cursor: (loading || !input.trim()) ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 6px 14px rgba(34,24,28,.2)',
                opacity: (loading || !input.trim()) ? 0.55 : 1,
              }}
            >
              Chiedi a Bi →
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-corallo)', fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {response && <AiOutput response={response} isGuest={!user} />}
    </div>
  )
}

function AiOutput({ response, isGuest }) {
  const results = Array.isArray(response.results) ? response.results : []
  return (
    <div className="hfv4-ai-output" style={{ padding: '4px 16px 22px' }}>
      <div style={{ padding: '16px 4px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--color-ink)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 13,
            flex: '0 0 28px',
          }}
        >
          B
        </div>
        <div
          style={{
            background: 'var(--color-ink-05)',
            borderRadius: '14px 14px 14px 4px',
            padding: '9px 14px',
            fontSize: 13,
            color: 'var(--color-ink)',
            maxWidth: 280,
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {response.message || "Eccomi."}
        </div>
      </div>

      {results.map((r, i) => (
        <Link
          key={r.restaurant_id || r.slug || i}
          to={r.slug ? `/restaurant/${r.slug}` : '#'}
          className="hfv4-ai-result"
          style={{
            background: '#fff',
            border: '1px solid var(--color-ink-05)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
            display: 'flex',
            gap: 0,
            marginBottom: 8,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              flex: '0 0 108px',
              height: 108,
              background: `linear-gradient(135deg,#C9A57B,#7D5230)`,
            }}
          />
          <div
            style={{
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              minWidth: 0,
            }}
          >
            <div>
              {r.why && (
                <div
                  style={{
                    fontFamily: 'var(--font-hand, "Caveat", cursive)',
                    fontSize: 18,
                    color: 'var(--color-corallo-ink, #C6372F)',
                    fontWeight: 600,
                    lineHeight: 1.1,
                  }}
                >
                  {r.why}
                </div>
              )}
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  marginTop: 2,
                }}
              >
                {r.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2 }}>
                {[r.category, r.zone, r.price, r.closes_at ? `aperto fino ${r.closes_at}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            {r.open_now && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 5,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#137C3E',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#137C3E' }} />
                aperto ora
              </span>
            )}
          </div>
        </Link>
      ))}

      {results.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 0' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-ink)',
              padding: '9px 14px',
              background: 'var(--color-ink-05)',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Scrivi a Bi per altri <span style={{ color: 'var(--color-corallo)' }}>→</span>
          </span>
        </div>
      )}

      {isGuest && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--color-ink-05)',
            borderRadius: 12,
            fontSize: 11,
            color: 'var(--color-ink-70)',
            textAlign: 'center',
          }}
        >
          Stai chattando come ospite. <Link to="/login" style={{ color: 'var(--color-corallo)', fontWeight: 700 }}>Accedi</Link> per salvare le conversazioni.
        </div>
      )}
    </div>
  )
}

const dividerStyle = {
  margin: '20px 20px 4px',
  textAlign: 'center',
  color: 'var(--color-ink-40, rgba(34,24,28,.4))',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  padding: '14px 0',
  position: 'relative',
}
