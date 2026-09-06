import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useCity } from '../../lib/CityContext'
import { getCurrentMoment } from '../../lib/hours'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import BiLogoMark from '../../components/UI/BiLogoMark'
import { PhotoOrEmoji } from '../../components/UI/SmartImage'
import './ChiediPage.css'

/**
 * /chiedi · "Chiedi a Bi" — chat AI dedicata.
 * - Empty state: hero breve + 6 prompt + blocco didattico richiudibile.
 * - Conversazione: bubble user/Bi + result-card + typing indicator.
 * - Auth gate: utenti anonimi possono visitare ma non chattare.
 * - URL persistente: /chiedi/:conversationId (replace dopo il primo invio).
 *
 * LAYOUT — leggere prima di toccare il CSS.
 * La pagina è una SCATOLA alta esattamente quanto l'area visibile, non un
 * documento che scrolla: `.chiedi-page` è `position: fixed` con altezza
 * presa da `visualViewport.height` (vedi useEffect "viewport lock"), con un
 * solo scroller interno (`.cp-body`) e la input bar come ultimo figlio flex.
 * Il documento è bloccato (classe `.cp-locked` su html+body).
 * Serve perché tre tentativi di tenere la barra `position: fixed` sopra la
 * tastiera su iOS sono falliti: un elemento `fixed` è ancorato al LAYOUT
 * viewport, che non si restringe quando la tastiera si apre, e Safari
 * scrolla il documento per portare in vista il campo attivo — la barra
 * finiva a metà schermo col contenuto che le scorreva sotto. Così non c'è
 * nessun elemento `fixed` da sbagliare né documento da scrollare.
 */
