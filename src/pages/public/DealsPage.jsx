import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useActiveDiscounts, useMyDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import Footer from '../../components/Layout/Footer'

function slugify(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const pad = (n) => String(n).padStart(2, '0')

const sectionLabel = {
  fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
  color: 'var(--color-secondary)', marginLeft: 4,
}

/* ── Countdown hook ── */
function useCountdown(targetDate) {
  const calc = useCallback(() => {
    if (!targetDate) return null
    const diff = new Date(targetDate).getTime() - Date.now()
    if (diff <= 0) return null
    return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) }
  }, [targetDate])
  const [time, setTime] = useState(calc)
  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDate, calc])
  return time
}

/* ── Photo helper ── */
function getPhoto(restaurant) {
  const p = restaurant?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
  return p?.photo_url || null
}

/* ── LiveDropCard — drop attivo con bordo accent ── */
function LiveDropCard({ deal, onNavigate }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const claimed = deal.claimed_count || deal.total_redeemed || 0
  const max = deal.max_quantity || deal.max_redemptions || 10
  const remaining = max - claimed
  const soldOut = remaining <= 0
  const time = useCountdown(deal.drop_ends_at || deal.valid_until)

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      border: soldOut ? '2px solid var(--color-bordo)' : '2px solid var(--color-accent)',
      background: '#fff',
      opacity: soldOut ? 0.6 : 1,
    }}>
      {/* Photo */}
      <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
        {photo ? (
          <img src={photo} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: soldOut ? 'grayscale(1)' : 'none' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #F0EBE3, #e0d8cc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>🍽️</div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />

        {/* LIVE badge */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--color-accent)', padding: '5px 12px', borderRadius: 10,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'cityPulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>Live</span>
        </div>

        {/* Countdown badge */}
        {time && !soldOut && (
          <div style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            padding: '5px 12px', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700,
          }}>
            Scade tra {time.h}h {pad(time.m)}m
          </div>
        )}

        {/* Name */}
        <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
          <h3 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 22, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{r?.name}</h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{r?.cuisine_type} · {r?.city}</p>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)' }}>{deal.discount_value}</span>
            <span style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>{deal.title}</span>
          </div>
          {deal.conditions && <span style={{ fontSize: 11, color: 'var(--color-secondary)' }}>{deal.conditions}</span>}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between" style={{ marginBottom: 6, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{claimed} di {max} presi</span>
          {remaining > 0 && remaining <= 5 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)' }}>Solo {remaining} rimast{remaining === 1 ? 'o' : 'i'}!</span>
          )}
          {soldOut && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-secondary)' }}>Esaurito</span>}
        </div>
        <div style={{ height: 6, background: 'var(--color-bordo)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${Math.min(100, (claimed / max) * 100)}%`,
            background: soldOut ? 'var(--color-secondary)' : 'linear-gradient(90deg, var(--color-accent), #ff6b6b)',
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* CTA */}
        {!soldOut && (
          <button onClick={() => onNavigate(r)} style={{
            width: '100%', marginTop: 14, padding: '14px 0', borderRadius: 14,
            background: 'var(--color-accent)', color: '#fff',
            fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
          }}>
            Prendi lo sconto
          </button>
        )}
      </div>
    </div>
  )
}

