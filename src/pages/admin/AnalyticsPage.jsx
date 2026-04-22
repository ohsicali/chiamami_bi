import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
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
/*  StatCard — compact, no animation                                   */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, sub, subColor }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-line)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)', marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: subColor || '#999', fontWeight: 500, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  GeoCard — compact horizontal-bar list (country/city/device)        */
/* ------------------------------------------------------------------ */
const COUNTRY_FLAG = (code) => {
  if (!code || code.length !== 2) return ''
  const cc = code.toUpperCase()
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)))
}
const DEVICE_LABEL = { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop', unknown: 'Sconosciuto' }

function GeoCard({ title, rows, emptyLabel }) {
  const isDevice = title === 'Dispositivi'
  const isCountry = title === 'Top paesi'
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-line)', borderRadius: 10, padding: 16 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </h3>
      <div style={{ fontSize: 10, color: '#bbb', marginBottom: 14, fontStyle: 'italic' }}>
        sessioni uniche nel periodo
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((r, i) => {
            const opacity = 1 - i * 0.12
            const display = isDevice
              ? (DEVICE_LABEL[r.label] || r.label)
              : isCountry
                ? `${COUNTRY_FLAG(r.label)} ${r.label}`
                : r.label
            return (
              <div key={r.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#444' }}>{display}</span>
                  <span style={{ fontSize: 11, color: '#999' }}>{r.count}</span>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct}%`, height: '100%', background: `rgba(232, 69, 60,${Math.max(opacity, 0.25)})`, borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
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
    uniqueSessions: 0,
    usersTotal: 0,
    usersInPeriod: 0,
    qrGenerated: 0,
    qrRedeemed: 0,
  })
  const [activeDiscounts, setActiveDiscounts] = useState([])
  const [topRestaurants, setTopRestaurants] = useState([])
  const [pageBreakdown, setPageBreakdown] = useState([])
  const [countryBreakdown, setCountryBreakdown] = useState([])
  const [cityBreakdown, setCityBreakdown] = useState([])
  const [deviceBreakdown, setDeviceBreakdown] = useState([])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function fetchAll() {
      const days = PERIODS.find((p) => p.key === period)?.days || 7
      const start = periodStart(days)

      try {
        const [usersTotal, usersInPeriod, qrGen, qrUsed, periodRedemptions, savedTop, pvTotal, pvByPath] = await Promise.all([
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
          // Fetch all redemptions in the period (with status) to group by discount
          supabase
            .from('discount_redemptions')
            .select('discount_id, status')
            .gte('generated_at', start),
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
            .select('path, session_id, country, city, device_type')
            .gte('created_at', start)
            .limit(50000),
        ])

        if (cancelled) return

        // Unique sessions count — dedup session_ids from the path rows
        const allSessions = new Set((pvByPath.data || []).map((r) => r.session_id).filter(Boolean))

        setMetrics({
          totalVisits: pvTotal.count || 0,
          uniqueSessions: allSessions.size,
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

        // Geo + device breakdowns — unique sessions per country/city/device
        const byCountry = {}
        const byCity = {}
        const byDevice = {}
        rows.forEach((r) => {
          if (!r.session_id) return
          if (r.country) {
            if (!byCountry[r.country]) byCountry[r.country] = new Set()
            byCountry[r.country].add(r.session_id)
          }
          if (r.city) {
            if (!byCity[r.city]) byCity[r.city] = new Set()
            byCity[r.city].add(r.session_id)
          }
          if (r.device_type) {
            if (!byDevice[r.device_type]) byDevice[r.device_type] = new Set()
            byDevice[r.device_type].add(r.session_id)
          }
        })
        const toSortedList = (obj, limit = 8) => {
          const entries = Object.entries(obj).map(([label, set]) => ({ label, count: set.size }))
          entries.sort((a, b) => b.count - a.count)
          const max = entries[0]?.count || 1
          return entries.slice(0, limit).map((e) => ({ ...e, pct: Math.round((e.count / max) * 100) }))
        }
        setCountryBreakdown(toSortedList(byCountry))
        setCityBreakdown(toSortedList(byCity))
        setDeviceBreakdown(toSortedList(byDevice, 4))

        // Group redemptions by discount_id to compute period counts
        const discountCounts = {}
        ;(periodRedemptions.data || []).forEach((r) => {
          if (!discountCounts[r.discount_id]) {
            discountCounts[r.discount_id] = { gen: 0, used: 0 }
          }
          discountCounts[r.discount_id].gen += 1
          if (r.status === 'redeemed') {
            discountCounts[r.discount_id].used += 1
          }
        })

        const discountIdsWithActivity = Object.keys(discountCounts)
        let withCounts = []
        if (discountIdsWithActivity.length > 0) {
          // Fetch discount details regardless of is_active/valid_until
          // (no embed — restaurants joined client-side from useRestaurants hook)
          const { data: discDetails, error: discErr } = await supabase
            .from('discounts')
            .select('id, title, discount_value, discount_type, drop_time, max_redemptions, is_active, valid_until, restaurant_id')
            .in('id', discountIdsWithActivity)

          if (discErr) {
            console.warn('Analytics discounts fetch error:', discErr.message)
          }

          const restMap = {}
          ;(restaurants || []).forEach((r) => { restMap[r.id] = r })

          withCounts = (discDetails || [])
            .map((d) => ({
              ...d,
              restaurant: restMap[d.restaurant_id] || null,
              generatedCount: discountCounts[d.id]?.gen || 0,
              redeemedCount: discountCounts[d.id]?.used || 0,
            }))
            .sort((a, b) => b.generatedCount - a.generatedCount)

          // Fallback: if the discounts fetch returned nothing (RLS quirk etc.)
          // but we do have redemption activity, show minimal rows using only
          // the redemption data so the admin sees *something*.
          if (withCounts.length === 0) {
            withCounts = discountIdsWithActivity.map((id) => ({
              id,
              title: 'Sconto',
              discount_value: '—',
              restaurant: null,
              generatedCount: discountCounts[id].gen,
              redeemedCount: discountCounts[id].used,
            }))
          }
        }
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
            border: '3px solid var(--color-corallo)',
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
    <AdminLayout>
      {/* ─── DESKTOP STICKY TOP BAR ─── */}
      <div
        className="hidden md:flex"
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--color-page)',
          borderBottom: '1px solid var(--color-line)',
          padding: '0 28px', height: 56,
          alignItems: 'center', gap: 12,
        }}
      >
        <div style={{ flex: 1 }} />
        {/* Period selector */}
        <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-line)', borderRadius: 10, padding: 3 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600,
                border: 'none', borderRadius: 7, cursor: 'pointer',
                background: period === p.key ? 'var(--color-ink)' : 'transparent',
                color: period === p.key ? '#fff' : '#666',
                transition: 'background 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CONTENT HEADER ─── */}
      <div className="px-[18px] pt-[18px] pb-0 md:px-[28px] md:pt-[20px]">
        <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 6 }}>
          Admin · <b style={{ color: 'var(--color-ink)' }}>Analytics</b>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-ink)', margin: '0 0 2px', fontFamily: 'var(--font-sans)' }}>Numeri</h1>
            <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Performance e metriche in tempo reale</p>
          </div>
          {/* Mobile period selector */}
          <div className="md:hidden" style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-line)', borderRadius: 10, padding: 2 }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 600,
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: period === p.key ? 'var(--color-ink)' : 'transparent',
                  color: period === p.key ? '#fff' : '#666',
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
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* ─── LIVE BANNER ─── */}
        <div
          style={{
            background: 'var(--color-ink)',
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
            gap: 8,
          }}
          className="md:!grid-cols-4 md:!gap-[10px]"
        >
          <StatCard label="Visitatori unici" value={metrics.uniqueSessions} sub={metrics.totalVisits > 0 ? `${metrics.totalVisits} pagine viste` : 'sessioni distinte'} />
          <StatCard label="Utenti registrati" value={metrics.usersTotal} sub={metrics.usersInPeriod > 0 ? `+${metrics.usersInPeriod} nel periodo` : null} subColor="#2d7a4f" />
          <StatCard label="QR presi" value={metrics.qrGenerated} sub="sconti attivati" />
          <StatCard label="QR utilizzati" value={metrics.qrRedeemed} sub={`${conversionRate}% conversione`} subColor="var(--color-corallo)" />
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
              border: '1px solid var(--color-line)',
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
                  color: 'var(--color-ink)',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Attività nel periodo
              </h3>
              <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-corallo)' }} />
                  <span style={{ color: '#666' }}>Visite</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#B08954' }} />
                  <span style={{ color: '#666' }}>Nuovi utenti</span>
                </span>
              </div>
            </div>
            {hasData ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={visitsChartData}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-corallo)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--color-corallo)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f5f5f5" strokeWidth={0.5} />
                  <XAxis dataKey="key" tick={{ fontSize: 9, fill: '#ccc' }} stroke="#eee" />
                  <YAxis tick={{ fontSize: 9, fill: '#ccc' }} stroke="#eee" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid var(--color-line)',
                      fontSize: 11,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="visite"
                    stroke="var(--color-corallo)"
                    strokeWidth={2}
                    fill="url(#grad1)"
                    name="Visite"
                  />
                  <Line
                    type="monotone"
                    dataKey="utenti"
                    stroke="#B08954"
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
              border: '1px solid var(--color-line)',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-ink)',
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
                            background: `rgba(232, 69, 60,${Math.max(opacity, 0.25)})`,
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

        {/* ─── GEO + DEVICE BREAKDOWN ─── */}
        {(countryBreakdown.length > 0 || cityBreakdown.length > 0 || deviceBreakdown.length > 0) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 16,
            }}
            className="md:!grid-cols-3"
          >
            <GeoCard title="Top paesi" rows={countryBreakdown} emptyLabel="In attesa di dati geo" />
            <GeoCard title="Top città" rows={cityBreakdown} emptyLabel="In attesa di dati geo" />
            <GeoCard title="Dispositivi" rows={deviceBreakdown} emptyLabel="In attesa di dati" />
          </div>
        )}

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
              border: '1px solid var(--color-line)',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: '0 0 12px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Sconti — presi vs utilizzati
            </h3>
            {activeDiscounts.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>
                Nessuna attività QR nel periodo
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
                              color: 'var(--color-ink)',
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
                                color: '#B08954',
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
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{gen}</div>
                            <div style={{ fontSize: 9, color: '#999' }}>Presi</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{used}</div>
                            <div style={{ fontSize: 9, color: '#999' }}>Usati</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-corallo)' }}>{convRate}%</div>
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
                        <div style={{ width: `${takenPct}%`, background: '#B08954' }} />
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
              border: '1px solid var(--color-line)',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-ink)',
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
                          color: i === 0 ? 'var(--color-corallo)' : '#bbb',
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
                            color: 'var(--color-ink)',
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
                          <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{r.savedCount}</div>
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
