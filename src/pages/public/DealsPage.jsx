import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
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

export default function DealsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts, loading } = useActiveDiscounts()
  const [tab, setTab] = useState('available') // 'available' | 'mine'

  // TODO: fetch user's redeemed discounts for "I miei" tab
  const myDiscounts = []

  const featuredDeal = discounts[0]
  const otherDeals = discounts.slice(1)

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
                        onClick={(r) => navigate(`/restaurant/${r.slug || slugify(r.name || '')}`)}
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
                        {otherDeals.map((deal) => {
                          const r = deal.restaurant
                          const photo = r?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
                          return (
                            <motion.div
                              key={deal.id}
                              variants={fadeUp}
                              className="flex gap-3.5"
                              onClick={() => navigate(`/restaurant/${r?.slug || slugify(r?.name || '')}`)}
                              style={{
                                padding: 14, background: '#fff', borderRadius: 18,
                                border: '1px solid rgba(0,0,0,0.04)',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ width: 80, height: 80, borderRadius: 14, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                                {photo ? (
                                  <img src={photo.photo_url} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #e8d5c0, #d4c0a8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.6 }}>
                                    🍽️
                                  </div>
                                )}
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div className="flex items-baseline gap-2" style={{ marginBottom: 3 }}>
                                  <h3 style={{
                                    fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
                                    fontSize: 17, fontWeight: 600, color: '#22181C', lineHeight: 1.2,
                                  }}>
                                    {r?.name}
                                  </h3>
                                  <span style={{
                                    background: 'rgba(163,230,53,0.15)', color: '#22181C',
                                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                  }}>
                                    {deal.discount_value}
                                  </span>
                                </div>
                                <p style={{ fontSize: 12, color: '#8A8680', marginBottom: 6 }}>
                                  {r?.cuisine_type} · {r?.city}
                                </p>
                                {deal.max_redemptions && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ flex: 1, height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${Math.max(5, ((deal.max_redemptions - (deal.current_redemptions || 0)) / deal.max_redemptions) * 100)}%`,
                                        height: '100%', background: 'linear-gradient(135deg, #a3e635, #4ade80)', borderRadius: 2,
                                      }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#8A8680', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      {deal.max_redemptions - (deal.current_redemptions || 0)}/{deal.max_redemptions} rimasti
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )
                        })}
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
