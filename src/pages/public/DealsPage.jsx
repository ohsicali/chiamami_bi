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
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
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

/* ── Countdown — Apple-style segmented timer ── */
function CountdownTimer({ dropTime }) {
  const time = useCountdown(dropTime)
  if (!time) return null

  const pad = (n) => String(n).padStart(2, '0')
  const segments = [
    { value: pad(time.h), label: 'ore' },
    { value: pad(time.m), label: 'min' },
    { value: pad(time.s), label: 'sec' },
  ]

  return (
    <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
      <p style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
        color: '#C4A265', marginBottom: 10,
      }}>
        Drop disponibile tra
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 56, padding: '10px 0',
              background: 'rgba(196,162,101,0.08)',
              borderRadius: 14,
              textAlign: 'center',
            }}>
              <span style={{
                fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                color: '#22181C', fontFamily: "'DM Sans', sans-serif",
                letterSpacing: -1,
              }}>
                {seg.value}
              </span>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#8A8680', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                {seg.label}
              </p>
            </div>
            {i < 2 && (
              <span style={{ fontSize: 20, fontWeight: 700, color: '#D4CFC8', marginTop: -10 }}>:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Deal Card — Apple minimal ── */
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
      whileTap={!soldOut && !isDrop ? { scale: 0.98 } : {}}
      onClick={() => !soldOut && !isDrop && onNavigate(r)}
      style={{
        background: '#fff', borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 2px 20px rgba(34,24,28,0.06)',
        cursor: soldOut || isDrop ? 'default' : 'pointer',
      }}
    >
      {/* Photo */}
      <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
        {photo ? (
          <img
            src={photo.photo_url} alt={r?.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              filter: soldOut ? 'grayscale(1) brightness(0.6)' : 'none',
              transition: 'filter 0.4s ease',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(145deg, #F0EBE3, #e0d8cc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44,
          }}>
            🍽️
          </div>
        )}

        {/* Top gradient */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 60,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)',
        }} />
        {/* Bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
          background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)',
        }} />

        {/* Discount value — pill top right */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: soldOut
            ? 'rgba(255,255,255,0.15)'
            : 'linear-gradient(135deg, #a3e635, #4ade80)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          color: soldOut ? 'rgba(255,255,255,0.5)' : '#1a2e05',
          fontSize: 15, fontWeight: 800,
          padding: '6px 16px', borderRadius: 50,
          textDecoration: soldOut ? 'line-through' : 'none',
        }}>
          {deal.discount_value}
        </div>

        {/* Status badge — top left */}
        {(isDrop || soldOut || almostGone) && (
          <div style={{
            position: 'absolute', top: 16, left: 16,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            padding: '6px 12px', borderRadius: 50,
            border: '0.5px solid rgba(255,255,255,0.12)',
          }}>
            {isDrop && (
              <>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C4A265' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>Prossimo drop</span>
              </>
            )}
            {soldOut && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3 }}>Esaurito</span>
            )}
            {almostGone && !soldOut && !isDrop && (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#E8453C',
                  boxShadow: '0 0 6px rgba(232,69,60,0.6)',
                  animation: 'cityPulse 1.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>
                  Ultim{remaining === 1 ? 'o' : 'i'} {remaining}
                </span>
              </>
            )}
          </div>
        )}

        {/* Name + cuisine overlay */}
        <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
          <h3 style={{
            fontFamily: "'TAN Songbird', serif",
            fontSize: 24, fontWeight: 600, color: '#fff', lineHeight: 1.1,
            marginBottom: 4,
          }}>
            {r?.name}
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
            {r?.cuisine_type}{r?.city ? ` · ${r.city}` : ''}
          </p>
        </div>
      </div>

      {/* Content area */}
      <div style={{ padding: '18px 20px 20px' }}>
        {/* Title + description */}
        {deal.title && (
          <p style={{ fontSize: 15, fontWeight: 700, color: '#22181C', lineHeight: 1.3, marginBottom: deal.conditions ? 4 : 0 }}>
            {deal.title}
          </p>
        )}
        {deal.conditions && (
          <p style={{ fontSize: 13, color: '#8A8680', lineHeight: 1.5, marginBottom: 16 }}>
            {deal.conditions}
          </p>
        )}

        {/* Countdown */}
        {isDrop && (
          <div style={{ marginBottom: 4 }}>
            <CountdownTimer dropTime={deal.drop_time} />
          </div>
        )}

        {/* Progress section */}
        {deal.max_redemptions && !isDrop && (
          <div>
            <div style={{
              height: 6, background: '#F0EBE3', borderRadius: 100, overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${soldOut ? 100 : pct}%` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  height: '100%', borderRadius: 100,
                  background: soldOut
                    ? '#D4CFC8'
                    : almostGone
                      ? 'linear-gradient(90deg, #E8453C, #f87171)'
                      : 'linear-gradient(90deg, #86efac, #4ade80)',
                }}
              />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 10,
            }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: soldOut ? '#B0ACA6' : almostGone ? '#E8453C' : '#22181C',
              }}>
                {soldOut ? (
                  'Tutti esauriti'
                ) : almostGone ? (
                  <>Solo {remaining} rimast{remaining === 1 ? 'o' : 'i'}</>
                ) : (
                  <>{remaining} disponibil{remaining === 1 ? 'e' : 'i'}</>
                )}
              </span>
              <span style={{
                fontSize: 12, color: '#B0ACA6', fontWeight: 600,
              }}>
                {soldOut ? (
                  `${deal.max_redemptions} riscattati`
                ) : (
                  `${deal.total_redeemed || 0} di ${deal.max_redemptions} presi`
                )}
              </span>
            </div>
          </div>
        )}

        {/* Sold out — soft CTA */}
        {soldOut && (
          <div style={{
            marginTop: 14, padding: '12px 16px', borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(196,162,101,0.06), rgba(196,162,101,0.12))',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#C4A265' }}>
              Attiva le notifiche per non perdere il prossimo drop
            </p>
          </div>
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
      {/* ── Header ── */}
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
        <div className="flex" style={{ background: '#fff', borderRadius: 14, padding: 4, boxShadow: '0 1px 8px rgba(34,24,28,0.04)' }}>
          {['available', 'mine'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 11, fontSize: 13, fontWeight: 700,
                background: tab === t ? '#22181C' : 'transparent',
                color: tab === t ? '#FAF7F2' : '#8A8680',
                border: 'none', cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              {t === 'available' ? 'Disponibili' : 'I miei'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1" style={{ padding: `0 18px ${TAB_BAR_HEIGHT + 16}px` }}>
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>

          {/* ═══ AVAILABLE TAB ═══ */}
          {tab === 'available' && (
            <>
              {/* CTA non-logged */}
              {!user && (
                <motion.div variants={fadeUp} style={{
                  borderRadius: 20, padding: '22px 24px', marginBottom: 20, marginTop: 18,
                  background: '#fff',
                  boxShadow: '0 2px 20px rgba(34,24,28,0.05)',
                }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#22181C', marginBottom: 6 }}>Sblocca sconti esclusivi</p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginBottom: 16, lineHeight: 1.5 }}>Crea un account gratuito per accedere agli sconti selezionati da Bi</p>
                  <Link to="/login" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    borderRadius: 14, background: '#22181C', color: '#FAF7F2',
                    padding: '12px 22px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Registrati gratis
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  </Link>
                </motion.div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col gap-5 mt-5">
                  {[200, 220, 220].map((h, i) => (
                    <div key={i} style={{ height: h, borderRadius: 24, background: '#fff', boxShadow: '0 2px 20px rgba(34,24,28,0.04)' }} className="skeleton" />
                  ))}
                </div>
              )}

              {/* Empty */}
              {!loading && discounts.length === 0 && (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ padding: '60px 20px' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 24,
                    background: 'linear-gradient(145deg, rgba(163,230,53,0.1), rgba(74,222,128,0.1))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, marginBottom: 20,
                  }}>🏷️</div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#22181C' }}>Nessuno sconto attivo</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 8, maxWidth: 260, lineHeight: 1.6 }}>
                    Torna presto, Bi sta preparando nuove offerte per te
                  </p>
                  <Link to="/" style={{
                    marginTop: 28, borderRadius: 14, background: '#22181C', color: '#FAF7F2',
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
                    fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
                    textTransform: 'uppercase', color: '#B0ACA6',
                    margin: '22px 0 14px 4px',
                  }}>
                    In evidenza
                  </p>

                  {/* HERO */}
                  {featuredDeal?.restaurant && (
                    <div style={{ marginBottom: 24 }}>
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
                      <p style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
                        textTransform: 'uppercase', color: '#B0ACA6',
                        margin: '4px 0 14px 4px',
                      }}>
                        Tutti gli sconti
                      </p>
                      <div className="flex flex-col gap-5">
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
                  <motion.div variants={fadeUp} style={{ marginTop: 32 }}>
                    <p style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
                      textTransform: 'uppercase', color: '#B0ACA6',
                      margin: '0 0 14px 4px',
                    }}>
                      Come funziona
                    </p>
                    <div style={{
                      background: '#fff', borderRadius: 24, padding: '24px 22px',
                      boxShadow: '0 2px 20px rgba(34,24,28,0.04)',
                    }}>
                      {[
                        { num: '1', color: '#E8453C', title: 'Mostra il QR code', desc: 'Apri lo sconto e presenta il codice al ristorante' },
                        { num: '2', color: '#C4A265', title: 'Il ristorante valida', desc: 'Il codice viene verificato e lo sconto applicato' },
                        { num: '3', color: '#4ade80', title: 'Goditi il risparmio', desc: 'Lo sconto viene scalato direttamente dal conto' },
                      ].map((step, i) => (
                        <div key={i} className="flex gap-4" style={{
                          marginBottom: i < 2 ? 20 : 0,
                          paddingBottom: i < 2 ? 20 : 0,
                          borderBottom: i < 2 ? '1px solid #F0EBE3' : 'none',
                          alignItems: 'center',
                        }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: `${step.color}10`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 800, color: step.color, flexShrink: 0,
                          }}>{step.num}</div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#22181C', marginBottom: 2 }}>{step.title}</p>
                            <p style={{ fontSize: 12, color: '#8A8680', lineHeight: 1.5 }}>{step.desc}</p>
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
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ padding: '60px 20px' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 24,
                    background: 'rgba(232,69,60,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#22181C' }}>I tuoi sconti</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 8, maxWidth: 260, lineHeight: 1.6 }}>
                    Accedi per vedere i tuoi sconti attivi e già utilizzati
                  </p>
                  <Link to="/login" style={{
                    marginTop: 28, borderRadius: 14, background: '#22181C', color: '#FAF7F2',
                    padding: '13px 28px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Accedi
                  </Link>
                </motion.div>
              ) : myDiscounts.length === 0 ? (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ padding: '60px 20px' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 24,
                    background: 'rgba(196,162,101,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C4A265" strokeWidth="1.5" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#22181C' }}>Nessuno sconto usato</p>
                  <p style={{ fontSize: 14, color: '#8A8680', marginTop: 8, maxWidth: 260, lineHeight: 1.6 }}>
                    Quando riscatti uno sconto, lo ritroverai qui
                  </p>
                  <button
                    onClick={() => setTab('available')}
                    style={{
                      marginTop: 28, borderRadius: 14, background: '#22181C', color: '#FAF7F2',
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
