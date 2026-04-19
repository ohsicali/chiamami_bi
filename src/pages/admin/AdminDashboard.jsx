import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'Adesso'
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`
  if (diff < 172800) return 'Ieri'
  if (diff < 604800) return `${Math.floor(diff / 86400)} g fa`
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
const ic = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function PlusIcon({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function ChevronRight({ w = 14 }) {
  return (
    <svg {...ic} width={w} height={w}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
function SuggestionIc({ w = 16 }) {
  return (
    <svg {...ic} width={w} height={w}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}
function ApplicationIc({ w = 16 }) {
  return (
    <svg {...ic} width={w} height={w}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */
export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { allRestaurants: restaurants, loading: dataLoading } = useRestaurants()

  const [metrics, setMetrics] = useState({
    restaurantsTotal: 0,
    usersTotal: 0,
    usersThisWeek: 0,
    discountsActive: 0,
    dropsActive: 0,
    qrUsed: 0,
    qrUsedThisWeek: 0,
    pendingSuggestions: 0,
    pendingApplications: 0,
  })
  const [recentRestaurants, setRecentRestaurants] = useState([])

  // Fetch metrics from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function fetchMetrics() {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const nowIso = new Date().toISOString()

      try {
        const [
          restCount,
          usersCount,
          usersWeek,
          activeDiscounts,
          qrUsed,
          qrUsedWeek,
          pendSugg,
          pendApp,
          recentRest,
        ] = await Promise.all([
          supabase.from('restaurants').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
          supabase
            .from('discounts')
            .select('id, drop_time', { count: 'exact' })
            .eq('is_active', true)
            .gte('valid_until', nowIso),
          supabase
            .from('discount_redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'redeemed'),
          supabase
            .from('discount_redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'redeemed')
            .gte('redeemed_at', weekAgo),
          supabase
            .from('restaurant_suggestions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('partner_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('restaurants')
            .select('id, name, slug, cuisine_type, category, photos, is_published, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        if (cancelled) return

        const dropsActive = (activeDiscounts.data || []).filter((d) => d.drop_time != null).length

        setMetrics({
          restaurantsTotal: restCount.count || 0,
          usersTotal: usersCount.count || 0,
          usersThisWeek: usersWeek.count || 0,
          discountsActive: activeDiscounts.count || 0,
          dropsActive,
          qrUsed: qrUsed.count || 0,
          qrUsedThisWeek: qrUsedWeek.count || 0,
          pendingSuggestions: pendSugg.count || 0,
          pendingApplications: pendApp.count || 0,
        })
        setRecentRestaurants(recentRest.data || [])
      } catch (err) {
        console.warn('Dashboard metrics error:', err?.message || err)
      }
    }

    fetchMetrics()
  }, [user])

  // Chart: weekly registrations (last 8 weeks) — we try to get real data
  const [registrationData, setRegistrationData] = useState([])
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function fetchRegistrations() {
      try {
        const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', eightWeeksAgo)
          .order('created_at', { ascending: true })

        if (cancelled) return

        // Bucket by week
        const buckets = []
        const now = new Date()
        for (let i = 7; i >= 0; i--) {
          const start = new Date(now)
          start.setDate(start.getDate() - i * 7)
          const label = start.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
          buckets.push({ week: label, start: start.getTime(), count: 0 })
        }
        ;(data || []).forEach((row) => {
          const t = new Date(row.created_at).getTime()
          // Find bucket
          for (let i = buckets.length - 1; i >= 0; i--) {
            if (t >= buckets[i].start) {
              buckets[i].count += 1
              break
            }
          }
        })
        setRegistrationData(buckets)
      } catch (err) {
        console.warn('Registration chart error:', err?.message || err)
      }
    }
    fetchRegistrations()
  }, [user])

  // Top categories chart
  const topCategoriesData = useMemo(() => {
    const counts = {}
    restaurants.forEach((r) => {
      const cats = r.category || (r.cuisine_type ? [r.cuisine_type] : [])
      cats.forEach((c) => {
        counts[c] = (counts[c] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))
  }, [restaurants])

  // "Ultimi aggiunti" from useRestaurants hook (always available)
  const latestRestaurants = useMemo(() => {
    return [...restaurants]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3)
  }, [restaurants])

  if (authLoading || dataLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
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

  const userName = user?.email?.split('@')[0] ?? 'Admin'

  const publishedCount = restaurants.filter(r => r.is_published !== false).length

  // Stat cards data
  const statCards = [
    {
      label: 'Ristoranti',
      value: metrics.restaurantsTotal,
      sub: publishedCount > 0 ? `${publishedCount} pubblicati` : null,
      subColor: '#059669',
    },
    {
      label: 'Utenti',
      value: metrics.usersTotal,
      sub: metrics.usersThisWeek > 0 ? `+${metrics.usersThisWeek} questa settimana` : null,
      subColor: '#059669',
    },
    {
      label: 'Sconti attivi',
      value: metrics.discountsActive,
      sub: metrics.dropsActive > 0 ? `${metrics.dropsActive} drop live` : null,
      subColor: '#C4A265',
    },
    {
      label: 'QR usati',
      value: metrics.qrUsed,
      sub: metrics.qrUsedThisWeek > 0 ? `+${metrics.qrUsedThisWeek} questa settimana` : null,
      subColor: '#059669',
    },
  ]

  // "Da gestire" items
  const manageItems = [
    {
      count: metrics.pendingSuggestions,
      title: metrics.pendingSuggestions === 1 ? '1 suggerimento utente' : `${metrics.pendingSuggestions} suggerimenti utenti`,
      subtitle: metrics.pendingSuggestions > 0 ? 'Nuovi da rivedere' : 'Nessun nuovo',
      color: '#E8453C',
      bg: 'rgba(232,69,60,0.08)',
      to: '/admin/suggestions',
      Icon: SuggestionIc,
    },
    {
      count: metrics.pendingApplications,
      title: metrics.pendingApplications === 1 ? '1 candidatura partner' : `${metrics.pendingApplications} candidature partner`,
      subtitle: metrics.pendingApplications > 0 ? 'Da contattare' : 'Nessuna nuova',
      color: '#C4A265',
      bg: 'rgba(196,162,101,0.12)',
      to: '/admin/applications',
      Icon: ApplicationIc,
    },
  ]

  return (
    <AdminLayout title="Dashboard">
      {/* ─── HEADER ─── */}
      <div
        style={{
          borderBottom: '1px solid #eee',
          background: '#fff',
        }}
        className="px-[18px] py-[16px] md:px-[28px] md:py-[20px]"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Desktop title */}
            <div className="hidden md:block">
              <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>Dashboard</h1>
              <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>Panoramica della guida</p>
            </div>
            {/* Mobile title */}
            <div className="md:hidden">
              <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>
                Ciao, {userName}
              </h1>
              <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
                Ecco cosa succede sulla guida
              </p>
            </div>
          </div>

          {/* Desktop: new restaurant button */}
          <Link
            to="/admin/restaurant/new"
            className="hidden md:inline-flex"
            style={{
              alignItems: 'center',
              gap: 6,
              background: '#E8453C',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <PlusIcon w={14} /> Nuovo ristorante
          </Link>
        </div>

        {/* Mobile quick actions — horizontal scroll */}
        <div
          className="md:hidden"
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          <Link
            to="/admin/restaurant/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#E8453C',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <PlusIcon w={12} /> Nuovo ristorante
          </Link>
          <Link
            to="/admin/discounts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#fff',
              color: '#1a1a1f',
              border: '1px solid #eee',
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <PlusIcon w={12} /> Nuovo sconto
          </Link>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="px-[18px] py-[16px] md:px-[28px] md:py-[24px]" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ─── 4 STAT CARDS ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}
          className="md:!grid-cols-4 md:!gap-[10px]"
        >
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              style={{
                background: '#fff',
                border: '1px solid #eee',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 10, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1f', marginTop: 4, lineHeight: 1.1 }}>
                {s.value}
              </div>
              {s.sub && (
                <div style={{ fontSize: 11, color: s.subColor, fontWeight: 500, marginTop: 4 }}>
                  {s.sub}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ─── DA GESTIRE ─── */}
        <div>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1a1a1f',
              margin: '0 0 10px',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Da gestire
          </h2>
          <div
            style={{
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {manageItems.map((item, i) => {
              const isZero = item.count === 0
              const Content = (
                <>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: isZero ? '#f5f5f5' : item.bg,
                      color: isZero ? '#bbb' : item.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <item.Icon w={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: isZero ? '#999' : '#1a1a1f',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#999',
                        marginTop: 2,
                      }}
                    >
                      {item.subtitle}
                    </div>
                  </div>
                  {!isZero && (
                    <div style={{ color: '#ccc', flexShrink: 0 }}>
                      <ChevronRight w={14} />
                    </div>
                  )}
                </>
              )
              return isZero ? (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 8,
                    background: '#fafafa',
                  }}
                >
                  {Content}
                </div>
              ) : (
                <Link
                  key={i}
                  to={item.to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 8,
                    background: item.bg,
                    textDecoration: 'none',
                  }}
                >
                  {Content}
                </Link>
              )
            })}
          </div>
        </div>

        {/* ─── ULTIMI AGGIUNTI ─── */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#1a1a1f',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Ultimi aggiunti
            </h2>
            <Link
              to="/admin/restaurants"
              style={{
                fontSize: 12,
                color: '#E8453C',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Tutti →
            </Link>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {latestRestaurants.map((r) => {
              const cats = (r.category || (r.cuisine_type ? [r.cuisine_type] : []))
                .map((name) => getCategoryInfo(name))
                .filter(Boolean)
              const firstCat = cats[0]
              const thumb = proxyImg(
                Array.isArray(r.photos) && r.photos.length > 0
                  ? typeof r.photos[0] === 'string'
                    ? r.photos[0]
                    : r.photos[0]?.thumb_url || r.photos[0]?.photo_url
                  : null
              )
              const isPublished = r.is_published !== false
              return (
                <Link
                  key={r.id}
                  to={`/admin/restaurant/${r.id}/edit`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 8px',
                    borderRadius: 8,
                    textDecoration: 'none',
                  }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={r.name}
                      style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: '#f0f0f0',
                        flexShrink: 0,
                      }}
                    />
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
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      {firstCat?.name || '—'} · {formatDate(r.created_at)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontWeight: 500,
                      background: isPublished ? '#ecfdf5' : '#fef3c7',
                      color: isPublished ? '#059669' : '#b45309',
                      flexShrink: 0,
                    }}
                  >
                    {isPublished ? 'Live' : 'Bozza'}
                  </span>
                </Link>
              )
            })}
            {latestRestaurants.length === 0 && (
              <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: '#999' }}>
                Nessun ristorante
              </div>
            )}
          </div>
        </div>

        {/* ─── GRAFICI — solo desktop ─── */}
        <div className="hidden md:grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Registrazioni */}
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
              Registrazioni settimanali
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={registrationData}>
                <defs>
                  <linearGradient id="reggrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8453C" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#E8453C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#999' }} stroke="#eee" />
                <YAxis tick={{ fontSize: 10, fill: '#999' }} stroke="#eee" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #eee',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#E8453C" strokeWidth={2} fill="url(#reggrad)" name="Utenti" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top categorie */}
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
              Top categorie
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCategoriesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} stroke="#eee" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#999' }}
                  stroke="#eee"
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #eee',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                />
                <Bar dataKey="count" fill="#E8453C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
