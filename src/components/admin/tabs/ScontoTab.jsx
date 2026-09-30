import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import FGroup from './_FGroup'
import { formatDiscountBadge, formatDiscountBadgeShort } from '../../../lib/utils/discountFormat'
import { formatPublishAt } from '../../../lib/scheduledPublish'

/**
 * ScontoTab — gli sconti del locale (tutti, con lo stato) e il tasto per
 * crearne uno nuovo già intestato a lui (/admin/discounts?new=1&restaurant=).
 * Tocchi una riga e si apre l'editor su quello sconto (?edit=).
 *
 * (Prima: read-only panel showing the active discount for the restaurant.)
 * Create / edit flow lives in /admin/discounts (full-page manager).
 * This tab is the "quick glance" from inside the drawer.
 *
 * Vincolo: gli sconti richiedono PIN attivo. Se il PIN non c'è, la tab
 * mostra un blocker che rimanda alle Credenziali.
 */
export default function ScontoTab({ form, restaurantId }) {
  const [loading, setLoading] = useState(true)
  const [discounts, setDiscounts] = useState([])

  const pinActive = !!form?.verify_pin

  // Tutti gli sconti del locale, non solo il primo attivo: un locale può
  // averne più d'uno insieme (21/09), e da qui si deve vedere quali sono,
  // in che stato, e aprirli.
  useEffect(() => {
    if (!restaurantId || !isSupabaseConfigured()) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('discounts')
        .select('id, title, description, conditions, discount_value, discount_type, is_drop, is_active, is_test, publish_at, valid_from, valid_until, drop_ends_at, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setDiscounts(data || [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  if (loading) {
    return <FGroup title="Sconti"><div style={{ color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 13 }}>Carico…</div></FGroup>
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

  const newHref = `/admin/discounts?new=1&restaurant=${restaurantId}`

  if (discounts.length === 0) {
    return (
      <div className="adm-card adm-card--cream" style={{ textAlign: 'center', padding: 26 }}>
        <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden>🎟</div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Ancora nessuno sconto</div>
        <p className="adm-help" style={{ margin: '6px auto 16px', maxWidth: 380 }}>
          Lo sconto è la leva più forte per far scegliere questo locale a chi legge Bi.
        </p>
        <Link to={newHref} className="adm-btn adm-btn--primary">+ Crea uno sconto</Link>
      </div>
    )
  }

  const now = new Date()
  const live = discounts.filter((d) => discountState(d, now).key === 'live').length

  return (
    <div className="adm-card" style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--adm-muted)' }}>
          {discounts.length === 1 ? '1 sconto' : `${discounts.length} sconti`}
          {live > 0 ? ` · ${live} online` : ''}
        </div>
        <Link to={newHref} className="adm-btn adm-btn--primary adm-btn--sm">+ Nuovo</Link>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {discounts.map((d) => {
          const st = discountState(d, now)
          const badge = formatDiscountBadge(d)
          return (
            <li key={d.id}>
              <Link to={`/admin/discounts?edit=${d.id}`} className="adm-disc-row">
                <span className={`adm-disc-row__badge${d.is_drop ? ' is-drop' : ''}`}>{formatDiscountBadgeShort(d) || '🎟'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{d.title || badge}</b>
                  <small>
                    {d.is_drop ? '🔥 Drop' : 'Convenzione'}
                    {d.valid_until || d.drop_ends_at ? ` · fino al ${new Date(d.drop_ends_at || d.valid_until).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ' · senza scadenza'}
                  </small>
                </span>
                <span className={`adm-pill ${st.cls}`}>{st.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Lo stato di uno sconto detto in una parola, per la lista del locale.
function discountState(d, now) {
  if (d.is_test) return { key: 'test', label: 'Prova', cls: 'adm-pill--test' }
  if (d.publish_at && !d.is_active) return { key: 'scheduled', label: `⏰ ${formatPublishAt(d.publish_at)}`, cls: 'adm-pill--scheduled' }
  const end = d.is_drop ? (d.drop_ends_at || d.valid_until) : d.valid_until
  if (end && new Date(end) <= now) return { key: 'expired', label: 'Scaduto', cls: 'adm-pill--draft' }
  if (!d.is_active) return { key: 'paused', label: 'In pausa', cls: 'adm-pill--warn' }
  return { key: 'live', label: 'Online', cls: 'adm-pill--live' }
}
