import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams, Navigate } from 'react-router-dom'
import { motion, useMotionValue, animate, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useAllReviews } from '../../lib/hooks/useReviews'
import { LoadingSpinner } from '../../components/UI/LoadingSpinner'
import Badge from '../../components/UI/Badge'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/* ------------------------------------------------------------------ */
/*  Relative time helper                                               */
/* ------------------------------------------------------------------ */
function timeAgo(date) {
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'Adesso'
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`
  if (diff < 604800) return `${Math.floor(diff / 86400)} giorni fa`
  return date.toLocaleDateString('it-IT')
}

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
function PlusIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
/*  Rating color helper                                                */
/* ------------------------------------------------------------------ */
function ratingColor(rating) {
  if (rating >= 5) return '#22c55e'
  if (rating >= 4) return '#3b82f6'
  if (rating >= 3) return '#eab308'
  if (rating >= 2) return '#f97316'
  return '#ef4444'
}

/* ------------------------------------------------------------------ */
/*  Activity type dot color                                            */
/* ------------------------------------------------------------------ */
function activityDotColor(type) {
  if (type === 'restaurant') return '#6366f1'
  if (type === 'review') return '#22c55e'
  if (type === 'discount') return '#f59e0b'
  if (type === 'partner') return '#3b82f6'
  return '#9ca3af'
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard Page                                                */
/* ------------------------------------------------------------------ */
export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { allRestaurants: restaurants, loading: dataLoading } = useRestaurants()

  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [deleteId, setDeleteId] = useState(null)
  const [searchParams] = useSearchParams()
  const restaurantTableRef = useRef(null)


  // Scroll to restaurants table if ?section=restaurants
  useEffect(() => {
    if (searchParams.get('section') === 'restaurants' && restaurantTableRef.current) {
      setTimeout(() => {
        restaurantTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [searchParams, dataLoading])

  // Stats
  const stats = useMemo(() => {
    const total = restaurants.length
    const published = restaurants.filter((r) => r.is_published !== false).length
    const drafts = total - published
    const cities = new Set(restaurants.map((r) => r.city || 'Torino')).size
    return { total, published, drafts, cities }
  }, [restaurants])

  // Chart data — restaurants added per week over last 8 weeks (real data)
  const registrationData = useMemo(() => {
    const weeks = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7)
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() - i * 7)
      const count = restaurants.filter(r => {
        const created = new Date(r.created_at)
        return created >= weekStart && created < weekEnd
      }).length
      weeks.push({
        week: weekEnd.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        ristoranti: count,
      })
    }
    return weeks
  }, [restaurants])

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

  // Reviews for moderation
  const { reviews: allReviews, updateStatus: updateReviewStatus } = useAllReviews()
  const pendingReviews = useMemo(() => allReviews.filter(r => r.status === 'pending_review'), [allReviews])

  // Real recent activity feed
  const [activityFeed, setActivityFeed] = useState([])
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const fetchActivity = async () => {
      try {
        const items = []
        // Latest restaurants
        const { data: recentRestaurants } = await supabase
          .from('restaurants')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(3)
        ;(recentRestaurants || []).forEach(r => {
          items.push({ id: `r-${r.id}`, type: 'restaurant', text: `Ristorante aggiunto: ${r.name}`, time: r.created_at, icon: '🍽️' })
        })
        // Latest reviews
        const { data: recentReviews } = await supabase
          .from('user_reviews')
          .select('id, created_at, status, restaurant:restaurants(name), user:profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(3)
        ;(recentReviews || []).forEach(r => {
          items.push({ id: `rev-${r.id}`, type: 'review', text: `Recensione su ${r.restaurant?.name || '?'} da ${r.user?.full_name || 'Utente'}`, time: r.created_at, icon: r.status === 'pending_review' ? '⏳' : '⭐' })
        })
        // Latest redemptions
        const { data: recentRedemptions } = await supabase
          .from('discount_redemptions')
          .select('id, generated_at, redeemed_at, status, discount:discounts(title, discount_value, restaurant:restaurants(name))')
          .order('generated_at', { ascending: false })
          .limit(3)
        ;(recentRedemptions || []).forEach(r => {
          const action = r.status === 'redeemed' ? 'Sconto usato' : 'QR generato'
          items.push({ id: `d-${r.id}`, type: 'discount', text: `${action}: ${r.discount?.discount_value || ''} da ${r.discount?.restaurant?.name || '?'}`, time: r.redeemed_at || r.generated_at, icon: '🎟️' })
        })
        // Latest partner applications
        const { data: recentPartners } = await supabase
          .from('partner_applications')
          .select('id, created_at, restaurant_name')
          .order('created_at', { ascending: false })
          .limit(2)
        ;(recentPartners || []).forEach(p => {
          items.push({ id: `p-${p.id}`, type: 'partner', text: `Candidatura partner: ${p.restaurant_name}`, time: p.created_at, icon: '🤝' })
        })
        // Sort by time descending
        items.sort((a, b) => new Date(b.time) - new Date(a.time))
        setActivityFeed(items.slice(0, 8))
      } catch (err) {
        console.error('Failed to fetch activity:', err)
      }
    }
    fetchActivity()
  }, [])

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

  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const statCards = [
    { label: 'Ristoranti totali', value: stats.total, icon: '🍽️', highlight: true },
    { label: 'Pubblicati', value: stats.published, icon: '✅' },
    { label: 'Bozze', value: stats.drafts, icon: '📝' },
    { label: 'Citta', value: stats.cities, icon: '🏙️' },
  ]

  const SortHeader = ({ col, children, className = '' }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none transition-colors ${className}`}
      style={{ color: sortCol === col ? '#1a1a1a' : '#9ca3af' }}
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10"
      >
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: '#1a1a1a' }}
          >
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
            Bentornato, {user?.email?.split('@')[0] ?? 'Admin'}
          </p>
        </div>

        <Link
          to="/admin/restaurant/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95"
          style={{ background: '#1a1a1a', color: '#fff' }}
        >
          <PlusIcon className="w-4 h-4" />
          Nuovo Ristorante
        </Link>
      </motion.div>

      {/* Stats cards — horizontal scrollable row */}
      <div className="flex gap-4 overflow-x-auto pb-2 mb-10" style={{ scrollbarWidth: 'none' }}>
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
            className="flex-shrink-0 rounded-2xl p-6"
            style={
              s.highlight
                ? { background: '#1a1a1a', minWidth: 170 }
                : {
                    background: '#fff',
                    border: '1px solid #eae7e0',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    minWidth: 160,
                  }
            }
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl">{s.icon}</span>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: s.highlight ? 'rgba(255,255,255,0.3)' : '#eae7e0' }}
              />
            </div>
            <p
              className="text-3xl font-bold leading-none mb-2"
              style={{ color: s.highlight ? '#fff' : '#1a1a1a' }}
            >
              <AnimatedCounter value={s.value} />
            </p>
            <p
              className="text-xs font-medium"
              style={{ color: s.highlight ? 'rgba(255,255,255,0.55)' : '#9ca3af' }}
            >
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="rounded-2xl p-6"
          style={{ background: '#fff', border: '1px solid #eae7e0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <h3
            className="text-base font-semibold mb-5"
            style={{ fontFamily: 'var(--font-display)', color: '#1a1a1a' }}
          >
            Registrazioni settimanali
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={registrationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="none" />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="none" />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #eae7e0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="ristoranti" stroke="#1a1a1a" strokeWidth={2} dot={{ r: 3, fill: '#1a1a1a' }} name="Ristoranti" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.35 }}
          className="rounded-2xl p-6"
          style={{ background: '#fff', border: '1px solid #eae7e0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <h3
            className="text-base font-semibold mb-5"
            style={{ fontFamily: 'var(--font-display)', color: '#1a1a1a' }}
          >
            Top categorie
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topCategoriesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="none" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} stroke="none" width={90} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #eae7e0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#1a1a1a" radius={[0, 6, 6, 0]} name="Ristoranti" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Reviews moderation section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.35 }}
        className="rounded-2xl p-6 mb-10"
        style={{ background: '#fff', border: '1px solid #eae7e0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: '#1a1a1a' }}
            >
              Recensioni in attesa
            </h3>
            {pendingReviews.length > 0 && (
              <span
                className="rounded-full text-[11px] font-semibold px-2.5 py-0.5"
                style={{ background: '#1a1a1a', color: '#fff' }}
              >
                {pendingReviews.length}
              </span>
            )}
          </div>
          <Link
            to="/admin/reviews"
            className="text-xs font-medium transition-colors hover:opacity-70"
            style={{ color: '#1a1a1a' }}
          >
            Vedi tutte →
          </Link>
        </div>

        {pendingReviews.length === 0 ? (
          <p className="text-sm py-4" style={{ color: '#9ca3af' }}>
            Nessuna recensione da moderare
          </p>
        ) : (
          <div className="space-y-3">
            {pendingReviews.slice(0, 5).map(review => {
              const borderColor = ratingColor(review.rating || 3)
              return (
                <div
                  key={review.id}
                  className="flex items-start gap-4 rounded-xl px-4 py-3"
                  style={{ borderLeft: `3px solid ${borderColor}`, background: '#fafafa' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                        {review.user?.full_name || 'Utente'}
                      </span>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>
                        su {review.restaurant?.name || '?'}
                      </span>
                      {review.rating && (
                        <span className="text-xs font-semibold" style={{ color: borderColor }}>
                          {'★'.repeat(review.rating)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2" style={{ color: '#6b7280' }}>
                      {review.comment}
                    </p>
                    {review.ai_reason && (
                      <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>
                        AI: {review.ai_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 mt-0.5">
                    <button
                      onClick={() => updateReviewStatus(review.id, 'published')}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                      style={{ background: '#f0fdf4', color: '#16a34a' }}
                    >
                      Approva
                    </button>
                    <button
                      onClick={() => updateReviewStatus(review.id, 'rejected')}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                      style={{ background: '#fef2f2', color: '#dc2626' }}
                    >
                      Rifiuta
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Activity timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44, duration: 0.35 }}
        className="rounded-2xl p-6 mb-10"
        style={{ background: '#fff', border: '1px solid #eae7e0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <h3
          className="text-base font-semibold mb-6"
          style={{ fontFamily: 'var(--font-display)', color: '#1a1a1a' }}
        >
          Attivita recente
        </h3>

        {activityFeed.length === 0 ? (
          <p className="text-sm py-4" style={{ color: '#9ca3af' }}>
            Nessuna attivita recente
          </p>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div
              className="absolute top-2 bottom-2 w-px"
              style={{ left: 11, background: '#eae7e0' }}
            />
            <div className="space-y-5">
              {activityFeed.map((item, idx) => {
                const ago = item.time ? timeAgo(new Date(item.time)) : ''
                const dotColor = activityDotColor(item.type)
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.44 + idx * 0.05, duration: 0.3 }}
                    className="relative flex items-start gap-4"
                    style={{ paddingLeft: 34 }}
                  >
                    {/* Timeline dot */}
                    <span
                      className="absolute top-1 flex items-center justify-center rounded-full text-[11px] z-10"
                      style={{
                        left: 0,
                        width: 22,
                        height: 22,
                        background: dotColor,
                        border: '2px solid #fff',
                        boxShadow: `0 0 0 1px ${dotColor}`,
                      }}
                    >
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ color: '#1a1a1a' }}>
                        {item.text}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                        {ago}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Restaurant table with search */}
      <motion.div
        ref={restaurantTableRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.48, duration: 0.35 }}
        className="scroll-mt-20"
      >
        {/* Section heading + search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <h3
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: '#1a1a1a' }}
          >
            Ristoranti
            {rows.length > 0 && (
              <span className="ml-2 text-sm font-normal" style={{ color: '#9ca3af' }}>
                {rows.length}
              </span>
            )}
          </h3>

          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: '#9ca3af' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca ristoranti..."
              className="pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all w-64"
              style={{
                background: '#fafafa',
                border: '1px solid #eae7e0',
                color: '#1a1a1a',
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid #eae7e0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead style={{ background: '#fafafa', borderBottom: '1px solid #eae7e0' }}>
                <tr>
                  <th className="px-4 py-3 w-12" />
                  <SortHeader col="name">Nome</SortHeader>
                  <SortHeader col="city">Citta</SortHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#9ca3af' }}>Categoria</th>
                  <SortHeader col="status">Stato</SortHeader>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#9ca3af' }}>Azioni</th>
                </tr>
              </thead>
              <tbody style={{ background: '#fff' }}>
                {rows.map((r, idx) => {
                  const cats = (r.category || (r.cuisine_type ? [r.cuisine_type] : []))
                    .map(name => getCategoryInfo(name))
                    .filter(Boolean)
                  const isPublished = r.is_published !== false
                  const thumb = Array.isArray(r.photos) && r.photos.length > 0
                    ? (typeof r.photos[0] === 'string' ? r.photos[0] : r.photos[0]?.photo_url)
                    : null

                  return (
                    <tr
                      key={r.id}
                      className="transition-colors"
                      style={{ borderTop: idx > 0 ? '1px solid #f4f4f4' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                            style={{ border: '1px solid #eae7e0' }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ background: '#f4f4f4', color: '#9ca3af' }}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4a3 3 0 014.24 0L16 16m-2-2l1.17-1.17a3 3 0 014.24 0L21 14M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{r.name}</p>
                        <p className="text-xs truncate max-w-[200px]" style={{ color: '#9ca3af' }}>{r.address}</p>
                      </td>
                      {/* City */}
                      <td className="px-4 py-3 text-sm" style={{ color: '#6b7280' }}>{r.city || 'Torino'}</td>
                      {/* Category */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {cats.length > 0 ? cats.map(c => (
                            <Badge key={c.name} color={c.color}>
                              {c.emoji} {c.name}
                            </Badge>
                          )) : (
                            <span className="text-xs" style={{ color: '#9ca3af' }}>—</span>
                          )}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={
                            isPublished
                              ? { background: '#f0fdf4', color: '#16a34a' }
                              : { background: '#fffbeb', color: '#d97706' }
                          }
                        >
                          {isPublished ? 'Pubblicato' : 'Bozza'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to={`/admin/restaurant/${r.id}/edit`}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#9ca3af' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#1a1a1a'; e.currentTarget.style.background = '#f4f4f4' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }}
                            title="Modifica"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleTogglePublish(r.id)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: isPublished ? '#16a34a' : '#d97706' }}
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
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#9ca3af' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }}
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
                    <td colSpan={7} className="px-4 py-16 text-center text-sm" style={{ color: '#9ca3af' }}>
                      {search ? 'Nessun ristorante trovato.' : 'Nessun ristorante ancora.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="rounded-2xl p-7 max-w-sm w-full"
              style={{
                background: '#fff',
                border: '1px solid #eae7e0',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: 'var(--font-display)', color: '#1a1a1a' }}
              >
                Conferma eliminazione
              </h3>
              <p className="text-sm mb-7" style={{ color: '#6b7280' }}>
                Sei sicuro di voler eliminare questo ristorante? Questa azione non puo essere annullata.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: '#6b7280', background: '#f4f4f4' }}
                >
                  Annulla
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
                  style={{ background: '#1a1a1a', color: '#fff' }}
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
