import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import BiLogoMark from '../../components/UI/BiLogoMark'
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

  /* ---- Send message ---- */
  const sendMessage = useCallback(async (rawText) => {
    const text = String(rawText ?? '').trim()
    if (!text || loading) return

    if (!user) {
      setShowAuthGate(true)
      setPendingMessage(text)
      return
    }

    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

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
          conversation_id: convId || undefined,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (resp.status === 401) {
        setShowAuthGate(true)
        setPendingMessage(text)
        setMessages((m) => m.slice(0, -1))
        return
      }
      if (!resp.ok) {
        throw new Error(data.error || `Errore ${resp.status}`)
      }

      const newConvId = data.conversation_id
      if (newConvId && !convId) {
        setConvId(newConvId)
        navigate(`/chiedi/${newConvId}`, { replace: true })
      }

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.message || 'Eccomi.',
          results: Array.isArray(data.results) ? data.results : [],
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Mmh, qualcosa non gira. Riprova tra un secondo?',
          error: true,
        },
      ])
      console.error('[chiedi] sendMessage error', err)
    } finally {
      setLoading(false)
    }
  }, [convId, loading, navigate, user])

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
          <Conversation messages={messages} loading={loading} />
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <form className="cp-input-bar" onSubmit={handleSubmit}>
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
      </form>

      {/* Striscia opaca sotto al tab bar mobile, blocca lo scroll-through
         nella safe-area sotto al tab bar floating. */}
      <div className="cp-bottom-strip" aria-hidden="true" />

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
        <div className="cp-h-mark"><BiLogoMark style={{ width: '78%', height: '78%' }} /></div>
        <div className="cp-h-text">
          <strong>Chiedi a Bi</strong>
          <small><span className="cp-dot" />in linea · ti rispondo in 3 secondi</small>
        </div>
      </div>

      <button
        type="button"
        className="cp-h-iconbtn"
        aria-label={hasConversation ? 'Nuova chat' : 'Cronologia'}
        onClick={hasConversation ? onNewChat : undefined}
        title={hasConversation ? 'Nuova chat' : 'Cronologia (presto)'}
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
          <BiLogoMark style={{ width: '70%', height: '70%' }} />
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
function Conversation({ messages, loading }) {
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
        return (
          <div key={i}>
            <div className="cp-bi-row">
              <div className="cp-av-mini"><BiLogoMark style={{ width: '78%', height: '78%' }} /></div>
              <div className={`cp-bubble cp-bi${m.error ? ' cp-error' : ''}`}>
                {m.content}
              </div>
            </div>
            {Array.isArray(m.results) && m.results.length > 0 && (
              <div className="cp-results">
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

      {loading && (
        <div className="cp-typing">
          <div className="cp-av-mini"><BiLogoMark style={{ width: '78%', height: '78%' }} /></div>
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
    restaurant.closes_at ? `aperto fino a ${restaurant.closes_at}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Link
      to={restaurant.slug ? `/restaurant/${restaurant.slug}` : '#'}
      className="cp-rcard"
    >
      <div className="cp-ph">
        {finalPhoto && <img src={finalPhoto} alt="" loading="lazy" />}
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
          <BiLogoMark style={{ width: '70%', height: '70%' }} />
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
