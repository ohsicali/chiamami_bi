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

  // Stat cards data — v4 KPI (k-lab/k-val/k-delta/k-spark) §77-86
  const miniSpark = (seed = 1) => {
    const base = [40, 55, 45, 60, 52, 70, 68, 82]
    return base.map((h) => Math.max(20, Math.min(100, Math.round(h * (0.85 + (seed % 13) / 42)))))
  }
  const statCards = [
    {
      label: 'Ristoranti',
      value: metrics.restaurantsTotal,
      delta: publishedCount > 0 ? `${publishedCount} pubblicati` : null,
      deltaDir: 'up',
      spark: miniSpark(metrics.restaurantsTotal),
    },
    {
      label: 'Utenti registrati',
      value: metrics.usersTotal,
      delta: metrics.usersThisWeek > 0 ? `+${metrics.usersThisWeek} · 7gg` : null,
      deltaDir: 'up',
      spark: miniSpark(metrics.usersTotal),
    },
    {
      label: 'Sconti attivi',
      value: metrics.discountsActive,
      delta: metrics.dropsActive > 0 ? `${metrics.dropsActive} drop live` : null,
      deltaDir: 'up',
      spark: miniSpark(metrics.discountsActive + 3),
    },
    {
      label: 'Redenzioni QR',
      value: metrics.qrUsed,
      delta: metrics.qrUsedThisWeek > 0 ? `+${metrics.qrUsedThisWeek} · 7gg` : null,
      deltaDir: 'up',
      spark: miniSpark(metrics.qrUsed + 7),
    },
  ]

  // "Da gestire" items
  const manageItems = [
    {
      count: metrics.pendingSuggestions,
      title: metrics.pendingSuggestions === 1 ? '1 suggerimento utente' : `${metrics.pendingSuggestions} suggerimenti utenti`,
      subtitle: metrics.pendingSuggestions > 0 ? 'Nuovi da rivedere' : 'Nessun nuovo',
      color: '#E8453C',
      bg: 'rgba(232, 69, 60,0.08)',
      to: '/admin/suggestions',
      Icon: SuggestionIc,
    },
    {
      count: metrics.pendingApplications,
      title: metrics.pendingApplications === 1 ? '1 candidatura partner' : `${metrics.pendingApplications} candidature partner`,
      subtitle: metrics.pendingApplications > 0 ? 'Da contattare' : 'Nessuna nuova',
      color: '#B08954',
      bg: 'rgba(176,137,84,0.12)',
      to: '/admin/applications',
      Icon: ApplicationIc,
    },
  ]

  const GG = ['dom','lun','mar','mer','gio','ven','sab']
  const MM = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  const _t = new Date()
  const dateLabel = `${GG[_t.getDay()]} ${_t.getDate()} ${MM[_t.getMonth()]}`
  const avatarInitial = (user?.email || 'A')[0].toUpperCase()

  return (
    <AdminLayout>
      {/* ─── DESKTOP TOP BAR ─── */}
      <div className="hidden md:flex" style={{ alignItems:'center', gap:16, padding:'14px 28px', background:'rgba(255,255,255,0.6)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--color-line)', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ flex:1, maxWidth:440, display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid var(--color-line)', borderRadius:999, padding:'9px 14px', fontSize:13, color:'rgba(34,24,28,0.55)' }}>
          🔍 <span>Cerca — ristoranti, utenti, sconti…</span>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ background:'#fff', border:'1px solid var(--color-line)', borderRadius:999, padding:'7px 14px', fontSize:12, fontWeight:700, color:'var(--color-ink)', cursor:'pointer' }}>Ultimi 30 giorni ▾</div>
        <Link to="/admin/restaurant/new" style={{ background:'var(--color-corallo)', color:'#fff', padding:'7px 14px', borderRadius:999, fontSize:12, fontWeight:800, textDecoration:'none', boxShadow:'0 6px 14px rgba(232,69,60,.28)' }}>+ Nuovo</Link>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--color-corallo)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mark)', fontSize:13 }}>{avatarInitial}</div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="px-[18px] py-[16px] md:px-[32px] md:py-[28px]" style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* Mobile: breadcrumb + titolo + sottotitolo */}
        <div className="md:hidden">
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(34,24,28,0.55)', letterSpacing:'.05em', marginBottom:4 }}>Home · <b style={{color:'var(--color-ink)'}}>Dashboard</b></div>
          <h1 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:26, letterSpacing:'-.025em', lineHeight:1.05, marginBottom:4, color:'var(--color-ink)' }}>Ciao, {userName}</h1>
          <div style={{ color:'rgba(34,24,28,0.55)', fontWeight:500, fontSize:13, marginBottom:20, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span>Oggi · {dateLabel}</span>
            <span style={{width:3,height:3,borderRadius:'50%',background:'rgba(34,24,28,0.55)',flexShrink:0}} />
            <span>tutto in regola</span>
          </div>
        </div>
        {/* Desktop: breadcrumb + saluto + data */}
        <div className="hidden md:block" style={{ marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'rgba(34,24,28,0.55)', marginBottom:8 }}>Dashboard · <b style={{color:'var(--color-ink)'}}>panoramica</b></div>
          <h1 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:32, letterSpacing:'-.025em', marginBottom:4, color:'var(--color-ink)', display:'flex', alignItems:'center', gap:14 }}>Ciao Bi 👋</h1>
          <div style={{ color:'rgba(34,24,28,0.55)', fontWeight:500, marginBottom:28, display:'flex', gap:12, alignItems:'center' }}>
            <span>{dateLabel}</span>
            <span style={{width:3,height:3,borderRadius:'50%',background:'rgba(34,24,28,0.55)',flexShrink:0}} />
            <span style={{fontSize:13}}>{metrics.pendingApplications > 0 && `${metrics.pendingApplications} candidature nuove, `}{metrics.dropsActive} drop attivi</span>
          </div>
        </div>
        {/* ─── 4 STAT CARDS ─── */}
        {/* KPI grid: 2×2 mobile + full-width sparkline | 4-col desktop */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }} className="md:!grid-cols-4 md:!gap-[16px]">
          {statCards.map((s, i) => (
            <motion.div key={s.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04,duration:0.25}}
              style={{ background:'#fff', border:'1px solid var(--color-line)', borderRadius:16, padding:14 }}
              className="md:!rounded-[18px] md:!p-[18px]"
            >
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(34,24,28,0.55)' }} className="md:!text-[11px]">{s.label}</div>
              <div style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:26, letterSpacing:'-.03em', lineHeight:1, marginTop:6, color:'var(--color-ink)' }} className="md:!text-[34px] md:!mt-[8px]">
                {typeof s.value === 'number' ? s.value.toLocaleString('it-IT') : s.value}
              </div>
              {s.delta && <div style={{ marginTop:4, fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3, color:s.deltaDir==='dn'?'#C0392B':'#2C7A4A' }} className="md:!text-[12px]">{s.deltaDir==='dn'?'▼':'▲'} {s.delta}</div>}
              <div style={{ height:28, marginTop:8, display:'flex', alignItems:'flex-end', gap:3 }} className="md:!h-[34px] md:!mt-[10px]">
                {s.spark.map((h,idx)=>(
                  <span key={idx} style={{ flex:1, height:`${h}%`, borderRadius:2, background:idx>=s.spark.length-2?'var(--color-corallo)':'var(--color-cream-deep)' }} />
                ))}
              </div>
            </motion.div>
          ))}
          {/* Mobile only: full-width sparkline tile (redenzioni settimana) */}
          <div className="md:hidden" style={{ gridColumn:'1/-1', background:'#fff', border:'1px solid var(--color-line)', borderRadius:16, padding:14 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(34,24,28,0.55)' }}>Redenzioni QR · settimana</div>
            <div style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:26, letterSpacing:'-.03em', lineHeight:1, marginTop:6, color:'var(--color-ink)' }}>{metrics.qrUsedThisWeek || 0}</div>
            <div style={{ height:28, marginTop:8, display:'flex', alignItems:'flex-end', gap:3 }}>
              {miniSpark(metrics.qrUsed+5).map((h,idx)=>(
                <span key={idx} style={{ flex:1, height:`${h}%`, borderRadius:2, background:idx>=6?'var(--color-corallo)':'var(--color-cream-deep)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* ─── DROP ATTIVO (mobile + desktop) ─── */}
        {metrics.dropsActive > 0 && (
          <div style={{ background:'linear-gradient(135deg,#FFF1EF,#FCE4E1)', border:'1px solid var(--color-corallo-soft)', borderRadius:18, padding:16, position:'relative' }}>
            <div style={{ position:'absolute', top:12, right:14, fontSize:20 }}>🔥</div>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--color-corallo)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:4 }}>Drop attivo</div>
            <h3 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:18, letterSpacing:'-.02em', marginBottom:3, paddingRight:34, color:'var(--color-ink)' }}>
              {metrics.dropsActive === 1 ? 'Sconto drop in corso' : `${metrics.dropsActive} drop in corso`}
            </h3>
            <div style={{ fontSize:12, color:'#3d2f36', fontWeight:600, marginBottom:12 }}>
              Sconto attivo per i lettori della guida
            </div>
            <div style={{ height:7, background:'rgba(232,69,60,.18)', borderRadius:999, overflow:'hidden', marginBottom:6 }}>
              <div style={{ height:'100%', width:'65%', background:'var(--color-corallo)', borderRadius:999 }} />
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#3d2f36', display:'flex', justifyContent:'space-between' }}>
              <span>{metrics.qrUsedThisWeek} riscatti questa settimana</span><span>65%</span>
            </div>
          </div>
        )}

        {/* ─── INBOX ALERT candidature ─── */}
        {metrics.pendingApplications > 0 && (
          <Link to="/admin/applications" style={{ textDecoration:'none' }}>
            <div style={{ background:'var(--color-ink)', color:'#fff', borderRadius:16, padding:14, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'var(--color-corallo)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>✉</div>
              <div style={{ flex:1, fontSize:12, lineHeight:1.3, color:'rgba(255,255,255,0.8)' }}>
                <b style={{ display:'block', fontSize:14, marginBottom:2, color:'#fff' }}>{metrics.pendingApplications} nuove candidature</b>
                Locali che chiedono di entrare in guida
              </div>
              <div style={{ fontSize:18, opacity:.6, color:'#fff' }}>›</div>
            </div>
          </Link>
        )}

        {/* ─── ATTIVITÀ RECENTE + TOP 5 ─── */}
        {/* Mobile: card verticali */}
        <div className="md:hidden">
          {/* Activity card */}
          <div style={{ background:'#fff', border:'1px solid var(--color-line)', borderRadius:16, padding:16, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <h3 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:15, letterSpacing:'-.01em', margin:0, color:'var(--color-ink)' }}>Attività recente</h3>
              <Link to="/admin/restaurants" style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:'var(--color-corallo)', textDecoration:'none' }}>Tutto ›</Link>
            </div>
            {latestRestaurants.slice(0,4).map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px dashed var(--color-line)', fontSize:12 }}>
                <div style={{ width:32, height:32, borderRadius:10, background:'var(--color-green-wash,#E8F5D8)', display:'grid', placeItems:'center', fontSize:14, flexShrink:0 }}>✓</div>
                <div style={{ flex:1 }}><b style={{fontWeight:800}}>{r.name}</b> aggiunto al catalogo</div>
                <div style={{ fontSize:10, color:'rgba(34,24,28,0.55)', fontWeight:600, flexShrink:0 }}>{formatDate(r.created_at)}</div>
              </div>
            ))}
            {latestRestaurants.length === 0 && <div style={{ padding:14, textAlign:'center', fontSize:12, color:'#999' }}>Nessuna attività recente</div>}
          </div>
          {/* Top 5 card */}
          <div style={{ background:'#fff', border:'1px solid var(--color-line)', borderRadius:16, padding:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <h3 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:15, letterSpacing:'-.01em', margin:0, color:'var(--color-ink)' }}>Top 5 · questa settimana</h3>
              <Link to="/admin/analytics" style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:'var(--color-corallo)', textDecoration:'none' }}>Analytics ›</Link>
            </div>
            {latestRestaurants.slice(0,5).map((r,i) => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:i<4?'1px dashed var(--color-line)':0 }}>
                <div style={{ width:22, textAlign:'center', fontFamily:'var(--font-sans)', fontWeight:900, fontSize:15, color:'rgba(34,24,28,0.55)' }}>{i+1}</div>
                <div style={{ width:40, height:40, borderRadius:10, background:'var(--color-cream-deep)', flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:13, lineHeight:1.15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize:10, color:'rgba(34,24,28,0.55)', fontWeight:600, marginTop:2 }}>{r.cuisine_type || '—'}</div>
                </div>
                <div style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:15, color:'var(--color-ink)' }}>+{(i+1)*8+12}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: 2-col dash row (activity + top ristoranti) + inbox tile */}
        <div className="hidden md:block">
          {/* Dash row */}
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16, marginBottom:24 }}>
            <div style={{ background:'#fff', border:'1px solid var(--color-line)', borderRadius:18, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <h3 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:17, letterSpacing:'-.01em', margin:0 }}>Attività recente</h3>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(34,24,28,0.55)' }}>cosa è successo oggi</span>
                <Link to="/admin/restaurants" style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:'var(--color-corallo)', textDecoration:'none' }}>Vedi tutto →</Link>
              </div>
              {latestRestaurants.map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px dashed var(--color-line)', fontSize:13 }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:'var(--color-green-wash,#E8F5D8)', display:'grid', placeItems:'center', fontSize:15, flexShrink:0 }}>✓</div>
                  <div><b style={{fontWeight:800}}>{r.name}</b> aggiunto al catalogo</div>
                  <div style={{ marginLeft:'auto', fontSize:11, color:'rgba(34,24,28,0.55)', fontWeight:600 }}>{formatDate(r.created_at)}</div>
                </div>
              ))}
              {latestRestaurants.length === 0 && <div style={{ padding:14, textAlign:'center', fontSize:13, color:'#999' }}>Nessuna attività recente</div>}
            </div>
            <div style={{ background:'#fff', border:'1px solid var(--color-line)', borderRadius:18, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <h3 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:17, letterSpacing:'-.01em', margin:0 }}>Top ristoranti · settimana</h3>
                <Link to="/admin/analytics" style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:'var(--color-corallo)', textDecoration:'none' }}>Vedi tutto →</Link>
              </div>
              {latestRestaurants.slice(0,5).map((r,i) => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:i<latestRestaurants.length-1?'1px dashed var(--color-line)':0 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:'var(--color-cream-deep)', flexShrink:0 }} />
                  <div>
                    <div style={{ fontWeight:800, fontSize:14 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'rgba(34,24,28,0.55)', fontWeight:600, marginTop:2 }}>{r.cuisine_type || '—'}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:999, background:'var(--color-cream-deep)', color:'rgba(34,24,28,0.7)' }}>+{(i+1)*8+12}%</span>
                  <div style={{ marginLeft:'auto', fontFamily:'var(--font-sans)', fontWeight:900, fontSize:18 }}>—</div>
                </div>
              ))}
            </div>
          </div>
          {/* Inbox tile — candidature */}
          <div style={{ background:'var(--color-cream)', borderRadius:18, padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <h3 style={{ fontFamily:'var(--font-sans)', fontWeight:900, fontSize:17, letterSpacing:'-.01em', margin:0 }}>Candidature da aprire</h3>
              <span style={{ fontSize:10, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(34,24,28,0.55)' }}>rispondi entro 3gg</span>
              {metrics.pendingApplications > 0 && <span style={{ marginLeft:4, background:'var(--color-corallo)', color:'#fff', fontSize:11, fontWeight:800, padding:'3px 9px', borderRadius:999 }}>{metrics.pendingApplications}</span>}
              <Link to="/admin/applications" style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:'var(--color-corallo)', textDecoration:'none' }}>Vedi tutte →</Link>
            </div>
            {metrics.pendingApplications > 0 ? latestRestaurants.slice(0,3).map(r => (
              <div key={r.id} style={{ display:'flex', gap:12, padding:12, background:'#fff', borderRadius:12, marginBottom:8, fontSize:12, alignItems:'center' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'var(--color-cream-deep)', flexShrink:0 }} />
                <div>
                  <div style={{ fontWeight:800, fontSize:13 }}>{r.name}</div>
                  <div style={{ color:'rgba(34,24,28,0.55)', marginTop:2, fontSize:11, fontWeight:600 }}>In attesa di revisione</div>
                </div>
                <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                  <span style={{ padding:'5px 10px', borderRadius:999, fontSize:11, fontWeight:800, background:'var(--color-cream)', color:'var(--color-ink)', cursor:'pointer' }}>Archivia</span>
                  <Link to="/admin/applications" style={{ padding:'5px 10px', borderRadius:999, fontSize:11, fontWeight:800, background:'var(--color-ink)', color:'#fff', textDecoration:'none' }}>→ Apri</Link>
                </div>
              </div>
            )) : <div style={{ textAlign:'center', fontSize:13, color:'rgba(34,24,28,0.55)', padding:'14px 0' }}>Nessuna candidatura in attesa</div>}
          </div>
        </div>


      </div>
    </AdminLayout>
  )
}
