import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { DISCOUNT_OPTIONS, LIKED_OPTIONS, RETURN_OPTIONS } from '../../lib/redemptionFeedback'
import BiCharacter from '../Feedback/BiCharacter'
import './VerifyReviews.css'

/**
 * Le recensioni del locale nell'area ristoratori (/verify), 29/09.
 *
 * Arrivano dal feedback dopo la convalida (src/components/Feedback): stelle,
 * cosa è piaciuto o no, com'è andato lo sconto, se ci tornerebbero, e il
 * messaggio. Le legge l'RPC `verify_feedback_list` col device token, che
 * restituisce solo le righe del locale (supabase/verify-feedback-list-2026-09-29.sql).
 * Del cliente arriva solo il nome di battesimo, e chi scrive lo sa: la
 * schermata delle stelle dice che le vede anche il locale.
 *
 * Due pezzi: `ReviewsTeaser` in dashboard (media, quante, l'ultimo
 * messaggio) e `VerifyReviews`, la scheda intera.
 */

const LIKED = Object.fromEntries(LIKED_OPTIONS.map((o) => [o.key, o]))
const SCONTO = Object.fromEntries(DISCOUNT_OPTIONS.map((o) => [o.key, o.label]))
const TORNARE = Object.fromEntries(RETURN_OPTIONS.map((o) => [o.key, o.label]))
const AVATAR_TONES = ['#E8453C', '#B08954', '#2C7A4A', '#4E6BD8', '#C2552A', '#8A5A9E']

function useVerifyFeedback(restaurantId, deviceToken, onSessionExpired) {
  const enabled = !!restaurantId && !!deviceToken && isSupabaseConfigured()
  const [state, setState] = useState({ loading: enabled, summary: null, items: [], error: null })
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    supabase
      .rpc('verify_feedback_list', { p_restaurant_id: restaurantId, p_device_token: deviceToken, p_limit: 100 })
      .then(({ data, error }) => {
        if (cancelled) return
        if (data?.error === 'unauthorized') { onSessionExpired?.(); return }
        setState({
          loading: false,
          summary: data?.summary || null,
          items: Array.isArray(data?.items) ? data.items : [],
          error: error ? error.message : null,
        })
      })
    return () => { cancelled = true }
  }, [enabled, restaurantId, deviceToken, onSessionExpired])
  return state
}

const fmtAvg = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))

function when(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 60) return min <= 1 ? 'adesso' : `${min} min fa`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h fa`
  const d = Math.round(h / 24)
  if (d === 1) return 'ieri'
  if (d < 7) return `${d} giorni fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

/** Stelle che si riempiono anche a metà (4,6 → quattro e un pezzo). */
export function StarsFill({ value = 0, size = 18 }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100))
  return (
    <span className="vr-stars" style={{ fontSize: size }} aria-label={`${fmtAvg(value)} su 5`}>
      <span className="vr-stars-off" aria-hidden="true">★★★★★</span>
      <span className="vr-stars-on" style={{ width: `${pct}%` }} aria-hidden="true">★★★★★</span>
    </span>
  )
}

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : null
}

/* ── Dashboard: il riquadro che porta alle recensioni ─────────────────── */

export function ReviewsTeaser({ restaurant, deviceToken, onSessionExpired, onOpen }) {
  const { loading, summary, items } = useVerifyFeedback(restaurant?.id, deviceToken, onSessionExpired)
  if (loading) return null
  const count = summary?.count || 0
  const last = items.find((i) => i.comment)
  return (
    <button type="button" className={`vr-teaser ${count ? '' : 'is-empty'}`} onClick={onOpen}>
      {count ? (
        <>
          <span className="vr-teaser-avg">
            <span className="n">{fmtAvg(summary.avg)}</span>
            <StarsFill value={summary.avg} size={13} />
          </span>
          <span className="vr-teaser-body">
            <span className="t">{count === 1 ? '1 recensione' : `${count} recensioni`} dai clienti Bi</span>
            {last
              ? <span className="q">“{last.comment}”</span>
              : <span className="q">Tocca per vedere cosa è piaciuto.</span>}
          </span>
        </>
      ) : (
        <span className="vr-teaser-body">
          <span className="t">Recensioni dei clienti Bi</span>
          <span className="q">Arrivano qui dopo ogni sconto che convalidi.</span>
        </span>
      )}
      <span className="vr-teaser-arr" aria-hidden="true">›</span>
    </button>
  )
}

/* ── La scheda intera ─────────────────────────────────────────────────── */

const FILTERS = [
  { key: 'all', label: 'Tutte' },
  { key: 'comment', label: 'Con messaggio' },
  { key: 'low', label: '1–2 stelle' },
]

