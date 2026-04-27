import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, proxyImg } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'

/**
 * AskBiChat · chat AI "Chiedi a Bi".
 *  - Input libero + 3 chip suggeriti.
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
  const [searchParams, setSearchParams] = useSearchParams()
  const cardRef = useRef(null)
  const autoSubmittedRef = useRef(false)

  // Allow other parts of the app (e.g. UnifiedSearch) to deep-link into Bi
  // via /?ask=<query> (auto-submit) or /?focus=bi (just scroll + focus).
  useEffect(() => {
    const askParam = searchParams.get('ask')
    const focusParam = searchParams.get('focus')
    if (!askParam && focusParam !== 'bi') return

    // Scroll the card into view on next frame so layout has settled.
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    if (askParam && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      setInput(askParam)
      // Submit after a tick so the input is mounted with the value.
      setTimeout(() => { submit(askParam) }, 80)
    }

    // Clear params so reload/back doesn't re-trigger.
    const next = new URLSearchParams(searchParams)
    next.delete('ask')
    next.delete('focus')
    setSearchParams(next, { replace: true })
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="hfv4-ai" ref={cardRef}>
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
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const [photos, setPhotos] = useState({})

  useEffect(() => {
    const ids = results.map(r => r.restaurant_id).filter(Boolean)
    if (ids.length === 0) return
    let cancelled = false
    supabase
      .from('restaurant_photos')
      .select('restaurant_id, photo_url, thumb_url, sort_order')
      .in('restaurant_id', ids)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const map = {}
        for (const p of (data || [])) {
          if (!map[p.restaurant_id]) map[p.restaurant_id] = p.thumb_url || p.photo_url
        }
        setPhotos(map)
      })
    return () => { cancelled = true }
  }, [results.map(r => r.restaurant_id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="hfv4-ai-output" style={{ padding: '4px 20px 22px' }}>
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

      {results.map((r, i) => {
        const photoUrl = photos[r.restaurant_id] ? proxyImg(photos[r.restaurant_id]) : null
        const saved = r.restaurant_id && isSaved ? isSaved(r.restaurant_id) : false
        return (
          <div
            key={r.restaurant_id || r.slug || i}
            className="hfv4-ai-result"
            style={{ background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)', display: 'flex', gap: 0, marginBottom: 8, position: 'relative' }}
          >
            <Link
              to={r.slug ? `/restaurant/${r.slug}` : '#'}
              style={{ display: 'flex', gap: 0, textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
            >
              <div
                style={{
                  flex: '0 0 108px',
                  height: 108,
                  background: photoUrl ? `url(${photoUrl}) center/cover` : 'linear-gradient(135deg,#C9A57B,#7D5230)',
                }}
              />
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                <div>
                  {r.why && (
                    <div style={{ fontFamily: 'var(--font-hand, "Caveat", cursive)', fontSize: 18, color: 'var(--color-corallo-ink, #C6372F)', fontWeight: 600, lineHeight: 1.1 }}>{r.why}</div>
                  )}
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', marginTop: 2 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2 }}>
                    {[r.category, r.zone, r.price, r.closes_at ? `aperto fino ${r.closes_at}` : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {r.open_now && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: 10, fontWeight: 700, color: '#137C3E' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#137C3E' }} />aperto ora
                  </span>
                )}
              </div>
            </Link>
            {r.restaurant_id && toggleSave && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(r.restaurant_id) }}
                aria-label={saved ? 'Rimuovi dai salvati' : 'Salva'}
                style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: saved ? 'var(--color-corallo)' : 'var(--color-ink-70)', border: 0, cursor: 'pointer' }}
              >
                {saved ? '♥' : '♡'}
              </button>
            )}
          </div>
        )
      })}

      {results.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 0' }}>
          <a
            href="https://www.instagram.com/chiamamibi/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-ink)', padding: '9px 14px', background: 'var(--color-ink-05)', borderRadius: 999, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Scrivi a Bi su Instagram <span style={{ color: 'var(--color-corallo)' }}>→</span>
          </a>
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
