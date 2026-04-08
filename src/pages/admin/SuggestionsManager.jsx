import { useState, useEffect } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, proxyImg } from '../../lib/supabase'

const STATUS_CONFIG = {
  pending: { label: 'In attesa', bg: '#FEF3C7', color: '#92400E' },
  reviewed: { label: 'Visto', bg: '#DBEAFE', color: '#1E40AF' },
  accepted: { label: 'Accettato', bg: '#D1FAE5', color: '#065F46' },
  rejected: { label: 'Rifiutato', bg: '#FEE2E2', color: '#991B1B' },
}

export default function SuggestionsManager() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSuggestions = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('restaurant_suggestions')
      .select('*, profile:profiles(full_name, email)')
      .order('created_at', { ascending: false })
    setSuggestions(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSuggestions() }, [])

  const updateStatus = async (id, status) => {
    await supabase.from('restaurant_suggestions').update({ status }).eq('id', id)
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  return (
    <AdminLayout title="Suggerimenti ristoranti">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>Suggerimenti</h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
              {suggestions.length} suggeriment{suggestions.length === 1 ? 'o' : 'i'} dagli utenti
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Caricamento...</div>
        ) : suggestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Nessun suggerimento</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>I suggerimenti degli utenti appariranno qui</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {suggestions.map(s => {
              const statusConf = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending
              const userName = s.profile?.full_name || s.profile?.email || 'Utente'
              const date = new Date(s.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
              return (
                <div key={s.id} style={{
                  background: '#fff', borderRadius: 16, padding: 20,
                  border: '1px solid #e5e7eb',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'TAN Songbird', serif", fontSize: 18, fontWeight: 700 }}>
                        {s.restaurant_name}
                      </div>
                      {s.address && (
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{s.address}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                      background: statusConf.bg, color: statusConf.color,
                    }}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Google Maps link */}
                  {s.google_maps_url && (
                    <a href={s.google_maps_url} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 12, color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: 4,
                      marginBottom: 10, textDecoration: 'none',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
                          fontSize: 11, padding: '3px 10px', borderRadius: 12,
                          background: '#f3f4f6', color: '#374151',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {s.description && (
                    <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 10 }}>
                      "{s.description}"
                    </p>
                  )}

                  {/* Photo */}
                  {s.photo_url && (
                    <img src={proxyImg(s.photo_url)} alt="" loading="lazy" decoding="async" style={{
                      width: 120, height: 80, objectFit: 'cover', borderRadius: 10, marginBottom: 10,
                    }} />
                  )}

                  {/* Footer: user + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {userName} · {date}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {s.status !== 'reviewed' && (
                        <button onClick={() => updateStatus(s.id, 'reviewed')} style={{
                          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                          background: '#DBEAFE', color: '#1E40AF', border: 'none', cursor: 'pointer',
                        }}>
                          Visto
                        </button>
                      )}
                      {s.status !== 'accepted' && (
                        <button onClick={() => updateStatus(s.id, 'accepted')} style={{
                          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                          background: '#D1FAE5', color: '#065F46', border: 'none', cursor: 'pointer',
                        }}>
                          Accetta
                        </button>
                      )}
                      {s.status !== 'rejected' && (
                        <button onClick={() => updateStatus(s.id, 'rejected')} style={{
                          fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                          background: '#FEE2E2', color: '#991B1B', border: 'none', cursor: 'pointer',
                        }}>
                          Rifiuta
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
