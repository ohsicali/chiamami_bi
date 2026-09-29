import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase } from '../../lib/supabase'
import { formatDiscountBadge } from '../../lib/utils/discountFormat'
import { DISCOUNT_OPTIONS, LIKED_OPTIONS, RETURN_OPTIONS } from '../../lib/redemptionFeedback'

/**
 * I feedback dopo gli sconti convalidati (29/09): le stelle, le risposte e
 * quello che la gente ha scritto a Bi. Una riga per convalida — anche quelle
 * senza risposta, per sapere quante persone non hanno ancora detto niente.
 * Le righe le crea il DB alla convalida (redemption-feedback-2026-09-29.sql).
 */

const LABEL = Object.fromEntries([...LIKED_OPTIONS, ...DISCOUNT_OPTIONS, ...RETURN_OPTIONS].map((o) => [o.key, o.label]))
const DISCOUNT_LABEL = Object.fromEntries(DISCOUNT_OPTIONS.map((o) => [o.key, o.label]))
const RETURN_LABEL = Object.fromEntries(RETURN_OPTIONS.map((o) => [o.key, o.label]))

const FILTERS = [
  { key: 'all', label: 'Tutti' },
  { key: 'comment', label: 'Con un messaggio' },
  { key: 'low', label: '1–2 stelle' },
  { key: 'problem', label: 'Sconto con problemi' },
  { key: 'none', label: 'Senza risposta' },
]

function Stars({ value, size = 15 }) {
  if (value == null) return <span style={{ color: '#aaa', fontSize: 12 }}>nessun voto</span>
  return (
    <span aria-label={`${value} stelle`} style={{ letterSpacing: 1, fontSize: size, lineHeight: 1 }}>
      <span style={{ color: '#F5B82E' }}>{'★'.repeat(value)}</span>
      <span style={{ color: '#e6ded0' }}>{'★'.repeat(5 - value)}</span>
    </span>
  )
}

