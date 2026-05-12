import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/*
 * PrettyDatePicker
 * ------------------
 * Date / datetime picker leggero, in stile guida.
 *
 * Props:
 *   value     stringa formato 'YYYY-MM-DD' (date) o 'YYYY-MM-DDTHH:MM' (datetime)
 *   onChange  (next) => void — riceve la stringa nello stesso formato
 *   withTime  true → include ora+minuti
 *   minDate   stringa 'YYYY-MM-DD' opzionale
 *   placeholder testo quando vuoto
 *   accent    colore evidenziazione (default corallo)
 */

const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const DOW_IT = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const MONTHS_SHORT_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const pad = (n) => String(n).padStart(2, '0')

function parseValue(value, withTime) {
  if (!value) return { date: null, hour: 19, minute: 0 }
  if (withTime) {
    const [d, t] = value.split('T')
    const [y, mo, da] = (d || '').split('-').map(Number)
    const [h, mi] = (t || '19:00').split(':').map(Number)
    if (!y) return { date: null, hour: 19, minute: 0 }
    return { date: new Date(y, mo - 1, da), hour: h || 0, minute: mi || 0 }
  }
  const [y, mo, da] = value.split('-').map(Number)
  if (!y) return { date: null, hour: 0, minute: 0 }
  return { date: new Date(y, mo - 1, da), hour: 0, minute: 0 }
}

function formatValue(date, hour, minute, withTime) {
  if (!date) return ''
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return withTime ? `${ymd}T${pad(hour)}:${pad(minute)}` : ymd
}

function formatDisplay(date, hour, minute, withTime) {
  if (!date) return ''
  const base = `${date.getDate()} ${MONTHS_SHORT_IT[date.getMonth()]} ${date.getFullYear()}`
  return withTime ? `${base}, ${pad(hour)}:${pad(minute)}` : base
}

function buildMonthGrid(year, month) {
  // Lunedì-first
  const first = new Date(year, month, 1)
  const firstWeekday = (first.getDay() + 6) % 7 // 0 = Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export default function PrettyDatePicker({
  value,
  onChange,
  withTime = false,
  minDate,
  placeholder = 'Seleziona…',
  accent = '#E8453C',
}) {
  const parsed = parseValue(value, withTime)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const base = parsed.date || new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const [pos, setPos] = useState(() => ({
    top: 0,
    left: 0,
    mobile: typeof window !== 'undefined' && window.innerWidth < 520,
  }))

  // Calcola la posizione del popover ogni volta che si apre (e ad ogni resize).
  useLayoutEffect(() => {
    if (!open) return
    const recompute = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const mobile = vw < 520
      if (mobile) {
        setPos({ mobile: true, top: 0, left: 0 })
        return
      }
      const popoverWidth = 296
      const popoverHeight = withTime ? 380 : 320
      const gap = 6
      // Prefer below; flip above if not enough space.
      let top = rect.bottom + gap
      if (top + popoverHeight > vh - 8 && rect.top - gap - popoverHeight > 8) {
        top = rect.top - gap - popoverHeight
      }
      // Allinea a sinistra del trigger; se sborda a destra, allinea al bordo destro del trigger.
      let left = rect.left
      if (left + popoverWidth > vw - 8) left = Math.max(8, rect.right - popoverWidth)
      setPos({ mobile: false, top, left })
    }
    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [open, withTime])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target)
      const inPopover = popoverRef.current && popoverRef.current.contains(e.target)
      if (!inTrigger && !inPopover) setOpen(false)
    }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick, { passive: true })
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  // Quando value cambia da fuori, riallinea la view al mese del valore.
  useEffect(() => {
    if (parsed.date) {
      setView({ year: parsed.date.getFullYear(), month: parsed.date.getMonth() })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view])
  const minDateObj = useMemo(() => {
    if (!minDate) return null
    const [y, mo, da] = minDate.split('-').map(Number)
    if (!y) return null
    const d = new Date(y, mo - 1, da)
    d.setHours(0, 0, 0, 0)
    return d
  }, [minDate])
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const selectDay = (d) => {
    if (!d) return
    if (minDateObj && d < minDateObj) return
    onChange(formatValue(d, parsed.hour, parsed.minute, withTime))
    if (!withTime) setOpen(false)
  }

  const setHM = (h, m) => {
    const d = parsed.date || new Date()
    onChange(formatValue(d, h, m, withTime))
  }

  const goPrev = () => {
    setView((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  }
  const goNext = () => {
    setView((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })
  }
  const goToday = () => {
    const t = new Date()
    setView({ year: t.getFullYear(), month: t.getMonth() })
    selectDay(t)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: open ? `1px solid ${accent}` : '1px solid #e6e0d3',
          background: '#fff',
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
          color: parsed.date ? 'var(--color-ink)' : '#999',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ fontWeight: parsed.date ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {parsed.date ? formatDisplay(parsed.date, parsed.hour, parsed.minute, withTime) : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#999', flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (pos.mobile ? (
            // Mobile: bottom sheet centrato in basso
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.35)',
                  zIndex: 200,
                  touchAction: 'none',
                }}
              />
              <motion.div
                key="sheet"
                ref={popoverRef}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 201,
                  background: '#fff',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
                  padding: '14px 14px 22px',
                  fontFamily: 'var(--font-sans)',
                  touchAction: 'pan-y',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
              >
                <div style={{ width: 40, height: 4, background: '#e6e0d3', borderRadius: 999, margin: '0 auto 12px' }} />
                <CalendarBody
                  view={view}
                  cells={cells}
                  parsed={parsed}
                  today={today}
                  minDateObj={minDateObj}
                  accent={accent}
                  withTime={withTime}
                  goPrev={goPrev}
                  goNext={goNext}
                  goToday={goToday}
                  selectDay={selectDay}
                  setHM={setHM}
                  closeSheet={() => setOpen(false)}
                />
              </motion.div>
            </>
          ) : (
            <motion.div
              key="popover"
              ref={popoverRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                zIndex: 200,
                width: 296,
                background: '#fff',
                border: '1px solid #eee',
                borderRadius: 14,
                boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
                padding: 14,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <CalendarBody
                view={view}
                cells={cells}
                parsed={parsed}
                today={today}
                minDateObj={minDateObj}
                accent={accent}
                withTime={withTime}
                goPrev={goPrev}
                goNext={goNext}
                goToday={goToday}
                selectDay={selectDay}
                setHM={setHM}
                closeSheet={() => setOpen(false)}
              />
            </motion.div>
          ))}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