export default function VerifyReviews({ restaurant, deviceToken, onSessionExpired }) {
  const { loading, summary, items, error } = useVerifyFeedback(restaurant?.id, deviceToken, onSessionExpired)
  const [filter, setFilter] = useState('all')
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    if (loading) return undefined
    const t = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(t)
  }, [loading])

  const shown = useMemo(() => items.filter((r) => {
    if (filter === 'comment') return !!r.comment
    if (filter === 'low') return r.rating <= 2
    return true
  }), [items, filter])

  if (loading) {
    return <div className="vr-loading"><span className="vr-spin" />Carico le recensioni…</div>
  }
  if (error) {
    return <div className="vr-error">Non riesco a caricare le recensioni. Riprova tra poco.</div>
  }

  const count = summary?.count || 0
  if (!count) {
    return (
      <div className="vr-empty">
        <div className="vr-empty-bi"><BiCharacter mood="ok" food={false} /></div>
        <h3>Ancora nessuna recensione</h3>
        <p>
          Dopo ogni sconto che convalidi, chiedo al cliente com’è andata: stelle,
          cosa gli è piaciuto e due righe. Le trovi qui.
        </p>
      </div>
    )
  }

  const dist = summary.dist || {}
  const maxDist = Math.max(1, ...[1, 2, 3, 4, 5].map((s) => dist[s] || 0))
  const tornare = summary.tornare || {}
  const tornareTot = (tornare.si || 0) + (tornare.forse || 0) + (tornare.no || 0)
  const sconto = summary.sconto || {}
  const scontoTot = (sconto.liscio || 0) + (sconto.intoppo || 0) + (sconto.problema || 0)
  const good = Object.entries(summary.liked_good || {}).sort((a, b) => b[1] - a[1])
  const bad = Object.entries(summary.liked_bad || {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="vr">
      {/* Media e distribuzione */}
      <section className="vr-hero">
        <div className="vr-hero-avg">
          <div className="n">{fmtAvg(summary.avg)}</div>
          <StarsFill value={summary.avg} size={20} />
          <div className="c">{count === 1 ? '1 recensione' : `${count} recensioni`}</div>
        </div>
        <div className="vr-hero-dist">
          {[5, 4, 3, 2, 1].map((s, i) => (
            <div className="vr-dist-row" key={s}>
              <span className="s">{s}★</span>
              <span className="bar">
                <span
                  className="fill"
                  style={{ width: grown ? `${((dist[s] || 0) / maxDist) * 100}%` : 0, transitionDelay: `${i * 60}ms` }}
                />
              </span>
              <span className="k">{dist[s] || 0}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Due numeri che contano */}
      <div className="vr-tiles">
        <div className="vr-tile">
          <div className="n">{pct(tornare.si || 0, tornareTot) ?? '—'}{tornareTot ? '%' : ''}</div>
          <div className="l">ci tornerebbe</div>
          {tornareTot > 0 && <div className="m">su {tornareTot} {tornareTot === 1 ? 'risposta' : 'risposte'}</div>}
        </div>
        <div className="vr-tile">
          <div className="n">{pct(sconto.liscio || 0, scontoTot) ?? '—'}{scontoTot ? '%' : ''}</div>
          <div className="l">sconto senza intoppi</div>
          {scontoTot > 0 && <div className="m">su {scontoTot} {scontoTot === 1 ? 'risposta' : 'risposte'}</div>}
        </div>
      </div>

      {good.length > 0 && (
        <section className="vr-block">
          <div className="vr-lbl">Cosa piace di più</div>
          <div className="vr-chips">
            {good.map(([k, n]) => (
              <span className="vr-chip good" key={k}>
                <span aria-hidden="true">{LIKED[k]?.emoji}</span> {LIKED[k]?.label || k} <b>{n}</b>
              </span>
            ))}
          </div>
        </section>
      )}
      {bad.length > 0 && (
        <section className="vr-block">
          <div className="vr-lbl">Da migliorare</div>
          <div className="vr-chips">
            {bad.map(([k, n]) => (
              <span className="vr-chip bad" key={k}>
                <span aria-hidden="true">{LIKED[k]?.emoji}</span> {LIKED[k]?.label || k} <b>{n}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="vr-filter" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={filter === f.key ? 'on' : ''}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="vr-list">
        {shown.length === 0 && <div className="vr-none">Niente qui, per ora.</div>}
        {shown.map((r, i) => (
          <ReviewCard key={`${r.redeemed_at}-${i}`} review={r} index={i} />
        ))}
      </div>

      <p className="vr-foot">
        Le lasciano i clienti Bi dopo che hai convalidato il loro sconto. Del cliente vedi solo il nome di battesimo.
      </p>
    </div>
  )
}

function ReviewCard({ review, index }) {
  const a = review.answers || {}
  const low = review.rating <= 2
  const name = review.first_name || 'Cliente Bi'
  const tone = AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length]
  return (
    <article className={`vr-card ${low ? 'is-low' : ''}`} style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <header className="vr-card-head">
        <span className="vr-av" style={{ background: tone }} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span className="vr-card-who">
          <span className="nm">{name}</span>
          <span className="tm">{when(review.redeemed_at)}{review.discount_title ? ` · ${review.discount_title}` : ''}</span>
        </span>
        <StarsFill value={review.rating} size={15} />
      </header>
      {review.comment && <p className="vr-card-text">{review.comment}</p>}
      {(a.liked?.length || a.sconto || a.tornare) && (
        <div className="vr-card-tags">
          {(a.liked || []).map((k) => (
            <span key={k} className={`vr-tag ${low ? 'bad' : 'good'}`}>{low ? '✗' : '✓'} {LIKED[k]?.label || k}</span>
          ))}
          {a.tornare && <span className={`vr-tag ${a.tornare === 'si' ? 'good' : a.tornare === 'no' ? 'bad' : ''}`}>Ci torna: {TORNARE[a.tornare] || a.tornare}</span>}
          {a.sconto && <span className={`vr-tag ${a.sconto === 'liscio' ? '' : 'warn'}`}>Sconto: {SCONTO[a.sconto] || a.sconto}</span>}
        </div>
      )}
    </article>
  )
}