function StatCard({ label, value, hint }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-ink)', marginTop: 6 }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: '#999', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function when(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function FeedbackManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (authLoading || !isAdmin) return undefined
    let cancelled = false
    supabase
      .from('redemption_feedback')
      .select('redemption_id, redeemed_at, rating, answers, comment, completed_at, source, profile:profiles(full_name, email), restaurant:restaurants(name, slug), discount:discounts(title, discount_type, discount_value)')
      .order('redeemed_at', { ascending: false })
      .limit(1000)
      .then(({ data, error: err }) => {
        if (cancelled) return
        setError(err ? err.message : '')
        setRows(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [authLoading, isAdmin])

  const stats = useMemo(() => {
    const rated = rows.filter((r) => r.rating != null)
    const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null
    return {
      total: rows.length,
      rated: rated.length,
      avg,
      written: rows.filter((r) => r.comment).length,
      rate: rows.length ? Math.round((rated.length / rows.length) * 100) : 0,
    }
  }, [rows])

  const byPlace = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      if (r.rating == null) continue
      const k = r.restaurant?.name || '—'
      const cur = m.get(k) || { name: k, n: 0, sum: 0, back: 0, problems: 0 }
      cur.n += 1
      cur.sum += r.rating
      if (r.answers?.tornare === 'si') cur.back += 1
      if (r.answers?.sconto && r.answers.sconto !== 'liscio') cur.problems += 1
      m.set(k, cur)
    }
    return [...m.values()].sort((a, b) => b.n - a.n)
  }, [rows])

  const filtered = useMemo(() => rows.filter((r) => {
    if (filter === 'comment') return !!r.comment
    if (filter === 'low') return r.rating != null && r.rating <= 2
    if (filter === 'problem') return r.answers?.sconto && r.answers.sconto !== 'liscio'
    if (filter === 'none') return r.rating == null
    return true
  }), [rows, filter])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Feedback">
      <div style={{ padding: '20px 28px', fontFamily: 'var(--font-sans)', maxWidth: 1100 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>Feedback dopo lo sconto</h1>
          <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
            Cosa dicono le persone dopo che il locale ha convalidato il loro sconto. Chi non risponde nell’app riceve un’email dopo ~30 minuti e una dopo un giorno.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <StatCard label="Sconti convalidati" value={stats.total} hint="da quando c’è il feedback" />
          <StatCard label="Con le stelle" value={stats.rated} hint={`${stats.rate}% risponde`} />
          <StatCard label="Media" value={stats.avg == null ? '—' : `${stats.avg.toFixed(1)} ★`} />
          <StatCard label="Messaggi a Bi" value={stats.written} />
        </div>

        {byPlace.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px', marginBottom: 18, overflowX: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Per locale</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#999', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={{ padding: '6px 8px 6px 0' }}>Locale</th>
                  <th style={{ padding: 6 }}>Voti</th>
                  <th style={{ padding: 6 }}>Media</th>
                  <th style={{ padding: 6 }}>Ci tornerebbero</th>
                  <th style={{ padding: 6 }}>Sconto con intoppi</th>
                </tr>
              </thead>
              <tbody>
                {byPlace.map((p) => (
                  <tr key={p.name} style={{ borderTop: '1px solid #f2f2f2' }}>
                    <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: 6 }}>{p.n}</td>
                    <td style={{ padding: 6 }}><Stars value={Math.round(p.sum / p.n)} size={13} /> <span style={{ color: '#666' }}>{(p.sum / p.n).toFixed(1)}</span></td>
                    <td style={{ padding: 6 }}>{p.back}</td>
                    <td style={{ padding: 6, color: p.problems ? '#b45309' : undefined }}>{p.problems}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: '8px 13px', borderRadius: 10, border: '1px solid',
                borderColor: filter === f.key ? 'var(--color-ink)' : '#e5e5e5',
                background: filter === f.key ? 'var(--color-ink)' : '#fff',
                color: filter === f.key ? '#fff' : 'var(--color-ink)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px', marginBottom: 14, fontSize: 12.5, color: '#dc2626' }}>
            Errore nel caricamento: {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 13 }}>Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 48, textAlign: 'center', fontSize: 13, color: '#999' }}>
            Niente da mostrare qui, per ora.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((r) => {
              const a = r.answers || {}
              const badge = r.discount ? formatDiscountBadge(r.discount) : ''
              return (
                <div key={r.redemption_id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Stars value={r.rating} size={17} />
                    <strong style={{ fontSize: 14 }}>{r.restaurant?.name || '—'}</strong>
                    {badge && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-sconto-ink)', background: 'var(--gradient-sconto)', borderRadius: 6, padding: '1px 6px' }}>{badge}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
                      {r.profile?.full_name || r.profile?.email || 'Utente'} · {when(r.redeemed_at)}
                      {r.source === 'email' ? ' · da email' : ''}
                    </span>
                  </div>
                  {(a.liked?.length || a.sconto || a.tornare) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {(a.liked || []).map((k) => (
                        <span key={k} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 99, background: r.rating != null && r.rating <= 2 ? '#fef2f2' : '#f3f1ec' }}>
                          {r.rating != null && r.rating <= 2 ? '✗ ' : '✓ '}{LABEL[k] || k}
                        </span>
                      ))}
                      {a.sconto && (
                        <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 99, background: a.sconto === 'liscio' ? '#ecfdf5' : '#fef3c7' }}>
                          Sconto: {DISCOUNT_LABEL[a.sconto] || a.sconto}
                        </span>
                      )}
                      {a.tornare && (
                        <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 99, background: '#eef2ff' }}>
                          Ci torna: {RETURN_LABEL[a.tornare] || a.tornare}
                        </span>
                      )}
                    </div>
                  )}
                  {r.comment && (
                    <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-ink)', whiteSpace: 'pre-wrap' }}>
                      “{r.comment}”
                    </p>
                  )}
                  {r.rating != null && !r.completed_at && (
                    <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#999' }}>Solo le stelle: il modulo l’ha saltato.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
