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

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
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

/* ── Deal Card ── */
function DealCard({ deal, index, onNavigate }) {
  const r = deal.restaurant
  const photo = r?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
  const remaining = deal.max_redemptions ? deal.max_redemptions - (deal.total_redeemed || 0) : null
  const soldOut = remaining !== null && remaining <= 0
  const almostGone = remaining !== null && remaining > 0 && remaining <= Math.ceil(deal.max_redemptions * 0.25)
  const isDrop = deal.drop_time && new Date(deal.drop_time).getTime() > Date.now()
  const time = useCountdown(isDrop ? deal.drop_time : null)
  const pad = (n) => String(n).padStart(2, '0')

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={!soldOut && !isDrop ? { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' } : {}}
      whileTap={!soldOut && !isDrop ? { scale: 0.98 } : {}}
      onClick={() => !soldOut && !isDrop && onNavigate(r)}
      style={{
        background: '#fff', borderRadius: 18, overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        cursor: soldOut || isDrop ? 'default' : 'pointer',
        opacity: soldOut ? 0.65 : 1,
        transition: 'box-shadow 0.2s ease, opacity 0.3s ease',
      }}
    >
      {/* Discount strip — top, like RestaurantCard */}
      <div style={{
        padding: '6px 14px',
        background: soldOut
          ? '#D4CFC8'
          : isDrop
            ? 'linear-gradient(135deg, #C4A265, #d4b77a)'
            : 'linear-gradient(135deg, #a3e635 0%, #4ade80 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {almostGone && !soldOut && (
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: '#fff',
              animation: 'cityPulse 1.5s ease-in-out infinite',
              boxShadow: '0 0 4px rgba(255,255,255,0.5)',
            }} />
          )}
          <span style={{
            fontSize: 11, fontWeight: 700, color: soldOut ? '#fff' : isDrop ? '#fff' : '#1a2e05',
            textDecoration: soldOut ? 'line-through' : 'none',
          }}>
            {deal.discount_value}
          </span>
          {deal.title && (
            <>
              <span style={{
                width: 3, height: 3, borderRadius: '50%',
                background: soldOut ? 'rgba(255,255,255,0.4)' : isDrop ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)',
                display: 'inline-block',
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: soldOut ? 'rgba(255,255,255,0.7)' : isDrop ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.5)',
              }}>
                {deal.title}
              </span>
            </>
          )}
        </div>
        {/* Status label */}
        {soldOut && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Esaurito
          </span>
        )}
        {isDrop && time && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#fff',
            fontVariantNumeric: 'tabular-nums', fontFamily: "'DM Sans', sans-serif",
          }}>
            {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
          </span>
        )}
        {almostGone && !soldOut && !isDrop && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1a2e05', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Ultimi {remaining}
          </span>
        )}
      </div>

      {/* Card body — same layout as RestaurantCard default */}
      <div className="flex" style={{ gap: 14, padding: 14 }}>
        {/* Photo */}
        <div style={{
          width: 100, height: 100, borderRadius: 14, flexShrink: 0,
          overflow: 'hidden', position: 'relative',
        }}>
          {photo ? (
            <img
              src={photo.photo_url} alt={r?.name}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: soldOut ? 'grayscale(1)' : 'none',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', background: '#F0EBE3',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>🍽️</div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          {/* Name */}
          <h3 style={{
            fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
            fontSize: 14, fontWeight: 600, color: '#22181C',
            lineHeight: 1.5, marginBottom: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {r?.name}
          </h3>

          {/* Tagline */}
          {r?.tagline && (
            <p style={{ fontSize: 12, color: '#8A8680', fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.tagline}
            </p>
          )}

          {/* Cuisine + city */}
          <p style={{ fontSize: 11, color: '#8A8680', fontWeight: 500, marginBottom: 6 }}>
            {r?.cuisine_type}{r?.city ? ` · ${r.city}` : ''}
          </p>

          {/* Conditions */}
          {deal.conditions && (
            <p style={{ fontSize: 10, color: '#A89A86', marginBottom: 6 }}>
              {deal.conditions}
            </p>
          )}

          {/* Progress bar */}
          {deal.max_redemptions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, background: '#F0EBE3', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${soldOut ? 100 : Math.max(4, (remaining / deal.max_redemptions) * 100)}%` }}
                  transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: index * 0.06 + 0.3 }}
                  style={{
                    height: '100%', borderRadius: 2,
                    background: soldOut
                      ? '#D4CFC8'
                      : almostGone
                        ? '#E8453C'
                        : 'linear-gradient(90deg, #a3e635, #4ade80)',
                  }}
                />
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                color: soldOut ? '#B0ACA6' : almostGone ? '#E8453C' : '#8A8680',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {remaining}/{deal.max_redemptions}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Drop countdown expanded — only for drops */}
      {isDrop && time && (
        <div style={{
          padding: '12px 14px 14px', borderTop: '1px solid rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4A265" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span style={{ fontSize: 12, color: '#C4A265', fontWeight: 600 }}>
            Drop disponibile tra {time.h > 0 ? `${time.h} ore e ` : ''}{time.m} minuti
          </span>
        </div>
      )}
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

      {/* ── Content ── */}
      <div className="flex-1 px-4" style={{ paddingBottom: TAB_BAR_HEIGHT + 16 }}>

        {/* ═══ AVAILABLE TAB ═══ */}
        {tab === 'available' && (
          <>
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

            {/* Loading */}
            {loading && (
              <div className="flex flex-col gap-3 mt-4">
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    height: i === 1 ? 200 : 140, borderRadius: 18,
                    background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
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

            {/* Deals list */}
            {!loading && discounts.length > 0 && (
              <>
                {/* In evidenza */}
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '16px 0 14px 4px' }}>
                  In evidenza
                </p>

                {featuredDeal?.restaurant && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{ marginBottom: 16 }}
                  >
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

                {/* Tutti gli sconti */}
                {otherDeals.length > 0 && (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '4px 0 14px 4px' }}>
                      Tutti gli sconti
                    </p>
                    <div className="flex flex-col gap-3">
                      {otherDeals.map((deal, i) => (
                        <DealCard key={deal.id} deal={deal} index={i} onNavigate={handleNavigate} />
                      ))}
                    </div>
                  </>
                )}

                {/* Come funziona */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', margin: '24px 0 14px 4px' }}>
                    Come funziona
                  </p>
                  <div style={{
                    background: '#fff', borderRadius: 16, padding: 18,
                    border: '1px solid #E8E0D6',
                    boxShadow: '0 2px 8px rgba(34,24,28,0.04)',
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
              </>
            )}
          </>
        )}

        {/* ═══ MY DISCOUNTS TAB ═══ */}
        {tab === 'mine' && (
          <>
            {!user ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
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
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
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
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
