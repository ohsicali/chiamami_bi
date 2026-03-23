import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function DiscountManager() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [discounts, setDiscounts] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
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
  })

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin/login', { replace: true })
  }, [user, authLoading, navigate])

  useEffect(() => {
    document.body.classList.add('admin-scroll')
    return () => document.body.classList.remove('admin-scroll')
  }, [])

  // Fetch discounts and restaurants
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    Promise.all([
      supabase
        .from('discounts')
        .select('*, restaurant:restaurants(id, name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('restaurants')
        .select('id, name')
        .order('name'),
    ]).then(([discRes, restRes]) => {
      setDiscounts(discRes.data || [])
      setRestaurants(restRes.data || [])
      setLoading(false)
    })
  }, [])

  const resetForm = () => {
    setForm({
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
    })
    setEditing(null)
  }

  const handleEdit = (discount) => {
    setForm({
      restaurant_id: discount.restaurant_id,
      title: discount.title,
      description: discount.description || '',
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      conditions: discount.conditions || '',
      valid_from: discount.valid_from?.split('T')[0] || '',
      valid_until: discount.valid_until?.split('T')[0] || '',
      max_redemptions: discount.max_redemptions || '',
      is_active: discount.is_active,
    })
    setEditing(discount.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.restaurant_id || !form.title || !form.discount_value || !form.valid_until) return

    setSaving(true)
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
    }

    let result
    if (editing) {
      result = await supabase.from('discounts').update(payload).eq('id', editing).select('*, restaurant:restaurants(id, name)').single()
    } else {
      result = await supabase.from('discounts').insert(payload).select('*, restaurant:restaurants(id, name)').single()
    }

    if (result.data) {
      if (editing) {
        setDiscounts(prev => prev.map(d => d.id === editing ? result.data : d))
      } else {
        setDiscounts(prev => [result.data, ...prev])
      }
      setShowForm(false)
      resetForm()
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo sconto?')) return
    await supabase.from('discounts').delete().eq('id', id)
    setDiscounts(prev => prev.filter(d => d.id !== id))
  }

  const handleToggleActive = async (id, currentActive) => {
    const { data } = await supabase
      .from('discounts')
      .update({ is_active: !currentActive })
      .eq('id', id)
      .select('*, restaurant:restaurants(id, name)')
      .single()
    if (data) {
      setDiscounts(prev => prev.map(d => d.id === id ? data : d))
    }
  }

  if (authLoading || loading) return null

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
            Gestione Sconti
          </h1>
          <p className="text-sm text-secondary mt-0.5">{discounts.length} sconti totali</p>
        </div>
        <motion.button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          whileTap={{ scale: 0.95 }}
        >
          + Nuovo sconto
        </motion.button>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowForm(false); resetForm() }}
          >
            <motion.div
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-primary mb-4">
                {editing ? 'Modifica sconto' : 'Nuovo sconto'}
              </h2>

              <div className="flex flex-col gap-4">
                {/* Restaurant */}
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">Ristorante</label>
                  <select
                    value={form.restaurant_id}
                    onChange={e => setForm(f => ({ ...f, restaurant_id: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">Seleziona...</option>
                    {restaurants.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">Titolo sconto</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Es: 10% su tutta la cena"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>

                {/* Type + Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-primary block mb-1">Tipo</label>
                    <select
                      value={form.discount_type}
                      onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
                    >
                      <option value="percentage">Percentuale</option>
                      <option value="fixed">Importo fisso</option>
                      <option value="freebie">Omaggio</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-primary block mb-1">Valore</label>
                    <input
                      type="text"
                      value={form.discount_value}
                      onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                      placeholder="Es: 10%, 5€, Dolce gratis"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">Condizioni (opzionale)</label>
                  <input
                    type="text"
                    value={form.conditions}
                    onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
                    placeholder="Es: Valido solo a cena, min 2 persone"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-primary block mb-1">Valido dal</label>
                    <input
                      type="date"
                      value={form.valid_from}
                      onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-primary block mb-1">Valido fino al</label>
                    <input
                      type="date"
                      value={form.valid_until}
                      onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                {/* Max redemptions */}
                <div>
                  <label className="text-sm font-medium text-primary block mb-1">Limite utilizzi (vuoto = illimitato)</label>
                  <input
                    type="number"
                    value={form.max_redemptions}
                    onChange={e => setForm(f => ({ ...f, max_redemptions: e.target.value }))}
                    placeholder="Illimitato"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>

                {/* Active toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 accent-[#FF5757]"
                  />
                  <span className="text-sm text-primary">Attivo</span>
                </label>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-secondary"
                  >
                    Annulla
                  </button>
                  <motion.button
                    onClick={handleSave}
                    disabled={saving || !form.restaurant_id || !form.title || !form.discount_value || !form.valid_until}
                    className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    whileTap={{ scale: 0.97 }}
                  >
                    {saving ? 'Salvataggio...' : editing ? 'Salva modifiche' : 'Crea sconto'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discounts list */}
      <div className="flex flex-col gap-3">
        {discounts.map(d => {
          const isExpired = new Date(d.valid_until) < new Date()
          const isActive = d.is_active && !isExpired

          return (
            <motion.div
              key={d.id}
              className="rounded-2xl bg-card p-4 shadow-sm"
              layout
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-primary truncate">
                      {d.restaurant?.name || 'Ristorante'}
                    </h3>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isActive ? 'Attivo' : isExpired ? 'Scaduto' : 'Disattivato'}
                    </span>
                  </div>
                  <p className="text-accent font-semibold text-sm mt-0.5">{d.discount_value}</p>
                  <p className="text-xs text-secondary mt-0.5">{d.title}</p>
                  {d.conditions && (
                    <p className="text-xs text-secondary mt-0.5">{d.conditions}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-secondary">
                    <span>Utilizzi: {d.total_redeemed}{d.max_redemptions ? `/${d.max_redemptions}` : ''}</span>
                    <span>Scade: {new Date(d.valid_until).toLocaleDateString('it-IT')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(d.id, d.is_active)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      d.is_active ? 'bg-gray-100 text-secondary' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {d.is_active ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button
                    onClick={() => handleEdit(d)}
                    className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-secondary"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}

        {discounts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm">
            <span className="text-4xl mb-3">🏷️</span>
            <p className="text-base font-semibold text-primary">Nessuno sconto creato</p>
            <p className="mt-1 text-sm text-secondary">
              Crea il primo sconto per un ristorante partner
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
