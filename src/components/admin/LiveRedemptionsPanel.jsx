import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDiscountBadge } from '../../lib/utils/discountFormat'

/**
 * LiveRedemptionsPanel — feed "In diretta" degli sconti presi e utilizzati.
 *
 * Solo presentazione: i dati arrivano da `useAdminRedemptions` (vedi lì
 * perché feed e contatori delle card stanno sulla stessa fonte).
 *
 * Props:
 *   events         → [{ key, kind: 'taken'|'used', at, row }] dal più recente
 *   today          → { taken, used }
 *   status         → 'live' | 'connecting' | 'offline'
 *   loaded         → la prima fotografia è arrivata
 *   freshKeys      → Set di `key` arrivati dal vivo (evidenziati)
 *   now            → timestamp di riferimento per "3 min fa"
 *   discountsById  → { [discount_id]: discount con `restaurant.name` }
 */

const COLLAPSED = 6
// Alias maiuscolo: la config ESLint non conta `<motion.li>` come uso di `motion`.
const MotionLi = motion.li

function relativeTime(iso, now) {
  if (!iso) return ''
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'adesso'
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`
  if (diff < 172800) return 'ieri'
  if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

const STATUS = {
  live: { label: 'In diretta', color: '#2C7A4A' },
  connecting: { label: 'Connessione…', color: '#B08954' },
  offline: { label: 'Non in diretta', color: '#C0392B' },
}

export default function LiveRedemptionsPanel({ events, today, status, loaded, freshKeys, now, discountsById }) {
  const [expanded, setExpanded] = useState(false)
  const st = STATUS[status] || STATUS.connecting
  const shown = expanded ? events : events.slice(0, COLLAPSED)

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        fontFamily: 'var(--font-sans)',
      }}
      aria-label="Sconti presi e utilizzati in tempo reale"
    >
      <style>{`
        @keyframes lr-pulse { 0% { box-shadow: 0 0 0 0 rgba(44,122,74,0.45) } 70% { box-shadow: 0 0 0 8px rgba(44,122,74,0) } 100% { box-shadow: 0 0 0 0 rgba(44,122,74,0) } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: st.color,
              animation: status === 'live' ? 'lr-pulse 1.8s infinite' : 'none',
            }}
          />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: '-0.01em', color: 'var(--color-ink, #22181C)' }}>
            {st.label}
          </h2>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
            sconti presi e utilizzati
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip label="Oggi presi" value={today.taken} />
          <Chip label="Oggi utilizzati" value={today.used} color="#2C7A4A" bg="#E9F8EF" />
        </div>
      </div>

      {!loaded && (
        <div style={{ padding: '14px 4px', fontSize: 13, color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>Carico…</div>
      )}

      {loaded && events.length === 0 && (
        <div style={{ padding: '14px 4px', fontSize: 13, color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
          Ancora nessuno sconto preso. Appena qualcuno ne sblocca uno, compare qui.
        </div>
      )}

      {loaded && events.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: expanded ? 460 : 'none',
            overflowY: expanded ? 'auto' : 'visible',
          }}
        >
          <AnimatePresence initial={false}>
            {shown.map((ev) => (
              <EventRow
                key={ev.key}
                ev={ev}
                fresh={freshKeys.has(ev.key)}
                now={now}
                discount={discountsById[ev.row.discount_id]}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {loaded && events.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 10,
            background: 'none',
            border: 0,
            padding: 0,
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--color-corallo, #E8453C)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {expanded ? 'Mostra meno' : `Mostra gli ultimi ${events.length}`}
        </button>
      )}
    </section>
  )
}

function EventRow({ ev, fresh, now, discount }) {
  const used = ev.kind === 'used'
  const who = ev.row.user_name?.trim() || 'Un utente'
  const place = discount?.restaurant?.name || 'un locale'
  // Qui c'è spazio: "−20%" per i valori, il titolo ("3x2 Veneziane") per il resto.
  const value = discount ? (formatDiscountBadge(discount) || discount.title) : null

  return (
    <MotionLi
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '30px 1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 12,
        background: fresh ? (used ? '#E9F8EF' : 'var(--color-corallo-wash, #FDEDEB)') : 'var(--color-cream, #F5F0E4)',
        transition: 'background 1.2s',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 900,
          background: used ? '#2C7A4A' : '#fff',
          color: used ? '#fff' : 'var(--color-ink, #22181C)',
          border: used ? 0 : '1px solid var(--color-line, #EAE3D7)',
        }}
      >
        {used ? '✓' : '🎟'}
      </span>
      <div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.35, color: 'var(--color-ink, #22181C)' }}>
        {used ? (
          <>
            <b>{place}</b> ha convalidato lo sconto di <b>{who}</b>
          </>
        ) : (
          <>
            <b>{who}</b> ha preso lo sconto di <b>{place}</b>
          </>
        )}
        {value && (
          <span style={{ marginLeft: 6, fontWeight: 900, color: 'var(--color-corallo, #E8453C)' }}>{value}</span>
        )}
      </div>
      <time
        dateTime={ev.at}
        title={ev.at ? new Date(ev.at).toLocaleString('it-IT') : ''}
        style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', whiteSpace: 'nowrap' }}
      >
        {relativeTime(ev.at, now)}
      </time>
    </MotionLi>
  )
}

function Chip({ label, value, color = 'var(--color-ink, #22181C)', bg = 'var(--color-cream, #F5F0E4)' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        padding: '5px 11px',
        borderRadius: 999,
        background: bg,
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
      }}
    >
      {label}
      <b style={{ fontSize: 15, fontWeight: 900, color }}>{value}</b>
    </span>
  )
}
