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

const pad = (n) => String(n).padStart(2, '0')

/* ── Discount info strip below a card ── */
function DiscountStrip({ deal, index }) {
  const remaining = deal.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const almostGone = remaining !== null && remaining > 0 && remaining <= Math.ceil(deal.max_redemptions * 0.3)
  const isDrop = deal.drop_time && new Date(deal.drop_time).getTime() > Date.now()
  const time = useCountdown(isDrop ? deal.drop_time : null)
  const pct = deal.max_redemptions ? Math.max(4, ((deal.total_redeemed || 0) / deal.max_redemptions) * 100) : 0

  return (
    <div style={{
      padding: '10px 14px 12px',
      borderTop: '1px solid rgba(0,0,0,0.04)',
      background: soldOut ? 'rgba(0,0,0,0.02)' : 'transparent',
    }}>
      {/* Title + conditions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: deal.max_redemptions ? 8 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#22181C',
            textDecoration: soldOut ? 'line-through' : 'none',
            opacity: soldOut ? 0.5 : 1,
          }}>
            {deal.title || 'Sconto attivo'}
          </span>
          {deal.conditions && (
            <span style={{ fontSize: 11, color: '#8A8680', marginLeft: 6 }}>
              · {deal.conditions}
            </span>
          )}
        </div>

        {/* Status badges */}
        {isDrop && time && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'linear-gradient(135deg, #C4A265, #d4b77a)',
            padding: '3px 10px', borderRadius: 8,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#fff',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
            </span>
          </div>
        )}
        {soldOut && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#fff', background: '#B0ACA6',
            padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.5,
          }}>Esaurito</span>
        )}
        {almostGone && !soldOut && !isDrop && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#E8453C',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: '#E8453C',
              animation: 'cityPulse 1.5s ease-in-out infinite',
            }} />
            Ultimi {remaining}!
          </span>
        )}
      </div>

      {/* Progress bar */}
      {deal.max_redemptions && !isDrop && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: '#F0EBE3', borderRadius: 2, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${soldOut ? 100 : pct}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: index * 0.06 + 0.3 }}
              style={{
                height: '100%', borderRadius: 2,
                background: soldOut
                  ? '#D4CFC8'
                  : almostGone
                    ? 'linear-gradient(90deg, #E8453C, #ff6b6b)'
                    : 'linear-gradient(90deg, #a3e635, #4ade80)',
              }}
            />
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, color: soldOut ? '#B0ACA6' : almostGone ? '#E8453C' : '#8A8680',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>
            {deal.total_redeemed || 0}/{deal.max_redemptions}
          </span>
        </div>
      )}

      {/* Drop countdown info */}
      {isDrop && time && (
        <p style={{ fontSize: 11, color: '#C4A265', fontWeight: 500, marginTop: 4 }}>
          Drop tra {time.h > 0 ? `${time.h}h ` : ''}{time.m}min — {deal.max_redemptions || '?'} sconti disponibili
        </p>
      )}
    </div>
  )
}

