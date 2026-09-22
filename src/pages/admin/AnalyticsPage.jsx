import { useState, useEffect, useMemo, useRef } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import { PERIODS, getAnalyticsRange } from '../../lib/analyticsRange'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

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
/*  Formattazione                                                      */
/* ------------------------------------------------------------------ */
const nf = new Intl.NumberFormat('it-IT')
const fmtNum = (n) => nf.format(Math.round(n || 0))

let regionNames = null
try {
  regionNames = new Intl.DisplayNames(['it'], { type: 'region' })
} catch {
  regionNames = null
}
function countryName(code) {
  if (!code) return '—'
  try {
    return regionNames?.of(code.toUpperCase()) || code
  } catch {
    return code
  }
}
function countryFlag(code) {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)))
}

// Vercel manda i nomi delle città in inglese.
const CITY_IT = {
  Turin: 'Torino', Milan: 'Milano', Rome: 'Roma', Florence: 'Firenze', Genoa: 'Genova',
  Naples: 'Napoli', Venice: 'Venezia', Padua: 'Padova', Mantua: 'Mantova', Syracuse: 'Siracusa',
  Leghorn: 'Livorno', 'Reggio Emilia': 'Reggio Emilia',
}
const DEVICE_LABEL = { mobile: 'Telefono', tablet: 'Tablet', desktop: 'Computer', unknown: 'Non rilevato' }

const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

// `t` arriva dal DB già in ora italiana ("2026-09-22T14:00"): si legge a
// pezzi invece di passarlo a new Date(), che lo sposterebbe di fuso.
function parseBucket(t) {
  const [d, hm] = t.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h] = (hm || '00:00').split(':').map(Number)
  return { y, m, day, h, weekday: new Date(y, m - 1, day).getDay() }
}
function bucketTick(t, bucket) {
  const b = parseBucket(t)
  return bucket === 'hour' ? `${String(b.h).padStart(2, '0')}` : `${b.day} ${MONTHS_SHORT[b.m - 1]}`
}
function bucketTitle(t, bucket) {
  const b = parseBucket(t)
  const date = `${WEEKDAYS[b.weekday]} ${b.day} ${MONTHS_SHORT[b.m - 1]}`
  if (bucket !== 'hour') return date
  const hh = (n) => `${String(n % 24).padStart(2, '0')}:00`
  return `${date}, ${hh(b.h)}–${hh(b.h + 1)}`
}

function deltaOf(cur, prev) {
  if (!prev) return cur > 0 ? { text: 'prima era 0', dir: 'up' } : null
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return { text: 'invariato', dir: null }
  // "+10850%" non si legge: oltre il triplo si dice quante volte tanto.
  if (pct >= 200) {
    return { text: `×${(cur / prev).toLocaleString('it-IT', { maximumFractionDigits: cur / prev < 10 ? 1 : 0 })}`, dir: 'up' }
  }
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, dir: pct > 0 ? 'up' : 'dn' }
}

function photoOf(r) {
  const p = Array.isArray(r?.photos) && r.photos.length > 0 ? r.photos[0] : null
  if (!p) return null
  return proxyImg(typeof p === 'string' ? p : p.thumb_url || p.photo_url)
}

/* ------------------------------------------------------------------ */
/*  Pezzi di interfaccia                                              */
/* ------------------------------------------------------------------ */
const card = {
  background: '#fff',
  border: '1px solid var(--color-line, #EAE3D7)',
  borderRadius: 18,
  padding: 18,
}

function SectionTitle({ children, hint }) {
  return (
    <div style={{ margin: '8px 0 -4px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.01em', margin: 0, color: 'var(--color-ink)' }}>
        {children}
      </h2>
      {hint && (
        <div style={{ fontSize: 13, color: 'var(--color-ink-55)', marginTop: 2 }}>{hint}</div>
      )}
    </div>
  )
}

function CardTitle({ title, hint, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 220px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--color-ink)' }}>{title}</h3>
        {hint && <div style={{ fontSize: 12, color: 'var(--color-ink-55)', marginTop: 2 }}>{hint}</div>}
      </div>
      {right}
    </div>
  )
}

