import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import BiLogoMark from '../../components/UI/BiLogoMark'
import { PhotoOrEmoji } from '../../components/UI/SmartImage'
import './ChiediPage.css'

/**
 * /chiedi · "Chiedi a Bi" v1 — chat AI dedicata.
 * - Empty state: hero + 6 prompt + blocco didattico (cosa Bi sa / non sa).
 * - Conversazione: bubble user/Bi + result-card + typing indicator.
 * - Auth gate: utenti anonimi possono visitare ma non chattare.
 * - URL persistente: /chiedi/:conversationId (replace dopo il primo invio).
 */
export default function ChiediPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { conversationId: routeConvId } = useParams()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [convId, setConvId] = useState(routeConvId || null)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [pendingMessage, setPendingMessage] = useState(null)
  // (Streaming SSE sostituisce il typewriter: ogni delta arriva già in tempo
  // reale dal server e viene appeso al content del messaggio.)
  // userLocation: { lat, lng } | null. Si attiva al click del 📍 nell'input bar.
  // Se attivo, viene incluso in /api/ai così Bi può citare i minuti a piedi
  // e usare il filtro near_me.
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationPending, setLocationPending] = useState(false)

  const bodyRef = useRef(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const initialMessageHandledRef = useRef(false)

  const isEmpty = messages.length === 0 && !loading

  /* ---- Scroll to bottom on new content ---- */
  useEffect(() => {
    if (isEmpty) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading, isEmpty])


  /* ---- Load existing conversation when arriving on /chiedi/:id ---- */
  useEffect(() => {
    if (!routeConvId || !user || !isSupabaseConfigured()) return
    let cancelled = false
    setConvId(routeConvId)
    setLoading(true)
    supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', routeConvId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error || !data) return
        const restored = data
          .map((m) => {
            const text = m.content?.text || (typeof m.content === 'string' ? m.content : '')
            const results = Array.isArray(m.content?.results) ? m.content.results : []
            return { role: m.role, content: text, results }
          })
          .filter((m) => m.role === 'user' || m.role === 'assistant')
        setMessages(restored)
      })
    return () => { cancelled = true }
  }, [routeConvId, user])

  /* ---- Auto-grow textarea ---- */
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }, [])
  useEffect(adjustTextarea, [input, adjustTextarea])

  /* ---- Send message (streaming SSE) ---- */
  const sendMessage = useCallback(async (rawText) => {
    const text = String(rawText ?? '').trim()
    if (!text || loading) return

    if (!user) {
      setShowAuthGate(true)
      setPendingMessage(text)
      return
    }

    // Append messaggio user + bolla assistant vuota (verrà riempita dai delta).
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: '', results: [], streaming: true },
    ])
    setInput('')
    setLoading(true)

    const failWithError = (msg) => {
      setMessages((m) => {
        // Sostituisci l'ultima bolla assistant in streaming con l'errore.
        const last = m[m.length - 1]
        if (last?.role === 'assistant' && last?.streaming) {
          return [...m.slice(0, -1), { role: 'assistant', content: msg, error: true }]
        }
        return [...m, { role: 'assistant', content: msg, error: true }]
      })
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const resp = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: text,
          conversation_id: convId || undefined,
          user_location: userLocation || undefined,
          stream: true,
        }),
      })

      if (resp.status === 401) {
        // Toglie messaggio user + bolla streaming (entrambi gli ultimi due).
        setMessages((m) => m.slice(0, -2))
        setShowAuthGate(true)
        setPendingMessage(text)
        return
      }
      if (!resp.ok || !resp.body) {
        const fallback = await resp.text().catch(() => '')
        throw new Error(fallback || `Errore ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let gotAnyDelta = false

      // Parser SSE: eventi separati da blank line; ogni evento ha event:
      // name + data: payload. Data può essere spezzato in più "data:" lines.
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          let evt = ''
          let data = ''
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) evt = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) continue
          let parsed
          try { parsed = JSON.parse(data) } catch { continue }

          if (evt === 'delta') {
            gotAnyDelta = true
            setMessages((m) => m.map((msg, i) =>
              i === m.length - 1 && msg.role === 'assistant'
                ? { ...msg, content: (msg.content || '') + (parsed.text || '') }
                : msg,
            ))
          } else if (evt === 'picks') {
            setMessages((m) => m.map((msg, i) =>
              i === m.length - 1 && msg.role === 'assistant'
                ? { ...msg, results: Array.isArray(parsed) ? parsed : [] }
                : msg,
            ))
          } else if (evt === 'done') {
            if (parsed?.conversation_id && !convId) {
              setConvId(parsed.conversation_id)
              navigate(`/chiedi/${parsed.conversation_id}`, { replace: true })
            }
            setMessages((m) => m.map((msg, i) =>
              i === m.length - 1 && msg.role === 'assistant'
                ? { ...msg, streaming: false }
                : msg,
            ))
          } else if (evt === 'error') {
            throw new Error(parsed?.message || 'AI stream error')
          }
        }
      }

      // Safety: se lo stream è finito senza alcun delta, mostra un fallback.
      if (!gotAnyDelta) {
        setMessages((m) => m.map((msg, i) =>
          i === m.length - 1 && msg.role === 'assistant' && !msg.content
            ? { ...msg, content: 'Eccomi.', streaming: false }
            : msg,
        ))
      }
    } catch (err) {
      console.error('[chiedi] sendMessage error', err)
      failWithError('Mmh, qualcosa non gira. Riprova tra un secondo?')
    } finally {
      setLoading(false)
    }
  }, [convId, loading, navigate, user, userLocation])

  /* ---- Geolocation toggle ---- */
  const requestLocation = useCallback(() => {
    if (userLocation) {
      // Già attivo → toggle off
      setUserLocation(null)
      setLocationError(null)
      return
    }
    if (!('geolocation' in navigator)) {
      setLocationError('Il tuo browser non supporta la geolocalizzazione.')
      return
    }
    setLocationPending(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationPending(false)
      },
      (err) => {
        setLocationPending(false)
        setLocationError(err.code === 1 ? 'Permesso negato — abilitalo nelle impostazioni del browser.' : 'Non riesco a leggere la posizione.')
      },
      { maximumAge: 5 * 60 * 1000, timeout: 8000, enableHighAccuracy: false },
    )
  }, [userLocation])

  /* ---- Initial message from Home / post-login state ---- */
  useEffect(() => {
    if (initialMessageHandledRef.current) return
    const initial = location.state?.initialMessage
    if (!initial) return
    initialMessageHandledRef.current = true
    // pulisci lo state per evitare re-send su refresh
    window.history.replaceState({}, document.title)
    sendMessage(initial)
  }, [location.state, sendMessage])

  /* ---- Submit handlers ---- */
  const handleSubmit = (e) => {
    e?.preventDefault?.()
    sendMessage(input)
  }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="chiedi-page">
      <ChiediHeader hasConversation={!isEmpty} onNewChat={() => {
        setMessages([])
        setConvId(null)
        navigate('/chiedi', { replace: true })
      }} />

      <div className="cp-body" ref={bodyRef}>
        {isEmpty ? (
          <EmptyState onPromptClick={sendMessage} />
        ) : (
          <Conversation messages={messages} loading={loading} onChip={sendMessage} />
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <form className="cp-input-bar" onSubmit={handleSubmit}>
        <div className="cp-input-row">
          <button
            type="button"
            className={`cp-geo${userLocation ? ' is-on' : ''}${locationPending ? ' is-pending' : ''}`}
            onClick={requestLocation}
            disabled={locationPending}
            aria-label={userLocation ? 'Disattiva la posizione' : 'Condividi la posizione'}
            title={userLocation ? 'Posizione attiva · tap per disattivare' : 'Condividi la posizione per ottenere risposte vicino a te'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </button>
          <div className="cp-input-wrap">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isEmpty ? 'Scrivi qui che voglia hai…' : 'Continua a chiedermi…'}
              aria-label="Scrivi a Bi"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="cp-send"
            disabled={loading || !input.trim()}
            aria-label="Invia"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {locationError && (
          <div className="cp-geo-err" role="alert">{locationError}</div>
        )}
      </form>

      {showAuthGate && (
        <AuthGate
          pendingMessage={pendingMessage}
          onClose={() => { setShowAuthGate(false); setPendingMessage(null) }}
        />
      )}
    </div>
  )
}

/* ============================================================ */
/*  Header                                                        */
/* ============================================================ */
function ChiediHeader({ hasConversation, onNewChat }) {
  const navigate = useNavigate()
  return (
    <header className="cp-header">
      <button
        type="button"
        className="cp-h-back"
        aria-label="Indietro"
        onClick={() => navigate(-1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="cp-h-title">
        <div className="cp-h-mark"><BiLogoMark style={{ width: '88%', height: '88%' }} /></div>
        <div className="cp-h-text">
          <strong>Chiedi a Bi</strong>
          <small><span className="cp-dot" />in linea · ti rispondo in qualche secondo</small>
        </div>
      </div>

      <button
        type="button"
        className="cp-h-iconbtn"
        aria-label={hasConversation ? 'Nuova chat' : 'Cronologia'}
        onClick={hasConversation ? onNewChat : () => navigate('/profile/chat')}
        title={hasConversation ? 'Nuova chat' : 'Cronologia'}
      >
        {hasConversation ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 2" />
          </svg>
        )}
      </button>
    </header>
  )
}

/* ============================================================ */
/*  Empty State                                                   */
/* ============================================================ */
const PROMPTS = [
  { icon: '🥂', title: 'Aperitivo a Vanchiglia',          sub: 'cocktail bar, locali con buon tagliere',     query: 'Aperitivo a Vanchiglia' },
  { icon: '🍣', title: 'Giapponese aperto stasera',       sub: 'solo locali con orario verificato',          query: 'Giapponese aperto stasera' },
  { icon: '🍕', title: 'Pizza in centro la domenica',     sub: 'quartiere + giorno + cucina',                query: 'Pizza in centro la domenica' },
  { icon: '🐟', title: 'Pesce a San Salvario',            sub: 'cucina + zona',                              query: 'Pesce a San Salvario' },
  { icon: '🥟', title: 'Locali che fanno gli agnolotti',  sub: 'piatto specifico — cerco nel "Bi consiglia"', query: 'Locali che fanno gli agnolotti del plin' },
  { icon: '🏷️', title: 'Sconti attivi stasera vicino a me', sub: 'chi ha sconto + è aperto adesso',          query: 'Sconti attivi stasera' },
]

function EmptyState({ onPromptClick }) {
  return (
    <>
      <div className="cp-hero">
        <div className="cp-av-iconic">
          <BiLogoMark style={{ width: '88%', height: '88%' }} />
          <span className="cp-sp" aria-hidden="true">✦</span>
          <span className="cp-ring" aria-hidden="true" />
        </div>
        <h1>Ciao, sono Bi.</h1>
        <div className="cp-sub">Dimmi che voglia hai…</div>
        <p>Ti consiglio dove andare tra i locali che ho selezionato io a Torino. Cucina, zona, momento, piatto. Quello che vuoi.</p>
      </div>

      <div className="cp-explainer" role="note">
        <div className="cp-explainer-row">
          <div className="cp-ic cp-ic-yes" aria-hidden="true">✓</div>
          <div>
            <strong>Cosa posso dirti</strong>
            <p>
              Ti consiglio dove andare tra i locali che ho selezionato io a Torino.
              Cucina, zona, momento della giornata, piatti specifici, sconti attivi,
              chi è aperto adesso. Sono ~200 ristoranti, tutti validati da me.
            </p>
          </div>
        </div>
        <div className="cp-explainer-row">
          <div className="cp-ic cp-ic-no" aria-hidden="true">~</div>
          <div>
            <strong>Cosa non so</strong>
            <p>
              Prezzi precisi, recensioni utenti, disponibilità di un tavolo stasera,
              menu in tempo reale. Per quelle cose, ti passo il numero del locale.
            </p>
          </div>
        </div>
      </div>

      <div className="cp-section-hint">
        <div className="cp-ln" />
        <span>prova a chiedermi</span>
        <div className="cp-ln" />
      </div>

      <div className="cp-prompts">
        {PROMPTS.map((p) => (
          <button
            key={p.query}
            type="button"
            className="cp-pcard"
            onClick={() => onPromptClick(p.query)}
          >
            <div className="cp-ic" aria-hidden="true">{p.icon}</div>
            <div className="cp-tx">
              <strong>{p.title}</strong>
              <small>{p.sub}</small>
            </div>
            <svg className="cp-ar" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      <div className="cp-bi-tip">
        <div className="cp-ic" aria-hidden="true">💡</div>
        <p>Sono trasparente: se non ho la risposta te lo dico subito e ti propongo l'alternativa più vicina. Mai un nome di locale che non ho validato io.</p>
      </div>
    </>
  )
}

/* ============================================================ */
/*  Conversation                                                  */
/* ============================================================ */
function Conversation({ messages, loading, onChip }) {
  const allRestaurantIds = messages.flatMap((m) =>
    Array.isArray(m.results) ? m.results.map((r) => r.restaurant_id).filter(Boolean) : [],
  )
  const [photos, setPhotos] = useState({})

  useEffect(() => {
    if (allRestaurantIds.length === 0 || !isSupabaseConfigured()) return
    let cancelled = false
    supabase
      .from('restaurant_photos')
      .select('restaurant_id, photo_url, thumb_url, sort_order')
      .in('restaurant_id', allRestaurantIds)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRestaurantIds.join(',')])

  return (
    <div className="cp-conv">
      {messages.map((m, i) => {
        if (m.role === 'user') {
          return (
            <div key={i} className="cp-bubble cp-user">
              {m.content}
            </div>
          )
        }
        // Streaming: il content cresce in tempo reale dai delta SSE.
        // Mostriamo il cursore lampeggiante mentre msg.streaming è true.
        const isStreaming = m.streaming === true
        const hasResults = Array.isArray(m.results) && m.results.length > 0
        return (
          <div key={i}>
            <div className="cp-bi-row">
              <div className="cp-av-mini"><BiLogoMark style={{ width: '88%', height: '88%' }} /></div>
              <div className={`cp-bubble cp-bi${m.error ? ' cp-error' : ''}`}>
                {m.content}
                {isStreaming && <span className="cp-cursor" aria-hidden="true" />}
              </div>
            </div>
            {hasResults && (
              <div className="cp-results cp-results-in">
                {m.results.map((r, j) => (
                  <ResultCard
                    key={r.restaurant_id || r.slug || `${i}-${j}`}
                    restaurant={r}
                    photoUrl={r.restaurant_id ? photos[r.restaurant_id] : null}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Quick-reply chips (C5): continuano la conversazione senza tastiera —
          su mobile valgono oro. Compaiono solo sotto l'ultima risposta di Bi,
          a streaming finito. */}
      {(() => {
        if (loading) return null
        const last = messages[messages.length - 1]
        if (!last || last.role !== 'assistant' || last.streaming || last.error) return null
        const firstResult = Array.isArray(last.results) && last.results[0]
        const chips = [
          firstResult?.name ? `Cosa ordino da ${firstResult.name}?` : null,
          'Allarga la zona',
          'Solo con sconto',
        ].filter(Boolean)
        return (
          <div className="cp-chips">
            {chips.map((c) => (
              <button key={c} type="button" className="cp-chip" onClick={() => onChip?.(c)}>
                {c}
              </button>
            ))}
          </div>
        )
      })()}

      {/* Typing dots: solo se NON c'è una bolla assistant attiva — evita doppia
          indicazione (cursore + dots) durante lo streaming. */}
      {loading && !messages.some((m) => m.role === 'assistant' && m.streaming) && (
        <div className="cp-typing">
          <div className="cp-av-mini"><BiLogoMark style={{ width: '88%', height: '88%' }} /></div>
          <div className="cp-bub">
            <span className="cp-tdot" />
            <span className="cp-tdot" />
            <span className="cp-tdot" />
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ restaurant, photoUrl }) {
  const finalPhoto = photoUrl ? proxyImg(photoUrl) : null
  const meta = [
    restaurant.category,
    restaurant.zone,
    restaurant.walk_minutes ? `${restaurant.walk_minutes} min a piedi` : null,
    restaurant.closes_at ? `aperto fino a ${restaurant.closes_at}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Link
      to={restaurant.slug ? `/restaurant/${restaurant.slug}` : '#'}
      className="cp-rcard"
    >
      <div className="cp-ph">
        <PhotoOrEmoji
          src={finalPhoto}
          alt=""
          emoji="🍽️"
          imgStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {restaurant.closes_at && <span className="cp-open-pill">● Aperto</span>}
      </div>
      <div className="cp-info">
        <div>
          <h4>
            {restaurant.name}
            {restaurant.discount_percent && (
              <span className="cp-badge-mini">−{restaurant.discount_percent}%</span>
            )}
          </h4>
          <div className="cp-meta">{meta}</div>
        </div>
        {restaurant.why && (
          <div className="cp-why">"{restaurant.why}"</div>
        )}
      </div>
    </Link>
  )
}