function CalendarBody({ view, cells, parsed, today, minDateObj, accent, withTime, goPrev, goNext, goToday, selectDay, setHM, closeSheet }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrev} aria-label="Mese precedente" style={navBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)' }}>
          {MONTHS_IT[view.month]} {view.year}
        </div>
        <button type="button" onClick={goNext} aria-label="Mese successivo" style={navBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DOW_IT.map((d, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#999', textAlign: 'center', padding: '4px 0', letterSpacing: '0.04em' }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const isSel = parsed.date && sameDay(d, parsed.date)
          const isToday = sameDay(d, today)
          const isDisabled = minDateObj && d < minDateObj
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectDay(d)}
              disabled={isDisabled}
              style={{
                aspectRatio: '1 / 1',
                border: 0,
                borderRadius: 9,
                background: isSel ? accent : isToday ? 'var(--color-cream, #F5F0E4)' : 'transparent',
                color: isSel ? '#fff' : isDisabled ? '#d0d0d0' : 'var(--color-ink)',
                fontSize: 14,
                fontWeight: isSel ? 800 : isToday ? 700 : 500,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (!isSel && !isDisabled) e.currentTarget.style.background = '#f6f3ec' }}
              onMouseLeave={(e) => { if (!isSel && !isDisabled) e.currentTarget.style.background = isToday ? 'var(--color-cream, #F5F0E4)' : 'transparent' }}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      {withTime && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f0e8', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ora</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <TimeSpinner value={parsed.hour} onChange={(h) => setHM(h, parsed.minute)} max={23} accent={accent} />
            <span style={{ fontWeight: 800, color: 'var(--color-ink)', fontSize: 14 }}>:</span>
            <TimeSpinner value={parsed.minute} onChange={(m) => setHM(parsed.hour, m)} max={59} step={5} accent={accent} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={goToday}
          style={{ fontSize: 12, fontWeight: 600, background: 'transparent', border: 0, color: accent, cursor: 'pointer', padding: '6px 8px', fontFamily: 'var(--font-sans)' }}
        >
          Oggi
        </button>
        <button
          type="button"
          onClick={closeSheet}
          style={{ fontSize: 12, fontWeight: 700, background: accent, border: 0, color: '#fff', cursor: 'pointer', padding: '7px 14px', borderRadius: 8, fontFamily: 'var(--font-sans)' }}
        >
          {withTime ? 'Conferma' : 'Chiudi'}
        </button>
      </div>
    </>
  )
}

function TimeSpinner({ value, onChange, max, step = 1, accent }) {
  const inc = () => onChange((value + step) > max ? 0 : value + step)
  const dec = () => onChange((value - step) < 0 ? max - ((max + 1) % step) : value - step)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button type="button" onClick={inc} style={spinnerBtn} aria-label="Aumenta">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 15 12 9 18 15"/></svg>
      </button>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 800,
          fontSize: 18,
          color: 'var(--color-ink)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 28,
          textAlign: 'center',
          padding: '2px 0',
        }}
      >
        {pad(value)}
      </div>
      <button type="button" onClick={dec} style={spinnerBtn} aria-label="Diminuisci">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
  )
}

const navBtn = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: 0,
  background: 'var(--color-cream, #F5F0E4)',
  color: 'var(--color-ink)',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
}

const spinnerBtn = {
  width: 22,
  height: 18,
  borderRadius: 5,
  border: 0,
  background: 'transparent',
  color: '#888',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
}
