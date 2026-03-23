import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function NewsletterManager() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [subscribers, setSubscribers] = useState([])
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
      setSubscribers([
        { id: '1', email: 'mario@example.com', created_at: '2026-03-01T10:00:00Z' },
        { id: '2', email: 'laura@example.com', created_at: '2026-03-10T10:00:00Z' },
        { id: '3', email: 'giuseppe@example.com', created_at: '2026-03-15T10:00:00Z' },
      ])
      setLoading(false)
      return
    }

    supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSubscribers(data || [])
        setLoading(false)
      })
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo iscritto?')) return
    if (isSupabaseConfigured()) {
      await supabase.from('newsletter_subscribers').delete().eq('id', id)
    }
    setSubscribers(prev => prev.filter(s => s.id !== id))
  }

  const handleExportCSV = () => {
    const csv = ['email,data_iscrizione']
    subscribers.forEach(s => {
      csv.push(`${s.email},${new Date(s.created_at).toLocaleDateString('it-IT')}`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter_subscribers_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading || loading) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
            Newsletter
          </h1>
          <p className="text-sm text-secondary mt-0.5">{subscribers.length} iscritti</p>
        </div>
        <motion.button
          onClick={handleExportCSV}
          disabled={subscribers.length === 0}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          whileTap={{ scale: 0.95 }}
        >
          Esporta CSV
        </motion.button>
      </div>

      <div className="flex flex-col gap-2">
        {subscribers.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
            <div>
              <p className="text-sm font-medium text-primary">{s.email}</p>
              <p className="text-xs text-secondary">
                Iscritto il {new Date(s.created_at).toLocaleDateString('it-IT')}
              </p>
            </div>
            <button
              onClick={() => handleDelete(s.id)}
              className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500"
            >
              Elimina
            </button>
          </div>
        ))}

        {subscribers.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm">
            <span className="text-4xl mb-3">📬</span>
            <p className="text-base font-semibold text-primary">Nessun iscritto</p>
            <p className="mt-1 text-sm text-secondary">
              Gli utenti possono iscriversi dalla homepage
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