/* ── UpcomingDropCard — card scura con countdown grande ── */
function UpcomingDropCard({ deal, reminded, onRemind }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const time = useCountdown(deal.drop_starts_at || deal.drop_time)
  const max = deal.max_quantity || deal.max_redemptions || '?'

  const dropDate = deal.drop_starts_at || deal.drop_time
  const dropLabel = dropDate ? (() => {
    const d = new Date(dropDate)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isToday = d.toDateString() === now.toDateString()
    const isTomorrow = d.toDateString() === tomorrow.toDateString()
    const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Oggi alle ${timeStr}`
    if (isTomorrow) return `Domani alle ${timeStr}`
    return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${timeStr}`
  })() : null

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'var(--color-primary)',
    }}>
      {/* Photo */}
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        {photo && <img src={photo} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, var(--color-primary), transparent)' }} />

        {/* Drop date badge */}
        {dropLabel && (
          <div style={{
            position: 'absolute', top: 14, left: 14,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
            padding: '5px 12px', borderRadius: 10,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-oro)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{dropLabel}</span>
          </div>
        )}

        {/* Discount badge */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: '#fff', color: 'var(--color-primary)',
          fontSize: 13, fontWeight: 800, padding: '5px 14px', borderRadius: 10,
        }}>
          {deal.discount_value}
        </div>

        {/* Name */}
        <div style={{ position: 'absolute', bottom: 12, left: 16 }}>
          <h3 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{r?.name}</h3>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{r?.cuisine_type} · {r?.city}</p>
        </div>
      </div>

      {/* Countdown */}
      {time && (
        <div style={{ padding: '16px 16px 8px', textAlign: 'center' }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--color-oro)', marginBottom: 10 }}>
            Drop disponibile tra
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[{ v: pad(time.h), l: 'ore' }, { v: pad(time.m), l: 'min' }, { v: pad(time.s), l: 'sec' }].map((seg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 56, padding: '10px 0', background: 'rgba(196,162,101,0.08)', borderRadius: 14, textAlign: 'center' }}>
                  <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>{seg.v}</span>
                  <p style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-secondary)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{seg.l}</p>
                </div>
                {i < 2 && <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.15)', marginTop: -10 }}>:</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info + Ricordamelo */}
      <div style={{ padding: '8px 16px 16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{deal.title || deal.discount_value}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Solo {max} disponibili</span>
        </div>
        <button onClick={onRemind} style={{
          width: '100%', padding: '12px 0', borderRadius: 14,
          background: reminded ? 'rgba(196,162,101,0.25)' : 'rgba(196,162,101,0.12)',
          border: '1px solid rgba(196,162,101,0.2)', color: 'var(--color-oro)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {reminded ? 'Promemoria attivo' : 'Ricordamelo'}
        </button>
      </div>
    </div>
  )
}

/* ── FeaturedCard — in evidenza ── */
function FeaturedCard({ deal, onNavigate }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  return (
    <div onClick={() => onNavigate(r)} style={{ borderRadius: 20, overflow: 'hidden', background: '#fff', border: '1px solid var(--color-bordo)', cursor: 'pointer' }}>
      <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
        {photo ? (
          <img src={photo} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>🍽️</div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />

        <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-oro)', padding: '5px 12px', borderRadius: 10 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>In evidenza</span>
        </div>

        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: 'linear-gradient(135deg, #a3e635, #4ade80)', color: '#1a2e05',
          fontSize: 13, fontWeight: 800, padding: '5px 14px', borderRadius: 10,
        }}>
          {deal.discount_value}
        </div>

        <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
          <h3 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{r?.name}</h3>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{r?.cuisine_type} · {r?.price_range ? '€'.repeat(r.price_range) : ''}</p>
        </div>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{deal.title || deal.discount_value}</p>
        {deal.conditions && <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>{deal.conditions}</p>}
      </div>
    </div>
  )
}

/* ── DealCard — sconto normale ── */
function DealCard({ deal, onNavigate }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const remaining = deal.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const almostGone = remaining !== null && remaining > 0 && remaining <= 3

  return (
    <div onClick={() => !soldOut && onNavigate(r)} style={{
      borderRadius: 20, overflow: 'hidden', background: '#fff',
      border: '1px solid var(--color-bordo)', cursor: soldOut ? 'default' : 'pointer',
      opacity: soldOut ? 0.6 : 1,
    }}>
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        {photo ? (
          <img src={photo} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: soldOut ? 'grayscale(1)' : 'none' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🍽️</div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)' }} />

        {almostGone && !soldOut && (
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', padding: '5px 10px', borderRadius: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', animation: 'cityPulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Ultimi {remaining}</span>
          </div>
        )}

        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: soldOut ? 'rgba(0,0,0,0.4)' : 'linear-gradient(135deg, #a3e635, #4ade80)',
          color: soldOut ? '#ccc' : '#1a2e05', fontSize: 13, fontWeight: 800,
          padding: '5px 14px', borderRadius: 10, textDecoration: soldOut ? 'line-through' : 'none',
        }}>
          {deal.discount_value}
        </div>

        <div style={{ position: 'absolute', bottom: 12, left: 16 }}>
          <h3 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{r?.name}</h3>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{r?.cuisine_type} · {r?.city}</p>
        </div>
      </div>
      <div style={{ padding: '10px 16px 12px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{deal.title}</p>
        {deal.conditions && <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 2 }}>{deal.conditions}</p>}
        {deal.max_redemptions && (
          <div style={{ marginTop: 8 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--color-secondary)' }}>{deal.total_redeemed || 0}/{deal.max_redemptions}</span>
              {soldOut && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-secondary)' }}>Esaurito</span>}
            </div>
            <div style={{ height: 4, background: 'var(--color-bordo)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${(deal.total_redeemed || 0) / deal.max_redemptions * 100}%`, background: soldOut ? 'var(--color-secondary)' : 'linear-gradient(90deg, #a3e635, #4ade80)', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── MyActiveCard — sconto attivo dell'utente ── */
function MyActiveCard({ redemption, onNavigate }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  const photo = getPhoto(r)
  const isDrop = deal?.is_drop

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: '1.5px solid var(--color-success)', background: '#fff' }}>
      <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
        {photo ? (
          <img src={photo} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🍽️</div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />

        {isDrop && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: 'var(--color-accent)', padding: '4px 10px', borderRadius: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Drop</span>
          </div>
        )}

        <div style={{ position: 'absolute', top: 14, right: 14, background: '#fff', padding: '4px 12px', borderRadius: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)' }}>{deal?.discount_value}</span>
        </div>

        <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
          <h3 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 20, fontWeight: 600, color: '#fff' }}>{r?.name}</h3>
        </div>
      </div>

      <div style={{ padding: '12px 16px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{deal?.title || deal?.discount_value}</p>
        <button onClick={() => onNavigate(r)} style={{
          width: '100%', marginTop: 12, padding: '14px 0', borderRadius: 14,
          background: 'var(--color-accent)', color: '#fff',
          fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
        }}>
          Mostra QR al ristorante
        </button>
      </div>
    </div>
  )
}

/* ── MyUsedCard — sconto utilizzato ── */
function MyUsedCard({ redemption }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  const photo = getPhoto(r)
  const usedDate = redemption.redeemed_at
    ? new Date(redemption.redeemed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
    : null

  return (
    <div className="flex items-center" style={{
      borderRadius: 20, padding: 14, gap: 14,
      background: '#fff', border: '1px solid var(--color-bordo)',
      opacity: 0.55,
    }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
        {photo ? (
          <img src={photo} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.4)' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍽️</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>{r?.name}</h4>
        <p style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'line-through', marginTop: 2 }}>{deal?.discount_value} {deal?.title ? `— ${deal.title}` : ''}</p>
        {usedDate && (
          <div className="flex items-center gap-1" style={{ marginTop: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>Utilizzato il {usedDate}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DealsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeDrops, upcomingDrops, featured, regular, loading } = useActiveDiscounts()
  const { active: myActive, used: myUsed, loading: myLoading } = useMyDiscounts(user?.id)
  const [tab, setTab] = useState('available')
  const [reminders, setReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('drop_reminders') || '[]') } catch { return [] }
  })

  const goTo = (r) => navigate(`/restaurant/${r?.slug || slugify(r?.name || '')}`)

  const toggleReminder = (dropId) => {
    const next = reminders.includes(dropId) ? reminders.filter(id => id !== dropId) : [...reminders, dropId]
    setReminders(next)
    localStorage.setItem('drop_reminders', JSON.stringify(next))
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 14px',
        background: 'rgba(250,247,242,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: 'var(--color-secondary)', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>by Chiamami Bi</span>
          </Link>
          <button className="flex items-center gap-1.5" style={{
            fontSize: 12, color: '#555', fontWeight: 600, padding: '6px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-bordo)',
          }}>
            <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-success)' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--color-success)', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            Torino
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex" style={{ background: '#fff', borderRadius: 12, padding: 4, border: '1.5px solid var(--color-bordo)' }}>
          {[{ key: 'available', label: 'Disponibili' }, { key: 'mine', label: 'I miei' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, textAlign: 'center', padding: 10, borderRadius: 10,
              fontSize: 13, fontWeight: tab === t.key ? 700 : 600,
              background: tab === t.key ? 'var(--color-primary)' : 'transparent',
              color: tab === t.key ? 'var(--color-bg)' : 'var(--color-secondary)',
              border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-4" style={{ paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        {tab === 'available' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {loading && [200, 160, 160].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h, borderRadius: 20, background: '#fff', border: '1px solid var(--color-bordo)' }} />
            ))}

            {!loading && (
              <>
                {/* DROP ATTIVI */}
                {activeDrops.length > 0 && (
                  <div>
                    <p style={sectionLabel}>Drop attivi</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                      {activeDrops.map(deal => <LiveDropCard key={deal.id} deal={deal} onNavigate={goTo} />)}
                    </div>
                  </div>
                )}

                {/* PROSSIMO DROP */}
                {upcomingDrops.length > 0 && (
                  <div>
                    <p style={sectionLabel}>Prossimo drop</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                      {upcomingDrops.map(deal => (
                        <UpcomingDropCard key={deal.id} deal={deal} reminded={reminders.includes(deal.id)} onRemind={() => toggleReminder(deal.id)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* IN EVIDENZA */}
                {featured.length > 0 && (
                  <div>
                    <p style={sectionLabel}>In evidenza</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                      {featured.map(deal => <FeaturedCard key={deal.id} deal={deal} onNavigate={goTo} />)}
                    </div>
                  </div>
                )}

                {/* TUTTI GLI SCONTI */}
                {regular.length > 0 && (
                  <div>
                    <p style={sectionLabel}>Tutti gli sconti</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                      {regular.map(deal => <DealCard key={deal.id} deal={deal} onNavigate={goTo} />)}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {activeDrops.length === 0 && upcomingDrops.length === 0 && featured.length === 0 && regular.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(163,230,53,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>🏷️</div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' }}>Nessuno sconto attivo</p>
                    <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 4 }}>Torna presto!</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'mine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {!user ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(232,69,60,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>🔐</div>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' }}>Accedi per vedere i tuoi sconti</p>
                <Link to="/login" style={{ marginTop: 20, borderRadius: 14, background: 'var(--color-accent)', color: '#fff', padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Accedi</Link>
              </div>
            ) : (
              <>
                {/* ATTIVI */}
                <div>
                  <div className="flex items-center gap-2">
                    <p style={sectionLabel}>Attivi</p>
                    {myActive.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--color-success)', borderRadius: 10, padding: '2px 8px' }}>{myActive.length}</span>
                    )}
                  </div>
                  {myActive.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 8 }}>Nessuno sconto attivo</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                    {myActive.map(r => <MyActiveCard key={r.id} redemption={r} onNavigate={goTo} />)}
                  </div>
                </div>

                {/* UTILIZZATI */}
                <div>
                  <div className="flex items-center gap-2">
                    <p style={sectionLabel}>Utilizzati</p>
                    {myUsed.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-secondary)', background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: '2px 8px' }}>{myUsed.length}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {myUsed.map(r => <MyUsedCard key={r.id} redemption={r} />)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
