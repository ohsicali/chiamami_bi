import { useState, useEffect, useMemo, useRef } from 'react'
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

function getDateRange(period, customFrom, customTo) {
  if (period === 'custom' && customFrom && customTo) {
    const endDate = new Date(customTo)
    endDate.setHours(23, 59, 59, 999)
    const days = Math.max(1, Math.ceil((endDate - customFrom) / (24 * 60 * 60 * 1000)))
    return { start: customFrom.toISOString(), end: endDate.toISOString(), days }
  }
  const p = PERIODS.find((x) => x.key === period)
  const days = p?.days || 7
  return {
    start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    end: null,
    days,
  }
}

/* ------------------------------------------------------------------ */
/*  DateRangePicker                                                    */
/* ------------------------------------------------------------------ */
const MONTH_NAMES = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
]
const DAY_LABELS = ['Lu','Ma','Me','Gi','Ve','Sa','Do']

function startOfDay(d) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function isSameDay(a, b) {
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function DateRangePicker({ from, to, onApply, onClose }) {
  const today = startOfDay(new Date())
  const [viewYear, setViewYear] = useState(() => (from || today).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (from || today).getMonth())
  const [localFrom, setLocalFrom] = useState(from || null)
  const [localTo, setLocalTo] = useState(to || null)
  const [hoverDate, setHoverDate] = useState(null)

  function getMonthDays(y, m) {
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const days = []
    // Monday-first (Italian): (getDay()+6)%7 → Mon=0, Sun=6
    const pad = (first.getDay() + 6) % 7
    for (let i = 0; i < pad; i++) days.push(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d))
    return days
  }

  function handleDayClick(day) {
    if (!day) return
    const d = startOfDay(day)
    if (d > today) return
    if (!localFrom || localTo) {
      setLocalFrom(d)
      setLocalTo(null)
    } else {
      if (d < localFrom) {
        setLocalTo(localFrom)
        setLocalFrom(d)
      } else {
        setLocalTo(d)
      }
    }
  }

  function effectiveTo() {
    if (localTo) return localTo
    if (localFrom && hoverDate && hoverDate > localFrom) return hoverDate
    return null
  }

  function isInRange(day) {
    if (!day || !localFrom) return false
    const d = startOfDay(day)
    const eTo = effectiveTo()
    if (!eTo) return false
    return d > localFrom && d < eTo
  }

  function isEdge(day, which) {
    if (!day || !localFrom) return false
    const d = startOfDay(day)
    if (which === 'start') return isSameDay(d, localFrom)
    const eTo = effectiveTo()
    return eTo ? isSameDay(d, eTo) : false
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    const next = new Date(viewYear, viewMonth + 1, 1)
    if (next > today) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function fmtShort(d) {
    if (!d) return '—'
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  const days = getMonthDays(viewYear, viewMonth)
  const nextIsAfterToday = new Date(viewYear, viewMonth + 1, 1) > today
  const canApply = localFrom && localTo

  const btnBase = {
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: 12,
    padding: '8px 18px',
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        zIndex: 200,
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        width: 300,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Selected range summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{
          flex: 1, background: 'var(--color-cream-deep,#F1EBE0)', borderRadius: 8,
          padding: '6px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700,
          color: localFrom ? 'var(--color-ink)' : '#bbb',
        }}>
          {fmtShort(localFrom)}
        </div>
        <span style={{ color: '#bbb', fontSize: 12 }}>→</span>
        <div style={{
          flex: 1, background: 'var(--color-cream-deep,#F1EBE0)', borderRadius: 8,
          padding: '6px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700,
          color: effectiveTo() ? 'var(--color-ink)' : '#bbb',
        }}>
          {fmtShort(effectiveTo())}
        </div>
      </div>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={prevMonth}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-ink)', padding: '2px 8px', borderRadius: 6 }}
        >‹</button>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-ink)' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          disabled={nextIsAfterToday}
          style={{ background: 'none', border: 'none', cursor: nextIsAfterToday ? 'default' : 'pointer', fontSize: 18, color: nextIsAfterToday ? '#ddd' : 'var(--color-ink)', padding: '2px 8px', borderRadius: 6 }}
        >›</button>
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {DAY_LABELS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#bbb', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {days.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const isFuture = startOfDay(day) > today
          const inRange = isInRange(day)
          const isStart = isEdge(day, 'start')
          const isEnd = isEdge(day, 'end')
          const isT = isSameDay(day, today)
          const active = isStart || isEnd

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => {
                if (localFrom && !localTo) setHoverDate(startOfDay(day))
              }}
              onMouseLeave={() => setHoverDate(null)}
              disabled={isFuture}
              style={{
                padding: '5px 2px',
                border: 'none',
                borderRadius: active ? 999 : inRange ? 2 : 6,
                cursor: isFuture ? 'default' : 'pointer',
                fontSize: 11,
                fontWeight: isT && !active ? 800 : 500,
                background: active
                  ? 'var(--color-ink,#22181C)'
                  : inRange
                  ? 'rgba(34,24,28,0.08)'
                  : 'transparent',
                color: active ? '#fff' : isFuture ? '#ddd' : isT ? 'var(--color-ink)' : '#444',
                fontFamily: 'var(--font-sans)',
                textDecoration: isT && !active ? 'underline' : 'none',
                textDecorationColor: '#E8453C',
              }}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      {/* Hint */}
      {localFrom && !localTo && (
        <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>
          Seleziona la data di fine
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={{ ...btnBase, background: 'var(--color-cream-deep,#F1EBE0)', color: 'var(--color-ink)', flex: 1 }}>
          Annulla
        </button>
        <button
          onClick={() => canApply && onApply(localFrom, localTo)}
          disabled={!canApply}
          style={{
            ...btnBase,
            background: canApply ? 'var(--color-ink,#22181C)' : '#ddd',
            color: canApply ? '#fff' : '#aaa',
            flex: 1,
            cursor: canApply ? 'pointer' : 'default',
          }}
        >
          Applica
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StatCard — compact, no animation                                   */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, sub, subColor }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #eee',
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
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 16 }}>
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
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef(null)

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
    if (period === 'custom' && (!customFrom || !customTo)) return
    let cancelled = false

    async function fetchAll() {
      const { start, end } = getDateRange(period, customFrom, customTo)

      const rng = (q, field) => {
        let r = q.gte(field, start)
        if (end) r = r.lte(field, end)
        return r
      }

      try {
        const [usersTotal, usersInPeriod, qrGen, qrUsed, periodRedemptions, savedTop, pvTotal, pvByPath] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          rng(supabase.from('profiles').select('id', { count: 'exact', head: true }), 'created_at'),
          rng(supabase.from('discount_redemptions').select('id', { count: 'exact', head: true }), 'generated_at'),
          rng(supabase.from('discount_redemptions').select('id', { count: 'exact', head: true }).eq('status', 'redeemed'), 'redeemed_at'),
          rng(supabase.from('discount_redemptions').select('discount_id, status'), 'generated_at'),
          rng(supabase.from('saved_restaurants').select('restaurant_id'), 'created_at'),
          rng(supabase.from('page_views').select('id', { count: 'exact', head: true }), 'created_at'),
          rng(supabase.from('page_views').select('path, session_id, country, city, device_type').limit(50000), 'created_at'),
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
  }, [period, customFrom, customTo, user, restaurants])

  // Visits chart data — real page_views bucketed by time
  const [visitsChartData, setVisitsChartData] = useState([])
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    if (period === 'custom' && (!customFrom || !customTo)) return
    let cancelled = false

    async function fetchChart() {
      try {
        const { start, end, days } = getDateRange(period, customFrom, customTo)
        const points = days === 1 ? 24 : Math.min(days, 30)
        const spacing = days === 1 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000

        const rng = (q, field) => {
          let r = q.gte(field, start)
          if (end) r = r.lte(field, end)
          return r
        }

        const [pvRes, regsRes] = await Promise.all([
          rng(supabase.from('page_views').select('created_at'), 'created_at'),
          rng(supabase.from('profiles').select('created_at'), 'created_at'),
        ])

        if (cancelled) return

        const pvs = pvRes.data || []
        const regs = regsRes.data || []

        // Build buckets forward from range start
        const rangeStart = new Date(start)
        const buckets = []
        for (let i = 0; i < points; i++) {
          const bucketStart = new Date(rangeStart.getTime() + i * spacing)
          const label =
            days === 1
              ? bucketStart.toLocaleTimeString('it-IT', { hour: '2-digit' }) + 'h'
              : bucketStart.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
          buckets.push({ key: label, visite: 0, utenti: 0, start: bucketStart.getTime() })
        }

        pvs.forEach((row) => {
          const t = new Date(row.created_at).getTime()
          for (let i = buckets.length - 1; i >= 0; i--) {
            if (t >= buckets[i].start) { buckets[i].visite += 1; break }
          }
        })
        regs.forEach((row) => {
          const t = new Date(row.created_at).getTime()
          for (let i = buckets.length - 1; i >= 0; i--) {
            if (t >= buckets[i].start) { buckets[i].utenti += 1; break }
          }
        })
        setVisitsChartData(buckets)
      } catch (err) {
        console.warn('Visits chart error:', err?.message || err)
      }
    }
    fetchChart()
  }, [period, customFrom, customTo, user])

  // Close date picker when clicking outside
  useEffect(() => {
    if (!showDatePicker) return
    function handler(e) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setShowDatePicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDatePicker])

  function handleCustomApply(from, to) {
    setCustomFrom(from)
    setCustomTo(to)
    setPeriod('custom')
    setShowDatePicker(false)
  }

  function customPeriodLabel() {
    if (period !== 'custom' || !customFrom || !customTo) return null
    const fmt = (d) => d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
    return `${fmt(customFrom)} → ${fmt(customTo)}`
  }

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
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }} className="max-md:!p-[18px]">
        {/* ─── HEADER mockup-aligned ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              Numeri › <b style={{ color: 'var(--color-ink)', fontWeight: 800 }}>Analytics</b>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 900,
                fontSize: 32,
                letterSpacing: '-0.025em',
                margin: 0,
                color: 'var(--color-ink, #22181C)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              Analytics
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  background: 'var(--color-cream-deep, #F1EBE0)',
                  color: 'var(--color-ink, #22181C)',
                  padding: '5px 10px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                }}
              >
                {customPeriodLabel() || PERIODS.find((p) => p.key === period)?.label || 'periodo'}
              </span>
            </h1>
            <div style={{ marginTop: 6, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 14, fontWeight: 500 }}>
              Traffico, utenti, redenzioni · i numeri fattuali, non rating.
            </div>
          </div>

          {/* Period selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                background: '#fff',
                border: '1px solid var(--color-line, #EAE3D7)',
                borderRadius: 999,
                padding: 4,
              }}
            >
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => { setPeriod(p.key); setShowDatePicker(false) }}
                  style={{
                    padding: '7px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 999,
                    cursor: 'pointer',
                    background: period === p.key ? 'var(--color-ink, #22181C)' : 'transparent',
                    color: period === p.key ? '#fff' : 'var(--color-ink-55, rgba(34,24,28,0.55))',
                    transition: 'background 0.15s',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date range button + picker */}
            <div ref={datePickerRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDatePicker((v) => !v)}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  border: '1px solid var(--color-line, #EAE3D7)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  background: period === 'custom' ? 'var(--color-ink,#22181C)' : '#fff',
                  color: period === 'custom' ? '#fff' : 'var(--color-ink-55,rgba(34,24,28,0.55))',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <span aria-hidden style={{ fontSize: 13 }}>📅</span>
                {customPeriodLabel() || 'Personalizza'}
              </button>

              {showDatePicker && (
                <DateRangePicker
                  from={customFrom}
                  to={customTo}
                  onApply={handleCustomApply}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <StatCard label="Utenti registrati" value={metrics.usersTotal} sub={metrics.usersInPeriod > 0 ? `+${metrics.usersInPeriod} nel periodo` : null} subColor="#059669" />
          <StatCard label="QR presi" value={metrics.qrGenerated} sub="sconti attivati" />
          <StatCard label="QR utilizzati" value={metrics.qrRedeemed} sub={`${conversionRate}% conversione`} subColor="#E8453C" />
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
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E8453C' }} />
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
              border: '1px solid #eee',
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
              border: '1px solid #eee',
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
              border: '1px solid #eee',
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
      </div>
    </AdminLayout>
  )
}
