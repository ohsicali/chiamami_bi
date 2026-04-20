import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import CityPickerSheet from '../../components/UI/CityPickerSheet'
import { useCity } from '../../lib/CityContext'
import { useActiveDiscounts, useMyDiscounts, useUserRedemption } from '../../lib/hooks/useDiscounts'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import QRCodeDisplay from '../../components/Discount/QRCodeDisplay'
import { useAuth } from '../../lib/hooks/useAuth'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import Footer from '../../components/Layout/Footer'
import SaveButton from '../../components/Restaurant/SaveButton'
import { proxyImg } from '../../lib/supabase'

function slugify(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const pad = (n) => String(n).padStart(2, '0')

const sectionLabel = {
  fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
  color: 'var(--color-secondary)', marginLeft: 4,
}

/* ── Add to calendar (.ics) ── */
function addToCalendar({ title, description, start, url }) {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const startDt = fmt(start)
  // Event lasts 15 minutes (drop window)
  const endDt = fmt(new Date(new Date(start).getTime() + 15 * 60000))
  const uid = `drop-${Date.now()}@chiamamibi.com`
  // Alarm 10 minutes before
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChiamamiBi//Drop//IT',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${startDt}`,
    `DTEND:${endDt}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    url ? `URL:${url}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title} tra 10 minuti!`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'drop-chiamamibi.ics'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
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
  return proxyImg(p?.thumb_url || p?.photo_url || null)
}

/* ── DropMini — drop-mini compatto orizzontale (mockup §drops-row + .drop-mini) */
function DropMini({ deal, onTap, kind = 'live' }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const time = useCountdown(deal.drop_ends_at || deal.drop_starts_at || deal.valid_until)
  const endsAt = deal.drop_ends_at || deal.valid_until
  const startsAt = deal.drop_starts_at || deal.drop_time
  const timer = (() => {
    if (kind === 'upcoming' && startsAt) {
      const d = new Date(startsAt)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      const tt = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      return isToday ? `oggi alle ${tt}` : `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${tt}`
    }
    if (endsAt) {
      const tt = new Date(endsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      return `entro le ${tt}`
    }
    if (time) return `${time.h}h ${pad(time.m)}m`
    return null
  })()
  const cuisine = r?.category?.[0] || r?.cuisine_type || null
  return (
    <div onClick={() => onTap && onTap(deal)} style={{
      flex: '0 0 68%', minWidth: 0,
      background: '#fff', border: '1px solid var(--color-ink-05, rgba(34,24,28,.05))',
      borderRadius: 14, padding: 12,
      display: 'flex', gap: 10, alignItems: 'center',
      boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
      cursor: 'pointer', scrollSnapAlign: 'start',
    }}>
      <div style={{ width: 54, height: 54, flex: '0 0 54px', borderRadius: 10, overflow: 'hidden', background: '#ddd' }}>
        {photo ? (
          <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'var(--color-cream-deep, #F1EBE0)', fontSize: 22 }}>🍽️</div>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            background: 'var(--color-corallo-soft, rgba(232,69,60,.08))',
            color: 'var(--color-corallo-ink, #C6372F)',
            fontWeight: 800, fontSize: 11, padding: '3px 7px',
            borderRadius: 999, letterSpacing: '-0.01em',
          }}>{deal.discount_value}</span>
          {timer && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-ink-40, rgba(34,24,28,.4))', letterSpacing: '.04em' }}>
              {timer}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 14,
          letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--color-ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{r?.name}</div>
        <div style={{
          fontSize: 11, color: 'var(--color-ink-70, rgba(34,24,28,.7))', marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {r?.neighborhood || r?.city}{cuisine ? ` · ${cuisine}` : ''}
        </div>
      </div>
    </div>
  )
}

/* ── LiveDropCard — carousel 260px, bordo accent ── */
function LiveDropCard({ deal, onClaim, locked, onLogin, claiming, myRedemption, onShowQR }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const claimed = deal.claimed_count || deal.total_redeemed || 0
  const max = deal.max_quantity || deal.max_redemptions || 10
  const remaining = max - claimed
  const soldOut = remaining <= 0
  const alreadyUsed = myRedemption?.status === 'redeemed'
  const time = useCountdown(deal.drop_ends_at || deal.valid_until)

  return (
    <div style={{
      width: 260, minWidth: 260, scrollSnapAlign: 'start',
      borderRadius: 20, overflow: 'hidden', position: 'relative',
      border: alreadyUsed ? '2px solid var(--color-bordo)' : soldOut ? '2px solid var(--color-bordo)' : '2px solid var(--color-accent)',
      background: '#fff',
      opacity: alreadyUsed ? 0.55 : soldOut ? 0.6 : 1,
      filter: alreadyUsed ? 'grayscale(0.7)' : 'none',
      animation: (soldOut || alreadyUsed) ? 'none' : 'dropPulse 2.5s ease-in-out infinite',
      transition: 'opacity 0.6s ease, filter 0.6s ease, border-color 0.6s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Photo 110px */}
      <div style={{ position: 'relative', height: 110, overflow: 'hidden' }}>
        {photo ? (
          <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: soldOut ? 'grayscale(1)' : 'none' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #F0EBE3, #e0d8cc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🍽️</div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />

        {/* LIVE badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'var(--color-accent)', padding: '3px 10px', borderRadius: 8,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'cityPulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>In corso</span>
        </div>

        {/* Countdown badge */}
        {time && !soldOut && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            padding: '3px 8px', borderRadius: 8, color: '#fff', fontSize: 10, fontWeight: 700,
          }}>
            {time.h}h {pad(time.m)}m
          </div>
        )}

        {/* Name on photo */}
        <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12 }}>
          <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.2, textAlign: 'center' }}>{r?.name}</h3>
        </div>
      </div>

      {/* Info — flex-1 to fill space, CTA pushed to bottom */}
      <div style={{ padding: '10px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center gap-2 justify-center" style={{ marginBottom: 8 }}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#fff',
            background: 'var(--color-corallo)',
            borderRadius: 7, padding: '2px 8px', flexShrink: 0,
          }}>{deal.discount_value}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.title}</span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--color-secondary)' }}>{claimed}/{max} presi</span>
          {remaining > 0 && remaining <= 5 && (
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-accent)' }}>Ultimi {remaining}!</span>
          )}
          {soldOut && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-secondary)' }}>Esaurito</span>}
        </div>
        <div style={{ height: 6, background: 'var(--color-bordo)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${Math.min(100, (claimed / max) * 100)}%`,
            background: soldOut ? 'var(--color-secondary)' : 'linear-gradient(90deg, var(--color-accent), #ff6b6b)',
            transition: 'width 0.5s ease',
            position: 'relative', overflow: 'hidden',
          }}>
            {!soldOut && <div className="progress-shine" />}
          </div>
        </div>

        {/* CTA — pushed to bottom */}
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          {alreadyUsed ? (
            <div style={{
              width: '100%', padding: '10px 0', borderRadius: 12,
              background: '#e5e5e5', color: '#6b7280',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              textDecoration: 'line-through',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              Già usato
            </div>
          ) : !soldOut && myRedemption ? (
            <button onClick={() => onShowQR(myRedemption)} style={{
              width: '100%', padding: '10px 0', borderRadius: 12,
              background: 'var(--color-success)', color: '#fff',
              fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              Utilizza sconto
            </button>
          ) : !soldOut && (
            <button onClick={() => locked ? onLogin() : onClaim(deal)} disabled={claiming} style={{
              width: '100%', padding: '10px 0', borderRadius: 12,
              background: locked ? 'var(--color-primary)' : 'var(--color-accent)', color: '#fff',
              fontSize: 12, fontWeight: 700, border: 'none', cursor: claiming ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: claiming ? 0.7 : 1,
            }}>
              {locked ? 'Accedi' : claiming ? '...' : 'Prendi'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── UpcomingDropCard — carousel 260px, sfondo scuro ── */
function UpcomingDropCard({ deal, reminded, onRemind, locked, onLogin }) {
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
    if (isToday) return `Oggi ${timeStr}`
    if (isTomorrow) return `Domani ${timeStr}`
    return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${timeStr}`
  })() : null

  return (
    <div style={{
      width: 260, minWidth: 260, scrollSnapAlign: 'start',
      borderRadius: 20, overflow: 'hidden', background: 'var(--color-primary)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {/* Photo 110px dimmed */}
      <div style={{ position: 'relative', height: 110, overflow: 'hidden' }}>
        {photo ? (
          <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#2e2228', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: 0.5 }}>🍽️</div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, var(--color-primary), transparent)' }} />

        {/* PRESTO badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(176,137,84,0.18)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          padding: '3px 10px', borderRadius: 8,
          border: '1px solid rgba(176,137,84,0.35)',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-oro)', animation: 'cityPulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-oro)', letterSpacing: 1, textTransform: 'uppercase' }}>Presto</span>
        </div>

        {/* Discount badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: '#fff', color: 'var(--color-primary)',
          fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 8,
        }}>
          {deal.discount_value}
        </div>

        {/* Name on photo */}
        <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12 }}>
          <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.2, textAlign: 'center' }}>{r?.name}</h3>
        </div>
      </div>

      {/* Info + countdown + Ricordamelo — flex-1 to match height */}
      <div style={{ padding: '10px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Countdown boxes */}
        {time && (
          <div className="flex items-center justify-center" style={{ gap: 4, marginBottom: 10 }}>
            {[{ v: pad(time.h), l: 'ore' }, { v: pad(time.m), l: 'min' }, { v: pad(time.s), l: 'sec' }].map((seg, i) => (
              <div key={i} className="flex items-center" style={{ gap: 4 }}>
                <div style={{
                  width: 36, padding: '4px 0', textAlign: 'center',
                  background: 'rgba(176,137,84,0.15)', borderRadius: 8,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "var(--font-sans)", fontVariantNumeric: 'tabular-nums' }}>{seg.v}</span>
                  <p style={{ fontSize: 7, fontWeight: 600, color: 'var(--color-oro)', marginTop: 1, textTransform: 'uppercase', letterSpacing: 1 }}>{seg.l}</p>
                </div>
                {i < 2 && <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>:</span>}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{deal.title}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Solo {max}</span>
        </div>
        {dropLabel && (
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-oro)', textAlign: 'center', marginBottom: 8, letterSpacing: 0.3 }}>
            {dropLabel}
          </div>
        )}

        {/* Ricordamelo — pushed to bottom */}
        <div style={{ marginTop: 'auto' }}>
          <button onClick={() => locked ? onLogin() : onRemind()} style={{
            width: '100%', padding: '10px 0', borderRadius: 12,
            background: locked ? 'rgba(255,255,255,0.08)' : reminded ? 'rgba(176,137,84,0.25)' : 'rgba(176,137,84,0.12)',
            border: locked ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(176,137,84,0.2)',
            color: locked ? 'rgba(255,255,255,0.7)' : 'var(--color-oro)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {locked ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ) : reminded ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            )}
            {locked ? 'Accedi' : reminded ? 'Aggiunto' : 'Ricordamelo'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── CompactDealCard — like RestaurantCard default, with discount focus ── */
/* ── ScHero — featured drop card full-width corallo (mockup §sc-hero) ── */
function ScHero({ deal, onClaim, claiming, myRedemption, onShowQR }) {
  const r = deal.restaurant
  const countdown = useCountdown(deal.drop_ends_at || deal.valid_until)
  const endsAt = deal.drop_ends_at || deal.valid_until
  const endsTimeStr = endsAt ? new Date(endsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null
  const claimed = deal.claimed_count || deal.total_redeemed || 0
  const max = deal.max_quantity || deal.max_redemptions || 10
  const remaining = Math.max(0, max - claimed)
  const pct = max > 0 ? Math.min(100, Math.round((claimed / max) * 100)) : 0
  const soldOut = remaining <= 0
  const alreadyUsed = myRedemption?.status === 'redeemed'
  const isActive = myRedemption && myRedemption.status !== 'redeemed'

  // Extract big discount label from title (e.g. "-30%" from "Sconto -30% su tutto")
  const discMatch = (deal.title || '').match(/(-?\d+\s*%)/)
  const discountBig = discMatch ? discMatch[1].replace(/\s+/g, '') : (deal.title || '').slice(0, 6)

  const cta = alreadyUsed ? 'Già usato'
    : isActive ? 'Mostra QR'
    : soldOut ? 'Esaurito'
    : 'Sblocca sconto'
  const onCta = () => {
    if (alreadyUsed || soldOut) return
    if (isActive) onShowQR(myRedemption)
    else onClaim(deal)
  }

  return (
    <div style={{
      background: 'var(--color-corallo)', color: '#fff',
      borderRadius: 28, padding: '18px 18px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)',
      }} />
      <div style={{ position: 'relative' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', background: 'rgba(255,255,255,.22)',
          borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
          marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'cityPulse 1.4s infinite' }} />
          {countdown ? `DROP LIVE · ${countdown.h}h ${pad(countdown.m)}m` : 'LIVE · DROP ORA'}
        </span>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 56,
          lineHeight: .95, letterSpacing: '-.03em', marginBottom: 2,
        }}>{discountBig}</div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 20,
          letterSpacing: '-.02em', marginBottom: 6,
        }}>{r?.name || deal.title}</div>
        {(r?.neighborhood || r?.address) && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', marginBottom: 14 }}>
            {r?.neighborhood || r?.address}
          </div>
        )}
        <div style={{
          background: 'rgba(255,255,255,.2)', height: 6, borderRadius: 999,
          overflow: 'hidden', marginBottom: 6,
        }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 999 }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, fontWeight: 700, letterSpacing: '.04em', marginBottom: 14,
        }}>
          <span>{claimed} / {max} sbloccati</span>
          <span>{endsTimeStr ? `scade alle ${endsTimeStr}` : `${remaining} rimasti`}</span>
        </div>
        <button
          onClick={onCta}
          disabled={claiming || soldOut || alreadyUsed}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '12px 18px', background: 'var(--color-ink)', color: '#fff',
            borderRadius: 999, fontWeight: 800, fontSize: 14,
            border: 0, cursor: claiming || soldOut || alreadyUsed ? 'default' : 'pointer',
            opacity: alreadyUsed || soldOut ? 0.7 : 1,
          }}
        >
          {claiming ? 'Attivazione…' : cta} <span>→</span>
        </button>
      </div>
    </div>
  )
}

function CompactDealCard({ deal, onTap, alreadyUsed }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const categories = (r?.category || (r?.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
  const category = categories[0]
  const priceStr = r?.price_range != null ? '€'.repeat(r.price_range) : null

  return (
    <div onClick={() => onTap(deal)} style={{
      borderRadius: 14, overflow: 'hidden',
      background: '#fff',
      border: '1px solid var(--color-ink-05, rgba(34,24,28,.05))',
      boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
      cursor: 'pointer', position: 'relative',
      opacity: alreadyUsed ? 0.55 : 1,
      transition: 'opacity 0.6s ease',
    }}>
      {/* cv-banner: green-grad 135° lime→green (mockup §.cv-banner) */}
      <div style={{
        height: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px',
        background: 'linear-gradient(135deg, #A3E635, #4ADE80)',
        color: 'var(--color-ink)',
        fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em',
        position: 'relative',
      }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
          {deal.title}
        </span>
        {!alreadyUsed && (
          <span style={{
            flexShrink: 0, marginLeft: 8,
            fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
            color: 'var(--color-ink)', background: 'rgba(255,255,255,.55)',
            padding: '3px 8px', borderRadius: 999,
          }}>
            {deal.valid_until ? `fino al ${new Date(deal.valid_until).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}` : 'sempre'}
          </span>
        )}
        {alreadyUsed && (
          <span style={{
            flexShrink: 0, marginLeft: 8,
            fontSize: 9, fontWeight: 800, letterSpacing: '.06em',
            color: '#fff', background: 'rgba(34,24,28,.8)',
            padding: '4px 8px', borderRadius: 999,
          }}>✓ GIÀ USATO</span>
        )}
      </div>

      {/* conv-main: 54px thumb + body + ink "Usa" pill */}
      <div style={{
        display: 'grid', gridTemplateColumns: '54px 1fr auto', gap: 12,
        alignItems: 'center', padding: '12px 14px',
      }}>
        <div style={{ width: 54, height: 54, borderRadius: 10, overflow: 'hidden', background: '#ddd' }}>
          {photo ? (
            <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'var(--color-cream-deep, #F1EBE0)', fontSize: 22 }}>
              {category?.emoji || '🍽️'}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16,
            letterSpacing: '-0.015em', lineHeight: 1.2, color: 'var(--color-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{r?.name}</div>
          <div style={{
            fontSize: 11, color: 'var(--color-ink-70, rgba(34,24,28,.7))', marginTop: 2,
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            {category && (
              <span style={{
                background: 'var(--color-ink-05, rgba(34,24,28,.05))', color: 'var(--color-ink)',
                fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 999,
              }}>{category.emoji} {category.name}</span>
            )}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r?.neighborhood || r?.city}{priceStr ? ` · ${priceStr}` : ''}
            </span>
          </div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 800, color: '#fff',
          background: 'var(--color-ink, #22181C)',
          padding: '9px 14px', borderRadius: 999, whiteSpace: 'nowrap',
        }}>{alreadyUsed ? 'Vedi' : 'Usa'}</span>
      </div>
    </div>
  )
}

/* ── FeaturedDealCard — hero dark card like restaurant "In evidenza" ── */
function FeaturedDealCard({ deal, onTap, saved, onSaveToggle, alreadyUsed }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const categories = (r?.category || (r?.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
  const category = categories[0]

  return (
    <div onClick={() => onTap(deal)} style={{
      borderRadius: 22, height: 200, position: 'relative', overflow: 'hidden',
      cursor: 'pointer',
      animation: alreadyUsed ? 'none' : 'hero-pulse 3s ease-in-out infinite',
      opacity: alreadyUsed ? 0.6 : 1,
      filter: alreadyUsed ? 'grayscale(0.75)' : 'none',
      transition: 'opacity 0.6s ease, filter 0.6s ease',
    }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1e1520, #2e2228, #22181C)' }}>
        {photo && (
          <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%, rgba(232, 69, 60,0.12), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(176,137,84,0.1), transparent 50%)' }} />
      </div>

      {/* Top badges: In evidenza / Già usato + Discount */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        {alreadyUsed ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(34,24,28,0.9)', color: '#fff',
            fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            padding: '5px 12px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.25)',
            animation: 'usedBadgeIn 0.5s ease',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            Già usato
          </div>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--color-oro)', color: '#fff',
            fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            padding: '5px 12px', borderRadius: 10,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
            In evidenza
          </div>
        )}
        <div style={{
          background: alreadyUsed ? '#9ca3af' : 'var(--color-corallo)',
          color: '#fff',
          fontSize: 11, fontWeight: 700,
          padding: '5px 12px', borderRadius: 10,
          textDecoration: alreadyUsed ? 'line-through' : 'none',
          transition: 'background 0.6s ease, color 0.6s ease',
        }}>
          {deal.discount_value}
        </div>
      </div>

      {/* Heart — top right */}
      {onSaveToggle && (
        <div
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
          onClick={(e) => { e.stopPropagation(); onSaveToggle(); }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill={saved ? '#E8453C' : 'none'}
              stroke={saved ? '#E8453C' : '#fff'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
        </div>
      )}

      {/* Content — bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, zIndex: 2 }}>
        <h3 style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800,
          fontSize: 20, letterSpacing: '-0.02em',
          color: '#fff', lineHeight: 1.2, marginBottom: 4,
        }}>{r?.name}</h3>
        {r?.tagline && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500, marginBottom: 6 }}>{r.tagline}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.6)', flexWrap: 'wrap' }}>
          {category && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              backgroundColor: `${category.color}30`,
              color: '#fff', fontSize: 11, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20,
            }}>
              {category.emoji} {category.name}
            </span>
          )}
          {r?.recommended_for?.length > 0 && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
              <span>{r.recommended_for[0]}</span>
            </>
          )}
          {r?.price_range && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>{'€'.repeat(r.price_range)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── MyActiveCard — mockup .mycard con QR 46x46 checkerboard ── */
function MyActiveCard({ redemption, onShowQR, onGoTo, onOpenDeal }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  return (
    <div
      onClick={e => { e.stopPropagation(); onShowQR(redemption) }}
      style={{
        background: '#fff',
        border: '1px solid var(--color-ink-05, rgba(34,24,28,0.05))',
        borderRadius: 14,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      {/* QR preview — 46x46 repeating-conic-gradient checkerboard */}
      <div style={{
        width: 46, height: 46, borderRadius: 10,
        background: 'repeating-conic-gradient(#22181C 0 25%, #fff 0 50%) 50%/12px 12px',
        border: '1px solid var(--color-ink-15, rgba(34,24,28,0.15))',
      }} />

      {/* Body: name + meta + disc pill */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 14,
          letterSpacing: '-0.01em', color: 'var(--color-ink, #22181C)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{r?.name}</div>
        <div style={{
          fontSize: 11, color: 'var(--color-ink-70, rgba(34,24,28,0.7))',
          marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{deal?.title}</div>
        <span style={{
          display: 'inline-block', marginTop: 4,
          background: 'var(--color-corallo-soft, #FCE0DE)',
          color: 'var(--color-corallo-ink, #8E2620)',
          fontWeight: 800, fontSize: 10, padding: '2.5px 6px',
          borderRadius: 999, letterSpacing: '-0.01em',
        }}>{deal?.discount_value}</span>
      </div>

      {/* State label */}
      <div style={{
        fontSize: 10, fontWeight: 800,
        color: 'var(--color-corallo-ink, #8E2620)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>Attivo</div>
    </div>
  )
}

/* ── MyUsedCard — mockup .mycard.used ── */
function MyUsedCard({ redemption, onGoTo }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  const usedDate = redemption.redeemed_at
    ? new Date(redemption.redeemed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : null

  return (
    <div
      onClick={() => onGoTo && onGoTo(r)}
      style={{
        background: '#fff',
        border: '1px solid var(--color-ink-05, rgba(34,24,28,0.05))',
        borderRadius: 14,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
        opacity: 0.55,
        cursor: 'pointer',
      }}
    >
      {/* QR preview (faded) */}
      <div style={{
        width: 46, height: 46, borderRadius: 10,
        background: 'repeating-conic-gradient(#22181C 0 25%, #fff 0 50%) 50%/12px 12px',
        border: '1px solid var(--color-ink-15, rgba(34,24,28,0.15))',
      }} />

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 14,
          letterSpacing: '-0.01em', color: 'var(--color-ink, #22181C)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{r?.name}</div>
        <div style={{
          fontSize: 11, color: 'var(--color-ink-70, rgba(34,24,28,0.7))',
          marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{usedDate ? `Usato il ${usedDate}` : deal?.title}</div>
        <span style={{
          display: 'inline-block', marginTop: 4,
          background: 'var(--color-corallo-soft, #FCE0DE)',
          color: 'var(--color-corallo-ink, #8E2620)',
          fontWeight: 800, fontSize: 10, padding: '2.5px 6px',
          borderRadius: 999, letterSpacing: '-0.01em',
        }}>{deal?.discount_value}</span>
      </div>

      <div style={{
        fontSize: 10, fontWeight: 800,
        color: 'var(--color-ink-40, rgba(34,24,28,0.4))',
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>Usato</div>
    </div>
  )
}

/* ── DealBottomSheet — detail overlay on tap ── */
function DealBottomSheet({ deal, onClose, onClaim, locked, onLogin, claiming, myRedemption, onShowQR, onGoTo, saved, onSaveToggle }) {
  const r = deal?.restaurant
  const allPhotos = (r?.photos || []).sort((a, b) => a.sort_order - b.sort_order).map(p => proxyImg(p.photo_url)).filter(Boolean)
  const remaining = deal?.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const conditions = deal?.conditions ? deal.conditions.split('\n').filter(Boolean) : []
  const categories = (r?.category || (r?.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
  const category = categories[0]
  const [photoIdx, setPhotoIdx] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)

  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 300) onClose() }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '85vh',
          background: '#FAF7F2', borderRadius: '24px 24px 0 0',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center', cursor: 'grab' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-bordo)' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 24px' }}>
          {/* Photo carousel with swipe */}
          <div style={{ borderRadius: 20, overflow: 'hidden', height: 180, marginBottom: 0, position: 'relative' }}>
            {allPhotos.length > 0 ? (
              <>
                <div
                  style={{ display: 'flex', height: '100%', transition: swiping.current ? 'none' : 'transform 0.3s ease', transform: `translateX(-${photoIdx * 100}%)` }}
                  onTouchStart={e => {
                    touchStartX.current = e.touches[0].clientX
                    touchStartY.current = e.touches[0].clientY
                    swiping.current = false
                  }}
                  onTouchMove={e => {
                    const dx = Math.abs(e.touches[0].clientX - touchStartX.current)
                    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
                    if (dx > 10 && dx > dy) swiping.current = true
                  }}
                  onTouchEnd={e => {
                    if (!swiping.current) return
                    const diff = touchStartX.current - e.changedTouches[0].clientX
                    if (diff > 30) setPhotoIdx(prev => Math.min(prev + 1, allPhotos.length - 1))
                    else if (diff < -30) setPhotoIdx(prev => Math.max(prev - 1, 0))
                    swiping.current = false
                  }}
                >
                  {allPhotos.map((url, i) => (
                    <img key={i} src={url} alt={`${r?.name} ${i + 1}`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0, userSelect: 'none', WebkitUserDrag: 'none' }} draggable={false} />
                  ))}
                </div>
                {/* Dots on photo */}
                {allPhotos.length > 1 && (
                  <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
                    {allPhotos.map((_, i) => (
                      <div key={i} onClick={() => setPhotoIdx(i)} style={{
                        width: i === photoIdx ? 16 : 6, height: 6, borderRadius: 3,
                        background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.3s ease', cursor: 'pointer',
                      }} />
                    ))}
                  </div>
                )}
                {/* Heart on photo */}
                <button
                  onClick={() => onSaveToggle && onSaveToggle(r?.id)}
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 34, height: 34,
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: '50%', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#E8453C' : 'none'} stroke={saved ? '#E8453C' : 'white'} strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                </button>
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #F0EBE3, #e0d8cc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>🍽️</div>
            )}
          </div>
          <div style={{ height: 16 }} />

          {/* Restaurant name — tappable */}
          <h3 onClick={() => { onClose(); onGoTo(r); }} style={{
            fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 22,
            color: 'var(--color-primary)', lineHeight: 1.5, cursor: 'pointer', marginBottom: 8,
          }}>{r?.name}</h3>

          {/* Description */}
          {r?.tagline && (
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 10, lineHeight: 1.4 }}>{r.tagline}</p>
          )}

          {/* Category badge + price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            {category && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: `${category.color}20`, color: category.color,
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              }}>
                {category.emoji} {category.name}
              </span>
            )}
            {r?.recommended_for?.length > 0 && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{r.recommended_for[0]}</span>
              </>
            )}
            {r?.price_range && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)' }}>{'€'.repeat(r.price_range)}</span>
              </>
            )}
          </div>

          {/* Discount tag + title */}
          <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
            <span style={{
              display: 'inline-block', fontSize: 13, fontWeight: 800, color: '#fff',
              background: 'var(--color-corallo)',
              borderRadius: 8, padding: '3px 12px',
            }}>{deal?.discount_value}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>{deal?.title}</span>
          </div>

          {/* Conditions list — green checkmarks */}
          {conditions.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 14, border: '1px solid var(--color-bordo)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#22181C', margin: '0 0 8px' }}>Condizioni</p>
              {conditions.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: i < conditions.length - 1 ? 6 : 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#8A8680', lineHeight: 1.4 }}>{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* 3 quick action buttons — Indicazioni, Chiama, Locale */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(r?.address || r?.name)}`)}
              style={{
                flex: 1, background: '#fff', borderRadius: 12, padding: 12,
                border: '1px solid var(--color-bordo)', cursor: 'pointer', textAlign: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22181C" strokeWidth="1.8" style={{ display: 'block', margin: '0 auto 4px' }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ fontSize: 11, color: '#22181C', fontWeight: 500 }}>Indicazioni</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={e => {
                e.stopPropagation()
                if (!r?.phone) return
                const a = document.createElement('a')
                a.href = `tel:${r.phone}`
                a.click()
              }}
              style={{
                flex: 1, background: '#fff', borderRadius: 12, padding: 12,
                border: '1px solid var(--color-bordo)', cursor: 'pointer', textAlign: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22181C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 4px' }}>
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <span style={{ fontSize: 11, color: '#22181C', fontWeight: 500 }}>Chiama</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => { onClose(); onGoTo(r); }}
              style={{
                flex: 1, background: '#fff', borderRadius: 12, padding: 12,
                border: '1px solid var(--color-bordo)', cursor: 'pointer', textAlign: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22181C" strokeWidth="1.8" style={{ display: 'block', margin: '0 auto 4px' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span style={{ fontSize: 11, color: '#22181C', fontWeight: 500 }}>Locale</span>
            </motion.button>
          </div>

          {/* CTA */}
          {!soldOut && myRedemption?.status === 'redeemed' ? (
            <div style={{
              width: '100%', padding: '16px 0', borderRadius: 16,
              background: '#e5e5e5', color: '#6b7280',
              fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textDecoration: 'line-through',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              Sconto già utilizzato
            </div>
          ) : !soldOut && myRedemption ? (
            <motion.button whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }} onClick={() => onShowQR(myRedemption)} style={{
              width: '100%', padding: '16px 0', borderRadius: 16,
              background: 'var(--color-corallo)', color: '#fff',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              Utilizza sconto
            </motion.button>
          ) : !soldOut && (
            <motion.button whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }} onClick={() => locked ? onLogin() : onClaim(deal)} disabled={claiming} style={{
              width: '100%', padding: '16px 0', borderRadius: 16,
              background: locked ? 'var(--color-primary)' : 'var(--color-accent)', color: '#fff',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: claiming ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: claiming ? 0.7 : 1,
            }}>
              {locked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
              {locked ? 'Sblocca sconto' : claiming ? 'Un momento...' : 'Attiva sconto'}
            </motion.button>
          )}
          {soldOut && (
            <div style={{
              width: '100%', padding: '16px 0', borderRadius: 16,
              background: 'var(--color-bordo)', textAlign: 'center',
              fontSize: 15, fontWeight: 700, color: 'var(--color-secondary)',
            }}>Esaurito</div>
          )}

          <p style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#8A8680' }}>
            Mostra il QR al ristorante per applicare lo sconto
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── HowItWorks — come funziona (v4 mockup §291-296: 3 step grid) ── */
function HowItWorks() {
  const steps = [
    { emo: '📱', t: 'Mostra il QR', s: 'Apri lo sconto e mostra il codice al ristorante' },
    { emo: '✅', t: 'Validano', s: 'Il locale valida il codice e applica lo sconto' },
    { emo: '🎉', t: 'Risparmia', s: 'Lo sconto viene scalato direttamente dal conto' },
  ]
  return (
    <div>
      <div style={{ padding: '0 0 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900,
            fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.1,
            color: 'var(--color-ink)', margin: 0,
          }}>
            Come funziona
          </h3>
          <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2 }}>
            3 step e lo sconto è tuo
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            background: '#fff',
            border: '1px solid var(--color-ink-05, rgba(34,24,28,.06))',
            borderRadius: 16,
            padding: '14px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 8 }}>{s.emo}</div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontWeight: 800,
              fontSize: 12, letterSpacing: '-0.01em',
              color: 'var(--color-ink)', marginBottom: 4,
            }}>
              {s.t}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--color-ink-70)', lineHeight: 1.35 }}>
              {s.s}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DealsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const { city: currentCity } = useCity()
  const { activeDrops: allActiveDrops, upcomingDrops: allUpcomingDrops, featured: allFeatured, regular: allRegular, loading } = useActiveDiscounts()
  const { active: allMyActive, used: allMyUsed, loading: myLoading } = useMyDiscounts(user?.id)
  const [tab, setTab] = useState('available')
  const [reminders, setReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('drop_reminders') || '[]') } catch { return [] }
  })
  const [qrModal, setQrModal] = useState(null) // { qrCode, title, value }
  const [cityPickerOpen, setCityPickerOpen] = useState(false)

  // Filter deals by selected city
  const cityFilter = useCallback((deal) => {
    if (!currentCity.name) return true
    return deal.restaurant?.city?.toLowerCase() === currentCity.name.toLowerCase()
  }, [currentCity.name])
  const myFilter = useCallback((r) => {
    if (!currentCity.name) return true
    return r.discount?.restaurant?.city?.toLowerCase() === currentCity.name.toLowerCase()
  }, [currentCity.name])

  const activeDrops = useMemo(() => allActiveDrops.filter(cityFilter), [allActiveDrops, cityFilter])
  const upcomingDrops = useMemo(() => allUpcomingDrops.filter(cityFilter), [allUpcomingDrops, cityFilter])
  const featured = useMemo(() => allFeatured.filter(cityFilter), [allFeatured, cityFilter])
  const regular = useMemo(() => allRegular.filter(cityFilter), [allRegular, cityFilter])
  const myActive = useMemo(() => allMyActive.filter(myFilter), [allMyActive, myFilter])
  const myUsed = useMemo(() => allMyUsed.filter(myFilter), [allMyUsed, myFilter])
  // Set of discount_ids the user has already redeemed (across all cities).
  // Used to dim cards in "Disponibili" so it's clear the user can't reuse them.
  const usedDealIds = useMemo(
    () => new Set(allMyUsed.map(r => r.discount_id)),
    [allMyUsed]
  )
  const [claiming, setClaiming] = useState(null) // discount id being claimed
  const [justClaimed, setJustClaimed] = useState([]) // redemptions claimed this session
  const [mySubTab, setMySubTab] = useState('active') // 'active' | 'used'
  const [selectedDeal, setSelectedDeal] = useState(null) // for bottom sheet detail
  const [tabsStuck, setTabsStuck] = useState(false)
  const headerRef = useRef(null)
  const [headerH, setHeaderH] = useState(0)

  // Measure header height for sticky top offset
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setHeaderH(el.offsetHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Detect when tabs are stuck (only for border visual — no layout effect)
  useEffect(() => {
    if (!headerH) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setTabsStuck(window.scrollY > headerH + 70)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headerH])

  // Shared tab switcher JSX
  const tabSwitcherJSX = useMemo(() => (
    <>
      <style>{`
        @media (min-width: 768px) {
          /* Chip pill tabs: inline, rounded, dark-active */
          .deals-tab-switcher {
            display: inline-flex !important;
            width: auto !important;
            background: #FAF7F2 !important;
            border: 1px solid #E8E5DE !important;
            border-radius: 14px !important;
            padding: 4px !important;
            gap: 4px;
          }
          .deals-tab-switcher button {
            flex: 0 0 auto !important;
            padding: 9px 24px !important;
            border-radius: 11px !important;
            font-size: 13px !important;
            background: transparent !important;
            color: #8A8680 !important;
            border: none !important;
            margin: 0 !important;
          }
          .deals-tab-switcher .deals-tab-active {
            background: #22181C !important;
            color: #ffffff !important;
          }
          /* Drop carousel: wider cards on desktop */
          .drop-carousel > * {
            min-width: 360px;
          }
        }
      `}</style>
      <div className="flex deals-tab-switcher" style={{ gap: 6 }}>
        {[
          { key: 'available', label: 'Disponibili', count: activeDrops.length + featured.length + regular.length },
          { key: 'mine', label: 'I miei', count: myActive.length + myUsed.length },
        ].map(t => (
          <button key={t.key} className={tab === t.key ? 'deals-tab-active' : ''} onClick={() => { setTab(t.key); window.scrollTo({ top: 0 }) }} style={{
            flex: 1, textAlign: 'center', padding: '11px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700,
            background: tab === t.key ? 'var(--color-ink, #22181C)' : 'var(--color-ink-05, rgba(34,24,28,.05))',
            color: tab === t.key ? '#fff' : 'var(--color-ink-70)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontFamily: 'inherit',
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                display: 'inline-grid', placeItems: 'center',
                minWidth: 20, height: 20, padding: '0 6px',
                borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                background: tab === t.key ? 'rgba(255,255,255,.22)' : 'var(--color-ink, #22181C)',
                color: '#fff',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
    </>
  ), [tab, activeDrops.length, featured.length, regular.length, myActive.length, myUsed.length])

  // Shared sub-tabs JSX for "I miei"
  const subTabsJSX = useMemo(() => (
    <div className="flex gap-2" style={{ marginTop: 10 }}>
      <button
        onClick={() => setMySubTab('active')}
        className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${mySubTab === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-secondary'}`}
      >
        Attivi ({myActive.length})
      </button>
      <button
        onClick={() => setMySubTab('used')}
        className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${mySubTab === 'used' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-secondary'}`}
      >
        Utilizzati ({myUsed.length})
      </button>
    </div>
  ), [mySubTab, myActive.length, myUsed.length])

  const goTo = (r) => navigate(`/restaurant/${r?.slug || slugify(r?.name || '')}`)

  const claimDeal = async (deal) => {
    if (!user || claiming) return
    setClaiming(deal.id)
    try {
      const { supabase } = await import('../../lib/supabase')
      // Check existing redemption first
      const { data: existing } = await supabase
        .from('discount_redemptions')
        .select('id, qr_code, status')
        .eq('discount_id', deal.id)
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (existing?.qr_code) {
        setJustClaimed(prev => [...prev, { ...existing, discount_id: deal.id, discount: deal }])
        setQrModal({ qrCode: existing.qr_code, title: deal.title, value: deal.discount_value })
        setClaiming(null)
        return
      }

      // Generate new redemption
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      let code = 'BiSc-'
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))

      // Capture the user's name so the restaurant's verify dashboard can show
      // it in its activity feed without needing RLS access to profiles.
      let userName = null
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
        userName = profile?.full_name || null
      } catch {
        // best-effort; ignore errors
      }

      const { data, error } = await supabase
        .from('discount_redemptions')
        .insert({ discount_id: deal.id, user_id: user.id, qr_code: code, status: 'generated', user_name: userName })
        .select()
        .single()

      if (error) throw error

      // Increment counter
      await supabase.rpc('increment_discount_redeemed', { discount_uuid: deal.id }).catch(() => {})

      setJustClaimed(prev => [...prev, { ...data, discount_id: deal.id, discount: deal }])
      setQrModal({ qrCode: data.qr_code, title: deal.title, value: deal.discount_value })
    } catch (e) {
      console.error('Claim failed:', e)
    }
    setClaiming(null)
  }

  const showMyQR = (redemption) => {
    setQrModal({
      qrCode: redemption.qr_code,
      title: redemption.discount?.title,
      value: redemption.discount?.discount_value,
    })
  }

  const toggleReminder = (deal) => {
    const dropId = deal.id
    const alreadySet = reminders.includes(dropId)
    if (!alreadySet) {
      // Generate .ics and trigger download → opens native calendar
      const r = deal.restaurant
      addToCalendar({
        title: `Sconto limitato: ${r?.name || 'Ristorante'} - ${deal.title || deal.discount_value}`,
        description: `${deal.title || deal.discount_value} da ${r?.name}. Apri l'app per prendere lo sconto! chiamamibi.com/sconti`,
        start: deal.drop_starts_at || deal.drop_time,
        url: 'https://chiamamibi.com/sconti',
      })
    }
    const next = alreadySet ? reminders.filter(id => id !== dropId) : [...reminders, dropId]
    setReminders(next)
    localStorage.setItem('drop_reminders', JSON.stringify(next))
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* ── Sticky Header — topbar (mobile only) ── */}
      <div ref={headerRef} className="md:hidden" style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: 'var(--color-page, #FAF7F2)',
      }}>
        <div className="flex items-center justify-between" style={{ paddingBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--color-ink)', lineHeight: 1 }}>Sconti</div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 4 }}>
              {activeDrops.length > 0 && <>{activeDrops.length} {activeDrops.length === 1 ? 'drop live' : 'drops live'}</>}
              {activeDrops.length > 0 && (featured.length + regular.length) > 0 && ' · '}
              {(featured.length + regular.length) > 0 && <>{featured.length + regular.length} convenzion{(featured.length + regular.length) === 1 ? 'e' : 'i'}</>}
              {activeDrops.length === 0 && (featured.length + regular.length) === 0 && 'Nessuno sconto disponibile'}
            </div>
          </div>
          <button onClick={() => setCityPickerOpen(true)} className="flex items-center gap-1.5" style={{
            fontSize: 12, color: '#555', fontWeight: 600, padding: '6px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-bordo)', cursor: 'pointer',
          }}>
            <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-success)' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--color-success)', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            {currentCity.name}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-bordo)', margin: '0 -22px' }} />
      </div>


      {/* Tab switcher — CSS sticky, sticks below header naturally */}
      <div className="deals-tabs-sticky" style={{
        position: 'sticky',
        top: headerH,
        zIndex: 49,
        padding: '14px 22px 14px',
        background: 'rgba(250,247,242,0.75)',
        backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow: tabsStuck ? '0 1px 0 0 var(--color-bordo)' : 'none',
      }}>
        <div className="md:max-w-[960px] md:mx-auto">
          {tabSwitcherJSX}
          {/* Sub-tabs I miei */}
          {tab === 'mine' && user && !myLoading && subTabsJSX}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-4 md:max-w-[960px] md:mx-auto md:w-full" style={{ paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        {tab === 'available' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {loading && [200, 160, 160].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h, borderRadius: 20, background: '#fff', border: '1px solid var(--color-bordo)' }} />
            ))}

            {/* CTA per non iscritti */}
            {!user && !loading && (
              <div style={{
                borderRadius: 20, padding: '20px 18px', position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #2e2228 100%)',
              }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>🔓</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Sblocca sconti e drop esclusivi</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 14 }}>
                    Registrati gratis per accedere a sconti nei migliori ristoranti di Torino. Drop a tempo limitato, sconti esclusivi e QR code per risparmiare subito.
                  </p>
                  <Link to="/login" style={{
                    display: 'inline-block', borderRadius: 12,
                    background: 'var(--color-accent)', color: '#fff',
                    padding: '10px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Registrati gratis
                  </Link>
                </div>
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 120, height: 120,
                  borderRadius: '50%', background: 'rgba(232, 69, 60,0.12)',
                }} />
                <div style={{
                  position: 'absolute', bottom: -30, right: 40, width: 80, height: 80,
                  borderRadius: '50%', background: 'rgba(176,137,84,0.1)',
                }} />
              </div>
            )}


            {!loading && (
              <>
                {/* sc-hero: big corallo featured per il PRIMO drop live (mockup §sc-hero) */}
                {activeDrops.length > 0 && user && (
                  <ScHero
                    deal={activeDrops[0]}
                    onClaim={claimDeal}
                    claiming={claiming === activeDrops[0].id}
                    myRedemption={
                      myActive.find(r => r.discount_id === activeDrops[0].id)
                        || justClaimed.find(r => r.discount_id === activeDrops[0].id)
                        || allMyUsed.find(r => r.discount_id === activeDrops[0].id)
                    }
                    onShowQR={showMyQR}
                  />
                )}

                {/* DROP — carosello orizzontale (esclude il primo se già in sc-hero) */}
                {(() => {
                  const carouselDrops = user && activeDrops.length > 0 ? activeDrops.slice(1) : activeDrops
                  if (carouselDrops.length === 0 && upcomingDrops.length === 0) return null
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 17, letterSpacing: '-0.01em', margin: 0 }}>
                            {user && activeDrops.length > 1 ? 'Altri drops oggi' : 'Drops'}
                          </h3>
                          <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2, fontWeight: 500 }}>
                            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </div>
                        </div>
                        {carouselDrops.length > 0 && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--color-ink-40, rgba(34,24,28,.4))',
                          }}>{carouselDrops.length}</span>
                        )}
                      </div>
                      <div className="drop-carousel" style={{
                        display: 'flex', gap: 10, overflowX: 'auto',
                        scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                        paddingBottom: 4, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16,
                      }}>
                        {carouselDrops.map(deal => (
                          <DropMini key={deal.id} deal={deal} kind="live" onTap={setSelectedDeal} />
                        ))}
                        {upcomingDrops.map(deal => (
                          <DropMini key={deal.id} deal={deal} kind="upcoming" onTap={setSelectedDeal} />
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* SCONTI DISPONIBILI — featured (stella oro) + regular in unico feed */}
                {(featured.length > 0 || regular.length > 0) && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 17, letterSpacing: '-0.01em', margin: 0 }}>Convenzioni sempre attive</h3>
                        <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2, fontWeight: 500 }}>Senza limite utenti · valide per un periodo</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--color-ink-40, rgba(34,24,28,.4))',
                      }}>{featured.length + regular.length}</span>
                    </div>
                    <div className="flex flex-col gap-3 mt-2.5 md:grid md:grid-cols-2 lg:grid-cols-3">
                      {featured.map(deal => (
                        <CompactDealCard
                          key={deal.id}
                          deal={deal}
                          onTap={setSelectedDeal}
                          alreadyUsed={usedDealIds.has(deal.id)}
                        />
                      ))}
                      {regular.map(deal => (
                        <CompactDealCard
                          key={deal.id}
                          deal={deal}
                          onTap={setSelectedDeal}
                          alreadyUsed={usedDealIds.has(deal.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {activeDrops.length === 0 && upcomingDrops.length === 0 && featured.length === 0 && regular.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(163,230,53,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>📍</div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' }}>Nessuno sconto a {currentCity.name}</p>
                    <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 4 }}>Prova a selezionare un'altra città</p>
                    <button
                      onClick={() => setCityPickerOpen(true)}
                      style={{
                        background: 'var(--color-accent)', color: '#fff', borderRadius: 14,
                        padding: '12px 24px', fontSize: 13, fontWeight: 600, marginTop: 16,
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      Cambia città
                    </button>
                  </div>
                )}

                {/* Come funziona — always at bottom */}
                <div style={{ marginTop: 8 }}><HowItWorks /></div>
              </>
            )}
          </div>
        )}

        {tab === 'mine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {!user ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(232, 69, 60,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>🔐</div>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)' }}>Accedi per vedere i tuoi sconti</p>
                <Link to="/login" style={{ marginTop: 20, borderRadius: 14, background: 'var(--color-accent)', color: '#fff', padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Accedi</Link>
              </div>
            ) : myLoading ? (
              <div className="flex flex-col gap-3">
                {[68, 68, 68].map((h, i) => (
                  <div key={i} className="skeleton" style={{ height: h, borderRadius: 16, background: '#fff', border: '1px solid var(--color-bordo)' }} />
                ))}
              </div>
            ) : (
              <>
                {/* Sub-tabs moved outside scroll area — see above */}
                {mySubTab === 'active' ? (
                  myActive.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <span style={{ fontSize: 28, marginBottom: 8 }}>{allMyActive.length > 0 ? '📍' : '🏷️'}</span>
                      <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                        {allMyActive.length > 0
                          ? `Nessuno sconto attivo a ${currentCity.name}`
                          : 'Nessuno sconto attivo. Vai su "Disponibili" per prenderne uno!'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2">
                      {myActive.map(r => <MyActiveCard key={r.id} redemption={r} onShowQR={showMyQR} onGoTo={goTo} onOpenDeal={setSelectedDeal} />)}
                    </div>
                  )
                ) : (
                  myUsed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <span style={{ fontSize: 28, marginBottom: 8 }}>{allMyUsed.length > 0 ? '📍' : '✨'}</span>
                      <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                        {allMyUsed.length > 0
                          ? `Nessuno sconto utilizzato a ${currentCity.name}`
                          : 'Nessuno sconto utilizzato ancora'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2">
                      {myUsed.map(r => <MyUsedCard key={r.id} redemption={r} onGoTo={goTo} />)}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ paddingBottom: TAB_BAR_HEIGHT }}>
        <Footer />
      </div>

      {/* Bottom sheet detail */}
      <AnimatePresence>
        {selectedDeal && (
          <DealBottomSheet
            deal={selectedDeal}
            onClose={() => setSelectedDeal(null)}
            onClaim={(d) => { setSelectedDeal(null); claimDeal(d); }}
            locked={!user}
            onLogin={() => { setSelectedDeal(null); navigate('/login'); }}
            claiming={claiming === selectedDeal.id}
            myRedemption={myActive.find(r => r.discount_id === selectedDeal.id) || justClaimed.find(r => r.discount_id === selectedDeal.id) || allMyUsed.find(r => r.discount_id === selectedDeal.id)}
            onShowQR={(r) => { setSelectedDeal(null); showMyQR(r); }}
            onGoTo={goTo}
            saved={isSaved(selectedDeal.restaurant?.id)}
            onSaveToggle={(id) => toggleSave(id)}
          />
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModal && (
          <QRCodeDisplay
            qrCode={qrModal.qrCode}
            discountTitle={qrModal.title}
            discountValue={qrModal.value}
            onClose={() => setQrModal(null)}
          />
        )}
      </AnimatePresence>

      <CityPickerSheet open={cityPickerOpen} onClose={() => setCityPickerOpen(false)} />
    </div>
  )
}
