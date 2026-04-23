import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'
import PillTab from '../../components/admin/PillTab'

const STATUS_CONFIG = {
  pending: { label: 'In attesa', bg: 'var(--color-corallo-wash, #FDEDEB)', color: 'var(--color-corallo, #E8453C)', dot: 'var(--color-corallo, #E8453C)' },
  contacted: { label: 'Contattato', bg: 'var(--color-oro-wash, #F5EDDD)', color: 'var(--color-oro, #B08954)', dot: 'var(--color-oro, #B08954)' },
  approved: { label: 'Approvato', bg: 'var(--color-green-wash, #E8F5D8)', color: '#2C7A4A', dot: '#2C7A4A' },
  rejected: { label: 'Archiviato', bg: 'var(--color-cream-deep, #F1EBE0)', color: 'var(--color-ink-55, rgba(34,24,28,0.55))', dot: '#999' },
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return 'Adesso'
  if (hours < 24) return `${hours}h fa`
  if (days === 1) return 'Ieri'
  if (days < 7) return `${days}gg fa`
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export default function ApplicationManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (authLoading || !isAdmin) return
    if (!isSupabaseConfigured()) {
      setApplications([])
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (cancelled) return
      setApplications(data || [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAdmin])

  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter((a) => a.status === 'pending' || !a.status).length,
    contacted: applications.filter((a) => a.status === 'contacted').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  }), [applications])

  const filtered = useMemo(() => {
    let result = applications
    if (filter === 'pending') result = result.filter((a) => a.status === 'pending' || !a.status)
    else if (filter !== 'all') result = result.filter((a) => a.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          (a.restaurant_name || '').toLowerCase().includes(q) ||
          (a.contact_name || '').toLowerCase().includes(q) ||
          (a.city || '').toLowerCase().includes(q) ||
          (a.email || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [applications, filter, search])

  const selected = useMemo(() => filtered.find((a) => a.id === selectedId) || filtered[0] || null, [filtered, selectedId])

  async function handleStatusChange(id, newStatus) {
    if (isSupabaseConfigured()) {
      await supabase.from('partner_applications').update({ status: newStatus }).eq('id', id)
    }
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)))
  }

  async function handleArchive(id) {
    if (!confirm('Archiviare questa candidatura? Puoi sempre riaprirla dopo dai filtri.')) return
    await handleStatusChange(id, 'rejected')
  }

  function handleCreateFromApplication(app) {
    // Mark as approved and open new-restaurant page with hint in URL
    handleStatusChange(app.id, 'approved')
    const params = new URLSearchParams()
    if (app.restaurant_name) params.set('name', app.restaurant_name)
    if (app.email) params.set('email', app.email)
    if (app.city) params.set('city', app.city)
    navigate(`/admin/restaurant/new?${params.toString()}`)
  }

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Candidature">
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }} className="max-md:!p-[18px]">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            Business › <b style={{ color: 'var(--color-ink)', fontWeight: 800 }}>Candidature ristoratori</b>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 32,
              letterSpacing: '-0.025em',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              color: 'var(--color-ink, #22181C)',
              flexWrap: 'wrap',
            }}
          >
            Candidature
            {stats.pending > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  background: 'var(--color-corallo-wash, #FDEDEB)',
                  color: 'var(--color-corallo, #E8453C)',
                  padding: '5px 10px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                }}
              >
                {stats.pending} non lett{stats.pending === 1 ? 'a' : 'e'}
              </span>
            )}
          </h1>
          <div style={{ marginTop: 6, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 14, fontWeight: 500 }}>
            Ristoratori che vogliono entrare nella guida · target di risposta: entro 3 giorni
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <PillTab active={filter === 'pending'} count={stats.pending} onClick={() => setFilter('pending')}>
            Da gestire
          </PillTab>
          <PillTab active={filter === 'contacted'} count={stats.contacted} onClick={() => setFilter('contacted')}>
            Contattati
          </PillTab>
          <PillTab active={filter === 'approved'} count={stats.approved} onClick={() => setFilter('approved')}>
            Approvati
          </PillTab>
          <PillTab active={filter === 'rejected'} count={stats.rejected} onClick={() => setFilter('rejected')}>
            Archiviati
          </PillTab>
          <PillTab active={filter === 'all'} count={stats.total} onClick={() => setFilter('all')}>
            Tutti
          </PillTab>
        </div>

        {/* 2-col layout (inbox + detail) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '340px 1fr',
            gap: 16,
            minHeight: 540,
          }}
          className="max-md:!grid-cols-1"
        >
          {/* Inbox list */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--color-line, #EAE3D7)',
              borderRadius: 18,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: 12, borderBottom: '1px solid var(--color-line, #EAE3D7)', background: 'var(--color-cream, #F5F0E4)' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome ristorante…"
                style={{
                  width: '100%',
                  border: '1px solid var(--color-line, #EAE3D7)',
                  borderRadius: 999,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  background: '#fff',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 520 }}>
              {loading && <div style={inboxEmptyStyle}>Carico…</div>}
              {!loading && filtered.length === 0 && (
                <div style={inboxEmptyStyle}>Nessuna candidatura in questo stato.</div>
              )}
              {filtered.map((a) => (
                <InboxRow
                  key={a.id}
                  app={a}
                  active={selected?.id === a.id}
                  onClick={() => setSelectedId(a.id)}
                />
              ))}
            </div>
          </div>

          {/* Detail pane */}
          {selected ? (
            <DetailPane
              app={selected}
              onStatusChange={(s) => handleStatusChange(selected.id, s)}
              onArchive={() => handleArchive(selected.id)}
              onCreateFromApplication={() => handleCreateFromApplication(selected)}
            />
          ) : (
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--color-line, #EAE3D7)',
                borderRadius: 18,
                padding: '60px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 36 }} aria-hidden>📥</div>
              <div>Seleziona una candidatura a sinistra per leggerla.</div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

function InboxRow({ app, active, onClick }) {
  const st = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
  const isUnread = app.status === 'pending' || !app.status
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 14,
        borderBottom: '1px solid var(--color-line, #EAE3D7)',
        cursor: 'pointer',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        width: '100%',
        textAlign: 'left',
        background: active ? 'var(--color-cream, #F5F0E4)' : 'transparent',
        border: 'none',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isUnread ? st.dot : 'transparent',
          border: isUnread ? 'none' : '1px solid var(--color-line, #EAE3D7)',
          marginTop: 6,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-ink)' }}>
          {app.restaurant_name || '—'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            marginTop: 2,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {(app.message || '(nessun messaggio)').slice(0, 80)}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            marginTop: 4,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {timeAgo(app.created_at)}
          {app.city && ` · ${app.city}`}
        </div>
      </div>
    </button>
  )
}

function DetailPane({ app, onStatusChange, onArchive, onCreateFromApplication }) {
  const st = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 18,
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', margin: 0, color: 'var(--color-ink)' }}>
          {app.restaurant_name || '—'}
        </h2>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 999,
            background: st.bg,
            color: st.color,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {st.label}
        </span>
      </div>
      <div style={{ color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
        Da <b style={{ color: 'var(--color-ink)' }}>{app.contact_name || '—'}</b>
        {app.email && <> · <a href={`mailto:${app.email}`} style={{ color: 'var(--color-corallo, #E8453C)', textDecoration: 'none' }}>{app.email}</a></>}
        {app.created_at && <> · {new Date(app.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
      </div>

      {/* Fields grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          background: 'var(--color-cream, #F5F0E4)',
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
          fontSize: 12,
        }}
        className="max-md:!grid-cols-1"
      >
        <Field label="Indirizzo" value={app.city || '—'} />
        <Field label="Telefono" value={app.phone ? <a href={`tel:${app.phone}`} style={linkStyle}>{app.phone}</a> : '—'} />
      </div>

      {/* Message */}
      <div
        style={{
          flex: 1,
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--color-ink-70, rgba(34,24,28,0.7))',
          padding: 16,
          borderRadius: 12,
          background: 'var(--color-cream, #F5F0E4)',
          marginBottom: 16,
          whiteSpace: 'pre-wrap',
        }}
      >
        {app.message || <i style={{ color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>Il candidato non ha lasciato un messaggio.</i>}
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          paddingTop: 16,
          borderTop: '1px dashed var(--color-line, #EAE3D7)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button type="button" onClick={onCreateFromApplication} style={primaryBtn}>
          → Apri pre-compilata
        </button>
        {app.email && (
          <a href={`mailto:${app.email}?subject=Re: la tua candidatura a chiamamibi.com`} style={ghostBtn}>
            Rispondi via email
          </a>
        )}
        {app.status !== 'contacted' && (
          <button type="button" onClick={() => onStatusChange('contacted')} style={ghostBtn}>
            Segna come contattato
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onArchive} style={rejectBtn}>
          Archivia (non interessa)
        </button>
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px dashed var(--color-line, #EAE3D7)',
          fontSize: 11,
          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
          fontWeight: 500,
          lineHeight: 1.6,
        }}
      >
        <b style={{ color: 'var(--color-ink)' }}>Apri pre-compilata</b> porta alla pagina{' '}
        <Link to="/admin/restaurant/new" style={{ color: 'var(--color-corallo, #E8453C)' }}>Nuovo ristorante</Link>{' '}
        con nome, email e città già compilati. Puoi rifinire la scheda e pubblicarla in 60 secondi.
      </div>

      <AnimatePresence>{false}</AnimatePresence>
    </section>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div
        style={{
          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
          fontWeight: 800,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 800, color: 'var(--color-ink)' }}>{value}</div>
    </div>
  )
}

const inboxEmptyStyle = {
  padding: 24,
  textAlign: 'center',
  fontSize: 12,
  color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
}

const primaryBtn = {
  background: 'var(--color-corallo, #E8453C)',
  color: '#fff',
  border: 0,
  padding: '10px 18px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
}

const ghostBtn = {
  background: 'transparent',
  border: '1px solid var(--color-line, #EAE3D7)',
  color: 'var(--color-ink, #22181C)',
  padding: '9px 16px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  fontFamily: 'var(--font-sans)',
  display: 'inline-block',
}

const rejectBtn = {
  background: 'transparent',
  border: '1px solid var(--color-line, #EAE3D7)',
  color: 'var(--color-danger, #C0392B)',
  padding: '9px 16px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

const linkStyle = {
  color: 'var(--color-corallo, #E8453C)',
  textDecoration: 'none',
  fontWeight: 700,
}