/* ── Deal card: RestaurantCard + discount strip ── */
function DealCardWrapper({ deal, index, user, isSaved, toggleSave, onNavigate, variant = 'default' }) {
  const r = deal.restaurant
  if (!r) return null

  const remaining = deal.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const isDrop = deal.drop_time && new Date(deal.drop_time).getTime() > Date.now()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        borderRadius: variant === 'hero' ? 22 : 18,
        overflow: 'hidden',
        background: '#fff',
        border: variant === 'hero' ? 'none' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: variant === 'hero' ? 'none' : '0 2px 12px rgba(0,0,0,0.05)',
        opacity: soldOut ? 0.6 : 1,
        pointerEvents: isDrop ? 'none' : 'auto',
      }}
    >
      <RestaurantCard
        restaurant={r}
        index={index}
        onClick={!soldOut && !isDrop ? onNavigate : () => {}}
        saved={isSaved(r.id)}
        onSaveToggle={user ? () => toggleSave(r.id) : () => onNavigate({ slug: 'login' })}
        hasDiscount={!soldOut}
        discountTitle={deal.discount_value}
        variant={variant}
      />
      <DiscountStrip deal={deal} index={index} />
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
    if (r?.slug === 'login') { navigate('/login'); return }
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
        <div className="flex" style={{ background: '#fff', borderRadius: 12, padding: 4, border: '1.5px solid #E8E5DE' }}>
          {[
            { key: 'available', label: 'Disponibili' },
            { key: 'mine', label: 'I miei' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, textAlign: 'center', padding: 10, borderRadius: 10,
                fontSize: 13, fontWeight: tab === t.key ? 700 : 600,
                background: tab === t.key ? '#22181C' : 'transparent',
                color: tab === t.key ? '#FAF7F2' : '#8A8680',
                border: 'none', cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-4" style={{ paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        <AnimatePresence mode="wait">

          {/* ═══ AVAILABLE TAB ═══ */}
          {tab === 'available' && (
            <motion.div
              key="available"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* CTA non-logged */}
              {!user && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{
                    borderRadius: 18, padding: 20, marginBottom: 16, marginTop: 16,
                    background: 'linear-gradient(135deg, rgba(232,69,60,0.06), rgba(196,162,101,0.06))',
                    border: '1.5px solid #E8E5DE',
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#22181C', marginBottom: 6 }}>
                    Registrati per sbloccare gli sconti
                  </p>
                  <p style={{ fontSize: 12, color: '#8A8680', marginBottom: 12 }}>
                    Crea un account gratuito per accedere a sconti esclusivi nei migliori ristoranti di Torino
                  </p>
                  <Link to="/login" style={{
                    display: 'inline-block', borderRadius: 12, background: '#E8453C', color: '#fff',
                    padding: '10px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    boxShadow: '0 4px 16px rgba(232,69,60,0.3)',
                  }}>
                    Registrati gratis
                  </Link>
                </motion.div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col gap-3 mt-4">
                  {[200, 140, 140].map((h, i) => (
                    <div key={i} style={{
                      height: h, borderRadius: 18,
                      background: '#fff', border: '1px solid rgba(0,0,0,0.06)',
                    }} className="skeleton" />
                  ))}
                </div>
              )}

              {/* Empty */}
              {!loading && discounts.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, marginBottom: 16,
                    background: 'rgba(163,230,53,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  }}>🏷️</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Nessuno sconto attivo</p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginTop: 4, maxWidth: 260 }}>
                    Torna presto, Bi sta preparando nuove offerte!
                  </p>
                  <Link to="/" style={{
                    marginTop: 20, borderRadius: 14, background: '#E8453C', color: '#fff',
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Esplora i ristoranti
                  </Link>
                </motion.div>
              )}

              {/* Deals */}
              {!loading && discounts.length > 0 && (
                <div className="flex flex-col" style={{ gap: 14, marginTop: 16 }}>

                  {/* Section: In evidenza */}
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: 2,
                    textTransform: 'uppercase', color: '#8A8680', marginLeft: 4,
                  }}>
                    In evidenza
                  </p>

                  {featuredDeal?.restaurant && (
                    <DealCardWrapper
                      deal={featuredDeal}
                      index={0}
                      user={user}
                      isSaved={isSaved}
                      toggleSave={toggleSave}
                      onNavigate={handleNavigate}
                      variant="hero"
                    />
                  )}

                  {/* Section: Altri sconti */}
                  {otherDeals.length > 0 && (
                    <>
                      <p style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: 2,
                        textTransform: 'uppercase', color: '#8A8680', marginLeft: 4, marginTop: 4,
                      }}>
                        Tutti gli sconti
                      </p>

                      {otherDeals.map((deal, i) => (
                        <DealCardWrapper
                          key={deal.id}
                          deal={deal}
                          index={i + 1}
                          user={user}
                          isSaved={isSaved}
                          toggleSave={toggleSave}
                          onNavigate={handleNavigate}
                        />
                      ))}
                    </>
                  )}

                  {/* Come funziona */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{ marginTop: 8 }}
                  >
                    <p style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: 2,
                      textTransform: 'uppercase', color: '#8A8680', marginLeft: 4, marginBottom: 14,
                    }}>
                      Come funziona
                    </p>
                    <div style={{
                      background: '#fff', borderRadius: 18, padding: 18,
                      border: '1px solid rgba(0,0,0,0.06)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}>
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
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ MY DISCOUNTS TAB ═══ */}
          {tab === 'mine' && (
            <motion.div
              key="mine"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {!user ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, marginBottom: 16,
                    background: 'rgba(232,69,60,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  }}>🔐</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Accedi per vedere i tuoi sconti</p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginTop: 4 }}>I tuoi sconti attivi e usati appariranno qui</p>
                  <Link to="/login" style={{
                    marginTop: 20, borderRadius: 14, background: '#E8453C', color: '#fff',
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Accedi
                  </Link>
                </motion.div>
              ) : myDiscounts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, marginBottom: 16,
                    background: 'rgba(196,162,101,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  }}>📋</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Nessuno sconto riscattato</p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginTop: 4 }}>Quando riscatti uno sconto, lo troverai qui</p>
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
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <Footer />
    </div>
  )
}
