import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useAllReviews } from '../../lib/hooks/useReviews'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const TIME_FILTERS = [
  { key: '7d', label: '7 giorni' },
  { key: '30d', label: '30 giorni' },
  { key: 'all', label: 'Tutto' },
]

export default function AdminStats() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { allRestaurants: restaurants } = useRestaurants()
  const { reviews } = useAllReviews()
  const [discountStats, setDiscountStats] = useState({ total: 0, redeemed: 0 })
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [timeFilter, setTimeFilter] = useState('all')

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    supabase.from('discount_redemptions').select('status', { count: 'exact' }).then(({ count }) => {
      setDiscountStats(prev => ({ ...prev, total: count || 0 }))
    })
    supabase.from('discount_redemptions').select('status', { count: 'exact' }).eq('status', 'redeemed').then(({ count }) => {
      setDiscountStats(prev => ({ ...prev, redeemed: count || 0 }))
    })
    supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).then(({ count }) => {
      setSubscriberCount(count || 0)
    })
  }, [])

  // Filter data by time range
  const filterByTime = (items, dateField = 'created_at') => {
    if (!items || timeFilter === 'all') return items || []
    const now = new Date()
    const days = timeFilter === '7d' ? 7 : 30
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    return items.filter(item => {
      if (!item[dateField]) return false
      return new Date(item[dateField]) >= cutoff
    })
  }

  const filteredRestaurants = useMemo(() => filterByTime(restaurants), [restaurants, timeFilter])
  const filteredReviews = useMemo(() => filterByTime(reviews), [reviews, timeFilter])

  // Compute previous period stats for % change
  const periodStats = useMemo(() => {
    if (timeFilter === 'all') {
      return {
        restaurantChange: null,
        reviewChange: null,
        ratingChange: null,
        subscriberChange: null,
      }
    }
    const days = timeFilter === '7d' ? 7 : 30
    const now = new Date()
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const prevCutoff = new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000)

    const prevRestaurants = (restaurants || []).filter(r => {
      if (!r.created_at) return false
      const d = new Date(r.created_at)
      return d >= prevCutoff && d < cutoff
    })
    const prevReviews = (reviews || []).filter(r => {
      if (!r.created_at) return false
      const d = new Date(r.created_at)
      return d >= prevCutoff && d < cutoff
    })

    const pctChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return ((curr - prev) / prev * 100).toFixed(1)
    }

    return {
      restaurantChange: `+${pctChange(filteredRestaurants.length, prevRestaurants.length)}%`,
      reviewChange: `+${pctChange(filteredReviews.length, prevReviews.length)}%`,
      ratingChange: null,
      subscriberChange: null,
    }
  }, [restaurants, reviews, filteredRestaurants, filteredReviews, timeFilter])

  // Build monthly data for chart
  const monthlyData = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        label: d.toLocaleDateString('it-IT', { month: 'short' }),
        month: d.getMonth(),
        year: d.getFullYear(),
        restaurants: 0,
        reviews: 0,
      })
    }

    restaurants.forEach(r => {
      if (!r.created_at) return
      const d = new Date(r.created_at)
      const entry = months.find(m => m.month === d.getMonth() && m.year === d.getFullYear())
      if (entry) entry.restaurants++
    })

    if (reviews) {
      reviews.forEach(r => {
        if (!r.created_at) return
        const d = new Date(r.created_at)
        const entry = months.find(m => m.month === d.getMonth() && m.year === d.getFullYear())
        if (entry) entry.reviews++
      })
    }

    return months
  }, [restaurants, reviews])

  // Top restaurants by review count
  const topRestaurants = useMemo(() => {
    if (!reviews || !restaurants.length) return []
    const countMap = {}
    reviews.forEach(r => {
      if (r.restaurant_id) {
        countMap[r.restaurant_id] = (countMap[r.restaurant_id] || 0) + 1
      }
    })
    return Object.entries(countMap)
      .map(([id, count]) => {
        const rest = restaurants.find(r => r.id === id)
        return { name: rest?.name || 'Sconosciuto', count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [restaurants, reviews])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const avgRating = filteredReviews && filteredReviews.length > 0
    ? (filteredReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / filteredReviews.length).toFixed(1)
    : '—'

  const statCards = [
    {
      label: 'Ristoranti',
      value: filteredRestaurants.length,
      change: timeFilter === 'all' ? `+${filteredRestaurants.length} totali` : periodStats.restaurantChange,
      highlight: true,
    },
    {
      label: 'Recensioni',
      value: filteredReviews.length,
      change: timeFilter === 'all' ? `+${filteredReviews.length} totali` : periodStats.reviewChange,
    },
    {
      label: 'Media voti',
      value: avgRating,
      change: avgRating !== '—' ? `su ${filteredReviews.length} voti` : null,
    },
    {
      label: 'Iscritti newsletter',
      value: subscriberCount,
      change: `+${subscriberCount} totali`,
    },
  ]

  const maxTopCount = topRestaurants.length > 0 ? topRestaurants[0].count : 1

  return (
    <AdminLayout title="Statistiche">
      <motion.div
        className="flex flex-col gap-6"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {/* Title */}
        <motion.h1
          variants={itemVariants}
          className="text-2xl font-bold text-primary"
          style={{ fontWeight: 700 }}
        >
          Statistiche
        </motion.h1>

        {/* Time filter pills */}
        <motion.div variants={itemVariants} className="flex gap-2">
          {TIME_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTimeFilter(f.key)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                backgroundColor: timeFilter === f.key ? '#FF5757' : '#f3f4f6',
                color: timeFilter === f.key ? '#fff' : '#6b7280',
              }}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Stat cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((card, i) => (
            <StatCard key={card.label} {...card} />
          ))}
        </motion.div>

        {/* Crescita utenti chart */}
        <motion.div variants={itemVariants} className="rounded-2xl bg-card p-5 shadow-sm border border-border">
          <h2 className="text-base font-semibold text-primary mb-4" style={{ fontWeight: 700 }}>
            Crescita utenti
          </h2>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eae7e0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis tick={{ fontSize: 12, fill: '#888' }} />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #eae7e0',
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                />
                <Line type="monotone" dataKey="restaurants" stroke="#FF5757" strokeWidth={2} dot={{ r: 4 }} name="Ristoranti" />
                <Line type="monotone" dataKey="reviews" stroke="#1D9E75" strokeWidth={2} dot={{ r: 4 }} name="Recensioni" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top ristoranti */}
        <motion.div variants={itemVariants} className="rounded-2xl bg-card p-5 shadow-sm border border-border">
          <h2 className="text-base font-semibold text-primary mb-4" style={{ fontWeight: 700 }}>
            Top ristoranti
          </h2>
          <div className="flex flex-col gap-3">
            {topRestaurants.length === 0 && (
              <p className="text-sm text-secondary">Nessun dato disponibile</p>
            )}
            {topRestaurants.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span
                  className="w-6 text-sm font-bold text-right shrink-0"
                  style={{ color: '#888', fontWeight: 700 }}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-primary w-32 sm:w-40 truncate shrink-0">
                  {item.name}
                </span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: '#FF5757' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / maxTopCount) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                  />
                </div>
                <span
                  className="text-sm font-bold shrink-0 w-8 text-right"
                  style={{ color: '#1a1a1a', fontWeight: 700 }}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Social reach */}
        <motion.div variants={itemVariants}>
          <h2 className="text-base font-semibold text-primary mb-3" style={{ fontWeight: 700 }}>
            Social reach
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <SocialCard
              value="40K"
              label="TikTok follower"
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.71a8.19 8.19 0 004.76 1.52V6.78a4.83 4.83 0 01-1-.09z" />
                </svg>
              }
            />
            <SocialCard
              value="1.8M"
              label="TikTok likes"
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              }
            />
            <SocialCard
              value={subscriberCount}
              label="Newsletter"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
              }
            />
          </div>
        </motion.div>
      </motion.div>
    </AdminLayout>
  )
}

function StatCard({ label, value, change, highlight = false }) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm border"
      style={{
        backgroundColor: highlight ? '#1a1a1a' : '#fff',
        borderColor: highlight ? '#1a1a1a' : '#eae7e0',
      }}
    >
      <div
        className="text-2xl font-bold"
        style={{
          color: highlight ? '#fff' : '#1a1a1a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {value}
      </div>
      <div
        className="text-xs font-medium mt-0.5"
        style={{ color: highlight ? 'rgba(255,255,255,0.6)' : '#888' }}
      >
        {label}
      </div>
      {change && (
        <div className="text-xs font-semibold mt-1.5" style={{ color: '#1D9E75' }}>
          {change}
        </div>
      )}
    </div>
  )
}

function SocialCard({ value, label, icon }) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center gap-1"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div className="text-white/60 mb-1">{icon}</div>
      <div
        className="text-xl font-bold text-white"
        style={{ fontWeight: 700 }}
      >
        {value}
      </div>
      <div className="text-xs text-white/50 font-medium">{label}</div>
    </div>
  )
}
