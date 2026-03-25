import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export default function PartnerManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [partners, setPartners] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) return

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
  }, [])

  const [addError, setAddError] = useState(null)

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
      setAddError(error.message || 'Errore durante l\'aggiunta. Riprova.')
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

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo partner?')) return
    await supabase.from('restaurant_partners').delete().eq('id', id)
    setPartners(prev => prev.filter(p => p.id !== id))
  }

  // Restaurants not yet partners
  const partnerRestaurantIds = new Set(partners.map(p => p.restaurant_id))
  const availableRestaurants = restaurants.filter(r => !partnerRestaurantIds.has(r.id))

  if (authLoading || loading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Partner">
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary" style={{ fontWeight: 700 }}>
          Ristoranti Partner
        </h1>
        <p className="text-sm text-secondary mt-0.5">
          Gestisci i PIN per la verifica QR dei ristoranti
        </p>
      </div>

      {/* Add new partner */}
      <div className="rounded-2xl bg-card p-4 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-primary mb-3">Aggiungi partner</h3>
        <div className="flex gap-3">
          <select
            value={selectedRestaurant}
            onChange={e => setSelectedRestaurant(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
          >
            <option value="">Seleziona ristorante...</option>
            {availableRestaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <motion.button
            onClick={handleAdd}
            disabled={!selectedRestaurant || adding}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
          >
            {adding ? '...' : 'Aggiungi'}
          </motion.button>
        </div>
        {addError && (
          <p className="text-xs text-red-500 mt-2">{addError}</p>
        )}
      </div>

      {/* Partners list */}
      <div className="flex flex-col gap-3">
        {partners.map(p => (
          <div key={p.id} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-primary">
                    {p.restaurant?.name || 'Ristorante'}
                  </h3>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {p.is_active ? 'Attivo' : 'Disattivato'}
                  </span>
                </div>

                {/* PIN display */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-secondary">PIN:</span>
                  <span className="font-mono text-lg font-bold text-primary tracking-widest">
                    {p.pin_code}
                  </span>
                </div>

                {/* Verify URL */}
                <p className="text-xs text-secondary mt-1 truncate">
                  Verifica: {window.location.origin}/verify?code=...
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleRegeneratePin(p.id)}
                  className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700"
                >
                  Nuovo PIN
                </button>
                <button
                  onClick={() => handleToggle(p.id, p.is_active)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    p.is_active ? 'bg-gray-100 text-secondary' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {p.is_active ? 'Disattiva' : 'Attiva'}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500"
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        ))}

        {partners.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm">
            <span className="text-4xl mb-3">🤝</span>
            <p className="text-base font-semibold text-primary">Nessun partner</p>
            <p className="mt-1 text-sm text-secondary">
              Aggiungi un ristorante partner per generare il PIN di verifica QR
            </p>
          </div>
        )}
      </div>
    </div>
    </AdminLayout>
  )
}
