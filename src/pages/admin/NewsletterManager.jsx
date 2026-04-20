import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

function StatCard({ label, value, color = '#1a1a1f' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #eee',
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

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NewsletterManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    if (authLoading || !isAdmin) return
    if (!isSupabaseConfigured()) {
      setSubscribers([
        { id: '1', email: 'mario@example.com', created_at: '2026-03-01T10:00:00Z' },
        { id: '2', email: 'laura@example.com', created_at: '2026-03-10T10:00:00Z' },
        { id: '3', email: 'giuseppe@example.com', created_at: '2026-03-15T10:00:00Z' },
      ])
      setLoading(false)
      return
    }

    supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSubscribers(data || [])
        setLoading(false)
      })
  }, [authLoading, isAdmin])

  const handleDelete = async () => {
    if (!deleteConfirm) return
    if (isSupabaseConfigured()) {
      await supabase.from('newsletter_subscribers').delete().eq('id', deleteConfirm.id)
    }
    setSubscribers(prev => prev.filter(s => s.id !== deleteConfirm.id))
    setDeleteConfirm(null)
  }

  const handleExportCSV = () => {
    const csv = ['email,data_iscrizione']
    subscribers.forEach(s => {
      csv.push(`${s.email},${new Date(s.created_at).toLocaleDateString('it-IT')}`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter_subscribers_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 86400000
    const monthAgo = now - 30 * 86400000
    return {
      total: subscribers.length,
      week: subscribers.filter(s => new Date(s.created_at).getTime() >= weekAgo).length,
      month: subscribers.filter(s => new Date(s.created_at).getTime() >= monthAgo).length,
    }
  }, [subscribers])

  const filtered = useMemo(() => {
    if (!search.trim()) return subscribers
    const q = search.trim().toLowerCase()
    return subscribers.filter(s => (s.email || '').toLowerCase().includes(q))
  }, [subscribers, search])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Newsletter">
      <div style={{ padding: '20px 28px', fontFamily: "var(--font-sans)" }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1f', margin: 0 }}>Newsletter</h1>
            <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
              Iscritti alla newsletter di ChiamamiBi
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={subscribers.length === 0}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#1a1a1f',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: subscribers.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: subscribers.length === 0 ? 0.4 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Esporta CSV
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="Ultimi 7 giorni" value={stats.week} color="#059669" />
          <StatCard label="Ultimi 30 giorni" value={stats.month} color="#059669" />
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per email..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #e5e5e5',
              background: '#fff',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#1a1a1f',
              outline: 'none',
            }}
          />
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 13 }}>
            Caricamento...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>
              {subscribers.length === 0 ? 'Nessun iscritto' : 'Nessun risultato'}
            </p>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              {subscribers.length === 0 ? 'Gli utenti possono iscriversi dalla homepage' : 'Prova a modificare la ricerca'}
            </p>
          </div>
        ) : (
          <div style={{
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {filtered.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderTop: i === 0 ? 'none' : '1px solid #f3f3f3',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#f3f3f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#666',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.email}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      Iscritto il {formatDate(s.created_at)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirm(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Elimina
                </button>
              </div>
            ))}
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
                  maxWidth: 400, width: '100%', border: '1px solid #eee',
                  fontFamily: "var(--font-sans)",
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1f', margin: 0 }}>
                  Eliminare iscritto?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '8px 0 20px' }}>
                  Stai per rimuovere "{deleteConfirm.email}" dalla newsletter.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e5e5',
                      background: '#fff', color: '#1a1a1f', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: 'none',
                      background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600,
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
