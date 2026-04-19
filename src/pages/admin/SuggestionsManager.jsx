import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, proxyImg } from '../../lib/supabase'

const STATUS_CONFIG = {
  pending: { label: 'In attesa', bg: '#fef3c7', color: '#b45309' },
  reviewed: { label: 'Visto', bg: '#eef2ff', color: '#4338ca' },
  accepted: { label: 'Accettato', bg: '#ecfdf5', color: '#059669' },
  rejected: { label: 'Rifiutato', bg: '#fef2f2', color: '#dc2626' },
}

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

export default function SuggestionsManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    if (authLoading || !isAdmin) return
    fetchSuggestions()
  }, [authLoading, isAdmin])

  const fetchSuggestions = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('restaurant_suggestions')
      .select('*, profile:profiles(full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
    setSuggestions(data || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('restaurant_suggestions').update({ status }).eq('id', id)
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const stats = useMemo(() => ({
    total: suggestions.length,
    pending: suggestions.filter(s => !s.status || s.status === 'pending').length,
    accepted: suggestions.filter(s => s.status === 'accepted').length,
    rejected: suggestions.filter(s => s.status === 'rejected').length,
  }), [suggestions])

  const filtered = useMemo(() => {
    if (filter === 'all') return suggestions
    if (filter === 'pending') return suggestions.filter(s => !s.status || s.status === 'pending')
    return suggestions.filter(s => s.status === filter)
  }, [suggestions, filter])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Suggerimenti">
      <div style={{ padding: '20px 28px', fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1f', margin: 0 }}>Suggerimenti</h1>
          <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
            Nuovi ristoranti proposti dagli utenti
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="In attesa" value={stats.pending} color="#b45309" />
          <StatCard label="Accettati" value={stats.accepted} color="#059669" />
          <StatCard label="Rifiutati" value={stats.rejected} color="#999" />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { key: 'all', label: 'Tutti', count: stats.total },
            { key: 'pending', label: 'In attesa', count: stats.pending },
            { key: 'accepted', label: 'Accettati', count: stats.accepted },
            { key: 'rejected', label: 'Rifiutati', count: stats.rejected },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '9px 14px',
                borderRadius: 10,
                border: '1px solid',
                borderColor: filter === f.key ? '#1a1a1f' : '#e5e5e5',
                background: filter === f.key ? '#1a1a1f' : '#fff',
                color: filter === f.key ? '#fff' : '#1a1a1f',
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
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>
              Nessun suggerimento
            </p>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              I suggerimenti degli utenti appariranno qui
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(s => {
              const statusConf = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending
              const userName = s.profile?.full_name || s.profile?.email || 'Utente'
              return (
                <motion.div
                  key={s.id}
                  layout
                  style={{
                    background: '#fff',
                    border: '1px solid #eee',
                    borderRadius: 12,
                    padding: 18,
                  }}
                >
                  {/* Header: name + status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1f' }}>
                        {s.restaurant_name}
                      </div>
                      {s.address && (
                        <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
                          {s.address}
                        </div>
                      )}
                    </div>
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      background: statusConf.bg,
                      color: statusConf.color,
                      flexShrink: 0,
                    }}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Google Maps link */}
                  {s.google_maps_url && (
                    <a
                      href={s.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: '#EE5C55',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginBottom: 10,
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                      </svg>
                      Google Maps
                    </a>
                  )}

                  {/* Tags */}
                  {s.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {s.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: 11,
                          padding: '3px 10px',
                          borderRadius: 10,
                          background: '#f5f5f5',
                          color: '#666',
                          fontWeight: 500,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {s.description && (
                    <p style={{
                      fontSize: 13,
                      color: '#1a1a1f',
                      lineHeight: 1.55,
                      margin: '0 0 12px',
                      fontStyle: 'italic',
                    }}>
                      "{s.description}"
                    </p>
                  )}

                  {/* Photo */}
                  {s.photo_url && (
                    <img
                      src={proxyImg(s.photo_url)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: 140,
                        height: 90,
                        objectFit: 'cover',
                        borderRadius: 10,
                        marginBottom: 12,
                        border: '1px solid #eee',
                      }}
                    />
                  )}

                  {/* Footer: user + actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    paddingTop: 12,
                    borderTop: '1px solid #f3f3f3',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666', minWidth: 0 }}>
                      {s.profile?.avatar_url ? (
                        <img src={s.profile.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: '#f3f3f3', color: '#666',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                        }}>
                          {userName[0]?.toUpperCase()}
                        </div>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {userName} · {timeAgo(s.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {s.status !== 'reviewed' && (
                        <button
                          onClick={() => updateStatus(s.id, 'reviewed')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#eef2ff',
                            color: '#4338ca',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Visto
                        </button>
                      )}
                      {s.status !== 'accepted' && (
                        <button
                          onClick={() => updateStatus(s.id, 'accepted')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#ecfdf5',
                            color: '#059669',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Accetta
                        </button>
                      )}
                      {s.status !== 'rejected' && (
                        <button
                          onClick={() => updateStatus(s.id, 'rejected')}
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
                          }}
                        >
                          Rifiuta
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
