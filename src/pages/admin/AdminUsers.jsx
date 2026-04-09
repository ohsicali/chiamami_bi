import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

/* ------------------------------------------------------------------ */
/*  StatCard                                                           */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, color = '#1a1a1f' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #eee',
      borderRadius: 10,
      padding: 12,
    }}>
      <div style={{ fontSize: 10, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Oggi'
  if (days === 1) return 'Ieri'
  if (days < 7) return `${days} giorni fa`
  if (days < 30) return `${Math.floor(days / 7)} settimane fa`
  if (days < 365) return `${Math.floor(days / 30)} mesi fa`
  return `${Math.floor(days / 365)} anni fa`
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
export default function AdminUsers() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (authLoading || !isAdmin) return
    fetchUsers()
  }, [authLoading, isAdmin])

  const fetchUsers = async () => {
    setLoading(true)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, is_admin, created_at')
      .order('created_at', { ascending: false })

    if (!profiles) {
      setUsers([])
      setLoading(false)
      return
    }

    const [reviewsRes, savedRes, redeemRes] = await Promise.all([
      supabase.from('user_reviews').select('user_id'),
      supabase.from('saved_restaurants').select('user_id'),
      supabase.from('discount_redemptions').select('user_id'),
    ])

    const reviewCounts = {}
    ;(reviewsRes.data || []).forEach(r => { reviewCounts[r.user_id] = (reviewCounts[r.user_id] || 0) + 1 })
    const savedCounts = {}
    ;(savedRes.data || []).forEach(s => { savedCounts[s.user_id] = (savedCounts[s.user_id] || 0) + 1 })
    const redeemCounts = {}
    ;(redeemRes.data || []).forEach(r => { redeemCounts[r.user_id] = (redeemCounts[r.user_id] || 0) + 1 })

    setUsers(profiles.map(p => ({
      ...p,
      review_count: reviewCounts[p.id] || 0,
      saved_count: savedCounts[p.id] || 0,
      redeem_count: redeemCounts[p.id] || 0,
    })))
    setLoading(false)
  }

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 86400000
    const monthAgo = now - 30 * 86400000
    return {
      total: users.length,
      admins: users.filter(u => u.is_admin).length,
      newWeek: users.filter(u => new Date(u.created_at).getTime() >= weekAgo).length,
      newMonth: users.filter(u => new Date(u.created_at).getTime() >= monthAgo).length,
    }
  }, [users])

  const filtered = useMemo(() => {
    let list = users
    if (filter === 'admin') list = list.filter(u => u.is_admin)
    if (filter === 'recent') {
      const weekAgo = Date.now() - 7 * 86400000
      list = list.filter(u => new Date(u.created_at).getTime() >= weekAgo)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [users, filter, search])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Utenti">
      {/* ─── HEADER ─── */}
      <div style={{ borderBottom: '1px solid #eee', background: '#fff' }} className="px-[18px] py-[16px] md:px-[28px] md:py-[20px]">
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>Utenti</h1>
        <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>{users.length} utenti registrati</p>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="px-[18px] py-[16px] md:px-[28px] md:py-[24px]" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ─── STATS 2x2 mobile, 4 cols desktop ─── */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}
          className="md:!grid-cols-4"
        >
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="Admin" value={stats.admins} color="#b91c1c" />
          <StatCard label="Nuovi 7gg" value={stats.newWeek} color="#047857" />
          <StatCard label="Nuovi 30gg" value={stats.newMonth} color="#047857" />
        </div>

        {/* ─── SEARCH ─── */}
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #eee',
              background: '#fff',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#1a1a1f',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ─── FILTERS ─── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
          {[
            { key: 'all', label: 'Tutti', count: users.length },
            { key: 'admin', label: 'Admin', count: stats.admins },
            { key: 'recent', label: 'Recenti 7gg', count: stats.newWeek },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: filter === f.key ? '#1a1a1f' : '#eee',
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
                borderRadius: 8,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
              }}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* ─── LIST ─── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 13 }}>
            Caricamento...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: '#fff', border: '1px solid #eee', borderRadius: 12,
            padding: 60, textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>Nessun utente trovato</p>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>Prova a modificare i filtri</p>
          </div>
        ) : (
          <>
            {/* ─── DESKTOP TABLE ─── */}
            <div className="hidden md:block" style={{
              background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                    <th style={thStyle}>Utente</th>
                    <th style={thStyle}>Registrato</th>
                    <th style={thStyle}>Recensioni</th>
                    <th style={thStyle}>Salvati</th>
                    <th style={thStyle}>QR</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Ruolo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f3f3f3' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'rgba(232,69,60,0.15)', color: '#E8453C',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 600, flexShrink: 0,
                          }}>
                            {(u.full_name || u.email || '?')[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#1a1a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.full_name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                              {u.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: '#666', fontSize: 12 }}>{timeAgo(u.created_at)}</td>
                      <td style={tdStyle}>{u.review_count}</td>
                      <td style={tdStyle}>{u.saved_count}</td>
                      <td style={tdStyle}>{u.redeem_count}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {u.is_admin ? (
                          <span style={{
                            background: 'rgba(232,69,60,0.1)', color: '#E8453C',
                            padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          }}>Admin</span>
                        ) : (
                          <span style={{
                            background: '#f3f3f3', color: '#666',
                            padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                          }}>Utente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── MOBILE CARDS ─── */}
            <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(u => (
                <div key={u.id} style={{
                  background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 12,
                }}>
                  {/* Row 1: Avatar + Name/Email + Admin badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(232,69,60,0.15)', color: '#E8453C',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 600, flexShrink: 0,
                    }}>
                      {(u.full_name || u.email || '?')[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.full_name || '—'}
                        </span>
                        {u.is_admin && (
                          <span style={{
                            background: 'rgba(232,69,60,0.1)', color: '#E8453C',
                            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            flexShrink: 0,
                          }}>Admin</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                        {u.email}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Activity stats — NO separator */}
                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                    <span style={{ fontWeight: 600, color: '#1a1a1f' }}>{u.review_count}</span> recensioni
                    {' · '}
                    <span style={{ fontWeight: 600, color: '#1a1a1f' }}>{u.saved_count}</span> salvati
                    {' · '}
                    <span style={{ fontWeight: 600, color: '#1a1a1f' }}>{u.redeem_count}</span> QR
                  </div>

                  {/* Row 3: Relative time */}
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>
                    Registrato {timeAgo(u.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 10,
  fontWeight: 600,
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}

const tdStyle = {
  padding: '10px 14px',
  color: '#1a1a1f',
}
