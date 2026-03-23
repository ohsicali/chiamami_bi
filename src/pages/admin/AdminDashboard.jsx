import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, animate, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { LoadingSpinner } from '../../components/UI/LoadingSpinner'
import Badge from '../../components/UI/Badge'
import AdminLayout from '../../components/Layout/AdminLayout'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/* ------------------------------------------------------------------ */
/*  Animated counter component                                         */
/* ------------------------------------------------------------------ */
function AnimatedCounter({ value, duration = 1.2 }) {
  const motionVal = useMotionValue(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, duration, motionVal])

  return <span>{display}</span>
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    </svg>
  )
}
function ChevronIcon({ className, direction = 'up' }) {
  const rotation = direction === 'up' ? '' : 'rotate-180'
  return (
    <svg className={`${className} ${rotation}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard Page                                                */
/* ------------------------------------------------------------------ */
export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth()
  const { allRestaurants: restaurants, loading: dataLoading } = useRestaurants()

  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [deleteId, setDeleteId] = useState(null)

  // Stats
  const stats = useMemo(() => {
    const total = restaurants.length
    const published = restaurants.filter((r) => r.is_published !== false).length
    const drafts = total - published
    const cities = new Set(restaurants.map((r) => r.city || 'Torino')).size
    return { total, published, drafts, cities }
  }, [restaurants])

  // Chart data — mock weekly registrations over last 8 weeks
  const registrationData = useMemo(() => {
    const weeks = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      weeks.push({
        week: d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        utenti: Math.floor(Math.random() * 40) + 10 + i * 3,
        ristoranti: Math.floor(Math.random() * 5) + (i < 3 ? 2 : 0),
      })
    }
    return weeks
  }, [])

  // Top restaurants by category
  const topCategoriesData = useMemo(() => {
    const counts = {}
    restaurants.forEach(r => {
      const cats = r.category || (r.cuisine_type ? [r.cuisine_type] : [])
      cats.forEach(c => { counts[c] = (counts[c] || 0) + 1 })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))
  }, [restaurants])

  // Recent activity feed — mock data
  const activityFeed = useMemo(() => [
    { id: 1, type: 'restaurant', text: 'Nuovo ristorante aggiunto: Trattoria del Borgo', time: '2 ore fa', icon: '🍽️' },
    { id: 2, type: 'review', text: 'Nuova recensione su Pizzeria Bella Napoli', time: '3 ore fa', icon: '⭐' },
    { id: 3, type: 'partner', text: 'Nuova candidatura partner: Osteria del Centro', time: '5 ore fa', icon: '🤝' },
    { id: 4, type: 'discount', text: 'Sconto riscattato: 10% da Sushi Zen', time: '6 ore fa', icon: '🎟️' },
    { id: 5, type: 'newsletter', text: '3 nuovi iscritti alla newsletter', time: '8 ore fa', icon: '📬' },
    { id: 6, type: 'restaurant', text: 'Ristorante aggiornato: Café Torino', time: '1 giorno fa', icon: '✏️' },
  ], [])

  // Filtered + sorted
  const rows = useMemo(() => {
    let result = [...restaurants]

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

    result.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') cmp = a.name.localeCompare(b.name, 'it')
      else if (sortCol === 'city') cmp = (a.city || 'Torino').localeCompare(b.city || 'Torino', 'it')
      else if (sortCol === 'status') cmp = (a.is_published === false ? 1 : 0) - (b.is_published === false ? 1 : 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [restaurants, search, sortCol, sortDir])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }

  const handleTogglePublish = (id) => {
    // In mock mode this is a no-op visual change; with Supabase it would update the row
    console.log('Toggle publish:', id)
  }

  const handleDelete = (id) => {
    // Mock delete
    console.log('Delete restaurant:', id)
    setDeleteId(null)
  }

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) return null

  const statCards = [
    { label: 'Ristoranti', value: stats.total, color: '#FF5757', icon: '🍽️' },
    { label: 'Pubblicati', value: stats.published, color: '#34C759', icon: '✅' },
    { label: 'Bozze', value: stats.drafts, color: '#F59E0B', icon: '📝' },
    { label: 'Citta', value: stats.cities, color: '#6366F1', icon: '🏙️' },
  ]

  const SortHeader = ({ col, children, className = '' }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-primary transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col && <ChevronIcon className="w-3 h-3" direction={sortDir === 'asc' ? 'up' : 'down'} />}
      </span>
    </th>
  )

  return (
    <AdminLayout title="Dashboard">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <p className="text-sm text-secondary mt-0.5">
            Ciao, {user?.email?.split('@')[0] ?? 'Admin'}
          </p>
        </div>

        <Link
          to="/admin/restaurant/new"
          className="inline-flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-md hover:bg-[#e64545] transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuovo Ristorante
        </Link>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="bg-card rounded-2xl border border-gray-100 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl">{s.icon}</span>
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
            </div>
            <p className="text-2xl font-bold text-primary">
              <AnimatedCounter value={s.value} />
            </p>
            <p className="text-xs text-secondary mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Registrations line chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="bg-card rounded-2xl border border-gray-100 p-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-primary mb-4">Registrazioni settimanali</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={registrationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="utenti" stroke="#FF5757" strokeWidth={2} dot={{ r: 3 }} name="Utenti" />
              <Line type="monotone" dataKey="ristoranti" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} name="Ristoranti" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top categories bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="bg-card rounded-2xl border border-gray-100 p-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-primary mb-4">Top categorie</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCategoriesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" width={90} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" fill="#FF5757" radius={[0, 6, 6, 0]} name="Ristoranti" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent activity feed */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="bg-card rounded-2xl border border-gray-100 p-5 shadow-sm mb-8"
      >
        <h3 className="text-sm font-semibold text-primary mb-4">Attivita recente</h3>
        <div className="space-y-3">
          {activityFeed.map(item => (
            <div key={item.id} className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary">{item.text}</p>
                <p className="text-xs text-secondary">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mb-4"
      >
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca ristoranti..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-bg text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
          />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                <th className="px-4 py-3 w-12" />
                <SortHeader col="name">Nome</SortHeader>
                <SortHeader col="city">Citta</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Categoria</th>
                <SortHeader col="status">Stato</SortHeader>
                <th className="px-4 py-3 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const cats = (r.category || (r.cuisine_type ? [r.cuisine_type] : []))
                  .map(name => CUISINE_CATEGORIES.find(c => c.name === name))
                  .filter(Boolean)
                const cat = cats[0]
                const isPublished = r.is_published !== false
                const thumb = Array.isArray(r.photos) && r.photos.length > 0
                  ? (typeof r.photos[0] === 'string' ? r.photos[0] : r.photos[0]?.photo_url)
                  : null

                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Thumbnail */}
                    <td className="px-4 py-3">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-secondary text-xs">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4a3 3 0 014.24 0L16 16m-2-2l1.17-1.17a3 3 0 014.24 0L21 14M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    {/* Name */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-primary">{r.name}</p>
                      <p className="text-xs text-secondary truncate max-w-[200px]">{r.address}</p>
                    </td>
                    {/* City */}
                    <td className="px-4 py-3 text-sm text-secondary">{r.city || 'Torino'}</td>
                    {/* Category */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {cats.length > 0 ? cats.map(c => (
                          <Badge key={c.name} color={c.color}>
                            {c.emoji} {c.name}
                          </Badge>
                        )) : (
                          <span className="text-xs text-secondary">—</span>
                        )}
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isPublished ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {isPublished ? 'Pubblicato' : 'Bozza'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/admin/restaurant/${r.id}/edit`}
                          className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                          title="Modifica"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleTogglePublish(r.id)}
                          className={`p-2 rounded-lg transition-colors ${isPublished ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'}`}
                          title={isPublished ? 'Nascondi' : 'Pubblica'}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            {isPublished ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.17-3.592M6.7 6.7A9.965 9.965 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.162 5.175M15 12a3 3 0 01-6 0M3 3l18 18" />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(r.id)}
                          className="p-2 rounded-lg text-secondary hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Elimina"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-secondary text-sm">
                    {search ? 'Nessun ristorante trovato.' : 'Nessun ristorante ancora.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-primary mb-2">Conferma eliminazione</h3>
              <p className="text-sm text-secondary mb-6">
                Sei sicuro di voler eliminare questo ristorante? Questa azione non puo essere annullata.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-gray-100 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
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
