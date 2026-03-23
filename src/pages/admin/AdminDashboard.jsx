import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, useMotionValue, animate, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { LoadingSpinner } from '../../components/UI/LoadingSpinner'
import Badge from '../../components/UI/Badge'
import { LogoFull } from '../../components/UI/Logo'

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
/*  Admin sidebar / layout shell                                       */
/* ------------------------------------------------------------------ */
function AdminLayout({ children, user, onLogout }) {
  const navigate = useNavigate()

  // Enable scrolling on admin pages (body has overflow:hidden by default for map)
  useEffect(() => {
    document.body.classList.add('admin-scroll')
    return () => document.body.classList.remove('admin-scroll')
  }, [])

  const links = [
    { to: '/admin', label: 'Dashboard', icon: DashboardIcon },
    { to: '/admin/restaurant/new', label: 'Nuovo Ristorante', icon: PlusIcon },
    { to: '/admin/categories', label: 'Categorie', icon: TagIcon },
    { to: '/admin/discounts', label: 'Sconti', icon: DiscountIcon },
    { to: '/admin/partners', label: 'Partner', icon: PartnerIcon },
    { to: '/admin/reviews', label: 'Recensioni', icon: ReviewIcon },
  ]

  return (
    <div className="min-h-screen bg-bg flex" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}>
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-card border-r border-gray-100 p-6 shrink-0">
        <Link to="/admin" className="mb-10">
          <LogoFull height={22} />
        </Link>

        <nav className="flex-1 space-y-1">
          {links.map((l) => {
            const active = location.pathname === l.to
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-accent/10 text-accent' : 'text-secondary hover:text-primary hover:bg-gray-50'}`}
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            )
          })}
        </nav>

        <div className="pt-4 border-t border-gray-100 mt-4">
          <p className="text-xs text-secondary truncate mb-2">{user?.email ?? 'Admin'}</p>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-secondary hover:text-red-500 transition-colors">
            <LogoutIcon className="w-4 h-4" />
            Esci
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 glass border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Link to="/admin"><LogoFull height={20} /></Link>
        <div className="flex items-center gap-3">
          <Link to="/admin/restaurant/new" className="text-accent">
            <PlusIcon className="w-5 h-5" />
          </Link>
          <Link to="/admin/categories" className="text-secondary hover:text-primary">
            <TagIcon className="w-5 h-5" />
          </Link>
          <Link to="/admin/discounts" className="text-secondary hover:text-primary">
            <DiscountIcon className="w-5 h-5" />
          </Link>
          <Link to="/admin/partners" className="text-secondary hover:text-primary">
            <PartnerIcon className="w-5 h-5" />
          </Link>
          <Link to="/admin/reviews" className="text-secondary hover:text-primary">
            <ReviewIcon className="w-5 h-5" />
          </Link>
          <button onClick={onLogout} className="text-secondary hover:text-red-500">
            <LogoutIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:p-8 p-4 pt-16 md:pt-8" style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
function DashboardIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}
function PlusIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}
function TagIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 10V5a2 2 0 012-2z" />
    </svg>
  )
}
function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
    </svg>
  )
}
function DiscountIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  )
}
function ReviewIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}
function PartnerIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}
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
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const { allRestaurants: restaurants, loading: dataLoading } = useRestaurants()

  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [deleteId, setDeleteId] = useState(null)

  // Redirect if not auth
  useEffect(() => {
    if (!authLoading && !user) navigate('/admin/login', { replace: true })
  }, [user, authLoading, navigate])

  // Stats
  const stats = useMemo(() => {
    const total = restaurants.length
    const published = restaurants.filter((r) => r.is_published !== false).length
    const drafts = total - published
    const cities = new Set(restaurants.map((r) => r.city || 'Torino')).size
    return { total, published, drafts, cities }
  }, [restaurants])

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
    <AdminLayout user={user} onLogout={signOut}>
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

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
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
