import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
const ic = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}
function EyeIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function UsersIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}
function TagIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}
function CheckIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w} viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Period helpers                                                     */
/* ------------------------------------------------------------------ */
const PERIODS = [
  { key: 'today', label: 'Oggi', days: 1 },
  { key: '7d', label: '7g', days: 7 },
  { key: '30d', label: '30g', days: 30 },
  { key: '90d', label: '90g', days: 90 },
]

function periodStart(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/* ------------------------------------------------------------------ */
/*  StatCard                                                           */
/* ------------------------------------------------------------------ */
function StatCard({ Icon, label, value, sublabel, trend, trendPositive, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#fafafa',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon w={12} />
        </div>
        {trend && (
          <div
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: trendPositive ? '#ecfdf5' : '#fef2f2',
              color: trendPositive ? '#059669' : '#dc2626',
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            {trend}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1f', marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: 10, color: '#999', marginTop: 4 }} dangerouslySetInnerHTML={{ __html: sublabel }} />
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Analytics page                                                */
/* ------------------------------------------------------------------ */
export default function AnalyticsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { allRestaurants: restaurants } = useRestaurants()
  const [period, setPeriod] = useState('7d')

  // Live visitors — distinct session_id from page_views in last 5 minutes
  const [liveVisitors, setLiveVisitors] = useState(null)
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false
    let interval

    async function fetchLive() {
      try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const { data } = await supabase
          .from('page_views')
          .select('session_id')
          .gte('created_at', fiveMinAgo)
        if (cancelled) return
        const uniq = new Set((data || []).map((r) => r.session_id))
        setLiveVisitors(uniq.size)
      } catch {
        if (!cancelled) setLiveVisitors(0)
      }
    }

    fetchLive()
    interval = setInterval(fetchLive, 30000)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [user])

  // Core metrics (filtered by period)
  const [metrics, setMetrics] = useState({
    totalVisits: 0,
    usersTotal: 0,
    usersInPeriod: 0,
    qrGenerated: 0,
    qrRedeemed: 0,
  })
  const [activeDiscounts, setActiveDiscounts] = useState([])
  const [topRestaurants, setTopRestaurants] = useState([])
  const [pageBreakdown, setPageBreakdown] = useState([])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function fetchAll() {
      const days = PERIODS.find((p) => p.key === period)?.days || 7
      const start = periodStart(days)

      try {
        const [usersTotal, usersInPeriod, qrGen, qrUsed, discData, savedTop, pvTotal, pvByPath] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', start),
          supabase
            .from('discount_redemptions')
            .select('id', { count: 'exact', head: true })
            .gte('generated_at', start),
          supabase
            .from('discount_redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'redeemed')
            .gte('redeemed_at', start),
          supabase
            .from('discounts')
            .select(
              'id, title, discount_value, discount_type, drop_time, max_redemptions, total_redeemed, is_active, valid_until, restaurant:restaurants(id, name, photos)'
            )
            .eq('is_active', true)
            .gte('valid_until', new Date().toISOString())
            .limit(10),
          supabase
            .from('saved_restaurants')
            .select('restaurant_id')
            .gte('created_at', start),
          supabase
            .from('page_views')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', start),
          supabase
            .from('page_views')
            .select('path, session_id')
            .gte('created_at', start),
        ])

        if (cancelled) return

        setMetrics({
          totalVisits: pvTotal.count || 0,
          usersTotal: usersTotal.count || 0,
          usersInPeriod: usersInPeriod.count || 0,
          qrGenerated: qrGen.count || 0,
          qrRedeemed: qrUsed.count || 0,
        })

        // Page breakdown: distinct sessions per page category
        const rows = pvByPath.data || []
        const buckets = {
          'Mappa (home)': new Set(),
          'Scheda ristorante': new Set(),
          'Pagina sconti': new Set(),
          'Profilo': new Set(),
          'Salvati': new Set(),
          'Lista': new Set(),
        }
        rows.forEach((r) => {
          const p = r.path || ''
          if (p === '/' || p === '') buckets['Mappa (home)'].add(r.session_id)
          else if (p.startsWith('/restaurant/')) buckets['Scheda ristorante'].add(r.session_id)
          else if (p === '/deals') buckets['Pagina sconti'].add(r.session_id)
          else if (p === '/profile') buckets['Profilo'].add(r.session_id)
          else if (p === '/saved') buckets['Salvati'].add(r.session_id)
          else if (p === '/list') buckets['Lista'].add(r.session_id)
        })
        const maxCount = Math.max(...Object.values(buckets).map((s) => s.size), 1)
        const breakdown = Object.entries(buckets)
          .map(([label, set]) => ({
            label,
            count: set.size,
            pct: Math.round((set.size / maxCount) * 100),
          }))
          .filter((b) => b.count > 0)
          .sort((a, b) => b.count - a.count)
        setPageBreakdown(breakdown)

        // Fetch detail for each active discount: real generated/used counts
        const discounts = discData.data || []
        const withCounts = await Promise.all(
          discounts.map(async (d) => {
            const [genRes, usedRes] = await Promise.all([
              supabase
                .from('discount_redemptions')
                .select('id', { count: 'exact', head: true })
                .eq('discount_id', d.id),
              supabase
                .from('discount_redemptions')
                .select('id', { count: 'exact', head: true })
                .eq('discount_id', d.id)
                .eq('status', 'redeemed'),
            ])
            return {
              ...d,
              generatedCount: genRes.count || 0,
              redeemedCount: usedRes.count || 0,
            }
          })
        )
        if (!cancelled) setActiveDiscounts(withCounts)

        // Top restaurants: by saved count in period
        const savedMap = {}
        ;(savedTop.data || []).forEach((row) => {
          savedMap[row.restaurant_id] = (savedMap[row.restaurant_id] || 0) + 1
        })
        const top = restaurants
          .map((r) => ({ ...r, savedCount: savedMap[r.id] || 0 }))
          .sort((a, b) => b.savedCount - a.savedCount)
          .slice(0, 5)
        if (!cancelled) setTopRestaurants(top)
      } catch (err) {
        console.warn('Analytics fetch error:', err?.message || err)
      }
    }

    fetchAll()
  }, [period, user, restaurants])

  // Visits chart data — real page_views bucketed by time
  const [visitsChartData, setVisitsChartData] = useState([])
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function fetchChart() {
      try {
        const days = PERIODS.find((p) => p.key === period)?.days || 7
        const points = days === 1 ? 24 : Math.min(days, 30)

        const [pvRes, regsRes] = await Promise.all([
          supabase
            .from('page_views')
            .select('created_at')
            .gte('created_at', periodStart(days)),
          supabase
            .from('profiles')
            .select('created_at')
            .gte('created_at', periodStart(days)),
        ])

        if (cancelled) return

        const pvs = pvRes.data || []
        const regs = regsRes.data || []

        // Build buckets
        const buckets = []
        const now = new Date()
        const spacing = days === 1 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
        for (let i = points - 1; i >= 0; i--) {
          const start = new Date(now.getTime() - i * spacing)
          const label =
            days === 1
              ? start.toLocaleTimeString('it-IT', { hour: '2-digit' }) + 'h'
              : start.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
          buckets.push({
            key: label,
            visite: 0,
            utenti: 0,
            start: start.getTime(),
          })
        }
        pvs.forEach((row) => {
          const t = new Date(row.created_at).getTime()
          for (let i = buckets.length - 1; i >= 0; i--) {
            if (t >= buckets[i].start) {
              buckets[i].visite += 1
              break
            }
          }
        })
        regs.forEach((row) => {
          const t = new Date(row.created_at).getTime()
          for (let i = buckets.length - 1; i >= 0; i--) {
            if (t >= buckets[i].start) {
              buckets[i].utenti += 1
              break
            }
          }
        })
        setVisitsChartData(buckets)
      } catch (err) {
        console.warn('Visits chart error:', err?.message || err)
      }
    }
    fetchChart()
  }, [period, user])

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid #E8453C',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const conversionRate =
    metrics.qrGenerated > 0 ? Math.round((metrics.qrRedeemed / metrics.qrGenerated) * 100) : 0

  const hasData = visitsChartData.some((b) => b.visite > 0 || b.utenti > 0)

  return (
    <AdminLayout title="Analytics">
      {/* ─── HEADER ─── */}
      <div style={{ borderBottom: '1px solid #eee', background: '#fff' }} className="px-[18px] py-[16px] md:px-[28px] md:py-[20px]">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>Analytics</h1>
            <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
              Performance e metriche in tempo reale
            </p>
          </div>

          {/* Period selector */}
          <div
            style={{
              display: 'flex',
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 6,
              padding: 2,
            }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: period === p.key ? '#1a1a1f' : 'transparent',
                  color: period === p.key ? '#fff' : '#666',
                  transition: 'background 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div
        className="px-[18px] py-[16px] md:px-[28px] md:py-[24px]"
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {/* ─── LIVE BANNER ─── */}
        <div
          style={{
            background: '#1a1a1f',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#4ADE80',
                boxShadow: '0 0 8px rgba(74,222,128,0.5)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {liveVisitors != null ? liveVisitors : '…'}{' '}
              {liveVisitors === 1 ? 'persona sul sito adesso' : 'persone sul sito adesso'}
            </div>
          </div>
          <div
            className="hidden md:block"
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
          >
            tracking realtime · aggiornamento ogni 30s
          </div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>

        {/* ─── 4 STAT CARDS ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
          }}
          className="md:!grid-cols-4 md:gap-4"
        >
          <StatCard
            Icon={EyeIcon}
            label="Visite totali"
            value={metrics.totalVisits}
            sublabel="pagine viste nel periodo"
            index={0}
          />
          <StatCard
            Icon={UsersIcon}
            label="Utenti registrati"
            value={metrics.usersTotal}
            trend={metrics.usersInPeriod > 0 ? `+${metrics.usersInPeriod}` : null}
            trendPositive
            sublabel={`${metrics.usersInPeriod} nel periodo`}
            index={1}
          />
          <StatCard
            Icon={TagIcon}
            label="QR presi"
            value={metrics.qrGenerated}
            sublabel="sconti attivati dagli utenti"
            index={2}
          />
          <StatCard
            Icon={CheckIcon}
            label="QR utilizzati"
            value={metrics.qrRedeemed}
            sublabel={`<span style="color:#E8453C;font-weight:500">${conversionRate}%</span> tasso conversione`}
            index={3}
          />
        </div>

        {/* ─── VISITS CHART + PAGE BREAKDOWN ─── */}
        <div
          className="md:!grid-cols-[3fr_2fr]"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
          }}
        >
          {/* Visits line chart */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1a1a1f',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Attività nel periodo
              </h3>
              <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E8453C' }} />
                  <span style={{ color: '#666' }}>Visite</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#C4A265' }} />
                  <span style={{ color: '#666' }}>Nuovi utenti</span>
                </span>
              </div>
            </div>
            {hasData ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={visitsChartData}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8453C" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#E8453C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f5f5f5" strokeWidth={0.5} />
                  <XAxis dataKey="key" tick={{ fontSize: 9, fill: '#ccc' }} stroke="#eee" />
                  <YAxis tick={{ fontSize: 9, fill: '#ccc' }} stroke="#eee" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #eee',
                      fontSize: 11,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="visite"
                    stroke="#E8453C"
                    strokeWidth={2}
                    fill="url(#grad1)"
                    name="Visite"
                  />
                  <Line
                    type="monotone"
                    dataKey="utenti"
                    stroke="#C4A265"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    name="Nuovi utenti"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ccc',
                  fontSize: 12,
                }}
              >
                Nessun dato ancora
              </div>
            )}
          </div>

          {/* Page breakdown */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#1a1a1f',
                margin: '0 0 4px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Visitatori per pagina
            </h3>
            <div style={{ fontSize: 10, color: '#bbb', marginBottom: 14, fontStyle: 'italic' }}>
              sessioni uniche nel periodo
            </div>
            {pageBreakdown.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>
                Nessun dato ancora
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {pageBreakdown.map((p, i) => {
                  const opacity = 1 - i * 0.15
                  return (
                    <div key={p.label}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, color: '#444' }}>{p.label}</span>
                        <span style={{ fontSize: 11, color: '#999' }}>{p.count}</span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: '#f0f0f0',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${p.pct}%`,
                            height: '100%',
                            background: `rgba(232,69,60,${Math.max(opacity, 0.25)})`,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── SCONTI QR + TOP RESTAURANTS ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
          }}
          className="md:!grid-cols-2"
        >
          {/* QR discounts */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#1a1a1f',
                margin: '0 0 12px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Sconti — presi vs utilizzati
            </h3>
            {activeDiscounts.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>
                Nessuno sconto attivo
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeDiscounts.slice(0, 5).map((d) => {
                  const gen = d.generatedCount
                  const used = d.redeemedCount
                  const max = d.max_redemptions || Math.max(gen, 1)
                  const taken = gen - used
                  const remaining = Math.max(max - gen, 0)
                  const convRate = gen > 0 ? Math.round((used / gen) * 100) : 0
                  const usedPct = (used / max) * 100
                  const takenPct = (taken / max) * 100
                  const remainingPct = (remaining / max) * 100
                  const isDrop = d.drop_time != null
                  const photo = proxyImg(
                    Array.isArray(d.restaurant?.photos) && d.restaurant.photos.length > 0
                      ? typeof d.restaurant.photos[0] === 'string'
                        ? d.restaurant.photos[0]
                        : d.restaurant.photos[0]?.thumb_url || d.restaurant.photos[0]?.photo_url
                      : null
                  )
                  return (
                    <div
                      key={d.id}
                      style={{
                        padding: '10px 12px',
                        background: '#fafafa',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        {photo ? (
                          <img
                            src={photo}
                            alt=""
                            style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#e5e5e5', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#1a1a1f',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {d.restaurant?.name} {d.discount_value}
                          </div>
                          {isDrop && (
                            <div
                              style={{
                                fontSize: 9,
                                color: '#C4A265',
                                fontWeight: 600,
                                marginTop: 1,
                                letterSpacing: 0.5,
                              }}
                            >
                              DROP ATTIVO
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f' }}>{gen}</div>
                            <div style={{ fontSize: 9, color: '#999' }}>Presi</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f' }}>{used}</div>
                            <div style={{ fontSize: 9, color: '#999' }}>Usati</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#E8453C' }}>{convRate}%</div>
                            <div style={{ fontSize: 9, color: '#999' }}>Conv.</div>
                          </div>
                        </div>
                      </div>
                      {/* Segmented bar */}
                      <div
                        style={{
                          height: 6,
                          background: '#eee',
                          borderRadius: 3,
                          display: 'flex',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ width: `${usedPct}%`, background: '#4ADE80' }} />
                        <div style={{ width: `${takenPct}%`, background: '#C4A265' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top restaurants */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#1a1a1f',
                margin: '0 0 12px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Ristoranti più popolari
            </h3>
            {topRestaurants.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>
                Nessun dato
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topRestaurants.map((r, i) => {
                  const photo = proxyImg(
                    Array.isArray(r.photos) && r.photos.length > 0
                      ? typeof r.photos[0] === 'string'
                        ? r.photos[0]
                        : r.photos[0]?.thumb_url || r.photos[0]?.photo_url
                      : null
                  )
                  const catName =
                    (Array.isArray(r.category) && r.category[0]) || r.cuisine_type || '—'
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: 10,
                        background: '#fafafa',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: i === 0 ? '#E8453C' : '#bbb',
                          width: 20,
                          textAlign: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e5e5e5', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#1a1a1f',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#999' }}>{catName}</div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#666',
                          display: 'flex',
                          gap: 10,
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, color: '#1a1a1f' }}>{r.savedCount}</div>
                          <div style={{ fontSize: 9, color: '#999' }}>Salvati</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
