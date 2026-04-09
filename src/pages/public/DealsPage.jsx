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

/* ── LiveDropCard — carousel 260px, bordo accent ── */
function LiveDropCard({ deal, onClaim, locked, onLogin, claiming, myRedemption, onShowQR }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const claimed = deal.claimed_count || deal.total_redeemed || 0
  const max = deal.max_quantity || deal.max_redemptions || 10
  const remaining = max - claimed
  const soldOut = remaining <= 0
  const time = useCountdown(deal.drop_ends_at || deal.valid_until)

  return (
    <div style={{
      width: 260, minWidth: 260, scrollSnapAlign: 'start',
      borderRadius: 18, overflow: 'hidden', position: 'relative',
      border: soldOut ? '2px solid var(--color-bordo)' : '2px solid var(--color-accent)',
      background: '#fff',
      opacity: soldOut ? 0.6 : 1,
      animation: soldOut ? 'none' : 'dropPulse 2.5s ease-in-out infinite',
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
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>Live</span>
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
          <h3 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 15, fontWeight: 600, color: '#fff', lineHeight: 1.2, textAlign: 'center' }}>{r?.name}</h3>
        </div>
      </div>

      {/* Info — flex-1 to fill space, CTA pushed to bottom */}
      <div style={{ padding: '10px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center gap-2 justify-center" style={{ marginBottom: 8 }}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#1a2e05',
            background: 'linear-gradient(135deg, #a3e635, #4ade80)',
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
          {!soldOut && myRedemption ? (
            <button onClick={() => onShowQR(myRedemption)} style={{
              width: '100%', padding: '10px 0', borderRadius: 12,
              background: 'var(--color-success)', color: '#fff',
              fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              Mostra QR
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
      borderRadius: 18, overflow: 'hidden', background: 'var(--color-primary)',
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

        {/* Date badge */}
        {dropLabel && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
            padding: '3px 10px', borderRadius: 8,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-oro)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{dropLabel}</span>
          </div>
        )}

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
          <h3 style={{ fontFamily: "'TAN Songbird', sans-serif", fontSize: 15, fontWeight: 600, color: '#fff', lineHeight: 1.2, textAlign: 'center' }}>{r?.name}</h3>
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
                  background: 'rgba(196,162,101,0.15)', borderRadius: 8,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: 'tabular-nums' }}>{seg.v}</span>
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

        {/* Ricordamelo — pushed to bottom */}
        <div style={{ marginTop: 'auto' }}>
          <button onClick={() => locked ? onLogin() : onRemind()} style={{
            width: '100%', padding: '10px 0', borderRadius: 12,
            background: locked ? 'rgba(255,255,255,0.08)' : reminded ? 'rgba(196,162,101,0.25)' : 'rgba(196,162,101,0.12)',
            border: locked ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(196,162,101,0.2)',
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
function CompactDealCard({ deal, onTap, saved, onSaveToggle }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const categories = (r?.category || (r?.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
  const category = categories[0]

  return (
    <div onClick={() => onTap(deal)} style={{
      borderRadius: 18, overflow: 'hidden',
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      cursor: 'pointer', position: 'relative',
    }}>
      {/* Discount title strip — centered */}
      <div style={{
        background: 'linear-gradient(135deg, #a3e635, #4ade80)',
        color: '#1a2e05',
        fontSize: 11, fontWeight: 800,
        padding: '5px 14px',
        textAlign: 'center',
      }}>
        {deal.title}
      </div>

      <div className="flex w-full items-center gap-3.5" style={{ padding: 14 }}>
        {/* Photo */}
        <div style={{ width: 100, height: 100, borderRadius: 14, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: category?.color ? `linear-gradient(135deg, ${category.color}40, ${category.color}20)` : 'linear-gradient(135deg, #e8d5c0, #d4c0a8)' }} />
          {photo ? (
            <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: 0.6 }}>
              {category?.emoji || '🍽️'}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {/* Name */}
          <h3 style={{
            fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
            fontSize: 14, fontWeight: 600, color: '#22181C',
            lineHeight: 1.5, marginBottom: 3,
          }}>{r?.name}</h3>

          {/* Tagline */}
          {r?.tagline && (
            <p style={{ fontSize: 12, color: '#8A8680', fontWeight: 500, marginBottom: 4 }}>{r.tagline}</p>
          )}

          {/* Category badge */}
          {category && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: `${category.color}20`, color: category.color,
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              }}>
                {category.emoji} {category.name}
              </span>
            </div>
          )}

          {/* Recommended + Price row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8A8680', fontWeight: 500 }}>
            {r?.recommended_for?.length > 0 && (
              <>
                <span>{r.recommended_for[0]}</span>
                {r?.price_range && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', display: 'inline-block' }} />}
              </>
            )}
            {r?.price_range && <span style={{ fontWeight: 600 }}>{'€'.repeat(r.price_range)}</span>}
          </div>
        </div>
      </div>

      {/* Heart bottom-right */}
      {onSaveToggle && (
        <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
          <SaveButton saved={saved} onClick={onSaveToggle} size="sm" />
        </div>
      )}
    </div>
  )
}

/* ── FeaturedDealCard — hero dark card like restaurant "In evidenza" ── */
function FeaturedDealCard({ deal, onTap, saved, onSaveToggle }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const categories = (r?.category || (r?.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
  const category = categories[0]

  return (
    <div onClick={() => onTap(deal)} style={{
      borderRadius: 22, height: 200, position: 'relative', overflow: 'hidden',
      cursor: 'pointer', animation: 'hero-pulse 3s ease-in-out infinite',
    }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1e1520, #2e2228, #22181C)' }}>
        {photo && (
          <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%, rgba(232,69,60,0.12), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(196,162,101,0.1), transparent 50%)' }} />
      </div>

      {/* Top badges: In evidenza + Discount */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#C4A265', color: '#fff',
          fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
          padding: '5px 12px', borderRadius: 10,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
          In evidenza
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #a3e635, #4ade80)', color: '#000',
          fontSize: 11, fontWeight: 700,
          padding: '5px 12px', borderRadius: 10,
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
          fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
          fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.4, marginBottom: 4,
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

/* ── MyActiveCard — green border, tappable for QR ── */
function MyActiveCard({ redemption, onShowQR, onGoTo, onOpenDeal }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  const photo = getPhoto(r)
  return (
    <div onClick={() => onOpenDeal && onOpenDeal(deal)} className="flex items-center" style={{
      borderRadius: 16, padding: '14px 12px', gap: 12,
      background: '#fff', border: '1px solid var(--color-bordo)',
      cursor: 'pointer',
    }}>
      {/* Photo */}
      <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
        {photo ? (
          <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🍽️</div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <h4 style={{
          fontFamily: "'TAN Songbird', sans-serif", fontSize: 13, fontWeight: 600,
          color: 'var(--color-primary)', lineHeight: 1.8,
        }}>{r?.name}</h4>
        <div className="flex items-center gap-2">
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#1a2e05',
            background: 'linear-gradient(135deg, #a3e635, #4ade80)',
            borderRadius: 8, padding: '2px 8px', flexShrink: 0,
          }}>{deal?.discount_value}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal?.title}</span>
        </div>
        {deal?.conditions && (
          <p style={{ fontSize: 11, color: 'var(--color-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.conditions.split('\n')[0]}</p>
        )}
      </div>

      {/* Utilizza button */}
      <div onClick={e => { e.stopPropagation(); onShowQR(redemption); }} className="flex items-center gap-1" style={{
        flexShrink: 0,
        background: 'var(--color-accent)', borderRadius: 10, padding: '6px 10px',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Utilizza</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  )
}

/* ── MyUsedCard — faded, strikethrough, not tappable ── */
function MyUsedCard({ redemption, onGoTo }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  const photo = getPhoto(r)
  const usedDate = redemption.redeemed_at
    ? new Date(redemption.redeemed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : null

  return (
    <div className="flex items-center" style={{
      borderRadius: 16, padding: '14px 12px', gap: 12,
      background: '#fff', border: '1px solid var(--color-bordo)',
      opacity: 0.45,
    }}>
      {/* Photo */}
      <div onClick={() => onGoTo(r)} style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
        {photo ? (
          <img src={photo} alt={r?.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.6)' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🍽️</div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <h4 onClick={() => onGoTo(r)} style={{
          fontFamily: "'TAN Songbird', sans-serif", fontSize: 13, fontWeight: 600,
          color: 'var(--color-secondary)', cursor: 'pointer', lineHeight: 1.2,
          textDecoration: 'line-through',
        }}>{r?.name}</h4>
        <div className="flex items-center gap-2">
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#999',
            background: '#e5e5e5',
            borderRadius: 8, padding: '2px 8px', flexShrink: 0,
            textDecoration: 'line-through',
          }}>{deal?.discount_value}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal?.title}</span>
        </div>
        {usedDate && (
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>Utilizzato il {usedDate}</span>
          </div>
        )}
      </div>
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
            fontFamily: "'TAN Songbird', sans-serif", fontSize: 22, fontWeight: 600,
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
              display: 'inline-block', fontSize: 13, fontWeight: 800, color: '#1a2e05',
              background: 'linear-gradient(135deg, #a3e635, #4ade80)',
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
          {!soldOut && myRedemption ? (
            <motion.button whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }} onClick={() => onShowQR(myRedemption)} style={{
              width: '100%', padding: '16px 0', borderRadius: 16,
              background: 'linear-gradient(135deg, #a3e635, #4ade80)', color: '#1a2e05',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              Mostra QR
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

/* ── HowItWorks — come funziona section ── */
function HowItWorks() {
  return (
    <div>
      <p style={{ ...sectionLabel, marginBottom: 10 }}>Come funziona</p>
      <div style={{ background: '#fff', borderRadius: 20, padding: 18, border: '1px solid var(--color-bordo)' }}>
        {[
          { icon: '📱', bg: 'rgba(232,69,60,0.08)', title: 'Mostra il QR code', desc: 'Apri lo sconto e mostra il codice al ristorante' },
          { icon: '✅', bg: 'rgba(196,162,101,0.1)', title: 'Ottieni lo sconto', desc: 'Il ristorante valida il codice e applica lo sconto' },
          { icon: '🎉', bg: 'rgba(163,230,53,0.1)', title: 'Goditi il risparmio', desc: 'Lo sconto viene applicato direttamente al conto' },
        ].map((step, i) => (
          <div key={i} className="flex gap-3" style={{ marginBottom: i < 2 ? 14 : 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: step.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>{step.icon}</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 2 }}>{step.title}</p>
              <p style={{ fontSize: 11, color: 'var(--color-secondary)' }}>{step.desc}</p>
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
          .deals-tab-switcher {
            background: transparent !important;
            border: none !important;
            border-bottom: 2px solid var(--color-bordo) !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
          .deals-tab-switcher button {
            border-radius: 0 !important;
            background: transparent !important;
            color: var(--color-secondary) !important;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
          }
          .deals-tab-switcher .deals-tab-active {
            color: var(--color-accent) !important;
            border-bottom-color: var(--color-accent) !important;
          }
        }
      `}</style>
      <div className="flex deals-tab-switcher" style={{ background: '#fff', borderRadius: 12, padding: 4, border: '1.5px solid var(--color-bordo)' }}>
        {[{ key: 'available', label: 'Disponibili' }, { key: 'mine', label: 'I miei' }].map(t => (
          <button key={t.key} className={tab === t.key ? 'deals-tab-active' : ''} onClick={() => { setTab(t.key); window.scrollTo({ top: 0 }) }} style={{
            flex: 1, textAlign: 'center', padding: 10, borderRadius: 10,
            fontSize: 13, fontWeight: tab === t.key ? 700 : 600,
            background: tab === t.key ? 'var(--color-primary)' : 'transparent',
            color: tab === t.key ? 'var(--color-bg)' : 'var(--color-secondary)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
          }}>{t.label}</button>
        ))}
      </div>
    </>
  ), [tab])

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

      const { data, error } = await supabase
        .from('discount_redemptions')
        .insert({ discount_id: deal.id, user_id: user.id, qr_code: code, status: 'generated' })
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
      {/* ── Sticky Header — logo + border only (mobile only) ── */}
      <div ref={headerRef} className="md:hidden" style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: '#FAF7F2',
      }}>
        <div className="flex items-center justify-between" style={{ paddingBottom: 14 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: 'var(--color-secondary)', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>by Chiamami Bi</span>
          </Link>
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
                  borderRadius: '50%', background: 'rgba(232,69,60,0.12)',
                }} />
                <div style={{
                  position: 'absolute', bottom: -30, right: 40, width: 80, height: 80,
                  borderRadius: '50%', background: 'rgba(196,162,101,0.1)',
                }} />
              </div>
            )}


            {!loading && (
              <>
                {/* DROP — carosello orizzontale */}
                {(activeDrops.length > 0 || upcomingDrops.length > 0) && (
                  <div>
                    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                      <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
                        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-accent)' }} />
                        <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--color-accent)', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
                      </span>
                      <p style={sectionLabel}>Drop</p>
                    </div>
                    <div className="drop-carousel" style={{
                      display: 'flex', gap: 12, overflowX: 'auto',
                      scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                      paddingBottom: 4, marginLeft: -16, marginRight: -16, paddingLeft: 18, paddingRight: 18,
                    }}>
                      {activeDrops.map(deal => <LiveDropCard key={deal.id} deal={deal} onClaim={claimDeal} locked={!user} onLogin={() => navigate('/login')} claiming={claiming === deal.id} myRedemption={myActive.find(r => r.discount_id === deal.id) || justClaimed.find(r => r.discount_id === deal.id)} onShowQR={showMyQR} />)}
                      {upcomingDrops.map(deal => (
                        <UpcomingDropCard key={deal.id} deal={deal} reminded={reminders.includes(deal.id)} onRemind={() => toggleReminder(deal)} locked={!user} onLogin={() => navigate('/login')} />
                      ))}
                    </div>
                  </div>
                )}

                {/* IN EVIDENZA — hero dark cards */}
                {featured.length > 0 && (
                  <div>
                    <p style={sectionLabel}>In evidenza</p>
                    <div className="flex flex-col gap-3.5 mt-2.5 md:grid md:grid-cols-2">
                      {featured.map(deal => <FeaturedDealCard key={deal.id} deal={deal} onTap={setSelectedDeal} saved={isSaved(deal.restaurant?.id)} onSaveToggle={() => { if (!user) { navigate('/login'); return; } toggleSave(deal.restaurant?.id); }} />)}
                    </div>
                  </div>
                )}

                {/* SCONTI DISPONIBILI — compact cards */}
                {regular.length > 0 && (
                  <div>
                    <p style={sectionLabel}>Sconti disponibili</p>
                    <div className="flex flex-col gap-2.5 mt-2.5 md:grid md:grid-cols-2 lg:grid-cols-3">
                      {regular.map(deal => <CompactDealCard key={deal.id} deal={deal} onTap={setSelectedDeal} saved={isSaved(deal.restaurant?.id)} onSaveToggle={() => toggleSave(deal.restaurant?.id)} />)}
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
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(232,69,60,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>🔐</div>
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
            myRedemption={myActive.find(r => r.discount_id === selectedDeal.id) || justClaimed.find(r => r.discount_id === selectedDeal.id)}
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
