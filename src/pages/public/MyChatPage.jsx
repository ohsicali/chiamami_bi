import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'

/**
 * /profile/chat · "Le mie conversazioni con Bi"
 * Lista conversazioni AI per l'utente autenticato.
 * Le RLS policy su ai_conversations filtrano automaticamente per user_id.
 */
export default function MyChatPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingList, setLoadingList] = useState(() => !!(user?.id && isSupabaseConfigured()))
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return
    supabase
      .from('ai_conversations')
      .select('id, title, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setConversations(data || [])
        setLoadingList(false)
      })
  }, [user?.id])

  const openConversation = async (id) => {
    setSelected(id)
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoadingMsgs(false)
  }

  const deleteConversation = async (id) => {
    if (!confirm('Eliminare questa conversazione?')) return
    await supabase.from('ai_conversations').delete().eq('id', id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (selected === id) {
      setSelected(null)
      setMessages([])
    }
  }

  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div style={{ background: 'var(--color-page, #FAF7F2)', minHeight: '100dvh', paddingBottom: TAB_BAR_HEIGHT + 30 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 40px' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--color-ink-05)',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-ink)',
            border: 0,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          ← Indietro
        </button>

        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Le mie conversazioni con Bi
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-ink-70)', marginBottom: 20 }}>
          Tutto quello che hai chiesto a Bi, in ordine di recenza.
        </p>

        {loadingList ? (
          <div style={{ color: 'var(--color-ink-70)' }}>Caricamento…</div>
        ) : conversations.length === 0 ? (
          <div
            style={{
              padding: '32px 24px',
              background: '#fff',
              border: '1px solid var(--color-ink-05)',
              borderRadius: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
              Ancora nessuna conversazione
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-70)', marginBottom: 14 }}>
              Torna in home e prova "Chiedi a Bi".
            </div>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                padding: '10px 18px',
                background: 'var(--color-corallo)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Vai alla home
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {conversations.map((c) => (
              <div
                key={c.id}
                style={{
                  background: '#fff',
                  border: `1px solid ${selected === c.id ? 'var(--color-corallo)' : 'var(--color-ink-05)'}`,
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => (selected === c.id ? setSelected(null) : openConversation(c.id))}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--color-ink)' }}>
                      {c.title || '(senza titolo)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 3 }}>
                      Ultima attività: {new Date(c.updated_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteConversation(c.id) }}
                    aria-label="Elimina conversazione"
                    style={{
                      padding: '6px 10px',
                      background: '#FDEBEA',
                      color: '#C6372F',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      border: 0,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {selected === c.id && (
                  <div style={{ borderTop: '1px solid var(--color-ink-05)', padding: 14, background: 'var(--color-page, #FAF7F2)' }}>
                    {loadingMsgs ? (
                      <div style={{ fontSize: 12, color: 'var(--color-ink-70)' }}>Caricamento messaggi…</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {messages.map((m, i) => <Bubble key={i} m={m} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Bubble({ m }) {
  const isUser = m.role === 'user'
  const text = m.content?.text || (typeof m.content === 'string' ? m.content : '')
  const results = Array.isArray(m.content?.results) ? m.content.results : []

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '82%',
          padding: '9px 14px',
          background: isUser ? 'var(--color-ink)' : '#fff',
          color: isUser ? '#fff' : 'var(--color-ink)',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          border: isUser ? 'none' : '1px solid var(--color-ink-05)',
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
        {!isUser && results.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.slice(0, 3).map((r, i) => (
              <Link
                key={i}
                to={r.slug ? `/restaurant/${r.slug}` : '#'}
                style={{
                  padding: '8px 10px',
                  background: 'var(--color-ink-05)',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: 'var(--color-ink)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: 'var(--color-ink-70)' }}>
                  {[r.category, r.zone, r.price].filter(Boolean).join(' · ')}
                </div>
                {r.why && (
                  <div style={{ fontFamily: 'var(--font-hand, "Caveat", cursive)', color: 'var(--color-corallo-ink, #C6372F)', fontSize: 14, marginTop: 3 }}>
                    {r.why}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
