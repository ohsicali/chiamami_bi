import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

const STATUS_CONFIG = {
  pending: { label: 'In attesa', bg: 'var(--color-corallo-wash)', color: 'var(--color-corallo)' },
  contacted: { label: 'Contattato', bg: 'var(--color-cream)', color: 'var(--color-ink)' },
  approved: { label: 'Approvato', bg: 'var(--color-green-wash)', color: '#2d7a4f' },
  rejected: { label: 'Rifiutato', bg: 'var(--color-cream)', color: '#888' },
}

function StatCard({ label, value, color = 'var(--color-ink)' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-line)',
      borderRadius: 12,
      padding: '16px 18px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 6 }}>
        {value}
      </div>
    </div>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Oggi'
  if (days === 1) return 'Ieri'
  if (days < 7) return `${days}gg fa`
  if (days < 30) return `${Math.floor(days / 7)}sett fa`
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ApplicationManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    if (authLoading || !isAdmin) return
    if (!isSupabaseConfigured()) {
      setApplications([
        { id: '1', restaurant_name: 'Ristorante Da Mario', contact_name: 'Mario Rossi', email: 'mario@damario.it', phone: '+39 011 123456', city: 'Torino', message: 'Vorremmo entrare nella vostra piattaforma', status: 'pending', created_at: '2026-03-20T10:00:00Z' },
        { id: '2', restaurant_name: 'Pizzeria Bella Napoli', contact_name: 'Giovanni Bianchi', email: 'info@bellanapoli.it', phone: '+39 011 654321', city: 'Torino', message: '', status: 'contacted', created_at: '2026-03-18T10:00:00Z' },
      ])
      setLoading(false)
      return
    }

    supabase
      .from('partner_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setApplications(data || [])
        setLoading(false)
      })
  }, [authLoading, isAdmin])

  const handleStatusChange = async (id, newStatus) => {
    if (isSupabaseConfigured()) {
      await supabase.from('partner_applications').update({ status: newStatus }).eq('id', id)
    }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    if (isSupabaseConfigured()) {
      await supabase.from('partner_applications').delete().eq('id', deleteConfirm.id)
    }
    setApplications(prev => prev.filter(a => a.id !== deleteConfirm.id))
    setDeleteConfirm(null)
  }

  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending' || !a.status).length,
    contacted: applications.filter(a => a.status === 'contacted').length,
    approved: applications.filter(a => a.status === 'approved').length,
  }), [applications])

  const filtered = useMemo(() => {
    if (filter === 'all') return applications
    if (filter === 'pending') return applications.filter(a => a.status === 'pending' || !a.status)
    return applications.filter(a => a.status === filter)
  }, [applications, filter])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout>
      <div style={{ fontFamily: "var(--font-sans)" }}>
        {/* ── Desktop sticky top bar ── */}
        <div
          className="hidden md:flex"
          style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: 'var(--color-page)',
            borderBottom: '1px solid var(--color-line)',
            padding: '0 28px', height: 56,
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '20px 20px 0', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 6 }}>
            Admin · <b style={{ color: 'var(--color-ink)' }}>Candidature</b>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-ink)', margin: '0 0 2px', fontFamily: 'var(--font-sans)' }}>
            Chi vuole entrare nella guida
          </h1>
          <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
            {stats.total} in coda · {stats.pending} nuove
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, margin: '0 20px 16px', flexWrap: 'wrap' }}>
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="In attesa" value={stats.pending} color="var(--color-corallo)" />
          <StatCard label="Contattati" value={stats.contacted} color="var(--color-ink)" />
          <StatCard label="Approvati" value={stats.approved} color="#2d7a4f" />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, margin: '0 20px 16px', overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { key: 'all', label: 'Tutti', count: stats.total },
            { key: 'pending', label: 'In attesa', count: stats.pending },
            { key: 'contacted', label: 'Contattati', count: stats.contacted },
            { key: 'approved', label: 'Approvati', count: stats.approved },
            { key: 'rejected', label: 'Rifiutati', count: applications.filter(a => a.status === 'rejected').length },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '9px 14px',
                borderRadius: 10,
                border: '1px solid',
                borderColor: filter === f.key ? 'var(--color-ink)' : '#e5e5e5',
                background: filter === f.key ? 'var(--color-ink)' : '#fff',
                color: filter === f.key ? '#fff' : 'var(--color-ink)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {f.label}
              <span style={{
                background: filter === f.key ? 'rgba(255,255,255,0.2)' : '#f3f3f3',
                color: filter === f.key ? '#fff' : '#666',
                borderRadius: 10,
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 700,
              }}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 13 }}>
            Caricamento...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            margin: '0 20px',
            background: '#fff',
            border: '1px solid var(--color-line)',
            borderRadius: 14,
            padding: 60,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
              Nessuna candidatura
            </p>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              Le nuove candidature arriveranno dalla pagina /partner
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px' }}>
            {filtered.map(a => {
              const st = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending
              return (
                <motion.div
                  key={a.id}
                  layout
                  style={{
                    background: '#fff',
                    border: '1px solid var(--color-line)',
                    borderRadius: 12,
                    padding: 18,
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>
                        {a.restaurant_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
                        {a.city || '—'} · {timeAgo(a.created_at)}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      background: st.bg,
                      color: st.color,
                      flexShrink: 0,
                    }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Contact info */}
                  <div style={{
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: a.message ? 10 : 12,
                    display: 'grid',
                    gap: 6,
                    fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#999', minWidth: 70 }}>Referente:</span>
                      <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{a.contact_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#999', minWidth: 70 }}>Email:</span>
                      <a href={`mailto:${a.email}`} style={{ color: 'var(--color-corallo)', textDecoration: 'none', fontWeight: 500 }}>
                        {a.email || '—'}
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#999', minWidth: 70 }}>Telefono:</span>
                      <a href={`tel:${a.phone}`} style={{ color: 'var(--color-ink)', textDecoration: 'none', fontWeight: 500 }}>
                        {a.phone || '—'}
                      </a>
                    </div>
                  </div>

                  {/* Message */}
                  {a.message && (
                    <p style={{
                      fontSize: 13,
                      color: 'var(--color-ink)',
                      lineHeight: 1.55,
                      margin: '0 0 12px',
                      fontStyle: 'italic',
                      padding: '10px 12px',
                      background: '#fafafa',
                      borderLeft: '3px solid var(--color-corallo)',
                      borderRadius: '0 8px 8px 0',
                    }}>
                      "{a.message}"
                    </p>
                  )}

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    paddingTop: 12,
                    borderTop: '1px solid #f3f3f3',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}>
                    <select
                      value={a.status || 'pending'}
                      onChange={e => handleStatusChange(a.id, e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--color-line)',
                        background: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setDeleteConfirm(a)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#fef2f2',
                        color: 'var(--color-corallo)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        marginLeft: 'auto',
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Delete confirm modal */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: 20,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: 14, padding: 24,
                  maxWidth: 400, width: '100%', border: '1px solid var(--color-line)',
                  fontFamily: "var(--font-sans)",
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>
                  Eliminare candidatura?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '8px 0 20px' }}>
                  Stai per eliminare "{deleteConfirm.restaurant_name}". Questa azione è irreversibile.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: '1px solid var(--color-line)',
                      background: '#fff', color: 'var(--color-ink)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: 'none',
                      background: 'var(--color-corallo)', color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  )
}
