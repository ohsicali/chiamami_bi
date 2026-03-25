import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useAllReviews } from '../../lib/hooks/useReviews'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
}

export default function AdminStats() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { allRestaurants: restaurants } = useRestaurants()
  const { reviews } = useAllReviews()
  const [discountStats, setDiscountStats] = useState({ total: 0, redeemed: 0 })
  const [subscriberCount, setSubscriberCount] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    // Fetch discount redemption stats
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

  // Build monthly data for charts
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

  // Rating distribution
  const ratingDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]
    if (reviews) {
      reviews.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
      })
    }
    return [
      { label: '1 ⭐', count: dist[0] },
      { label: '2 ⭐', count: dist[1] },
      { label: '3 ⭐', count: dist[2] },
      { label: '4 ⭐', count: dist[3] },
      { label: '5 ⭐', count: dist[4] },
    ]
  }, [reviews])

  // City distribution
  const cityDist = useMemo(() => {
    const map = {}
    restaurants.forEach(r => {
      const city = r.city || 'Altro'
      map[city] = (map[city] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))
  }, [restaurants])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '—'

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
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Statistiche
        </motion.h1>

        {/* Summary cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Ristoranti" value={restaurants.length} icon="🏪" highlight />
          <StatCard label="Recensioni" value={reviews?.length || 0} icon="⭐" />
          <StatCard label="Media voti" value={avgRating} icon="📊" />
          <StatCard label="Iscritti newsletter" value={subscriberCount} icon="📧" />
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Sconti generati" value={discountStats.total} icon="🎫" />
          <StatCard label="Sconti usati" value={discountStats.redeemed} icon="✅" />
          <StatCard
            label="Tasso utilizzo"
            value={discountStats.total > 0 ? `${Math.round((discountStats.redeemed / discountStats.total) * 100)}%` : '—'}
            icon="📈"
          />
        </motion.div>

        {/* Growth chart */}
        <motion.div variants={itemVariants} className="rounded-2xl bg-card p-5 shadow-sm border border-border">
          <h2 className="text-base font-semibold text-primary mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Crescita mensile
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

        {/* Rating distribution */}
        <motion.div variants={itemVariants} className="rounded-2xl bg-card p-5 shadow-sm border border-border">
          <h2 className="text-base font-semibold text-primary mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Distribuzione voti
          </h2>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={ratingDist}>
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
                <Bar dataKey="count" fill="#FF5757" radius={[6, 6, 0, 0]} name="Recensioni" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* City distribution */}
        {cityDist.length > 0 && (
          <motion.div variants={itemVariants} className="rounded-2xl bg-card p-5 shadow-sm border border-border">
            <h2 className="text-base font-semibold text-primary mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Ristoranti per città
            </h2>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={cityDist} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#eae7e0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#888' }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: '#888' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #eae7e0',
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" fill="#1a1a1a" radius={[0, 6, 6, 0]} name="Ristoranti" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AdminLayout>
  )
}

function StatCard({ label, value, icon, highlight = false }) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm border"
      style={{
        backgroundColor: highlight ? '#1a1a1a' : '#fff',
        borderColor: highlight ? '#1a1a1a' : '#eae7e0',
      }}
    >
      <div className="text-lg mb-1">{icon}</div>
      <div
        className="text-xl font-bold"
        style={{
          color: highlight ? '#fff' : '#1a1a1a',
          fontFamily: 'var(--font-display)',
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
    </div>
  )
}
