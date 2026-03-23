import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

const STATUS_LABELS = {
  pending: { label: 'In attesa', color: 'bg-amber-100 text-amber-700' },
  contacted: { label: 'Contattato', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approvato', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rifiutato', color: 'bg-red-100 text-red-500' },
}

export default function ApplicationManager() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) navigate('/admin/login', { replace: true })
  }, [user, authLoading, navigate])

  useEffect(() => {
    document.body.classList.add('admin-scroll')
    return () => document.body.classList.remove('admin-scroll')
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setApplications([
        { id: '1', restaurant_name: 'Ristorante Da Mario', contact_name: 'Mario Rossi', email: 'mario@damario.it', phone: '+39 011 123456', city: 'Torino', message: 'Vorremmo entrare nella vostra piattaforma', status: 'pending', created_at: '2026-03-20T10:00:00Z' },
        { id: '2', restaurant_name: 'Pizzeria Bella Napoli', contact_name: 'Giovanni Bianchi', email: 'info@bellanapoli.it', phone: '+39 011 654321', city: 'Torino', message: '', status: 'contacted', created_at: '2026-03-18T10:00:00Z' },
      ])
      setLoading(false)
      return
    }

    supabase
      .from('partner_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setApplications(data || [])
        setLoading(false)
      })
  }, [])

  const handleStatusChange = async (id, newStatus) => {
    if (isSupabaseConfigured()) {
      await supabase
        .from('partner_applications')
        .update({ status: newStatus })
        .eq('id', id)
    }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questa candidatura?')) return
    if (isSupabaseConfigured()) {
      await supabase.from('partner_applications').delete().eq('id', id)
    }
    setApplications(prev => prev.filter(a => a.id !== id))
  }

  if (authLoading || loading) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
          Candidature Partner
        </h1>
        <p className="text-sm text-secondary mt-0.5">{applications.length} candidature</p>
      </div>

      <div className="flex flex-col gap-3">
        {applications.map(a => {
          const st = STATUS_LABELS[a.status] || STATUS_LABELS.pending
          return (
            <motion.div key={a.id} className="rounded-2xl bg-card p-4 shadow-sm" layout>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-primary">
                      {a.restaurant_name}
                    </h3>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-1">
                    {a.contact_name} &middot; {a.email} &middot; {a.phone}
                  </p>
                  <p className="text-xs text-secondary">{a.city}</p>
                  {a.message && (
                    <p className="text-xs text-secondary mt-1 italic">"{a.message}"</p>
                  )}
                  <p className="text-xs text-secondary mt-1">
                    {new Date(a.created_at).toLocaleDateString('it-IT')}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <select
                    value={a.status}
                    onChange={e => handleStatusChange(a.id, e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
                  >
                    {Object.entries(STATUS_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}

        {applications.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-base font-semibold text-primary">Nessuna candidatura</p>
            <p className="mt-1 text-sm text-secondary">
              Le candidature arriveranno dalla pagina /partner
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
