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
        fontFamily: "var(--font-sans)",
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
    fontFamily: "var(--font-sans)",
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
        background: '#B08954',
        color: '#fff',
        letterSpacing: 0.5,
        marginLeft: 6,
        fontFamily: "var(--font-sans)",
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
        color: '#B08954',
        marginLeft: 6,
        fontFamily: "var(--font-sans)",
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
        fontFamily: "var(--font-sans)",
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
  const [partnerIds, setPartnerIds] = useState(new Set()) // restaurant_ids that are active partners
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [filter, setFilter] = useState('all')
  // Restaurant search inside the form
  const [restSearch, setRestSearch] = useState('')
  const [showRestDD, setShowRestDD] = useState(false)
  // "Create partner" flow
  const [addPartnerOpen, setAddPartnerOpen] = useState(false)
  const [addPartnerSearch, setAddPartnerSearch] = useState('')
  const [newPartner, setNewPartner] = useState(null) // { id, name } — restaurant that will be created as partner
  const [pinPopup, setPinPopup] = useState(null)  // { name, pin } — shown after save
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  // Notify subscribers: map of `${type}:${id}` -> { sent_at, sent_count }
  const [notifyLogs, setNotifyLogs] = useState({})
  const [notifyingId, setNotifyingId] = useState(null)

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
      supabase.from('restaurant_partners').select('restaurant_id').eq('is_active', true),
    ]).then(([discRes, restRes, redRes, partRes]) => {
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
      setPartnerIds(new Set((partRes.data || []).map((p) => p.restaurant_id)))
      setLoading(false)
    })
  }, [])

  // Load notify log rows so we can show "già inviato" state inline.
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    supabase
      .from('email_notifications_log')
      .select('type, item_id, sent_at, sent_count')
      .in('type', ['discount', 'drop'])
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach((row) => {
          map[`${row.type}:${row.item_id}`] = { sent_at: row.sent_at, sent_count: row.sent_count }
        })
        setNotifyLogs(map)
      })
  }, [])

  const handleNotify = async (d, { force = false } = {}) => {
    if (!d?.id) return
    const type = d.is_drop ? 'drop' : 'discount'
    setNotifyingId(d.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessione scaduta')
      const res = await fetch('/api/notify-subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type, id: d.id, force }),
      })
      const json = await res.json()
      if (res.status === 409) {
        const sentWhen = new Date(json.sent_at).toLocaleString('it-IT')
        const again = window.confirm(`Già inviato il ${sentWhen} a ${json.sent_count} iscritti.\n\nVuoi inviare di nuovo?`)
        if (again) return handleNotify(d, { force: true })
        return
      }
      if (!res.ok) throw new Error(json.error || 'Errore invio')
      window.alert(`Notifica inviata a ${json.sent} iscritti${json.errors ? ` (${json.errors} errori)` : ''}`)
      setNotifyLogs((prev) => ({
        ...prev,
        [`${type}:${d.id}`]: { sent_at: new Date().toISOString(), sent_count: json.sent },
      }))
    } catch (err) {
      window.alert(`Errore notifica: ${err.message}`)
    } finally {
      setNotifyingId(null)
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setSaveError(null)
    setRestSearch('')
    setShowRestDD(false)
    setNewPartner(null)
    setAddPartnerOpen(false)
    setAddPartnerSearch('')
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
    const restId = form.restaurant_id || newPartner?.id
    if (!restId || !form.title || !form.discount_value || !form.valid_until) return
    if (!editing) {
      const existing = discounts.find(
        (d) => d.restaurant_id === restId && d.is_active && new Date(d.valid_until) > new Date()
      )
      if (existing) {
        setSaveError(`${existing.restaurant?.name || 'Questo ristorante'} ha già uno sconto attivo. Disattiva o elimina quello esistente prima.`)
        return
      }
    }
    setSaving(true)
    setSaveError(null)

    // If the user chose a non-partner restaurant, auto-create the partner with a new 6-digit PIN
    let pendingPin = null
    if (newPartner && !editing) {
      const pin = String(Math.floor(100000 + Math.random() * 900000))
      const { error: pErr } = await supabase.from('restaurant_partners').insert({
        restaurant_id: newPartner.id,
        pin_code: pin,
        is_active: true,
      })
      if (!pErr) {
        setPartnerIds((prev) => new Set([...prev, newPartner.id]))
        pendingPin = { name: newPartner.name, pin }
        // Also update restaurants column if it exists
        await supabase.from('restaurants').update({ verify_pin: pin }).eq('id', newPartner.id).then(() => {})
      }
    }

    const payload = {
      restaurant_id: restId,
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
      if (pendingPin) setPinPopup(pendingPin)
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
      <div style={{ fontFamily: "var(--font-sans)" }}>
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
              fontFamily: "var(--font-sans)",
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
          <StatCard label="Drop attivi" value={stats.drops} accent="#B08954" />
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
                  fontFamily: "var(--font-sans)",
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
                  fontFamily: "var(--font-sans)",
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
                        {(() => {
                          const key = `${d.is_drop ? 'drop' : 'discount'}:${d.id}`
                          const sent = notifyLogs[key]
                          const disabled = notifyingId === d.id || !isActive(d)
                          return (
                            <button
                              type="button"
                              onClick={() => handleNotify(d)}
                              disabled={disabled}
                              title={sent
                                ? `Già inviato il ${new Date(sent.sent_at).toLocaleDateString('it-IT')} a ${sent.sent_count} iscritti — clicca per inviare di nuovo`
                                : !isActive(d) ? 'Attiva lo sconto per notificare' : 'Notifica iscritti newsletter'}
                              style={{ ...iconBtnStyle, color: sent ? '#059669' : '#1a1a1f', opacity: disabled ? 0.4 : 1 }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 11l18-8v18L3 13v-2z" />
                                <path d="M11.6 16.8A3 3 0 0 1 8 20" />
                              </svg>
                            </button>
                          )
                        })()}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(() => {
                      const key = `${d.is_drop ? 'drop' : 'discount'}:${d.id}`
                      const sent = notifyLogs[key]
                      const disabled = notifyingId === d.id || !isActive(d)
                      return (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleNotify(d) }}
                          disabled={disabled}
                          title={sent ? `Già inviato a ${sent.sent_count} iscritti` : 'Notifica iscritti'}
                          style={{ background: 'transparent', border: 'none', color: sent ? '#059669' : '#1a1a1f', padding: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 11l18-8v18L3 13v-2z" />
                            <path d="M11.6 16.8A3 3 0 0 1 8 20" />
                          </svg>
                        </button>
                      )
                    })()}
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
                  fontFamily: "var(--font-sans)",
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
                    {/* When editing, just show the name — can't change it */}
                    {editing ? (
                      <div style={{ ...inputStyle, color: '#1a1a1f', background: '#f9f9f9' }}>
                        {restaurants.find((r) => r.id === form.restaurant_id)?.name || '—'}
                      </div>
                    ) : form.restaurant_id ? (
                      /* Partner already selected */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ ...inputStyle, flex: 1, color: '#1a1a1f', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                          {restaurants.find((r) => r.id === form.restaurant_id)?.name}
                        </div>
                        <button type="button" onClick={() => { setForm((f) => ({ ...f, restaurant_id: '' })); setRestSearch(''); setNewPartner(null) }} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
                      </div>
                    ) : newPartner ? (
                      /* Non-partner selected — will be auto-created */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ ...inputStyle, flex: 1, color: '#B08954', display: 'flex', alignItems: 'center', gap: 6, background: '#fffbf0' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B08954" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                          {newPartner.name}
                          <span style={{ fontSize: 11, color: '#B08954', background: '#fef3c7', borderRadius: 6, padding: '1px 7px', marginLeft: 4 }}>verrà aggiunto come partner</span>
                        </div>
                        <button type="button" onClick={() => { setNewPartner(null); setAddPartnerOpen(false) }} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
                      </div>
                    ) : (
                      /* Search UI */
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={restSearch}
                          onChange={(e) => { setRestSearch(e.target.value); setShowRestDD(true) }}
                          onFocus={() => setShowRestDD(true)}
                          placeholder="Cerca ristorante partner..."
                          style={{ ...inputStyle, paddingLeft: 36 }}
                          autoComplete="off"
                        />
                        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>

                        {showRestDD && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                            background: '#fff', border: '1px solid #eee', borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4,
                            maxHeight: 220, overflowY: 'auto',
                          }}>
                            {(() => {
                              const q = restSearch.toLowerCase().trim()
                              const partners = restaurants.filter(
                                (r) => partnerIds.has(r.id) && (!q || r.name.toLowerCase().includes(q))
                              )
                              return partners.length > 0 ? (
                                partners.map((r) => (
                                  <div
                                    key={r.id}
                                    onClick={() => { setForm((f) => ({ ...f, restaurant_id: r.id })); setRestSearch(''); setShowRestDD(false) }}
                                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#1a1a1f', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f5f5f5' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                                    {r.name}
                                  </div>
                                ))
                              ) : (
                                <div style={{ padding: '12px 14px', color: '#999', fontSize: 13 }}>
                                  {q ? `Nessun partner trovato per "${restSearch}"` : 'Nessun ristorante partner'}
                                </div>
                              )
                            })()}
                            <div
                              onClick={() => { setShowRestDD(false); setAddPartnerOpen(true); setAddPartnerSearch(restSearch) }}
                              style={{
                                padding: '11px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                color: '#B08954', borderTop: '1px solid #f0f0f0',
                                display: 'flex', alignItems: 'center', gap: 7,
                                background: '#fffbf0',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#fef3c7')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = '#fffbf0')}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                              Crea partner (ristorante non ancora partner)
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add-partner sub-panel */}
                    {addPartnerOpen && !newPartner && (
                      <div style={{ marginTop: 10, padding: 14, background: '#fffbf0', borderRadius: 10, border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 10 }}>
                          Seleziona il ristorante da aggiungere come partner:
                        </div>
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                          <input
                            type="text"
                            value={addPartnerSearch}
                            onChange={(e) => setAddPartnerSearch(e.target.value)}
                            placeholder="Cerca tra tutti i ristoranti..."
                            style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }}
                            autoFocus
                            autoComplete="off"
                          />
                          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        </div>
                        <div style={{ maxHeight: 180, overflowY: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                          {restaurants
                            .filter((r) => !partnerIds.has(r.id) && r.name.toLowerCase().includes(addPartnerSearch.toLowerCase().trim()))
                            .slice(0, 30)
                            .map((r) => (
                              <div
                                key={r.id}
                                onClick={() => { setNewPartner({ id: r.id, name: r.name }); setAddPartnerOpen(false) }}
                                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: '#1a1a1f', borderBottom: '1px solid #f5f5f5' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                {r.name}
                              </div>
                            ))}
                        </div>
                        <button type="button" onClick={() => setAddPartnerOpen(false)} style={{ marginTop: 8, fontSize: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>Annulla</button>
                      </div>
                    )}
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

                  <FormField label="Max persone che possono attivarlo" hint="Lascia vuoto per illimitato">
                    <input
                      type="number"
                      value={form.max_redemptions}
                      onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
                      placeholder="Illimitato"
                      min="1"
                      style={inputStyle}
                    />
                  </FormField>

                  {/* Drop toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={form.is_drop}
                      onChange={(e) => setForm((f) => ({ ...f, is_drop: e.target.checked, is_featured: e.target.checked ? false : f.is_featured }))}
                      style={{ accentColor: '#B08954', width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 13, color: '#1a1a1f', fontWeight: 500 }}>È un drop? (tempo limitato)</span>
                  </label>

                  {form.is_drop && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, borderLeft: '2px solid #B08954' }}>
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
                        style={{ accentColor: '#B08954', width: 16, height: 16 }}
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
                      fontFamily: "var(--font-sans)",
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
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {saving ? 'Salvataggio...' : editing ? 'Salva modifiche' : 'Crea sconto'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PIN popup — shown after auto-creating a partner ── */}
        <AnimatePresence>
          {pinPopup && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPinPopup(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(26,26,31,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: 18, border: '1px solid #eee',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 28, maxWidth: 360, width: '100%',
                  fontFamily: "var(--font-sans)", textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1f', margin: '0 0 6px' }}>
                  Partner creato!
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
                  <strong>{pinPopup.name}</strong> è ora un ristorante partner. Questo è il codice PIN per la pagina <strong>/verify</strong>:
                </p>
                <div style={{
                  background: '#f9f9f9', border: '2px dashed #D1D5DB', borderRadius: 12, padding: '16px 20px',
                  marginBottom: 20,
                }}>
                  <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>PIN di accesso</div>
                  <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: '#1a1a1f', fontVariantNumeric: 'tabular-nums' }}>
                    {pinPopup.pin}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#999', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Condividi questo PIN con il ristorante — serve per accedere alla dashboard /verify e validare i QR degli utenti.
                </p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(pinPopup.pin).catch(() => {}); setPinPopup(null) }}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 12,
                    background: '#1a1a1f', border: 'none', color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  Copia PIN e chiudi
                </button>
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
                  fontFamily: "var(--font-sans)",
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
                      cursor: 'pointer', fontFamily: "var(--font-sans)",
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
                      fontFamily: "var(--font-sans)",
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
                  fontFamily: "var(--font-sans)",
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
                      fontFamily: "var(--font-sans)",
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
                      fontFamily: "var(--font-sans)",
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
function FormField({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1f' }}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: '#999' }}>{hint}</span>}
      </div>
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
  fontFamily: "var(--font-sans)",
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
