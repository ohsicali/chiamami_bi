import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import FGroup from './_FGroup'

/**
 * ScontoTab — read-only panel showing the active discount for the restaurant.
 * Create / edit flow lives in /admin/discounts (full-page manager).
 * This tab is the "quick glance" from inside the drawer.
 *
 * Vincolo: gli sconti richiedono PIN attivo. Se il PIN non c'è, la tab
 * mostra un blocker che rimanda alle Credenziali.
 */
export default function ScontoTab({ form, restaurantId }) {
  const [loading, setLoading] = useState(true)
  const [discount, setDiscount] = useState(null)
  const [stats, setStats] = useState({ redeemed: 0, total: 0 })

  const pinActive = !!form?.verify_pin

  useEffect(() => {
    if (!restaurantId || !isSupabaseConfigured()) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('discounts')
        .select('id, title, description, conditions, discount_value, discount_type, drop_time, valid_from, valid_until, is_active, max_redemptions, total_redeemed')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .gt('valid_until', nowIso)
        .order('drop_time', { ascending: false, nullsFirst: false })
        .limit(1)
      if (cancelled) return
      const d = data?.[0] || null
      setDiscount(d)
      if (d) {
        setStats({
          redeemed: d.total_redeemed || 0,
          total: d.max_redemptions || 0,
        })
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  if (loading) {
    return <FGroup title="Sconto"><div style={{ color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 13 }}>Carico…</div></FGroup>
  }

  // ── Blocker: gli sconti richiedono PIN attivo ──
  if (!pinActive) {
    return (
      <FGroup title="Sconto per i lettori di Bi" count="bloccato">
        <div
          style={{
            background: 'var(--color-cream, #F5F0E4)',
            border: '1px dashed var(--color-line, #EAE3D7)',
            borderRadius: 14,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }} aria-hidden>🔒</div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 16,
              color: 'var(--color-ink)',
              marginBottom: 6,
            }}
          >
            Attiva prima il PIN partner
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              lineHeight: 1.5,
              maxWidth: 460,
              margin: '0 auto 18px',
            }}
          >
            Per creare uno sconto serve che il locale possa convalidare le redenzioni
            dall'area <code>/verify</code>. Vai nelle <b>Credenziali</b> e attiva il PIN —
            poi torni qui per creare lo sconto.
          </div>
          <a
            href="#sec-credenziali"
            onClick={(e) => {
              const el = document.getElementById('sec-credenziali')
              if (el) {
                e.preventDefault()
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
            style={{
              display: 'inline-block',
              background: 'var(--color-corallo, #E8453C)',
              color: '#fff',
              textDecoration: 'none',
              padding: '11px 20px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            🔑 Vai alle Credenziali
          </a>
        </div>
      </FGroup>
    )
  }

  if (!discount) {
    return (
      <FGroup title="Sconto per i lettori di Bi">
        <div
          style={{
            background: 'var(--color-cream, #F5F0E4)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden>🎟</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-ink)' }}>
            Nessuno sconto attivo
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', margin: '6px 0 14px' }}>
            Lo sconto è la leva più forte per far sì che un lettore di Bi scelga questo locale.
          </div>
          <Link
            to={`/admin/discounts?restaurant=${restaurantId}`}
            style={{
              display: 'inline-block',
              background: 'var(--color-corallo, #E8453C)',
              color: '#fff',
              textDecoration: 'none',
              padding: '10px 18px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            + Crea uno sconto
          </Link>
        </div>
      </FGroup>
    )
  }

  const isDrop = discount.drop_time != null
  const pct = stats.total ? Math.min(100, Math.round((stats.redeemed / stats.total) * 100)) : null

  return (
    <>
      <FGroup title="Sconto attivo">
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-green-a, #A3E635), var(--color-green-b, #4ADE80))',
            borderRadius: 14,
            padding: 18,
            color: '#0f2c12',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em' }}>
              {discount.discount_value}
            </div>
            {isDrop && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  background: 'var(--color-corallo, #E8453C)',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: 999,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                🔥 Drop
              </span>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{discount.title}</div>
          {discount.description && (
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, lineHeight: 1.5 }}>
              {discount.description}
            </div>
          )}
          {discount.conditions && (
            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.75, fontStyle: 'italic' }}>
              {discount.conditions}
            </div>
          )}
        </div>
      </FGroup>

      {pct !== null && (
        <FGroup title="Performance">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
                {stats.redeemed}
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', marginLeft: 8 }}>
                  / {stats.total}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-55, rgba(34,24,28,0.55))', marginTop: 2 }}>
                Redenzioni
              </div>
            </div>
            <div style={{ flex: 2 }}>
              <div
                style={{
                  height: 10,
                  background: 'var(--color-cream, #F5F0E4)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: 'linear-gradient(135deg, var(--color-green-a, #A3E635), var(--color-green-b, #4ADE80))',
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', marginTop: 6 }}>
                {pct}% di raggiungimento target
              </div>
            </div>
          </div>
        </FGroup>
      )}

      <FGroup title="Edita, pausa, chiudi">
        <Link
          to="/admin/discounts"
          style={{
            display: 'inline-block',
            background: 'var(--color-ink, #22181C)',
            color: '#fff',
            textDecoration: 'none',
            padding: '10px 18px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Apri gestione sconti & drop →
        </Link>
      </FGroup>
    </>
  )
}