function Stat({ label, value, hint, delta, prevLabel, loading }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)' }}>{label}</div>
      {loading ? (
        <div className="skeleton" aria-hidden="true" style={{ width: 80, height: 32, borderRadius: 8, marginTop: 8 }} />
      ) : (
        <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 6, color: 'var(--color-ink)' }}>
          {value}
        </div>
      )}
      {!loading && delta && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            fontWeight: 700,
            color: delta.dir === 'dn' ? '#C0392B' : delta.dir === 'up' ? '#2C7A4A' : 'var(--color-ink-55)',
          }}
        >
          {delta.dir === 'up' ? '▲ ' : delta.dir === 'dn' ? '▼ ' : ''}
          {delta.text}
          <span style={{ fontWeight: 500, color: 'var(--color-ink-55)' }}> {prevLabel}</span>
        </div>
      )}
      {hint && (
        <div style={{ fontSize: 12, color: 'var(--color-ink-55)', marginTop: 'auto', paddingTop: 8, lineHeight: 1.35 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

/** Classifica a barre orizzontali: etichetta, numero, quota sul totale. */
function RankList({ rows, valueKey, total, format = (r) => r.label, extra, empty = 'Nessun dato nel periodo', limit = 8 }) {
  if (!rows || rows.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--color-ink-55)', textAlign: 'center', padding: '24px 0' }}>{empty}</div>
  }
  const shown = rows.slice(0, limit)
  const max = Math.max(...shown.map((r) => r[valueKey]), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {shown.map((r) => {
        const v = r[valueKey]
        const pct = total > 0 ? (v / total) * 100 : null
        const share = pct == null ? null : pct > 0 && pct < 1 ? '<1' : Math.round(pct)
        return (
          <div key={r.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5, fontSize: 13 }}>
              <span style={{ color: 'var(--color-ink)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {format(r)}
              </span>
              <span style={{ color: 'var(--color-ink)', fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(v)}
                {share != null && <span style={{ color: 'var(--color-ink-55)', fontWeight: 500 }}> · {share}%</span>}
                {extra && extra(r)}
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--color-cream-deep, #F1EBE0)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(v / max) * 100}%`, height: '100%', background: 'var(--color-corallo, #E8453C)', borderRadius: 4 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const CHART_METRICS = [
  { key: 'visitors', label: 'Persone', unit: ['persona', 'persone'] },
  { key: 'pageviews', label: 'Pagine viste', unit: ['pagina vista', 'pagine viste'] },
  { key: 'signups', label: 'Nuovi iscritti', unit: ['nuovo iscritto', 'nuovi iscritti'] },
]

function ChartTooltip({ active, payload, bucket, metric }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const v = row[metric.key]
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-line)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)', fontSize: 12 }}>
      <div style={{ color: 'var(--color-ink-55)', marginBottom: 2 }}>{bucketTitle(row.t, bucket)}</div>
      <div style={{ fontWeight: 800, color: 'var(--color-ink)' }}>
        {fmtNum(v)} {v === 1 ? metric.unit[0] : metric.unit[1]}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Pagina                                                             */
/* ------------------------------------------------------------------ */
export default function AnalyticsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { allRestaurants: restaurants } = useRestaurants()
  const [period, setPeriod] = useState('7d')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef(null)
  const [chartMetric, setChartMetric] = useState('visitors')

  // ── Adesso sul sito: una funzione nel DB, ogni 30 secondi ──
  const [live, setLive] = useState(null)
  useEffect(() => {
    if (!isSupabaseConfigured() || !user || !isAdmin) return
    let cancelled = false
    async function fetchLive() {
      if (document.visibilityState === 'hidden') return
      const { data, error } = await supabase.rpc('admin_analytics_live')
      if (!cancelled && !error) setLive(data)
    }
    fetchLive()
    const interval = setInterval(fetchLive, 30000)
    document.addEventListener('visibilitychange', fetchLive)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', fetchLive)
    }
  }, [user, isAdmin])

  // ── Tutti i numeri del periodo: una sola chiamata ──
  // Prima qui c'erano otto query che scaricavano righe e le contavano nel
  // browser, tagliate a 1000 da PostgREST: con il traffico del lancio i
  // numeri erano un decimo di quelli veri. Ora conta Postgres
  // (supabase/admin-analytics-2026-09-23.sql).
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const range = useMemo(
    () => (period === 'custom' && (!customFrom || !customTo) ? null : getAnalyticsRange(period, customFrom, customTo)),
    // reloadKey: "Aggiorna" ricalcola anche la fine dell'intervallo (adesso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, customFrom, customTo, reloadKey]
  )

  useEffect(() => {
    if (!isSupabaseConfigured() || !user || !isAdmin || !range) return
    let cancelled = false
    setLoading(true)
    setError(null)
    supabase
      .rpc('admin_analytics', {
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
        p_prev_from: range.prevFrom.toISOString(),
        p_prev_to: range.prevTo.toISOString(),
        p_bucket: range.bucket,
      })
      .then(({ data: res, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else {
          setData(res)
          setUpdatedAt(new Date())
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [range, user, isAdmin])

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

  const restById = useMemo(() => {
    const m = {}
    ;(restaurants || []).forEach((r) => { m[r.id] = r })
    return m
  }, [restaurants])

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

  const cur = data?.current || {}
  const prev = data?.previous || {}
  const busy = loading && !data
  const prevLabel =
    period === 'today' ? 'rispetto a ieri alla stessa ora'
      : range ? `rispetto ai ${range.days} giorni prima` : ''
  const pagesPerVisit = cur.visits ? (cur.pageviews / cur.visits) : 0
  const prevPagesPerVisit = prev.visits ? (prev.pageviews / prev.visits) : 0
  const bounce = cur.visits ? Math.round((cur.single_page / cur.visits) * 100) : 0
  const signupRate = cur.visitors ? (cur.signups / cur.visitors) * 100 : 0
  const usedRate = cur.discounts_taken ? Math.round((cur.discounts_used / cur.discounts_taken) * 100) : 0
  const metric = CHART_METRICS.find((m) => m.key === chartMetric)
  const series = data?.series || []
  const seriesTotal = series.reduce((s, r) => s + (r[chartMetric] || 0), 0)
  const hasSeries = series.some((r) => r[chartMetric] > 0)
  const totalVisits = (data?.sources || []).reduce((s, r) => s + r.visits, 0)
  const totalDeviceVisitors = (data?.devices || []).reduce((s, r) => s + r.visitors, 0)

  return (
    <AdminLayout title="Analytics">
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }} className="max-md:!p-[18px]">
        {/* ─── HEADER ─── */}
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
              }}
            >
              Analytics
            </h1>
            <div style={{ marginTop: 6, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 14, fontWeight: 500 }}>
              Chi visita il sito, da dove arriva, cosa guarda e quanti si iscrivono.
              {updatedAt && (
                <>
                  {' '}Aggiornato alle {updatedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                  <button
                    onClick={() => setReloadKey((k) => k + 1)}
                    disabled={loading}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-corallo, #E8453C)', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
                  >
                    {loading ? 'aggiorno…' : 'aggiorna'}
                  </button>
                </>
              )}
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
          {/* ─── ADESSO SUL SITO ─── */}
          <div
            style={{
              background: 'var(--color-ink)',
              borderRadius: 18,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
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
                  flexShrink: 0,
                }}
              />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {live ? fmtNum(live.visitors) : '…'}{' '}
                {live?.visitors === 1 ? 'persona sul sito adesso' : 'persone sul sito adesso'}
              </div>
            </div>
            {live?.sections?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {live.sections.slice(0, 5).map((s) => (
                  <span
                    key={s.label}
                    style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '4px 10px' }}
                  >
                    {s.visitors} {s.label}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
              ultimi 5 minuti · si aggiorna ogni 30 s
            </div>
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>

          {error && (
            <div style={{ ...card, borderColor: '#F3C1BD', background: '#FFF6F5', color: '#8A2A22', fontSize: 14 }}>
              Non riesco a leggere le statistiche: {error}
            </div>
          )}

          {/* ─── TRAFFICO ─── */}
          <SectionTitle hint="Quante persone hanno aperto il sito nel periodo scelto.">Visite</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }} className="md:!grid-cols-4">
            <Stat
              label="Persone"
              value={fmtNum(cur.visitors)}
              delta={deltaOf(cur.visitors, prev.visitors)}
              prevLabel={prevLabel}
              hint="Browser diversi. Chi torna più volte conta una."
              loading={busy}
            />
            <Stat
              label="Visite"
              value={fmtNum(cur.visits)}
              delta={deltaOf(cur.visits, prev.visits)}
              prevLabel={prevLabel}
              hint="Ogni volta che qualcuno apre il sito. Dopo 30 minuti fermo è una visita nuova."
              loading={busy}
            />
            <Stat
              label="Pagine viste"
              value={fmtNum(cur.pageviews)}
              delta={deltaOf(cur.pageviews, prev.pageviews)}
              prevLabel={prevLabel}
              hint="Tutte le pagine aperte, anche più volte dalla stessa persona."
              loading={busy}
            />
            <Stat
              label="Pagine per visita"
              value={pagesPerVisit.toLocaleString('it-IT', { maximumFractionDigits: 1 })}
              delta={deltaOf(pagesPerVisit, prevPagesPerVisit)}
              prevLabel={prevLabel}
              hint={`${bounce}% delle visite si ferma alla prima pagina.`}
              loading={busy}
            />
          </div>

          {/* ─── GRAFICO ─── */}
          <div style={card}>
            <CardTitle
              title={`${metric.label} ${range?.bucket === 'hour' ? 'ora per ora' : 'giorno per giorno'}`}
              hint={hasSeries ? `${fmtNum(seriesTotal)} in totale · ora italiana` : 'ora italiana'}
              right={
                <div style={{ display: 'flex', background: 'var(--color-cream-deep, #F1EBE0)', borderRadius: 999, padding: 3 }}>
                  {CHART_METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setChartMetric(m.key)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 999,
                        cursor: 'pointer',
                        background: chartMetric === m.key ? '#fff' : 'transparent',
                        color: chartMetric === m.key ? 'var(--color-ink)' : 'var(--color-ink-55)',
                        boxShadow: chartMetric === m.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        fontFamily: 'var(--font-sans)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              }
            />
            {busy ? (
              <div className="skeleton" aria-hidden="true" style={{ height: 240, borderRadius: 12 }} />
            ) : hasSeries ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F1EBE0" />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) => bucketTick(t, range?.bucket)}
                    tick={{ fontSize: 11, fill: 'rgba(34,24,28,0.55)' }}
                    tickLine={false}
                    axisLine={{ stroke: '#EAE3D7' }}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgba(34,24,28,0.55)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={fmtNum}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(34,24,28,0.05)' }}
                    content={<ChartTooltip bucket={range?.bucket} metric={metric} />}
                  />
                  <Bar dataKey={chartMetric} fill="#E8453C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink-55)', fontSize: 13 }}>
                Nessun dato nel periodo
              </div>
            )}
          </div>

          {/* ─── PROVENIENZA + PAGINE ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }} className="md:!grid-cols-2">
            <div style={card}>
              <CardTitle title="Da dove arrivano" hint="Visite per sito di provenienza. «Diretto o link» = indirizzo scritto, preferiti o link condiviso in chat." />
              <RankList rows={data?.sources} valueKey="visits" total={totalVisits} />
            </div>
            <div style={card}>
              <CardTitle title="Cosa guardano" hint="Persone che hanno aperto almeno una pagina di ogni sezione." />
              <RankList
                rows={data?.sections}
                valueKey="visitors"
                total={cur.visitors}
                limit={10}
                extra={(r) => (
                  <span style={{ color: 'var(--color-ink-55)', fontWeight: 500 }}> · {fmtNum(r.pageviews)} pag.</span>
                )}
              />
            </div>
          </div>

          {/* ─── LOCALI PIÙ VISTI ─── */}
          <div style={card}>
            <CardTitle title="Locali più visti" hint="Aperture della scheda del locale nel periodo, con quante volte è stato salvato." />
            {!data?.restaurants?.length ? (
              <div style={{ fontSize: 13, color: 'var(--color-ink-55)', textAlign: 'center', padding: '24px 0' }}>Nessun dato nel periodo</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--color-ink-55)', textAlign: 'right' }}>
                      <th style={{ textAlign: 'left', fontWeight: 600, padding: '0 8px 8px 0' }}>Locale</th>
                      <th className="max-md:hidden" style={{ fontWeight: 600, padding: '0 8px 8px' }}>Persone</th>
                      <th style={{ fontWeight: 600, padding: '0 8px 8px' }}>Aperture</th>
                      <th style={{ fontWeight: 600, padding: '0 0 8px 8px' }}>Salvati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.restaurants.map((r, i) => {
                      const photo = photoOf(restById[r.id])
                      return (
                        <tr key={r.slug} style={{ borderTop: '1px solid var(--color-line)' }}>
                          {/* maxWidth 0 + width 100%: la colonna del nome prende lo
                              spazio che resta e taglia con i puntini invece di
                              allargare la tabella oltre lo schermo. */}
                          <td style={{ padding: '8px 8px 8px 0', maxWidth: 0, width: '100%' }}>
                            <a
                              href={`/restaurant/${r.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-ink)', textDecoration: 'none', fontWeight: 600 }}
                            >
                              <span style={{ width: 18, flexShrink: 0, textAlign: 'right', color: i === 0 ? 'var(--color-corallo)' : 'var(--color-ink-55)', fontWeight: 800 }}>{i + 1}</span>
                              {photo ? (
                                <img src={photo} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-cream-deep, #F1EBE0)', flexShrink: 0 }} />
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                            </a>
                          </td>
                          <td className="max-md:hidden" style={{ textAlign: 'right', padding: 8, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.visitors)}</td>
                          <td style={{ textAlign: 'right', padding: 8, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtNum(r.views)}</td>
                          <td style={{ textAlign: 'right', padding: '8px 0 8px 8px', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.saves)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── UTENTI ─── */}
          <SectionTitle hint="Chi ha un account e cosa fa con gli sconti.">Utenti e sconti</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }} className="md:!grid-cols-3">
            <Stat
              label="Nuovi iscritti"
              value={fmtNum(cur.signups)}
              delta={deltaOf(cur.signups, prev.signups)}
              prevLabel={prevLabel}
              hint={cur.visitors ? `${signupRate.toLocaleString('it-IT', { maximumFractionDigits: 1 })}% delle persone arrivate si è iscritto.` : null}
              loading={busy}
            />
            <Stat
              label="Iscritti in totale"
              value={fmtNum(data?.users_total)}
              hint={<Link to="/admin/users" style={{ color: 'var(--color-corallo)', fontWeight: 700, textDecoration: 'none' }}>Vedi l'elenco →</Link>}
              loading={busy}
            />
            <Stat
              label="Utenti attivi"
              value={fmtNum(cur.logged_users)}
              delta={deltaOf(cur.logged_users, prev.logged_users)}
              prevLabel={prevLabel}
              hint="Iscritti che hanno usato il sito da loggati nel periodo."
              loading={busy}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }} className="md:!grid-cols-3">
            <Stat
              label="Sconti presi"
              value={fmtNum(cur.discounts_taken)}
              delta={deltaOf(cur.discounts_taken, prev.discounts_taken)}
              prevLabel={prevLabel}
              hint="QR o codice generato da un utente."
              loading={busy}
            />
            <Stat
              label="Sconti utilizzati"
              value={fmtNum(cur.discounts_used)}
              delta={deltaOf(cur.discounts_used, prev.discounts_used)}
              prevLabel={prevLabel}
              hint={
                <>
                  {cur.discounts_taken ? `${usedRate}% di quelli presi, convalidati dal locale. ` : 'Convalidati dal locale. '}
                  <Link to="/admin/discounts" style={{ color: 'var(--color-corallo)', fontWeight: 700, textDecoration: 'none' }}>Per sconto →</Link>
                </>
              }
              loading={busy}
            />
            <Stat
              label="Locali salvati"
              value={fmtNum(cur.saves)}
              delta={deltaOf(cur.saves, prev.saves)}
              prevLabel={prevLabel}
              hint="Volte che qualcuno ha messo un locale nei Salvati."
              loading={busy}
            />
          </div>

          {/* ─── LUOGO E DISPOSITIVO ─── */}
          <SectionTitle hint="Dal numero IP, quindi la città è approssimativa.">Da dove si collegano</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }} className="md:!grid-cols-3">
            <div style={card}>
              <CardTitle title="Città" hint="Persone" />
              <RankList rows={data?.cities} valueKey="visitors" total={cur.visitors} format={(r) => CITY_IT[r.label] || r.label} />
            </div>
            <div style={card}>
              <CardTitle title="Paesi" hint="Persone" />
              <RankList rows={data?.countries} valueKey="visitors" total={cur.visitors} format={(r) => `${countryFlag(r.label)} ${countryName(r.label)}`} />
            </div>
            <div style={card}>
              <CardTitle title="Dispositivo" hint="Persone" />
              <RankList rows={data?.devices} valueKey="visitors" total={totalDeviceVisitors} format={(r) => DEVICE_LABEL[r.label] || r.label} />
            </div>
          </div>

          {/* ─── COME SI CONTA ─── */}
          <div style={{ ...card, background: 'var(--color-cream-deep, #F1EBE0)', border: 'none', fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.55 }}>
            <b>Come si contano questi numeri.</b> Li raccoglie il sito stesso a ogni pagina aperta, senza
            servizi esterni; le pagine dell'admin sono escluse. <b>Persone</b> = browser diversi: la stessa
            persona su telefono e computer conta due, e chi cancella i dati del browser ricomincia da capo.
            Fino al 23/09 il sito non distingueva le persone dalle visite, quindi per i giorni prima i due
            numeri coincidono. Orari e giorni sono in ora italiana.
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