/* ============================================================ */
/*  Auth Gate                                                     */
/* ============================================================ */
function AuthGate({ pendingMessage, onClose }) {
  return (
    <div
      className="cp-auth-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cp-auth-gate-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="cp-auth-gate-card">
        <div className="cp-av-iconic" style={{ width: 70, height: 70, marginBottom: 4 }}>
          <BiLogoMark style={{ width: '88%', height: '88%' }} />
          <span className="cp-sp" aria-hidden="true" style={{ width: 18, height: 18, fontSize: 9 }}>✦</span>
        </div>
        <h3 id="cp-auth-gate-title">Accedi per chattare con me</h3>
        <p>
          Per ricordarmi le tue domande e darti consigli più precisi nel tempo,
          ho bisogno che tu acceda. Ci metti 30 secondi.
        </p>
        <Link
          to="/login"
          state={{ returnTo: '/chiedi', initialMessage: pendingMessage }}
          className="cp-btn-primary"
        >
          Accedi
        </Link>
        <Link
          to="/login"
          state={{ returnTo: '/chiedi', initialMessage: pendingMessage, mode: 'register' }}
          className="cp-btn-secondary"
        >
          Registrati gratis
        </Link>
        <button type="button" onClick={onClose} className="cp-btn-link">
          Annulla
        </button>
      </div>
    </div>
  )
}
