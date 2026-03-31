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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

/* ── Countdown hook ── */
function useCountdown(targetDate) {
  const calc = useCallback(() => {
    if (!targetDate) return null
    const diff = new Date(targetDate).getTime() - Date.now()
    if (diff <= 0) return null
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return { h, m, s, total: diff }
  }, [targetDate])

  const [time, setTime] = useState(calc)

  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDate, calc])

  return time
}

/* ── Countdown display ── */
function CountdownBadge({ dropTime }) {
  const time = useCountdown(dropTime)
  if (!time) return null

  const pad = (n) => String(n).padStart(2, '0')
  const isUrgent = time.total < 3600000

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: isUrgent
        ? 'linear-gradient(135deg, rgba(232,69,60,0.06), rgba(232,69,60,0.12))'
        : 'linear-gradient(135deg, rgba(196,162,101,0.06), rgba(196,162,101,0.12))',
      borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${isUrgent ? 'rgba(232,69,60,0.12)' : 'rgba(196,162,101,0.12)'}`,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isUrgent ? '#E8453C' : '#C4A265'} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: isUrgent ? '#E8453C' : '#C4A265', textTransform: 'uppercase', letterSpacing: 1 }}>
          Drop tra
        </span>
        {[pad(time.h), pad(time.m), pad(time.s)].map((v, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {i > 0 && <span style={{ fontSize: 16, fontWeight: 700, color: isUrgent ? '#E8453C' : '#C4A265', opacity: 0.4 }}>:</span>}
            <span style={{
              fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              color: isUrgent ? '#E8453C' : '#C4A265',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {v}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Deal Card — visual with photo banner ── */
function DealCard({ deal, onNavigate }) {
  const r = deal.restaurant
  const photo = r?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
  const remaining = deal.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const almostGone = remaining !== null && remaining > 0 && remaining <= Math.ceil(deal.max_redemptions * 0.25)
  const isDrop = deal.drop_time && new Date(deal.drop_time).getTime() > Date.now()
  const pct = deal.max_redemptions ? Math.max(2, (remaining / deal.max_redemptions) * 100) : 100

  return (
    <motion.div
      variants={fadeUp}
      whileTap={!soldOut && !isDrop ? { scale: 0.985 } : {}}
      onClick={() => !soldOut && !isDrop && onNavigate(r)}
      style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        border: '1px solid #E8E0D6',
        cursor: soldOut || isDrop ? 'default' : 'pointer',
      }}
    >
      {/* Photo banner */}
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        {photo ? (
          <img
            src={photo.photo_url} alt={r?.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              filter: soldOut ? 'grayscale(1) brightness(0.7)' : isDrop ? 'brightness(0.85)' : 'none',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #e8d5c0, #d4c0a8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, opacity: 0.5,
          }}>
            🍽️
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
        }} />

        {/* Discount badge — top right */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: soldOut ? 'rgba(0,0,0,0.5)' : 'linear-gradient(135deg, #a3e635, #4ade80)',
          color: soldOut ? '#ccc' : '#1a2e05',
          fontSize: 14, fontWeight: 800,
          padding: '5px 14px', borderRadius: 10,
          textDecoration: soldOut ? 'line-through' : 'none',
          backdropFilter: soldOut ? 'blur(8px)' : 'none',
        }}>
          {deal.discount_value}
        </div>

        {/* Drop label — top left */}
        {isDrop && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            color: '#C4A265', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            padding: '5px 10px', borderRadius: 8,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#C4A265"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
            Prossimo drop
          </div>
        )}

        {/* Sold out label */}
        {soldOut && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            padding: '5px 10px', borderRadius: 8,
          }}>
            Esaurito
          </div>
        )}

        {/* FOMO — almost gone pulse */}
        {almostGone && !soldOut && !isDrop && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(232,69,60,0.85)', backdropFilter: 'blur(8px)',
            color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '5px 10px', borderRadius: 8,
            animation: 'fomoPulse 2s ease-in-out infinite',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#fff',
              animation: 'cityPulse 1.5s ease-in-out infinite',
            }} />
            Ultimi {remaining}!
          </div>
        )}

        {/* Name on photo */}
        <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}>
          <h3 style={{
            fontFamily: "'TAN Songbird', serif",
            fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.15,
            textShadow: '0 1px 6px rgba(0,0,0,0.3)',
          }}>
            {r?.name}
          </h3>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            {r?.cuisine_type}{r?.city ? ` · ${r.city}` : ''}
          </p>
        </div>
      </div>

      {/* Info section */}
      <div style={{ padding: '14px 16px 16px' }}>
        {/* Title + conditions */}
        {deal.title && (
          <p style={{ fontSize: 14, fontWeight: 700, color: '#22181C', marginBottom: 3 }}>
            {deal.title}
          </p>
        )}
        {deal.conditions && (
          <p style={{ fontSize: 12, color: '#8A8680', marginBottom: 10 }}>
            {deal.conditions}
          </p>
        )}

        {/* Drop countdown — centered, prominent */}
        {isDrop && (
          <div style={{ marginBottom: 4 }}>
            <CountdownBadge dropTime={deal.drop_time} />
          </div>
        )}

        {/* Progress bar */}
        {deal.max_redemptions && !isDrop && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: soldOut ? '#aaa' : almostGone ? '#E8453C' : '#22181C',
              }}>
                {soldOut ? (
                  'Sconti esauriti'
                ) : almostGone ? (
                  <>Solo {remaining} rimast{remaining === 1 ? 'o' : 'i'} — affrettati!</>
                ) : (
                  <>{remaining} di {deal.max_redemptions} disponibili</>
                )}
              </span>
              {!soldOut && (
                <span style={{ fontSize: 10, color: '#8A8680', fontWeight: 600 }}>
                  {Math.round(100 - pct)}% preso
                </span>
              )}
            </div>
            <div style={{ height: 6, background: '#F0EBE3', borderRadius: 3, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${soldOut ? 100 : pct}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  height: '100%', borderRadius: 3,
                  background: soldOut
                    ? '#D4CFC8'
                    : almostGone
                      ? 'linear-gradient(135deg, #f87171, #E8453C)'
                      : 'linear-gradient(135deg, #a3e635, #4ade80)',
                }}
              />
            </div>
          </div>
        )}

        {/* Sold out CTA */}
        {soldOut && (
          <p style={{ fontSize: 11, color: '#C4A265', fontWeight: 600, marginTop: 8 }}>
            Attiva le notifiche per il prossimo drop
          </p>
        )}
      </div>
    </motion.div>
  )
}

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
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 14px',
        background: 'rgba(250,247,242,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: '#8A8680', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>by Chiamami Bi</span>
          </Link>
          <button className="flex items-center gap-1.5" style={{
            fontSize: 12, color: '#555', fontWeight: 600, padding: '6px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
          }}>
            <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: '#4ade80', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            Torino
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5, marginLeft: 2 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex" style={{ background: '#fff', borderRadius: 12, padding: 4, border: '1.5px solid #E8E5DE' }}>
          <button
            onClick={() => setTab('available')}
            style={{
              flex: 1, textAlign: 'center', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: tab === 'available' ? '#22181C' : 'transparent',
              color: tab === 'available' ? '#FAF7F2' : '#8A8680',
              border: 'none', cursor: 'pointer',
            }}
          >
            Disponibili
          </button>
          <button
            onClick={() => setTab('mine')}
            style={{
              flex: 1, textAlign: 'center', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: tab === 'mine' ? '#22181C' : 'transparent',
              color: tab === 'mine' ? '#FAF7F2' : '#8A8680',
              border: 'none', cursor: 'pointer',
            }}
          >
            I miei
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4" style={{ paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>

          {/* AVAILABLE TAB */}
          {tab === 'available' && (
            <>
              {/* CTA for non-logged users */}
              {!user && (
                <motion.div variants={fadeUp} style={{
                  borderRadius: 18, padding: 20, marginBottom: 16, marginTop: 16,
                  background: 'linear-gradient(135deg, rgba(232,69,60,0.06), rgba(196,162,101,0.06))',
                  border: '1.5px solid #E8E5DE',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#22181C', marginBottom: 6 }}>Registrati per sbloccare gli sconti</p>
                  <p style={{ fontSize: 12, color: '#8A8680', marginBottom: 12 }}>Crea un account gratuito per accedere a sconti esclusivi</p>
                  <Link to="/login" style={{
                    display: 'inline-block', borderRadius: 12, background: '#E8453C', color: '#fff',
                    padding: '10px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    boxShadow: '0 4px 16px rgba(232,69,60,0.3)',
                  }}>
                    Registrati gratis
                  </Link>
                </motion.div>
              )}

              {loading && (
                <div className="flex flex-col gap-4 mt-4">
                  {[1, 2, 3].map(i => <div key={i} style={{ height: i === 1 ? 200 : 180, borderRadius: 20, background: '#fff', border: '1px solid #E8E0D6' }} className="skeleton" />)}
                </div>
              )}

              {!loading && discounts.length === 0 && (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center py-16 text-center">
                  <span style={{ fontSize: 48, marginBottom: 12 }}>🏷️</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Nessuno sconto attivo</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 4 }}>Torna presto, Bi sta preparando nuove offerte!</p>
                  <Link to="/" style={{
                    marginTop: 20, borderRadius: 14, background: '#E8453C', color: '#fff',
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Esplora i ristoranti
                  </Link>
                </motion.div>
              )}

              {!loading && discounts.length > 0 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '16px 0 14px 6px' }}>
                    Offerta in evidenza
                  </p>

                  {/* HERO CARD */}
                  {featuredDeal && featuredDeal.restaurant && (
                    <div style={{ marginBottom: 20 }}>
                      <RestaurantCard
                        restaurant={featuredDeal.restaurant}
                        index={0}
                        onClick={(r) => handleNavigate(r)}
                        saved={isSaved(featuredDeal.restaurant.id)}
                        onSaveToggle={user ? () => toggleSave(featuredDeal.restaurant.id) : () => navigate('/login')}
                        hasDiscount
                        discountTitle={featuredDeal.discount_value}
                        variant="hero"
                      />
                    </div>
                  )}

                  {/* Other deals */}
                  {otherDeals.length > 0 && (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '4px 0 14px 6px' }}>
                        Altri sconti
                      </p>
                      <div className="flex flex-col gap-4">
                        {otherDeals.map((deal) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            onNavigate={handleNavigate}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* How it works */}
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '28px 0 14px 6px' }}>
                    Come funziona
                  </p>
                  <motion.div variants={fadeUp} style={{
                    background: '#fff', borderRadius: 20, padding: '20px 18px',
                    border: '1px solid #E8E0D6',
                  }}>
                    {[
                      { num: '1', color: '#E8453C', title: 'Mostra il QR code', desc: 'Apri lo sconto e mostra il codice al ristorante' },
                      { num: '2', color: '#C4A265', title: 'Il ristorante valida', desc: 'Il codice viene verificato e lo sconto applicato' },
                      { num: '3', color: '#4ade80', title: 'Goditi il risparmio!', desc: 'Lo sconto viene applicato direttamente al conto' },
                    ].map((step, i) => (
                      <div key={i} className="flex gap-3.5" style={{ marginBottom: i < 2 ? 18 : 0, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: `${step.color}12`, border: `1px solid ${step.color}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 800, color: step.color, flexShrink: 0,
                        }}>{step.num}</div>
                        <div style={{ paddingTop: 3 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#22181C', marginBottom: 2 }}>{step.title}</p>
                          <p style={{ fontSize: 12, color: '#8A8680', lineHeight: 1.5 }}>{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </>
              )}
            </>
          )}

          {/* MY DISCOUNTS TAB */}
          {tab === 'mine' && (
            <>
              {!user ? (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center py-16 text-center">
                  <span style={{ fontSize: 48, marginBottom: 12 }}>🔐</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Accedi per vedere i tuoi sconti</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 4 }}>I tuoi sconti attivi e usati appariranno qui</p>
                  <Link to="/login" style={{
                    marginTop: 20, borderRadius: 14, background: '#E8453C', color: '#fff',
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Accedi
                  </Link>
                </motion.div>
              ) : myDiscounts.length === 0 ? (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center py-16 text-center">
                  <span style={{ fontSize: 48, marginBottom: 12 }}>📋</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Nessuno sconto riscattato</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 4 }}>Quando riscatti uno sconto, lo troverai qui</p>
                  <button
                    onClick={() => setTab('available')}
                    style={{
                      marginTop: 20, borderRadius: 14, background: '#E8453C', color: '#fff',
                      padding: '12px 24px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
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
