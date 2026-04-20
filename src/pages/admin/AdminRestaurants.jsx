import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
const ic = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}
function PlusIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function SearchIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function EditIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
function TrashIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}
function ChevronRightIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
function BackIcon({ w = 18 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */
function StatusBadge({ published }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 12,
        fontWeight: 500,
        background: published ? '#ecfdf5' : '#fef3c7',
        color: published ? '#059669' : '#b45309',
      }}
    >
      {published ? 'Pubblicato' : 'Bozza'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function AdminRestaurants() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { allRestaurants: restaurants, loading: dataLoading } = useRestaurants()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'published' | 'draft'
  const [deleteId, setDeleteId] = useState(null)
  const [discountsMap, setDiscountsMap] = useState({})
  const [savedCountMap, setSavedCountMap] = useState({})

  // Fetch active discounts per restaurant (for showing -X% badge)
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false
    async function fetchDiscounts() {
      try {
        const nowIso = new Date().toISOString()
        const { data } = await supabase
          .from('discounts')
          .select('id, restaurant_id, discount_value, discount_type, drop_time, is_active, valid_until')
          .eq('is_active', true)
          .gte('valid_until', nowIso)
        if (cancelled) return
        const map = {}
        ;(data || []).forEach((d) => {
          if (!map[d.restaurant_id]) map[d.restaurant_id] = d
        })
        setDiscountsMap(map)
      } catch {
        if (!cancelled) setDiscountsMap({})
      }
    }
    fetchDiscounts()
  }, [user])

  // Fetch saved counts per restaurant
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false
    async function fetchSaved() {
      try {
        const { data } = await supabase.from('saved_restaurants').select('restaurant_id')
        if (cancelled) return
        const map = {}
        ;(data || []).forEach((row) => {
          map[row.restaurant_id] = (map[row.restaurant_id] || 0) + 1
        })
        setSavedCountMap(map)
      } catch {
        if (!cancelled) setSavedCountMap({})
      }
    }
    fetchSaved()
  }, [user])

  // Stats + filter
  const { published, drafts, filtered } = useMemo(() => {
    const pub = restaurants.filter((r) => r.is_published !== false).length
    const drf = restaurants.length - pub

    let result = [...restaurants]
    if (filter === 'published') result = result.filter((r) => r.is_published !== false)
    else if (filter === 'draft') result = result.filter((r) => r.is_published === false)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine_type || '').toLowerCase().includes(q) ||
          (r.city || 'Torino').toLowerCase().includes(q) ||
          (r.address || '').toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => a.name.localeCompare(b.name, 'it'))
    return { published: pub, drafts: drf, filtered: result }
  }, [restaurants, filter, search])

  const handleDelete = async () => {
    if (!deleteId || !isSupabaseConfigured()) return
    try {
      await supabase.from('restaurants').delete().eq('id', deleteId)
      setDeleteId(null)
      window.location.reload()
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Errore durante eliminazione')
    }
  }

  if (authLoading || dataLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid #E8453C',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Ristoranti">
      {/* ─── DESKTOP HEADER ─── */}
      <div
        className="hidden md:block"
        style={{ borderBottom: '1px solid #eee', background: '#fff' }}
      >
        <div style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>Ristoranti</h1>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              {restaurants.length} ristoranti · {published} pubblicati · {drafts} bozze
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
                <SearchIcon w={14} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca ristoranti..."
                style={{
                  paddingLeft: 30,
                  paddingRight: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  borderRadius: 8,
                  border: '1px solid #eee',
                  fontSize: 13,
                  outline: 'none',
                  background: '#fff',
                  width: 220,
                }}
              />
            </div>
            <Link
              to="/admin/restaurant/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#E8453C',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <PlusIcon w={14} /> Aggiungi
            </Link>
          </div>
        </div>
      </div>

      {/* ─── MOBILE HEADER ─── */}
      <div
        className="md:hidden"
        style={{ borderBottom: '1px solid #eee', background: '#fff', padding: '14px 18px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              color: '#666',
              cursor: 'pointer',
              display: 'flex',
            }}
            aria-label="Indietro"
          >
            <BackIcon w={18} />
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1f', margin: 0, flex: 1 }}>Ristoranti</h1>
          <Link
            to="/admin/restaurant/new"
            style={{
              background: '#E8453C',
              color: '#fff',
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
            aria-label="Aggiungi"
          >
            <PlusIcon w={14} />
          </Link>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
            <SearchIcon w={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca ristoranti..."
            style={{
              width: '100%',
              paddingLeft: 30,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              border: '1px solid #eee',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { key: 'all', label: `Tutti (${restaurants.length})` },
            { key: 'published', label: `Pubblicati (${published})` },
            { key: 'draft', label: `Bozze (${drafts})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 16,
                border: filter === f.key ? 'none' : '1px solid #eee',
                background: filter === f.key ? '#1a1a1f' : '#fff',
                color: filter === f.key ? '#fff' : '#999',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── DESKTOP: FILTER CHIPS ─── */}
      <div
        className="hidden md:flex"
        style={{ padding: '14px 28px 0', gap: 8 }}
      >
        {[
          { key: 'all', label: `Tutti (${restaurants.length})` },
          { key: 'published', label: `Pubblicati (${published})` },
          { key: 'draft', label: `Bozze (${drafts})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 16,
              border: filter === f.key ? 'none' : '1px solid #eee',
              background: filter === f.key ? '#1a1a1f' : '#fff',
              color: filter === f.key ? '#fff' : '#666',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ─── DESKTOP TABLE ─── */}
      <div className="hidden md:block" style={{ padding: '16px 28px 24px' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#999',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Ristorante
                </th>
                <th style={headCellStyle}>Categoria</th>
                <th style={headCellStyle}>Stato</th>
                <th style={headCellStyle}>Sconto</th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const cats = (r.category || (r.cuisine_type ? [r.cuisine_type] : []))
                  .map((name) => getCategoryInfo(name))
                  .filter(Boolean)
                const firstCat = cats[0]
                const isPublished = r.is_published !== false
                const thumb = proxyImg(
                  Array.isArray(r.photos) && r.photos.length > 0
                    ? typeof r.photos[0] === 'string'
                      ? r.photos[0]
                      : r.photos[0]?.thumb_url || r.photos[0]?.photo_url
                    : null
                )
                const discount = discountsMap[r.id]
                const isDrop = discount?.drop_time != null
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #f5f5f5',
                      transition: 'background 0.15s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => navigate(`/admin/restaurant/${r.id}/edit`)}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: '#f0f0f0',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#1a1a1f',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 280,
                            }}
                          >
                            {r.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#999',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 280,
                            }}
                          >
                            {r.address || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={cellStyle}>{firstCat?.name || '—'}</td>
                    <td style={cellStyle}>
                      <StatusBadge published={isPublished} />
                    </td>
                    <td style={cellStyle}>
                      {discount ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#E8453C', fontWeight: 600, fontSize: 13 }}>
                            {discount.discount_value}
                          </span>
                          {isDrop && (
                            <span
                              style={{
                                fontSize: 9,
                                padding: '2px 6px',
                                background: 'rgba(196,162,101,0.15)',
                                color: '#B08954',
                                borderRadius: 4,
                                fontWeight: 600,
                                letterSpacing: 0.3,
                              }}
                            >
                              DROP
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#ccc' }}>—</span>
                      )}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 2 }}>
                        <Link
                          to={`/admin/restaurant/${r.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          style={actionBtn}
                          title="Modifica"
                        >
                          <EditIcon w={14} />
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteId(r.id)
                          }}
                          style={{ ...actionBtn, color: '#dc2626' }}
                          title="Elimina"
                        >
                          <TrashIcon w={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
                    {search ? 'Nessun ristorante trovato' : 'Nessun ristorante ancora'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MOBILE CARDS ─── */}
      <div className="md:hidden" style={{ padding: '14px 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((r) => {
          const cats = (r.category || (r.cuisine_type ? [r.cuisine_type] : []))
            .map((name) => getCategoryInfo(name))
            .filter(Boolean)
          const firstCat = cats[0]
          const isPublished = r.is_published !== false
          const thumb = proxyImg(
            Array.isArray(r.photos) && r.photos.length > 0
              ? typeof r.photos[0] === 'string'
                ? r.photos[0]
                : r.photos[0]?.thumb_url || r.photos[0]?.photo_url
              : null
          )
          const discount = discountsMap[r.id]
          const isDrop = discount?.drop_time != null
          const priceLabel = PRICE_LABELS[r.price_range] || ''
          const savedCount = savedCountMap[r.id] || 0
          return (
            <Link
              key={r.id}
              to={`/admin/restaurant/${r.id}/edit`}
              style={{
                background: '#fff',
                border: '1px solid #eee',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
              }}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={r.name}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: '#f0f0f0',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a1f',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {r.name}
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 10,
                      fontWeight: 500,
                      background: isPublished ? '#ecfdf5' : '#fef3c7',
                      color: isPublished ? '#059669' : '#b45309',
                      flexShrink: 0,
                    }}
                  >
                    {isPublished ? 'Live' : 'Bozza'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#999',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {firstCat?.name || '—'}
                  {priceLabel && ` · ${priceLabel}`}
                  {r.address && ` · ${r.address}`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
                    fontSize: 11,
                  }}
                >
                  {discount && (
                    <>
                      <span style={{ color: '#E8453C', fontWeight: 600 }}>{discount.discount_value}</span>
                      {isDrop && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: '1px 5px',
                            background: 'rgba(196,162,101,0.15)',
                            color: '#B08954',
                            borderRadius: 4,
                            fontWeight: 600,
                            letterSpacing: 0.3,
                          }}
                        >
                          DROP
                        </span>
                      )}
                      <span style={{ color: '#ccc' }}>·</span>
                    </>
                  )}
                  <span style={{ color: '#999' }}>
                    {savedCount} {savedCount === 1 ? 'salvataggio' : 'salvataggi'}
                  </span>
                </div>
              </div>
              <div style={{ color: '#ccc', flexShrink: 0 }}>
                <ChevronRightIcon w={14} />
              </div>
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
            {search ? 'Nessun ristorante trovato' : 'Nessun ristorante ancora'}
          </div>
        )}
      </div>

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: 24,
                maxWidth: 360,
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>
                Conferma eliminazione
              </h3>
              <p style={{ fontSize: 13, color: '#666', margin: '8px 0 20px', lineHeight: 1.5 }}>
                Sei sicuro di voler eliminare questo ristorante? Questa azione non può essere annullata.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteId(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #eee',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#666',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    background: '#dc2626',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}

const headCellStyle = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 10,
  fontWeight: 600,
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const cellStyle = {
  padding: '10px 14px',
  fontSize: 13,
  color: '#666',
}

const actionBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 6,
  background: 'transparent',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  textDecoration: 'none',
}
