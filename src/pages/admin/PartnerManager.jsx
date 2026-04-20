import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function StatCard({ label, value, color = 'var(--color-ink)' }) {
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

export default function PartnerManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [partners, setPartners] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [addError, setAddError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    if (authLoading || !isAdmin) return
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    Promise.all([
      supabase
        .from('restaurant_partners')
        .select('*, restaurant:restaurants(id, name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('restaurants')
        .select('id, name')
        .order('name'),
    ]).then(([partRes, restRes]) => {
      setPartners(partRes.data || [])
      setRestaurants(restRes.data || [])
      setLoading(false)
    })
  }, [authLoading, isAdmin])

  const handleAdd = async () => {
    if (!selectedRestaurant) return
    setAdding(true)
    setAddError(null)

    const pin = generatePin()
    const { data, error } = await supabase
      .from('restaurant_partners')
      .insert({
        restaurant_id: selectedRestaurant,
        pin_code: pin,
        is_active: true,
      })
      .select('*, restaurant:restaurants(id, name)')
      .single()

    if (error) {
      setAddError(error.message || "Errore durante l'aggiunta. Riprova.")
      setAdding(false)
      return
    }

    if (data) {
      setPartners(prev => [data, ...prev])
      setSelectedRestaurant('')
    }
    setAdding(false)
  }

  const handleRegeneratePin = async (id) => {
    const newPin = generatePin()
    const { data } = await supabase
      .from('restaurant_partners')
      .update({ pin_code: newPin })
      .eq('id', id)
      .select('*, restaurant:restaurants(id, name)')
      .single()

    if (data) {
      setPartners(prev => prev.map(p => p.id === id ? data : p))
    }
  }

  const handleToggle = async (id, currentActive) => {
    const { data } = await supabase
      .from('restaurant_partners')
      .update({ is_active: !currentActive })
      .eq('id', id)
      .select('*, restaurant:restaurants(id, name)')
      .single()

    if (data) {
      setPartners(prev => prev.map(p => p.id === id ? data : p))
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    await supabase.from('restaurant_partners').delete().eq('id', deleteConfirm.id)
    setPartners(prev => prev.filter(p => p.id !== deleteConfirm.id))
    setDeleteConfirm(null)
  }

  const handleCopyPin = async (id, pin) => {
    try {
      await navigator.clipboard.writeText(pin)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (e) {}
  }

  const partnerRestaurantIds = new Set(partners.map(p => p.restaurant_id))
  const availableRestaurants = restaurants.filter(r => !partnerRestaurantIds.has(r.id))

  const stats = useMemo(() => ({
    total: partners.length,
    active: partners.filter(p => p.is_active).length,
    inactive: partners.filter(p => !p.is_active).length,
  }), [partners])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Partner">
      <div style={{ padding: '20px 28px', fontFamily: "var(--font-sans)" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>Ristoranti Partner</h1>
          <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
            Gestisci i PIN per la verifica QR dei ristoranti
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="Attivi" value={stats.active} color="#059669" />
          <StatCard label="Disattivati" value={stats.inactive} color="#999" />
        </div>

        {/* Add new partner */}
        <div style={{
          background: '#fff',
          border: '1px solid #eee',
          borderRadius: 12,
          padding: 18,
          marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 12px' }}>
            Aggiungi nuovo partner
          </h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={selectedRestaurant}
              onChange={e => setSelectedRestaurant(e.target.value)}
              style={{
                flex: '1 1 240px',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #e5e5e5',
                background: '#fff',
                fontSize: 13,
                color: 'var(--color-ink)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">Seleziona ristorante...</option>
              {availableRestaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedRestaurant || adding}
              style={{
                padding: '10px 22px',
                borderRadius: 10,
                border: 'none',
                background: '#E8453C',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: !selectedRestaurant || adding ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: !selectedRestaurant || adding ? 0.5 : 1,
              }}
            >
              {adding ? '...' : 'Aggiungi'}
            </button>
          </div>
          {addError && (
            <p style={{ fontSize: 12, color: '#dc2626', margin: '10px 0 0' }}>{addError}</p>
          )}
          {availableRestaurants.length === 0 && restaurants.length > 0 && (
            <p style={{ fontSize: 11, color: '#999', margin: '8px 0 0' }}>
              Tutti i ristoranti sono già stati aggiunti come partner
            </p>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 13 }}>
            Caricamento...
          </div>
        ) : partners.length === 0 ? (
          <div style={{
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
              Nessun partner
            </p>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              Aggiungi un ristorante partner per generare il PIN di verifica QR
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {partners.map(p => (
              <motion.div
                key={p.id}
                layout
                style={{
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>
                      {p.restaurant?.name || 'Ristorante'}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                      Partner dal {new Date(p.created_at).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 9px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    background: p.is_active ? '#ecfdf5' : '#f3f3f3',
                    color: p.is_active ? '#059669' : '#666',
                    flexShrink: 0,
                  }}>
                    {p.is_active ? 'Attivo' : 'Disattivato'}
                  </span>
                </div>

                {/* PIN display */}
                <div style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      PIN Verifica
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--color-ink)',
                      letterSpacing: 4,
                    }}>
                      {p.pin_code}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyPin(p.id, p.pin_code)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #e5e5e5',
                      background: '#fff',
                      color: 'var(--color-ink)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {copiedId === p.id ? 'Copiato!' : 'Copia'}
                  </button>
                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  paddingTop: 12,
                  borderTop: '1px solid #f3f3f3',
                  flexWrap: 'wrap',
                }}>
                  <button
                    onClick={() => handleRegeneratePin(p.id)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#fef3c7',
                      color: '#b45309',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Rigenera PIN
                  </button>
                  <button
                    onClick={() => handleToggle(p.id, p.is_active)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: p.is_active ? '#f3f3f3' : '#ecfdf5',
                      color: p.is_active ? '#666' : '#059669',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {p.is_active ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(p)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: 11,
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
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>
                  Eliminare partner?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '8px 0 20px' }}>
                  Stai per rimuovere "{deleteConfirm.restaurant?.name}" dai partner. Il PIN non sarà più valido.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e5e5',
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
