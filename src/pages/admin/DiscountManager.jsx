import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const isExpired = (d) => new Date(d.valid_until) < new Date()
const isActive = (d) => d.is_active && !isExpired(d)

const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TYPE_LABELS = {
  percentage: 'Percentuale',
  fixed: 'Importo fisso',
  freebie: 'Omaggio',
}

const EMPTY_FORM = {
  restaurant_id: '',
  title: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  conditions: '',
  valid_from: new Date().toISOString().split('T')[0],
  valid_until: '',
  max_redemptions: '',
  is_active: true,
  is_drop: false,
  drop_starts_at: '',
  drop_ends_at: '',
  max_quantity: '',
  is_featured: false,
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, accent = '#1a1a1f' }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: 12,
        padding: '16px 18px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ fontSize: 10, color: '#999', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, marginTop: 6 }}>{value}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */
function StatusBadge({ discount: d }) {
  const expired = isExpired(d)
  const active = isActive(d)
  const style = {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 999,
    letterSpacing: 0.2,
    fontFamily: "'DM Sans', sans-serif",
    whiteSpace: 'nowrap',
  }
  if (expired) return <span style={{ ...style, background: '#f3f3f3', color: '#999' }}>Scaduto</span>
  if (!d.is_active) return <span style={{ ...style, background: '#fef3c7', color: '#b45309' }}>Disattivato</span>
  return <span style={{ ...style, background: '#ecfdf5', color: '#059669' }}>Attivo</span>
}

function DropBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 999,
        background: '#C4A265',
        color: '#fff',
        letterSpacing: 0.5,
        marginLeft: 6,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      DROP
    </span>
  )
}

function FeaturedBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 999,
        background: '#fef3c7',
        color: '#C4A265',
        marginLeft: 6,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      ★ Evidenza
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Filter chip                                                        */
/* ------------------------------------------------------------------ */
function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        border: active ? '1px solid #1a1a1f' : '1px solid #eee',
        background: active ? '#1a1a1f' : '#fff',
        color: active ? '#fff' : '#666',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: "'DM Sans', sans-serif",
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      {count != null && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: 10,
            background: active ? 'rgba(255,255,255,0.2)' : '#f3f3f3',
            color: active ? '#fff' : '#999',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
export default function DiscountManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [discounts, setDiscounts] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('discounts').select('*, restaurant:restaurants(id, name)').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('id, name').order('name'),
      supabase.from('discount_redemptions').select('discount_id, status'),
    ]).then(([discRes, restRes, redRes]) => {
      // Compute real counts per discount
      const genMap = {}
      const usedMap = {}
      ;(redRes.data || []).forEach((r) => {
        genMap[r.discount_id] = (genMap[r.discount_id] || 0) + 1
        if (r.status === 'redeemed') {
          usedMap[r.discount_id] = (usedMap[r.discount_id] || 0) + 1
        }
      })
      const enriched = (discRes.data || []).map((d) => ({
        ...d,
        generated_count: genMap[d.id] || 0,
        redeemed_count: usedMap[d.id] || 0,
      }))
      setDiscounts(enriched)
      setRestaurants(restRes.data || [])
      setLoading(false)
    })
  }, [])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setSaveError(null)
  }

  const handleEdit = (d) => {
    setForm({
      restaurant_id: d.restaurant_id,
      title: d.title,
      description: d.description || '',
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      conditions: d.conditions || '',
      valid_from: d.valid_from?.split('T')[0] || '',
      valid_until: d.valid_until?.split('T')[0] || '',
      max_redemptions: d.max_redemptions || '',
      is_active: d.is_active,
      is_drop: d.is_drop || false,
      drop_starts_at: d.drop_starts_at ? d.drop_starts_at.slice(0, 16) : '',
      drop_ends_at: d.drop_ends_at ? d.drop_ends_at.slice(0, 16) : '',
      max_quantity: d.max_quantity || '',
      is_featured: d.is_featured || false,
    })
    setEditing(d.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.restaurant_id || !form.title || !form.discount_value || !form.valid_until) return
    if (!editing) {
      const existing = discounts.find(
        (d) => d.restaurant_id === form.restaurant_id && d.is_active && new Date(d.valid_until) > new Date()
      )
      if (existing) {
        setSaveError(`${existing.restaurant?.name || 'Questo ristorante'} ha già uno sconto attivo. Disattiva o elimina quello esistente prima.`)
        return
      }
    }
    setSaving(true)
    setSaveError(null)
    const payload = {
      restaurant_id: form.restaurant_id,
      title: form.title,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      conditions: form.conditions || null,
      valid_from: new Date(form.valid_from).toISOString(),
      valid_until: new Date(form.valid_until).toISOString(),
      max_redemptions: form.max_redemptions ? parseInt(form.max_redemptions) : null,
      is_active: form.is_active,
      is_drop: form.is_drop,
      drop_starts_at: form.is_drop && form.drop_starts_at ? new Date(form.drop_starts_at).toISOString() : null,
      drop_ends_at: form.is_drop && form.drop_ends_at ? new Date(form.drop_ends_at).toISOString() : null,
      max_quantity: form.is_drop && form.max_quantity ? parseInt(form.max_quantity) : null,
      is_featured: !form.is_drop && form.is_featured,
    }
    const result = editing
      ? await supabase.from('discounts').update(payload).eq('id', editing).select('*, restaurant:restaurants(id, name)').single()
      : await supabase.from('discounts').insert(payload).select('*, restaurant:restaurants(id, name)').single()
    if (result.error) {
      setSaveError(result.error.message || 'Errore nel salvataggio. Riprova.')
      setSaving(false)
      return
    }
    if (result.data) {
      if (editing) setDiscounts((p) => p.map((d) => (d.id === editing ? result.data : d)))
      else setDiscounts((p) => [result.data, ...p])
      setShowForm(false)
      resetForm()
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    await supabase.from('discounts').delete().eq('id', id)
    setDiscounts((p) => p.filter((d) => d.id !== id))
    setDeleteConfirm(null)
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDiscounts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredDiscounts.map((d) => d.id)))
    }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    const ids = [...selectedIds]
    await supabase.from('discounts').delete().in('id', ids)
    setDiscounts((p) => p.filter((d) => !selectedIds.has(d.id)))
    setSelectedIds(new Set())
    setBulkDeleteConfirm(false)
    setBulkDeleting(false)
  }

  const handleToggleActive = async (id, currentActive) => {
    const { data } = await supabase
      .from('discounts')
      .update({ is_active: !currentActive })
      .eq('id', id)
      .select('*, restaurant:restaurants(id, name)')
      .single()
    if (data) setDiscounts((p) => p.map((d) => (d.id === id ? data : d)))
  }

  const stats = useMemo(() => {
    const total = discounts.length
    const active = discounts.filter((d) => isActive(d)).length
    const drops = discounts.filter((d) => d.is_drop && isActive(d)).length
    const redemptions = discounts.reduce((s, d) => s + (d.redeemed_count || 0), 0)
    return { total, active, drops, redemptions }
  }, [discounts])

  const filteredDiscounts = useMemo(() => {
    if (filter === 'all') return discounts
    if (filter === 'active') return discounts.filter((d) => isActive(d))
    if (filter === 'drops') return discounts.filter((d) => d.is_drop)
    if (filter === 'expired') return discounts.filter((d) => isExpired(d))
    return discounts
  }, [discounts, filter])

  const counts = useMemo(() => ({
    all: discounts.length,
    active: discounts.filter((d) => isActive(d)).length,
    drops: discounts.filter((d) => d.is_drop).length,
    expired: discounts.filter((d) => isExpired(d)).length,
  }), [discounts])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Sconti & Drop">
      <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* ── Header ── */}
        <div
          style={{
            padding: '22px 20px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1f', margin: 0, letterSpacing: '-0.3px' }}>
              Sconti & Drop
            </h1>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              Gestisci offerte e drop dei ristoranti del network
            </p>
          </div>
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true) }}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              background: '#E8453C',
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuovo sconto
          </button>
        </div>

        {/* ── Stats ── */}
        <div
          style={{
            padding: '0 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 18,
          }}
          className="md:!grid-cols-4"
        >
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="Attivi" value={stats.active} accent="#059669" />
          <StatCard label="Drop attivi" value={stats.drops} accent="#C4A265" />
          <StatCard label="QR utilizzati" value={stats.redemptions} accent="#E8453C" />
        </div>

        {/* ── Filter chips ── */}
        <div
          style={{
            padding: '0 20px 16px',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <FilterChip label="Tutti" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterChip label="Attivi" count={counts.active} active={filter === 'active'} onClick={() => setFilter('active')} />
          <FilterChip label="Drop" count={counts.drops} active={filter === 'drops'} onClick={() => setFilter('drops')} />
          <FilterChip label="Scaduti" count={counts.expired} active={filter === 'expired'} onClick={() => setFilter('expired')} />
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: 13 }}>
            Caricamento...
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filteredDiscounts.length === 0 && (
          <div
            style={{
              margin: '0 20px 20px',
              padding: '48px 24px',
              textAlign: 'center',
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏷️</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>
              {filter === 'all' ? 'Nessuno sconto creato' : 'Nessuno sconto in questa categoria'}
            </p>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              {filter === 'all' ? 'Crea il primo sconto per un ristorante partner' : 'Cambia filtro per vedere altri sconti'}
            </p>
          </div>
        )}

        {/* ── Bulk action bar — appears when items are selected ── */}
        {selectedIds.size > 0 && (
          <div style={{
            margin: '0 20px 12px',
            padding: '10px 16px',
            background: '#1a1a1f',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {selectedIds.size} {selectedIds.size === 1 ? 'sconto selezionato' : 'sconti selezionati'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ccc', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Deseleziona
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(true)}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: '#dc2626', border: 'none',
                  color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                Elimina {selectedIds.size}
              </button>
            </div>
          </div>
        )}

        {/* ── Desktop table ── */}
        {!loading && filteredDiscounts.length > 0 && (
          <div className="hidden md:block" style={{ padding: '0 20px 40px' }}>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                    <th style={{ ...thStyle, width: 40 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={filteredDiscounts.length > 0 && selectedIds.size === filteredDiscounts.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#dc2626' }}
                      />
                    </th>
                    <th style={thStyle}>Ristorante</th>
                    <th style={thStyle}>Sconto</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Scadenza</th>
                    <th style={thStyle}>QR presi / usati</th>
                    <th style={thStyle}>Stato</th>
                    <th style={{ ...thStyle, width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiscounts.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: '1px solid #f3f3f3', cursor: 'pointer', transition: 'background 0.1s',
                        background: selectedIds.has(d.id) ? '#fff8f8' : 'transparent',
                      }}
                      onClick={() => handleEdit(d)}
                      onMouseEnter={(e) => { if (!selectedIds.has(d.id)) e.currentTarget.style.background = '#fafafa' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = selectedIds.has(d.id) ? '#fff8f8' : 'transparent' }}
                    >
                      <td style={tdStyle} onClick={(e) => { e.stopPropagation(); toggleSelect(d.id) }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#dc2626' }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: '#1a1a1f' }}>
                          {d.restaurant?.name || '—'}
                          {d.is_drop && <DropBadge />}
                          {d.is_featured && !d.is_drop && <FeaturedBadge />}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ color: '#E8453C', fontWeight: 700 }}>{d.discount_value}</div>
                        <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>{d.title}</div>
                      </td>
                      <td style={{ ...tdStyle, color: '#666' }}>{TYPE_LABELS[d.discount_type] || d.discount_type}</td>
                      <td style={{ ...tdStyle, color: '#666' }}>{formatDate(d.valid_until)}</td>
                      <td style={{ ...tdStyle, color: '#666' }}>
                        <span style={{ color: '#1a1a1f', fontWeight: 600 }}>{d.generated_count || 0}</span>
                        <span style={{ color: '#999' }}> / </span>
                        <span style={{ color: '#059669', fontWeight: 600 }}>{d.redeemed_count || 0}</span>
                        {d.max_redemptions ? <span style={{ color: '#999' }}> · max {d.max_redemptions}</span> : null}
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge discount={d} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(d.id, d.is_active)}
                          title={d.is_active ? 'Disattiva' : 'Attiva'}
                          style={iconBtnStyle}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {d.is_active ? <circle cx="12" cy="12" r="9" /> : <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />}
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(d)}
                          title="Elimina"
                          style={{ ...iconBtnStyle, color: '#dc2626' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Mobile cards ── */}
        {!loading && filteredDiscounts.length > 0 && (
          <div className="md:hidden" style={{ padding: '0 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredDiscounts.map((d) => (
              <div
                key={d.id}
                onClick={() => handleEdit(d)}
                style={{
                  background: selectedIds.has(d.id) ? '#fff8f8' : '#fff',
                  border: selectedIds.has(d.id) ? '1.5px solid #dc2626' : '1px solid #eee',
                  borderRadius: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(d.id) }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#dc2626', marginTop: 2, flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1f', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        {d.restaurant?.name || '—'}
                        {d.is_drop && <DropBadge />}
                        {d.is_featured && !d.is_drop && <FeaturedBadge />}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#E8453C', marginTop: 4 }}>
                        {d.discount_value}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{d.title}</div>
                    </div>
                  </div>
                  <StatusBadge discount={d} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid #f3f3f3',
                    fontSize: 11,
                    color: '#999',
                  }}
                >
                  <span>
                    <span style={{ color: '#1a1a1f', fontWeight: 600 }}>{d.generated_count || 0}</span>
                    <span> presi · </span>
                    <span style={{ color: '#059669', fontWeight: 600 }}>{d.redeemed_count || 0}</span>
                    <span> usati{d.max_redemptions ? ` · max ${d.max_redemptions}` : ''} · Scade {formatDate(d.valid_until)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(d) }}
                    style={{ background: 'transparent', border: 'none', color: '#dc2626', padding: 4, cursor: 'pointer' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Form modal ── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowForm(false); resetForm() }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'rgba(26,26,31,0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: '1px solid #eee',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                  width: '100%',
                  maxWidth: 520,
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {/* Modal header */}
                <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #f3f3f3' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>
                    {editing ? 'Modifica sconto' : 'Nuovo sconto'}
                  </h2>
                </div>

                {/* Modal body */}
                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <FormField label="Ristorante">
                    <select
                      value={form.restaurant_id}
                      onChange={(e) => setForm((f) => ({ ...f, restaurant_id: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">Seleziona...</option>
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Titolo">
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Es: 10% su tutta la cena"
                      style={inputStyle}
                    />
                  </FormField>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Tipo">
                      <select
                        value={form.discount_type}
                        onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
                        style={inputStyle}
                      >
                        <option value="percentage">Percentuale</option>
                        <option value="fixed">Importo fisso</option>
                        <option value="freebie">Omaggio</option>
                      </select>
                    </FormField>
                    <FormField label="Valore">
                      <input
                        type="text"
                        value={form.discount_value}
                        onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                        placeholder="Es: 10%, 5€"
                        style={inputStyle}
                      />
                    </FormField>
                  </div>

                  <FormField label="Condizioni (opzionale)">
                    <input
                      type="text"
                      value={form.conditions}
                      onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                      placeholder="Es: Valido solo a cena, min 2 persone"
                      style={inputStyle}
                    />
                  </FormField>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Valido dal">
                      <input
                        type="date"
                        value={form.valid_from}
                        onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label="Valido fino al">
                      <input
                        type="date"
                        value={form.valid_until}
                        onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                        style={inputStyle}
                      />
                    </FormField>
                  </div>

                  <FormField label="Limite utilizzi">
                    <input
                      type="number"
                      value={form.max_redemptions}
                      onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
                      placeholder="Vuoto = illimitato"
                      style={inputStyle}
                    />
                  </FormField>

                  {/* Drop toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={form.is_drop}
                      onChange={(e) => setForm((f) => ({ ...f, is_drop: e.target.checked, is_featured: e.target.checked ? false : f.is_featured }))}
                      style={{ accentColor: '#C4A265', width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 13, color: '#1a1a1f', fontWeight: 500 }}>È un drop? (tempo limitato)</span>
                  </label>

                  {form.is_drop && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, borderLeft: '2px solid #C4A265' }}>
                      <FormField label="Inizio drop">
                        <input
                          type="datetime-local"
                          value={form.drop_starts_at}
                          onChange={(e) => setForm((f) => ({ ...f, drop_starts_at: e.target.value }))}
                          style={inputStyle}
                        />
                      </FormField>
                      <FormField label="Fine drop">
                        <input
                          type="datetime-local"
                          value={form.drop_ends_at}
                          onChange={(e) => setForm((f) => ({ ...f, drop_ends_at: e.target.value }))}
                          style={inputStyle}
                        />
                      </FormField>
                      <FormField label="Quantità massima">
                        <input
                          type="number"
                          value={form.max_quantity}
                          onChange={(e) => setForm((f) => ({ ...f, max_quantity: e.target.value }))}
                          placeholder="Es. 10"
                          style={inputStyle}
                        />
                      </FormField>
                    </div>
                  )}

                  {!form.is_drop && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.is_featured}
                        onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                        style={{ accentColor: '#C4A265', width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 13, color: '#1a1a1f' }}>★ In evidenza</span>
                    </label>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      style={{ accentColor: '#E8453C', width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 13, color: '#1a1a1f' }}>Attivo</span>
                  </label>

                  {saveError && (
                    <p style={{ fontSize: 11, color: '#dc2626', margin: 0, padding: 10, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                      {saveError}
                    </p>
                  )}
                </div>

                {/* Modal footer */}
                <div style={{ padding: '14px 22px 20px', borderTop: '1px solid #f3f3f3', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm() }}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid #eee',
                      color: '#666',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !form.restaurant_id || !form.title || !form.discount_value || !form.valid_until}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 8,
                      background: '#E8453C',
                      border: 'none',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving || !form.restaurant_id || !form.title || !form.discount_value || !form.valid_until ? 0.5 : 1,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {saving ? 'Salvataggio...' : editing ? 'Salva modifiche' : 'Crea sconto'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bulk delete confirm modal ── */}
        <AnimatePresence>
          {bulkDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setBulkDeleteConfirm(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 110,
                background: 'rgba(26,26,31,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #eee',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 24, maxWidth: 380, width: '100%',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1f', margin: 0, marginBottom: 8 }}>
                  Eliminare {selectedIds.size} {selectedIds.size === 1 ? 'sconto' : 'sconti'}?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Questa azione non può essere annullata. Tutti i QR code generati per {selectedIds.size === 1 ? 'questo sconto' : 'questi sconti'} diventeranno non validi.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteConfirm(false)}
                    style={{
                      padding: '9px 16px', borderRadius: 8, background: 'transparent',
                      border: '1px solid #eee', color: '#666', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    style={{
                      padding: '9px 16px', borderRadius: 8, background: '#dc2626', border: 'none',
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: bulkDeleting ? 'wait' : 'pointer', opacity: bulkDeleting ? 0.7 : 1,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {bulkDeleting ? 'Eliminazione...' : `Elimina ${selectedIds.size}`}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Delete confirm modal ── */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 110,
                background: 'rgba(26,26,31,0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: '1px solid #eee',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                  padding: 24,
                  maxWidth: 380,
                  width: '100%',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1f', margin: 0, marginBottom: 8 }}>
                  Eliminare lo sconto?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Sconto di <strong style={{ color: '#1a1a1f' }}>{deleteConfirm.restaurant?.name || 'ristorante'}</strong>: questa azione non può essere annullata.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid #eee',
                      color: '#666',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deleteConfirm.id)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      background: '#dc2626',
                      border: 'none',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
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

/* ------------------------------------------------------------------ */
/*  Local helpers                                                      */
/* ------------------------------------------------------------------ */
function FormField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#1a1a1f', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid #eee',
  background: '#fff',
  fontSize: 13,
  color: '#1a1a1f',
  outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
}

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const tdStyle = {
  padding: '14px 16px',
  color: '#1a1a1f',
  verticalAlign: 'top',
}

const iconBtnStyle = {
  background: 'transparent',
  border: 'none',
  padding: 6,
  cursor: 'pointer',
  color: '#999',
  borderRadius: 6,
  marginLeft: 2,
}
