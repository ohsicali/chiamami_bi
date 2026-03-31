import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

/* ── Countdown display component ── */
function CountdownBadge({ dropTime }) {
  const time = useCountdown(dropTime)
  if (!time) return null

  const pad = (n) => String(n).padStart(2, '0')
  const isUrgent = time.total < 3600000 // less than 1h

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: isUrgent ? 'rgba(232,69,60,0.08)' : 'rgba(196,162,101,0.08)',
      border: `1px solid ${isUrgent ? 'rgba(232,69,60,0.15)' : 'rgba(196,162,101,0.15)'}`,
      borderRadius: 10, padding: '6px 10px',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isUrgent ? '#E8453C' : '#C4A265'} strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
      <span style={{
        fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: isUrgent ? '#E8453C' : '#C4A265',
      }}>
        Drop tra {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
      </span>
    </div>
  )
}

/* ── Progress / FOMO bar ── */
function DealProgress({ max, redeemed }) {
  if (!max) return null
  const remaining = max - (redeemed || 0)
  const pct = Math.max(2, (remaining / max) * 100)
  const soldOut = remaining <= 0
  const almostGone = remaining > 0 && remaining <= Math.ceil(max * 0.25)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <div style={{ flex: 1, height: 5, background: '#F0EBE3', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${soldOut ? 100 : pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '100%', borderRadius: 3,
            background: soldOut
              ? '#ccc'
              : almostGone
                ? 'linear-gradient(135deg, #f87171, #E8453C)'
                : 'linear-gradient(135deg, #a3e635, #4ade80)',
          }}
        />
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
        color: soldOut ? '#aaa' : almostGone ? '#E8453C' : '#8A8680',
      }}>
        {soldOut ? (
          'Esauriti'
        ) : almostGone ? (
          <>{remaining} rimast{remaining === 1 ? 'o' : 'i'} — affrettati!</>
        ) : (
          <>{remaining}/{max} disponibili</>
        )}
      </span>
    </div>
  )
}

/* ── Deal Card ── */
function DealCard({ deal, onNavigate }) {
  const r = deal.restaurant
  const photo = r?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
  const remaining = deal.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const isDrop = deal.drop_time && new Date(deal.drop_time).getTime() > Date.now()

  return (
    <motion.div
      variants={fadeUp}
      onClick={() => !soldOut && !isDrop && onNavigate(r)}
      style={{
        background: '#fff', borderRadius: 18,
        border: '1px solid #E8E0D6',
        overflow: 'hidden',
        cursor: soldOut || isDrop ? 'default' : 'pointer',
        opacity: soldOut ? 0.6 : 1,
      }}
    >
      {/* Top: Photo + info row */}
      <div className="flex gap-3.5" style={{ padding: 14, paddingBottom: 0 }}>
        {/* Photo */}
        <div style={{
          width: 80, height: 80, borderRadius: 14, flexShrink: 0,
          overflow: 'hidden', position: 'relative',
        }}>
          {photo ? (
            <img src={photo.photo_url} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: soldOut ? 'grayscale(1)' : 'none' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              🍽️
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{
            fontFamily: "'TAN Songbird', serif",
            fontSize: 17, fontWeight: 600, color: '#22181C', lineHeight: 1.2,
            marginBottom: 4,
          }}>
            {r?.name}
          </h3>
          <p style={{ fontSize: 12, color: '#8A8680' }}>
            {r?.cuisine_type}{r?.city ? ` · ${r.city}` : ''}
          </p>
        </div>
      </div>

      {/* Discount info section */}
      <div style={{ padding: '12px 14px 14px' }}>
        {/* Discount badge + title + conditions */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flexWrap: 'wrap', marginBottom: 4,
        }}>
          <span style={{
            background: soldOut ? '#ddd' : 'linear-gradient(135deg, #a3e635, #4ade80)',
            color: soldOut ? '#999' : '#1a2e05',
            fontSize: 13, fontWeight: 800,
            padding: '4px 12px', borderRadius: 8,
            textDecoration: soldOut ? 'line-through' : 'none',
          }}>
            {deal.discount_value}
          </span>
          {deal.title && (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#22181C' }}>
              {deal.title}
            </span>
          )}
        </div>

        {deal.conditions && (
          <p style={{ fontSize: 11, color: '#8A8680', marginBottom: 4 }}>
            {deal.conditions}
          </p>
        )}

        {/* Drop countdown */}
        {isDrop && <CountdownBadge dropTime={deal.drop_time} />}

        {/* Sold out overlay text */}
        {soldOut && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.04)', borderRadius: 8,
            padding: '6px 10px', marginTop: 4,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#999' }}>
              Sconti esauriti — Torna per il prossimo drop!
            </span>
          </div>
        )}

        {/* Progress bar */}
        <DealProgress max={deal.max_redemptions} redeemed={deal.total_redeemed} />
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
                  {[1, 2, 3].map(i => <div key={i} className="skeleton h-44 rounded-2xl" />)}
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

                  {/* HERO CARD — same as restaurant list featured */}
                  {featuredDeal && featuredDeal.restaurant && (
                    <div style={{ marginBottom: 16 }}>
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
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '0 0 14px 6px' }}>
                        Altri sconti
                      </p>
                      <div className="flex flex-col gap-3">
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
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '24px 0 14px 6px' }}>
                    Come funziona
                  </p>
                  <div style={{ background: '#fff', borderRadius: 16, padding: 18, border: '1.5px solid #E8E5DE' }}>
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
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#22181C', marginBottom: 2 }}>{step.title}</p>
                          <p style={{ fontSize: 11, color: '#8A8680' }}>{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
