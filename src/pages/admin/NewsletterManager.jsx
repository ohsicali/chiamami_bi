import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

const TEMPLATES = [
  { id: 'new-restaurant', label: 'Nuovo ristorante', fields: ['restaurant_name', 'slug', 'discount'] },
  { id: 'weekly-digest', label: 'Digest settimanale', fields: ['content'] },
]

export default function NewsletterManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('subscribers') // 'subscribers' | 'send'
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id)
  const [subject, setSubject] = useState('')
  const [variables, setVariables] = useState({})
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

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

  const handleSendNewsletter = async () => {
    if (!subject.trim()) return
    if (!confirm(`Inviare la newsletter a ${subscribers.length} iscritti?`)) return

    setSending(true)
    setSendResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { subject, template: selectedTemplate, variables },
      })

      if (error) throw error
      setSendResult({ success: true, sent: data?.sent || 0 })
      setSubject('')
      setVariables({})
    } catch (err) {
      setSendResult({ success: false, error: err.message })
    } finally {
      setSending(false)
    }
  }

  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplate)

  if (authLoading || loading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Newsletter">
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>
            Newsletter
          </h1>
          <p className="text-sm text-secondary mt-0.5">{subscribers.length} iscritti</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleExportCSV}
            disabled={subscribers.length === 0}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow-sm disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
          >
            Esporta CSV
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-6">
        {[
          { id: 'subscribers', label: 'Iscritti' },
          { id: 'send', label: 'Invia newsletter' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'subscribers' ? (
          <motion.div
            key="subscribers"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-2"
          >
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
          </motion.div>
        ) : (
          <motion.div
            key="send"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            {/* Template selector */}
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2 block">
                Template
              </label>
              <div className="flex gap-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTemplate(t.id); setVariables({}) }}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      selectedTemplate === t.id
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-secondary hover:text-primary'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2 block">
                Oggetto
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Es. Nuovo ristorante: Trattoria del Corso"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            {/* Template variables */}
            <div className="rounded-2xl bg-card p-5 shadow-sm">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3 block">
                Variabili template
              </label>
              <div className="flex flex-col gap-3">
                {currentTemplate?.fields.map(field => (
                  <div key={field}>
                    <label className="text-xs text-secondary mb-1 block">{field}</label>
                    {field === 'content' ? (
                      <textarea
                        value={variables[field] || ''}
                        onChange={(e) => setVariables(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`Inserisci ${field}...`}
                        rows={4}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-accent focus:outline-none resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={variables[field] || ''}
                        onChange={(e) => setVariables(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`Inserisci ${field}...`}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-accent focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Send result */}
            {sendResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-4 text-sm font-medium ${
                  sendResult.success
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {sendResult.success
                  ? `Newsletter inviata a ${sendResult.sent} iscritti!`
                  : `Errore: ${sendResult.error}`}
              </motion.div>
            )}

            {/* Send button */}
            <motion.button
              onClick={handleSendNewsletter}
              disabled={sending || !subject.trim() || subscribers.length === 0}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
            >
              {sending ? 'Invio in corso...' : `Invia a ${subscribers.length} iscritti`}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </AdminLayout>
  )
}
