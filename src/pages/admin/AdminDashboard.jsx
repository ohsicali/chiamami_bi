import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'
import KpiCard from '../../components/admin/KpiCard'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS

function relativeTime(date) {
  if (!date) return ''
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'Adesso'
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`
  if (diff < 172800) return 'Ieri'
  if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function formatDateLong() {
  return new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function bucketByDay(items, dateField, days = 8) {
  // Returns array of `days` length: count of items per day, oldest first, today last.
  const buckets = new Array(days).fill(0)
  const now = Date.now()
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const todayStart = dayStart.getTime()
  items.forEach((item) => {
    const t = new Date(item[dateField]).getTime()
    const diffDays = Math.floor((todayStart - t) / DAY_MS)
    const idx = days - 1 - diffDays
    if (idx >= 0 && idx < days) buckets[idx] += 1
    else if (t >= todayStart) buckets[days - 1] += 1
  })
  return buckets
}

function toSparkHeights(buckets) {
  // Normalize to 0-100 range for visual sparkline; keep zero at 8 min so bar is visible.
  const max = Math.max(...buckets, 1)
  return buckets.map((v) => Math.round((v / max) * 100) || 8)
}

function countdown(target) {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return 'Scaduto'
  const d = Math.floor(diff / DAY_MS)
  const h = Math.floor((diff % DAY_MS) / (60 * 60 * 1000))
  if (d > 0) return `${d}g ${h}h`
  const m = Math.floor((diff % (60 * 60 * 1000)) / 60000)
  return `${h}h ${m}m`
}

/* ------------------------------------------------------------------ */
/*  Activity icon by event type                                        */
/* ------------------------------------------------------------------ */
function ActivityIcon({ type }) {
  const styles = {
    redemption: { bg: 'var(--color-green-wash, #E8F5D8)', label: '✓' },
    drop: { bg: 'var(--color-corallo-wash, #FDEDEB)', label: '🔥' },
    signup: { bg: 'var(--color-oro-wash, #F5EDDD)', label: '+' },
    application: { bg: 'var(--color-cream, #F5F0E4)', label: '📥' },
    suggestion: { bg: 'var(--color-cream, #F5F0E4)', label: '✉' },
    pinrotation: { bg: 'var(--color-cream, #F5F0E4)', label: '🔑' },
  }
  const s = styles[type] || styles.application
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: s.bg,
        display: 'grid',
        placeItems: 'center',
        fontSize: 15,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {s.label}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */
export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading, profile } = useAuth()

  const [metrics, setMetrics] = useState({
    restaurants: 0,
    restaurantsPublished: 0,
    users: 0,
    usersLastWeek: 0,
    discountsActive: 0,
    dropsActive: 0,
    redemptions30d: 0,
    redemptionsPrev30d: 0,
    inboxApplications: 0,
    activeDropsCount: 0,
    openSuggestions: 0,
  })
  const [sparklines, setSparklines] = useState({
    restaurants: new Array(8).fill(8),
    users: new Array(8).fill(8),
    discounts: new Array(8).fill(8),
    redemptions: new Array(8).fill(8),
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [topRestaurants, setTopRestaurants] = useState([])
  const [activeDrop, setActiveDrop] = useState(null)
  const [inboxApps, setInboxApps] = useState([])
  const [liveVisitors, setLiveVisitors] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false
    let interval
    async function fetchLive() {
      try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const { data } = await supabase.from('page_views').select('session_id').gte('created_at', fiveMinAgo)
        if (!cancelled) setLiveVisitors(new Set((data || []).map((r) => r.session_id)).size)
      } catch { if (!cancelled) setLiveVisitors(0) }
    }
    fetchLive()
    interval = setInterval(fetchLive, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [user])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function load() {
      const now = Date.now()
      const sevenDaysAgo = new Date(now - WEEK_MS).toISOString()
      const thirtyDaysAgo = new Date(now - MONTH_MS).toISOString()
      const sixtyDaysAgo = new Date(now - 2 * MONTH_MS).toISOString()
      const eightDaysAgo = new Date(now - 8 * DAY_MS).toISOString()
      const nowIso = new Date(now).toISOString()

      try {
        const [
          restCount,
          restPub,
          usersTotal,
          usersWeek,
          discActive,
          dropsActive,
          redemp30,
          redempPrev30,
          pendApps,
          pendSugg,
          restRecent,
          usersRecent,
          discRecent,
          redempRecent,
          activeDropRow,
          actRedemptions,
          actApplications,
          actSuggestions,
          actSignups,
          actDrops,
          inboxRows,
          topViews,
        ] = await Promise.all([
          supabase.from('restaurants').select('id', { count: 'exact', head: true }),
          supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_published', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
          supabase.from('discounts').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('valid_until', nowIso),
          supabase.from('discounts').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('valid_until', nowIso).not('drop_time', 'is', null),
          supabase.from('discount_redemptions').select('id', { count: 'exact', head: true }).eq('status', 'redeemed').gte('redeemed_at', thirtyDaysAgo),
          supabase.from('discount_redemptions').select('id', { count: 'exact', head: true }).eq('status', 'redeemed').gte('redeemed_at', sixtyDaysAgo).lt('redeemed_at', thirtyDaysAgo),
          supabase.from('partner_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('restaurant_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('restaurants').select('created_at').gte('created_at', eightDaysAgo),
          supabase.from('profiles').select('created_at').gte('created_at', eightDaysAgo),
          supabase.from('discounts').select('created_at').gte('created_at', eightDaysAgo),
          supabase.from('discount_redemptions').select('redeemed_at').eq('status', 'redeemed').gte('redeemed_at', eightDaysAgo),
          supabase.from('discounts').select('id, restaurant_id, title, discount_value, drop_time, valid_until, max_redemptions, total_redeemed').not('drop_time', 'is', null).eq('is_active', true).gt('valid_until', nowIso).order('drop_time', { ascending: true }).limit(1),
          supabase.from('discount_redemptions').select('id, status, redeemed_at, discount_id, user_id, discounts(title, discount_value, restaurants(name))').eq('status', 'redeemed').order('redeemed_at', { ascending: false }).limit(6),
          supabase.from('partner_applications').select('id, restaurant_name, city, status, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('restaurant_suggestions').select('id, restaurant_name, status, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('profiles').select('id, full_name, email, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('discounts').select('id, title, drop_time, created_at, restaurants(name)').not('drop_time', 'is', null).order('created_at', { ascending: false }).limit(6),
          supabase.from('partner_applications').select('id, restaurant_name, city, message, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
          supabase.from('page_views').select('path').ilike('path', '/r/%').gte('created_at', sevenDaysAgo).limit(5000),
        ])

        if (cancelled) return

        // ── Sparklines ──
        const restBuckets = bucketByDay(restRecent.data || [], 'created_at')
        const userBuckets = bucketByDay(usersRecent.data || [], 'created_at')
        const discBuckets = bucketByDay(discRecent.data || [], 'created_at')
        const redempBuckets = bucketByDay(redempRecent.data || [], 'redeemed_at')

        setSparklines({
          restaurants: toSparkHeights(restBuckets),
          users: toSparkHeights(userBuckets),
          discounts: toSparkHeights(discBuckets),
          redemptions: toSparkHeights(redempBuckets),
        })

        setMetrics({
          restaurants: restCount.count || 0,
          restaurantsPublished: restPub.count || 0,
          users: usersTotal.count || 0,
          usersLastWeek: usersWeek.count || 0,
          discountsActive: discActive.count || 0,
          dropsActive: dropsActive.count || 0,
          redemptions30d: redemp30.count || 0,
          redemptionsPrev30d: redempPrev30.count || 0,
          inboxApplications: pendApps.count || 0,
          activeDropsCount: dropsActive.count || 0,
          openSuggestions: pendSugg.count || 0,
        })

        setActiveDrop(activeDropRow.data?.[0] || null)
        setInboxApps(inboxRows.data || [])

        // ── Recent activity UNION ──
        const activity = []
        ;(actRedemptions.data || []).forEach((row) => {
          activity.push({
            type: 'redemption',
            at: row.redeemed_at,
            text: `Riscatto ${row.discounts?.discount_value || ''} da ${row.discounts?.restaurants?.name || '—'}`,
          })
        })
        ;(actApplications.data || []).forEach((row) => {
          activity.push({
            type: 'application',
            at: row.created_at,
            text: `Candidatura da ${row.restaurant_name}${row.city ? ` — ${row.city}` : ''}`,
          })
        })
        ;(actSuggestions.data || []).forEach((row) => {
          activity.push({
            type: 'suggestion',
            at: row.created_at,
            text: `Suggerimento: ${row.restaurant_name}`,
          })
        })
        ;(actSignups.data || []).forEach((row) => {
          const name = row.full_name || (row.email ? row.email.split('@')[0] : 'Nuovo utente')
          activity.push({
            type: 'signup',
            at: row.created_at,
            text: `${name} si è registrato`,
          })
        })
        ;(actDrops.data || []).forEach((row) => {
          activity.push({
            type: 'drop',
            at: row.created_at,
            text: `Drop schedulato · ${row.restaurants?.name || '—'}`,
          })
        })
        activity.sort((a, b) => new Date(b.at) - new Date(a.at))
        setRecentActivity(activity.slice(0, 8))

        // ── Top restaurants by views (7d) ──
        const viewsByPath = {}
        ;(topViews.data || []).forEach((row) => {
          const m = row.path.match(/^\/r\/([^?/]+)/)
          if (!m) return
          const slug = m[1]
          viewsByPath[slug] = (viewsByPath[slug] || 0) + 1
        })
        const topSlugs = Object.entries(viewsByPath)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
        if (topSlugs.length > 0) {
          const { data: topRest } = await supabase
            .from('restaurants')
            .select('id, name, slug, cuisine_type, category, city, photos')
            .in(
              'slug',
              topSlugs.map(([s]) => s)
            )
          if (!cancelled) {
            const ordered = topSlugs
              .map(([slug, count]) => {
                const r = (topRest || []).find((x) => x.slug === slug)
                return r ? { ...r, views: count } : null
              })
              .filter(Boolean)
            setTopRestaurants(ordered)
          }
        } else {
          setTopRestaurants([])
        }
      } catch (err) {
        console.warn('Dashboard load error:', err?.message || err)
      } finally {
        if (!cancelled) setMetricsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const redemptionsDelta = useMemo(() => {
    const { redemptions30d, redemptionsPrev30d } = metrics
    if (!redemptionsPrev30d) return null
    const pct = Math.round(((redemptions30d - redemptionsPrev30d) / redemptionsPrev30d) * 100)
    return {
      pct,
      dir: pct >= 0 ? 'up' : 'dn',
    }
  }, [metrics])

  if (authLoading) return <LoadingScreen />
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const firstName = profile?.full_name?.split(' ')?.[0] || (user?.email || '').split('@')[0]

  return (
    <AdminLayout title="Dashboard">
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }} className="max-md:!p-[18px]">
        {/* ── HEADER ── */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            <b style={{ color: 'var(--color-ink)', fontWeight: 800 }}>Dashboard</b> · panoramica
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 32,
              letterSpacing: '-0.025em',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              color: 'var(--color-ink, #22181C)',
            }}
          >
            Ciao {firstName} <span aria-hidden>👋</span>
          </h1>
          <div
            style={{
              marginTop: 6,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              textTransform: 'capitalize',
            }}
          >
            <span>{formatDateLong()}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor' }} />
            <span style={{ textTransform: 'none' }}>
              {metrics.inboxApplications} candidature nuove, {metrics.activeDropsCount} drop attivi
              {metrics.openSuggestions > 0 ? `, ${metrics.openSuggestions} suggerimenti` : ''}
            </span>
            {liveVisitors != null && liveVisitors > 0 && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor' }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textTransform: 'none' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 6px rgba(74,222,128,0.6)', display: 'inline-block' }} />
                  {liveVisitors} {liveVisitors === 1 ? 'persona live' : 'persone live'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── 4 KPI ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
          className="max-md:!grid-cols-2 max-md:!gap-[10px]"
        >
          <KpiCard
            label="Ristoranti pubblicati"
            value={metrics.restaurantsPublished.toLocaleString('it-IT')}
            delta={`${metrics.restaurants} totali`}
            deltaDir="up"
            sparkline={sparklines.restaurants}
            loading={metricsLoading}
          />
          <KpiCard
            label="Utenti registrati"
            value={metrics.users.toLocaleString('it-IT')}
            delta={metrics.usersLastWeek > 0 ? `+${metrics.usersLastWeek} · 7gg` : '— · 7gg'}
            deltaDir="up"
            sparkline={sparklines.users}
            loading={metricsLoading}
          />
          <KpiCard
            label="Sconti attivi"
            value={metrics.discountsActive.toLocaleString('it-IT')}
            delta={metrics.dropsActive > 0 ? `${metrics.dropsActive} drop live` : 'Nessun drop live'}
            deltaDir="up"
            sparkline={sparklines.discounts}
            loading={metricsLoading}
          />
          <KpiCard
            label="Redenzioni QR (30gg)"
            value={metrics.redemptions30d.toLocaleString('it-IT')}
            delta={redemptionsDelta ? `${redemptionsDelta.pct >= 0 ? '+' : ''}${redemptionsDelta.pct}% vs mese prec.` : null}
            deltaDir={redemptionsDelta?.dir || 'up'}
            sparkline={sparklines.redemptions}
            loading={metricsLoading}
          />
        </div>

        {/* ── DROP SPOTLIGHT ── */}
        {activeDrop && <DropSpotlight drop={activeDrop} />}

        {/* ── 2-col: Activity + Top Restaurants ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 16,
            marginBottom: 24,
          }}
          className="max-md:!grid-cols-1"
        >
          <ActivityCard items={recentActivity} />
          <TopRestaurantsCard items={topRestaurants} />
        </div>

        {/* ── Inbox candidature ── */}
        <InboxCandidatureTile applications={inboxApps} totalPending={metrics.inboxApplications} />

        {/* ── Manutenzione ── */}
        <MaintenanceTile />
      </div>
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ */
/*  MaintenanceTile — strumenti rapidi (es. sync orari Google)         */
/* ------------------------------------------------------------------ */
function MaintenanceTile() {
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [result, setResult] = useState(null)

  const runSync = async () => {
    setStatus('running')
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setStatus('error')
        setResult({ error: 'Sessione scaduta, rifai login' })
        return
      }
      const resp = await fetch('/api/places-details', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || data.ok === false) {
        setStatus('error')
        setResult(data)
        return
      }
      setStatus('done')
      setResult(data)
    } catch (err) {
      setStatus('error')
      setResult({ error: err?.message || String(err) })
    }
  }

  return (
    <div style={{ marginTop: 24, background: '#fff', border: '1px solid var(--color-line, #EAE3D7)', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 16, letterSpacing: '-0.01em', margin: 0 }}>
          Manutenzione
        </h3>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
          strumenti
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
            Sincronizza orari Google
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-ink-70, rgba(34,24,28,0.7))', lineHeight: 1.45 }}>
            Aggiorna gli orari di apertura (regolari + festivi della settimana) per tutti i locali pubblicati dai dati Google. Sincronizza fino a 50 locali per click — il cron settimanale GitHub Actions lo fa di domenica, qui puoi forzarlo a mano.
          </div>
        </div>

        <button
          type="button"
          onClick={runSync}
          disabled={status === 'running'}
          style={{
            padding: '11px 18px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            background: status === 'running' ? 'var(--color-ink-30, rgba(34,24,28,0.3))' : 'var(--color-ink, #22181C)',
            color: '#fff',
            border: 0,
            cursor: status === 'running' ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {status === 'running' ? 'Sincronizzo…' : 'Sincronizza ora'}
        </button>
      </div>

      {status === 'done' && result && (
        <div style={{ marginTop: 14, padding: 12, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, fontSize: 12.5, color: '#065F46', lineHeight: 1.5 }}>
          ✅ Sincronizzati <b>{result.succeeded}</b> locali su {result.candidates} candidati
          {result.failed > 0 ? <> (<b>{result.failed}</b> falliti — controlla i log Vercel)</> : ''}.
          <br />
          Tempo: {Math.round((result.elapsed_ms || 0) / 100) / 10}s.
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: 14, padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, fontSize: 12.5, color: '#991B1B', lineHeight: 1.5 }}>
          ❌ Errore: {result?.error || 'qualcosa non gira'}.
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DropSpotlight({ drop }) {
  const redeemed = drop.total_redeemed || 0
  const target = drop.max_redemptions || Math.max(redeemed, 100)
  const pct = Math.min(100, Math.round((redeemed / target) * 100))
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #FFF1EF, #FCE4E1)',
        border: '1px solid var(--color-corallo-soft, #F6B7B1)',
        borderRadius: 20,
        padding: 20,
        display: 'grid',
        gridTemplateColumns: '1.3fr 1fr',
        gap: 20,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
      className="max-md:!grid-cols-1 max-md:!gap-[12px]"
    >
      <span style={{ position: 'absolute', top: 14, right: 18, fontSize: 24 }} aria-hidden>🔥</span>
      <div>
        <div
          style={{
            color: 'var(--color-corallo, #E8453C)',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          🔥 Drop in corso
        </div>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'var(--color-ink)' }}>
          {drop.title}
        </h3>
        <div style={{ fontSize: 13, color: 'var(--color-ink-70, rgba(34,24,28,0.7))', fontWeight: 600, marginBottom: 14 }}>
          {drop.max_redemptions ? `Target: ${drop.max_redemptions} redenzioni` : 'Nessun target impostato'}
        </div>
        <div
          style={{
            height: 8,
            background: 'rgba(232,69,60,0.18)',
            borderRadius: 999,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--color-corallo, #E8453C)',
              borderRadius: 999,
              transition: 'width 0.3s',
            }}
          />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-ink-70, rgba(34,24,28,0.7))' }}>
          {redeemed} su {target} redenzioni
          {drop.max_redemptions ? ` · ${Math.max(0, target - redeemed)} posti rimasti` : ''}
        </div>
      </div>
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 32, letterSpacing: '-0.03em', color: 'var(--color-ink)' }}>
          {countdown(drop.valid_until)}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            marginTop: 4,
          }}
        >
          Al termine
        </div>
      </div>
    </div>
  )
}

function ActivityCard({ items }) {
  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}>
        <h3 style={cardTitleStyle}>Attività recente</h3>
        <span style={cardMetaStyle}>cosa è successo oggi</span>
      </div>
      {items.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
          Nessuna attività recente
        </div>
      )}
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 0',
            borderBottom: i === items.length - 1 ? 0 : '1px dashed var(--color-line, #EAE3D7)',
            fontSize: 13,
          }}
        >
          <ActivityIcon type={item.type} />
          <div style={{ flex: 1, color: 'var(--color-ink)', lineHeight: 1.4 }}>{item.text}</div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {relativeTime(item.at)}
          </div>
        </div>
      ))}
    </div>
  )
}

function TopRestaurantsCard({ items }) {
  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}>
        <h3 style={cardTitleStyle}>Top ristoranti · settimana</h3>
        <Link to="/admin/analytics" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--color-corallo, #E8453C)', textDecoration: 'none' }}>
          Vedi tutto →
        </Link>
      </div>
      {items.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
          Ancora poche visite per il ranking
        </div>
      )}
      {items.map((r, i) => {
        const thumb = proxyImg(pickThumb(r))
        const cat = (r.category && r.category[0]) || r.cuisine_type || '—'
        return (
          <Link
            key={r.id}
            to={`/admin/restaurant/${r.id}/edit`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: i === items.length - 1 ? 0 : '1px dashed var(--color-line, #EAE3D7)',
              textDecoration: 'none',
              color: 'var(--color-ink)',
            }}
          >
            {thumb ? (
              <img src={thumb} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #d8cfc1, #ad9b80)',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{r.name}</div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                {(r.city || 'Torino')} · {cat}
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: '-0.02em',
              }}
            >
              {r.views}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function InboxCandidatureTile({ applications, totalPending }) {
  if (!applications || applications.length === 0) {
    return (
      <div style={{ background: 'var(--color-cream, #F5F0E4)', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h3 style={cardTitleStyle}>Candidature</h3>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
            tutto gestito
          </span>
        </div>
        <div style={{ color: 'var(--color-ink-70, rgba(34,24,28,0.7))', fontSize: 13 }}>
          Nessuna candidatura aperta al momento. Bel lavoro.
        </div>
      </div>
    )
  }
  return (
    <div style={{ background: 'var(--color-cream, #F5F0E4)', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h3 style={cardTitleStyle}>Candidature da aprire</h3>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
          rispondi entro 3gg
        </span>
        <span
          style={{
            marginLeft: 'auto',
            background: 'var(--color-corallo, #E8453C)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 999,
          }}
        >
          {totalPending}
        </span>
        <Link to="/admin/applications" style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-corallo, #E8453C)', textDecoration: 'none' }}>
          Vedi tutte →
        </Link>
      </div>
      {applications.map((app) => (
        <div
          key={app.id}
          style={{
            display: 'flex',
            gap: 12,
            padding: 12,
            background: '#fff',
            borderRadius: 12,
            marginBottom: 8,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #d8cfc1, #ad9b80)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-ink)' }}>
              {app.restaurant_name}
              {app.city && (
                <span style={{ fontWeight: 600, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 11 }}>
                  {' '}· {app.city}
                </span>
              )}
            </div>
            <div
              style={{
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                marginTop: 2,
                fontSize: 11,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 480,
              }}
            >
              «{(app.message || 'Nessun messaggio').slice(0, 120)}»
            </div>
          </div>
          <Link
            to={`/admin/applications#app-${app.id}`}
            style={{
              padding: '7px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: 'var(--color-ink, #22181C)',
              color: '#fff',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Apri →
          </Link>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Utils                                                              */
/* ------------------------------------------------------------------ */
function pickThumb(r) {
  if (!Array.isArray(r.photos) || r.photos.length === 0) return null
  const first = r.photos[0]
  if (typeof first === 'string') return first
  return first?.thumb_url || first?.photo_url || null
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-page, #FAF7F2)',
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

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */
const cardStyle = {
  background: '#fff',
  border: '1px solid var(--color-line, #EAE3D7)',
  borderRadius: 18,
  padding: 20,
}

const cardHeadStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 14,
}

const cardTitleStyle = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 900,
  fontSize: 17,
  letterSpacing: '-0.01em',
  color: 'var(--color-ink, #22181C)',
  margin: 0,
}

const cardMetaStyle = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
}
