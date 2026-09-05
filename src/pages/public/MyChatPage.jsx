import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import BiLogoMark from '../../components/UI/BiLogoMark'

/**
 * /profile/chat · "Le mie conversazioni con Bi"
 *
 * Lista conversazioni AI per l'utente autenticato. Click su una riga →
 * apre `/chiedi/:conversationId` (ChiediPage la ricarica e l'utente
 * può continuare a scriverci). CTA "Nuova chat" → /chiedi pulito.
 *
 * Le RLS policy su ai_conversations filtrano automaticamente per user_id.
 */
export default function MyChatPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loadingList, setLoadingList] = useState(() => !!(user?.id && isSupabaseConfigured()))

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return
    let cancelled = false
    supabase
      .from('ai_conversations')
      .select('id, title, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return
        setConversations(data || [])
        setLoadingList(false)
      })
    return () => { cancelled = true }
  }, [user?.id])

  const deleteConversation = async (id, e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!confirm('Eliminare questa conversazione?')) return
    await supabase.from('ai_conversations').delete().eq('id', id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
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

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 20 }}>
          <div>
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
            <p style={{ fontSize: 13, color: 'var(--color-ink-70)' }}>
              Tutto quello che hai chiesto a Bi, in ordine di recenza.
            </p>
          </div>

          <Link
            to="/chiedi"
            aria-label="Nuova chat"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: 'var(--color-cta)',
              color: '#fff',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 6px 14px rgba(232,69,60,.3)',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nuova chat
          </Link>
        </div>

        {loadingList ? (
          <div style={{ color: 'var(--color-ink-70)' }}>Caricamento…</div>
        ) : conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                onDelete={(e) => deleteConversation(c.id, e)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ConversationRow({ conversation, onDelete }) {
  return (
    <Link
      to={`/chiedi/${conversation.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: '#fff',
        border: '1px solid var(--color-ink-05)',
        borderRadius: 16,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color .15s ease, transform .1s ease',
        overflow: 'hidden',
        minWidth: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-corallo)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-ink-05)' }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-corallo) 0%, var(--color-corallo-ink, #B92E26) 100%)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <BiLogoMark style={{ width: '75%', height: '75%' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--color-ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {conversation.title || '(senza titolo)'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 3 }}>
          {new Date(conversation.updated_at).toLocaleString('it-IT', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Elimina conversazione"
        style={{
          flexShrink: 0,
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
      <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--color-ink-70)', flexShrink: 0 }}>›</span>
    </Link>
  )
}

function EmptyState() {
  return (
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
        Inizia a chattare con Bi e te le ritroverai qui.
      </div>
      <Link
        to="/chiedi"
        style={{
          display: 'inline-flex',
          padding: '10px 18px',
          background: 'var(--color-cta)',
          color: '#fff',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        Apri Chiedi a Bi
      </Link>
    </div>
  )
}