export default function ChiediPage() {
  const { user } = useAuth()
  const { city } = useCity()
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
  // Etichetta di avanzamento inviata dal server (evento SSE "status") mentre
  // Bi cerca: l'attesa piu lunga è quella, e tre puntini muti la fanno
  // sembrare piu lunga di quanto sia.
  const [status, setStatus] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationPending, setLocationPending] = useState(false)

  const pageRef = useRef(null)
  const bodyRef = useRef(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const initialMessageHandledRef = useRef(false)

  const isEmpty = messages.length === 0 && !loading

  /* ---- Viewport lock (vedi il commento in testa al file) ----
     `visualViewport` misura l'area davvero visibile: quando la tastiera si
     apre, la sua `height` cala di colpo. Ci ridimensioniamo su quella, così
     la scatola finisce sempre esattamente sopra la tastiera e la input bar,
     essendo l'ultimo figlio flex, ci si appoggia da sola. `offsetTop` copre
     il caso in cui iOS scrolli il visual viewport dentro il layout viewport
     (pinch-zoom, e a volte la tastiera stessa). */
  useEffect(() => {
    const el = pageRef.current
    const vv = window.visualViewport
    const root = document.documentElement
    // Solo mobile: sul desktop non esiste tastiera virtuale da schivare, e
    // la DesktopNavbar è `sticky` nel flusso — una pagina `fixed` la
    // coprirebbe. Lì la pagina resta un documento normale (vedi CSS).
    const mq = window.matchMedia('(max-width: 767px)')

    const unlock = () => {
      root.classList.remove('cp-locked')
      document.body.classList.remove('cp-locked')
      if (el) {
        el.style.height = ''
        el.style.transform = ''
      }
    }

    const sync = () => {
      if (!el) return
      if (!mq.matches) return unlock()
      root.classList.add('cp-locked')
      document.body.classList.add('cp-locked')
      if (!vv) return
      el.style.height = `${vv.height}px`
      el.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ''
    }

    sync()
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    mq.addEventListener('change', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      unlock()
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      mq.removeEventListener('change', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

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
          // Le conversazioni di prima del fix hanno righe assistant vuote
          // salvate in DB: senza questo filtro riaprendole si vedono bolle
          // di Bi bianche e mute.
          .filter((m) => m.content || (m.results && m.results.length > 0))
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
    setStatus(null)

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
          // Fascia oraria e città attiva: l'endpoint le supportava già ma
          // nessuno gliele passava, così Bi ragionava sempre "Torino, ora
          // imprecisata" anche col CityPicker su un'altra città.
          current_moment: getCurrentMoment().active || undefined,
          city: city?.name || undefined,
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

          if (evt === 'status') {
            setStatus(typeof parsed?.text === 'string' ? parsed.text : null)
          } else if (evt === 'delta') {
            gotAnyDelta = true
            setStatus(null)
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
            ? { ...msg, content: 'Non mi è arrivata la risposta. Riprova a chiedermelo?', streaming: false }
            : msg,
        ))
      }
    } catch (err) {
      console.error('[chiedi] sendMessage error', err)
      failWithError('Mmh, qualcosa non gira. Riprova tra un secondo?')
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }, [city?.name, convId, loading, navigate, user, userLocation])

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
    <div className="chiedi-page" ref={pageRef}>
      <ChiediHeader hasConversation={!isEmpty} onNewChat={() => {
        setMessages([])
        setConvId(null)
        navigate('/chiedi', { replace: true })
      }} />

      <div className="cp-body" ref={bodyRef}>
        {isEmpty ? (
          <EmptyState onPromptClick={sendMessage} />
        ) : (
          <Conversation messages={messages} loading={loading} status={status} onChip={sendMessage} />
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
          <small><span className="cp-dot" />in linea · rispondo subito</small>
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

/* L'empty state era tre schermate di testo prima di poter fare qualcosa:
   hero lungo, due blocchi didattici fitti, sei card e un tip finale che
   ripeteva il blocco didattico. Ora la prima cosa sotto il saluto sono le
   cose da toccare; la parte didattica resta (è il patto di trasparenza con
   l'utente) ma richiusa in un <details>, e il tip ridondante è sparito. */
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
        <p>Ti dico dove andare tra i locali che ho scelto io.</p>
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

      <details className="cp-explainer">
        <summary>
          Cosa so e cosa non so
          <svg className="cp-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="cp-explainer-body">
          <p>
            <span className="cp-ic cp-ic-yes" aria-hidden="true">✓</span>
            Quasi cento locali validati da me — il grosso a Torino, qualcuno in
            giro per l'Italia. Chiedimi cucina, zona, momento, piatti specifici,
            sconti attivi, chi è aperto adesso.
          </p>
          <p>
            <span className="cp-ic cp-ic-no" aria-hidden="true">~</span>
            Non so prezzi precisi, disponibilità di un tavolo o menu in tempo
            reale: per quelli ti passo il numero del locale. E se non ho la
            risposta te lo dico, invece di inventarmi un nome.
          </p>
        </div>
      </details>
    </>
  )
}

/* ============================================================ */
/*  Conversation                                                  */
/* ============================================================ */
function Conversation({ messages, loading, status, onChip }) {
  // /api/ai manda gia photo_url dentro il pick: qui restano solo i risultati
  // delle conversazioni vecchie, salvate prima che lo facesse.
  const allRestaurantIds = messages.flatMap((m) =>
    Array.isArray(m.results)
      ? m.results.filter((r) => r.restaurant_id && !r.photo_url).map((r) => r.restaurant_id)
      : [],
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
        // Finché non arriva il primo delta la bolla è vuota: lì dentro vanno i
        // puntini e l'etichetta di stato. Prima si vedeva solo un cursore
        // lampeggiante nel vuoto — l'attesa sembrava molto piu lunga di quanto
        // fosse (i .cp-typing sotto non compaiono mai: questa bolla esiste già).
        const isWaiting = isStreaming && !m.content
        return (
          <div key={i}>
            <div className="cp-bi-row">
              <div className="cp-av-mini"><BiLogoMark style={{ width: '88%', height: '88%' }} /></div>
              <div className={`cp-bubble cp-bi${m.error ? ' cp-error' : ''}`}>
                {m.content}
                {isWaiting ? (
                  <span className="cp-thinking">
                    <span className="cp-tdot" />
                    <span className="cp-tdot" />
                    <span className="cp-tdot" />
                    {i === messages.length - 1 && status && (
                      <span className="cp-tstatus">{status}</span>
                    )}
                  </span>
                ) : isStreaming ? (
                  <span className="cp-cursor" aria-hidden="true" />
                ) : null}
              </div>
            </div>
            {hasResults && (
              <div className="cp-results cp-results-in">
                {m.results.map((r, j) => (
                  <ResultCard
                    key={r.restaurant_id || r.slug || `${i}-${j}`}
                    restaurant={r}
                    photoUrl={r.photo_url || (r.restaurant_id ? photos[r.restaurant_id] : null)}
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
        // Senza risultati "Allarga la zona"/"Solo con sconto" non hanno senso:
        // lì servono chip che aiutino a riformulare la domanda.
        const chips = firstResult
          ? [
              `Cosa ordino da ${firstResult.name}?`,
              'Allarga la zona',
              'Solo con sconto',
            ]
          : [
              'Fammi altri esempi',
              'Cambia zona',
              'Qualcosa di economico',
            ]
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
            {status && <span className="cp-tstatus">{status}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ restaurant, photoUrl }) {
  const finalPhoto = photoUrl ? proxyImg(photoUrl) : null
  // `open_now` è tri-stato: true aperto, false chiuso, null orari sconosciuti.
  // La pill verde va solo sul true (prima si basava su closes_at, che è null
  // anche per i locali chiusi).
  const isOpen = restaurant.open_now === true
  const meta = [
    restaurant.category,
    // La guida non è solo torinese: se il locale è fuori dalla città che stai
    // guardando, la card lo dice invece di far finta di niente.
    restaurant.out_of_city && restaurant.city ? restaurant.city : restaurant.zone,
    restaurant.walk_minutes ? `${restaurant.walk_minutes} min a piedi` : null,
    isOpen && restaurant.closes_at ? `aperto fino a ${restaurant.closes_at}` : null,
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
        {isOpen && <span className="cp-open-pill">● Aperto</span>}
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
