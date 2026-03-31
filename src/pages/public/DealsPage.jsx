import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import Footer from '../../components/Layout/Footer'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'

function slugify(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/* ── Animations ── */
const stagger = { visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.19, 1, 0.22, 1] } },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] } },
}

/* ── Countdown hook ── */
function useCountdown(targetDate) {
  const calc = useCallback(() => {
    if (!targetDate) return null
    const diff = new Date(targetDate).getTime() - Date.now()
    if (diff <= 0) return null
    return {
      h: Math.floor(diff / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      total: diff,
    }
  }, [targetDate])
  const [time, setTime] = useState(calc)
  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDate, calc])
  return time
}

/* ── Countdown — editorial timer with flip feel ── */
function DropTimer({ dropTime }) {
  const time = useCountdown(dropTime)
  if (!time) return null
  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div style={{ padding: '20px 0 6px' }}>
      {/* Label */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginBottom: 16,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(196,162,101,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4A265' }} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase',
          color: '#C4A265',
        }}>
          Drop tra
        </span>
      </div>

      {/* Timer digits */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        {[
          { v: pad(time.h), l: 'ore' },
          { v: pad(time.m), l: 'min' },
          { v: pad(time.s), l: 'sec' },
        ].map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4CFC8' }} />
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4CFC8' }} />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'flex', gap: 3,
              }}>
                {seg.v.split('').map((digit, di) => (
                  <div key={di} style={{
                    width: 36, height: 48,
                    background: '#22181C',
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: 24, fontWeight: 800, color: '#FAF7F2',
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {digit}
                    </span>
                  </div>
                ))}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: 1.5,
                textTransform: 'uppercase', color: '#B0ACA6',
                marginTop: 6, display: 'block',
              }}>
                {seg.l}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Availability dots — visual indicator ── */
function AvailabilityDots({ max, redeemed }) {
  if (!max || max > 12) return null
  const taken = redeemed || 0
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', padding: '4px 0' }}>
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.04, duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: i < max - taken
              ? 'linear-gradient(135deg, #a3e635, #4ade80)'
              : '#E8E0D6',
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════
   DEAL CARD — editorial magazine style
   ══════════════════════════════════════════════ */
function DealCard({ deal, onNavigate }) {
  const r = deal.restaurant
  const photo = r?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
  const remaining = deal.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const almostGone = remaining !== null && remaining > 0 && remaining <= Math.ceil(deal.max_redemptions * 0.25)
  const isDrop = deal.drop_time && new Date(deal.drop_time).getTime() > Date.now()

  return (
    <motion.div
      variants={scaleIn}
      whileTap={!soldOut && !isDrop ? { scale: 0.975 } : {}}
      onClick={() => !soldOut && !isDrop && onNavigate(r)}
      style={{
        background: '#fff', borderRadius: 28, overflow: 'hidden',
        boxShadow: '0 4px 32px rgba(34,24,28,0.07), 0 0 0 0.5px rgba(34,24,28,0.04)',
        cursor: soldOut || isDrop ? 'default' : 'pointer',
        position: 'relative',
      }}
    >
      {/* ─ Photo with cinematic overlay ─ */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        {photo ? (
          <motion.img
            src={photo.photo_url} alt={r?.name}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              filter: soldOut ? 'grayscale(1) brightness(0.5)' : 'none',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(145deg, #F0EBE3, #e0d8cc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
          }}>🍽️</div>
        )}

        {/* Cinematic gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 45%, rgba(0,0,0,0.15) 100%),
            radial-gradient(ellipse at 80% 20%, rgba(196,162,101,0.08), transparent 50%)
          `,
        }} />

        {/* Discount — large pill, glass */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: soldOut
            ? 'rgba(255,255,255,0.1)'
            : 'linear-gradient(135deg, #a3e635, #4ade80)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          color: soldOut ? 'rgba(255,255,255,0.4)' : '#0a2000',
          fontSize: 16, fontWeight: 800, letterSpacing: -0.3,
          padding: '7px 18px', borderRadius: 50,
          textDecoration: soldOut ? 'line-through' : 'none',
          boxShadow: soldOut ? 'none' : '0 4px 16px rgba(163,230,53,0.25)',
        }}>
          {deal.discount_value}
        </div>

        {/* Status chip — top left */}
        {(isDrop || soldOut || almostGone) && (
          <div style={{
            position: 'absolute', top: 16, left: 16,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            padding: '6px 14px', borderRadius: 50,
            border: '0.5px solid rgba(255,255,255,0.1)',
          }}>
            {isDrop && (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#C4A265',
                  boxShadow: '0 0 8px rgba(196,162,101,0.5)',
                }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Prossimo drop</span>
              </>
            )}
            {soldOut && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Esaurito</span>
            )}
            {almostGone && !soldOut && !isDrop && (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#E8453C',
                  boxShadow: '0 0 8px rgba(232,69,60,0.6)',
                  animation: 'cityPulse 1.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                  Ultim{remaining === 1 ? 'o' : 'i'} {remaining}
                </span>
              </>
            )}
          </div>
        )}

        {/* Name + meta — bottom of photo */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 22px 18px' }}>
          <h3 style={{
            fontFamily: "'TAN Songbird', serif",
            fontSize: 26, fontWeight: 600, color: '#fff', lineHeight: 1.05,
            marginBottom: 5,
            letterSpacing: -0.3,
          }}>
            {r?.name}
          </h3>
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500,
            letterSpacing: 0.3,
          }}>
            {r?.cuisine_type}{r?.city ? ` · ${r.city}` : ''}
          </p>
        </div>
      </div>

      {/* ─ Content ─ */}
      <div style={{ padding: '20px 22px 22px' }}>
        {/* Title row */}
        {deal.title && (
          <p style={{
            fontSize: 16, fontWeight: 700, color: '#22181C',
            lineHeight: 1.35, marginBottom: deal.conditions ? 5 : 12,
            letterSpacing: -0.2,
          }}>
            {deal.title}
          </p>
        )}

        {deal.conditions && (
          <p style={{
            fontSize: 13, color: '#8A8680', lineHeight: 1.55,
            marginBottom: 18,
          }}>
            {deal.conditions}
          </p>
        )}

        {/* Countdown for drops */}
        {isDrop && <DropTimer dropTime={deal.drop_time} />}

        {/* Progress — dots + bar */}
        {deal.max_redemptions && !isDrop && (
          <div>
            {/* Visual dots for small numbers */}
            {deal.max_redemptions <= 12 && (
              <div style={{ marginBottom: 14 }}>
                <AvailabilityDots max={deal.max_redemptions} redeemed={deal.total_redeemed} />
              </div>
            )}

            {/* Bar */}
            <div style={{
              height: 5, background: '#F0EBE3', borderRadius: 100, overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${soldOut ? 100 : Math.max(3, (remaining / deal.max_redemptions) * 100)}%` }}
                transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}
                style={{
                  height: '100%', borderRadius: 100,
                  background: soldOut
                    ? '#D4CFC8'
                    : almostGone
                      ? '#E8453C'
                      : 'linear-gradient(90deg, #86efac, #4ade80)',
                }}
              />
            </div>

            {/* Label */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginTop: 10,
            }}>
              <span style={{
                fontSize: 14, fontWeight: 700, letterSpacing: -0.2,
                color: soldOut ? '#B0ACA6' : almostGone ? '#E8453C' : '#22181C',
              }}>
                {soldOut
                  ? 'Esauriti'
                  : almostGone
                    ? `Solo ${remaining} rimast${remaining === 1 ? 'o' : 'i'}`
                    : `${remaining} disponibil${remaining === 1 ? 'e' : 'i'}`
                }
              </span>
              <span style={{ fontSize: 12, color: '#B0ACA6', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                {deal.total_redeemed || 0}/{deal.max_redemptions}
              </span>
            </div>
          </div>
        )}

        {/* Sold out CTA */}
        {soldOut && (
          <div style={{
            marginTop: 16, padding: '14px 18px', borderRadius: 16,
            background: '#22181C',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4A265" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#C4A265' }}>
              Avvisami al prossimo drop
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   DEALS PAGE
   ══════════════════════════════════════════════ */
export default function DealsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const { discounts, loading } = useActiveDiscounts()
  const [tab, setTab] = useState('available')

  const myDiscounts = []
  const featuredDeal = discounts[0]
  const otherDeals = discounts.slice(1)

  const handleNavigate = (r) => {
    navigate(`/restaurant/${r?.slug || slugify(r?.name || '')}`)
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: '#FAF7F2' }}>
      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 20px 16px',
        background: 'rgba(250,247,242,0.88)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{
              fontSize: 9, color: '#B0ACA6', fontWeight: 600, letterSpacing: 2,
              textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif",
            }}>by Chiamami Bi</span>
          </Link>
          <button className="flex items-center gap-1.5" style={{
            fontSize: 12, color: '#22181C', fontWeight: 600, padding: '7px 14px', borderRadius: 50,
            background: '#fff',
            boxShadow: '0 1px 8px rgba(34,24,28,0.06), 0 0 0 0.5px rgba(34,24,28,0.04)',
          }}>
            <span style={{ position: 'relative', width: 7, height: 7, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: '#4ade80', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            Torino
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.35 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        {/* Tabs — pill style */}
        <div className="flex" style={{
          background: 'rgba(34,24,28,0.04)', borderRadius: 16, padding: 4,
        }}>
          {['available', 'mine'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 13,
                fontSize: 13, fontWeight: 700,
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#22181C' : '#8A8680',
                border: 'none', cursor: 'pointer',
                boxShadow: tab === t ? '0 2px 12px rgba(34,24,28,0.06)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
              }}
            >
              {t === 'available' ? 'Disponibili' : 'I miei'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1" style={{ padding: `0 16px ${TAB_BAR_HEIGHT + 20}px` }}>
        <motion.div initial="hidden" animate="visible" variants={stagger}>

          {/* ═══ AVAILABLE TAB ═══ */}
          {tab === 'available' && (
            <>
              {/* CTA — non logged */}
              {!user && (
                <motion.div variants={fadeUp} style={{
                  borderRadius: 24, padding: '24px 22px', marginTop: 20, marginBottom: 24,
                  background: '#fff',
                  boxShadow: '0 4px 32px rgba(34,24,28,0.05), 0 0 0 0.5px rgba(34,24,28,0.03)',
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
                    color: '#C4A265', marginBottom: 10,
                  }}>Esclusivo</div>
                  <p style={{
                    fontSize: 18, fontWeight: 700, color: '#22181C', lineHeight: 1.35,
                    marginBottom: 6, letterSpacing: -0.3,
                  }}>
                    Sconti selezionati da Bi, solo per te
                  </p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginBottom: 20, lineHeight: 1.6 }}>
                    Registrati gratis per sbloccare gli sconti nei ristoranti scelti da Bi
                  </p>
                  <Link to="/login" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    borderRadius: 50, background: '#22181C', color: '#FAF7F2',
                    padding: '13px 26px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Registrati
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  </Link>
                </motion.div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col gap-5 mt-5">
                  {[200, 260, 260].map((h, i) => (
                    <div key={i} style={{ height: h, borderRadius: 28, background: '#fff' }} className="skeleton" />
                  ))}
                </div>
              )}

              {/* Empty */}
              {!loading && discounts.length === 0 && (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ padding: '80px 24px' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 22,
                    background: 'linear-gradient(145deg, rgba(163,230,53,0.08), rgba(74,222,128,0.12))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, marginBottom: 24,
                  }}>🏷️</div>
                  <p style={{
                    fontFamily: "'TAN Songbird', serif",
                    fontSize: 22, fontWeight: 600, color: '#22181C', letterSpacing: -0.3,
                  }}>Nessuno sconto attivo</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 10, maxWidth: 240, lineHeight: 1.6 }}>
                    Bi sta selezionando nuove offerte. Torna presto!
                  </p>
                  <Link to="/" style={{
                    marginTop: 28, borderRadius: 50, background: '#22181C', color: '#FAF7F2',
                    padding: '13px 28px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Esplora i ristoranti
                  </Link>
                </motion.div>
              )}

              {/* Deals */}
              {!loading && discounts.length > 0 && (
                <>
                  {/* Section label */}
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 3,
                    textTransform: 'uppercase', color: '#B0ACA6',
                    margin: '24px 0 16px 6px',
                  }}>
                    In evidenza
                  </p>

                  {/* Hero */}
                  {featuredDeal?.restaurant && (
                    <motion.div variants={scaleIn} style={{ marginBottom: 28 }}>
                      <RestaurantCard
                        restaurant={featuredDeal.restaurant}
                        index={0}
                        onClick={handleNavigate}
                        saved={isSaved(featuredDeal.restaurant.id)}
                        onSaveToggle={user ? () => toggleSave(featuredDeal.restaurant.id) : () => navigate('/login')}
                        hasDiscount
                        discountTitle={featuredDeal.discount_value}
                        variant="hero"
                      />
                    </motion.div>
                  )}

                  {/* Other deals */}
                  {otherDeals.length > 0 && (
                    <>
                      <p style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 3,
                        textTransform: 'uppercase', color: '#B0ACA6',
                        margin: '4px 0 16px 6px',
                      }}>
                        Tutti gli sconti
                      </p>
                      <div className="flex flex-col" style={{ gap: 20 }}>
                        {otherDeals.map(deal => (
                          <DealCard key={deal.id} deal={deal} onNavigate={handleNavigate} />
                        ))}
                      </div>
                    </>
                  )}

                  {/* How it works */}
                  <motion.div variants={fadeUp} style={{ marginTop: 36, marginBottom: 8 }}>
                    <p style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 3,
                      textTransform: 'uppercase', color: '#B0ACA6',
                      margin: '0 0 16px 6px',
                    }}>
                      Come funziona
                    </p>
                    <div style={{
                      background: '#fff', borderRadius: 28,
                      boxShadow: '0 4px 32px rgba(34,24,28,0.05), 0 0 0 0.5px rgba(34,24,28,0.03)',
                      padding: '26px 24px',
                    }}>
                      {[
                        { n: '01', color: '#E8453C', t: 'Mostra il QR', d: 'Apri lo sconto e presenta il codice al ristorante' },
                        { n: '02', color: '#C4A265', t: 'Validazione', d: 'Il ristorante verifica il codice e conferma lo sconto' },
                        { n: '03', color: '#4ade80', t: 'Risparmia', d: 'Lo sconto viene applicato direttamente al conto' },
                      ].map((step, i) => (
                        <div key={i} className="flex" style={{
                          gap: 16, alignItems: 'flex-start',
                          marginBottom: i < 2 ? 22 : 0,
                          paddingBottom: i < 2 ? 22 : 0,
                          borderBottom: i < 2 ? '1px solid rgba(34,24,28,0.04)' : 'none',
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, color: step.color,
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: 22, paddingTop: 2,
                          }}>{step.n}</span>
                          <div>
                            <p style={{ fontSize: 15, fontWeight: 700, color: '#22181C', marginBottom: 3, letterSpacing: -0.2 }}>{step.t}</p>
                            <p style={{ fontSize: 13, color: '#8A8680', lineHeight: 1.55 }}>{step.d}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </>
          )}

          {/* ═══ MY DISCOUNTS TAB ═══ */}
          {tab === 'mine' && (
            <>
              {!user ? (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ padding: '80px 24px' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 22,
                    background: 'rgba(232,69,60,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                  }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <p style={{ fontFamily: "'TAN Songbird', serif", fontSize: 22, fontWeight: 600, color: '#22181C', letterSpacing: -0.3 }}>I tuoi sconti</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 10, maxWidth: 240, lineHeight: 1.6 }}>
                    Accedi per vedere gli sconti attivi e già utilizzati
                  </p>
                  <Link to="/login" style={{
                    marginTop: 28, borderRadius: 50, background: '#22181C', color: '#FAF7F2',
                    padding: '13px 28px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Accedi
                  </Link>
                </motion.div>
              ) : myDiscounts.length === 0 ? (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ padding: '80px 24px' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 22,
                    background: 'rgba(196,162,101,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                  }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C4A265" strokeWidth="1.5" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
                  </div>
                  <p style={{ fontFamily: "'TAN Songbird', serif", fontSize: 22, fontWeight: 600, color: '#22181C', letterSpacing: -0.3 }}>Nessuno sconto usato</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 10, maxWidth: 240, lineHeight: 1.6 }}>
                    Quando riscatti uno sconto, lo ritroverai qui
                  </p>
                  <button
                    onClick={() => setTab('available')}
                    style={{
                      marginTop: 28, borderRadius: 50, background: '#22181C', color: '#FAF7F2',
                      padding: '13px 28px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                    }}
                  >
                    Vedi sconti disponibili
                  </button>
                </motion.div>
              ) : null}
            </>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
