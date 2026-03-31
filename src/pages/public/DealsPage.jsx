import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'

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

const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

export default function DealsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts, loading } = useActiveDiscounts()
  const [tab, setTab] = useState('available')

  const myDiscounts = []

  const featuredDeal = discounts[0]
  const otherDeals = discounts.slice(1)

  const remaining = (deal) =>
    deal.max_redemptions ? deal.max_redemptions - (deal.current_redemptions || 0) : null
  const pct = (deal) =>
    deal.max_redemptions
      ? Math.max(5, ((deal.max_redemptions - (deal.current_redemptions || 0)) / deal.max_redemptions) * 100)
      : 100

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
          {['available', 'mine'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, textAlign: 'center', padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: tab === t ? '#22181C' : 'transparent',
                color: tab === t ? '#FAF7F2' : '#8A8680',
                border: 'none', cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {t === 'available' ? 'Disponibili' : 'I miei'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-5" style={{ paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        <motion.div initial="hidden" animate="visible" variants={stagger}>

          {/* ═══ AVAILABLE TAB ═══ */}
          {tab === 'available' && (
            <>
              {/* CTA for non-logged users */}
              {!user && (
                <motion.div variants={fadeUp} style={{
                  borderRadius: 18, padding: '20px 22px', marginBottom: 20, marginTop: 16,
                  background: '#fff',
                  border: '1px solid #E8E0D6',
                }}>
                  <div className="flex items-start gap-3">
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(163,230,53,0.15), rgba(74,222,128,0.15))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 18,
                    }}>🏷️</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#22181C', marginBottom: 4 }}>Registrati per sbloccare gli sconti</p>
                      <p style={{ fontSize: 12, color: '#8A8680', lineHeight: 1.5, marginBottom: 14 }}>Crea un account gratuito per accedere a sconti esclusivi nei ristoranti selezionati da Bi</p>
                      <Link to="/login" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        borderRadius: 12, background: '#E8453C', color: '#fff',
                        padding: '10px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                      }}>
                        Registrati gratis
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col gap-4 mt-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: i === 1 ? 200 : 100, borderRadius: 18, background: '#fff', border: '1px solid #E8E0D6' }} className="skeleton" />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && discounts.length === 0 && (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 60, paddingBottom: 60 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(163,230,53,0.12), rgba(74,222,128,0.12))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, marginBottom: 16,
                  }}>🏷️</div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#22181C', fontFamily: "'TAN Songbird', serif" }}>Nessuno sconto attivo</p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginTop: 6, maxWidth: 240, lineHeight: 1.5 }}>Torna presto, Bi sta preparando nuove offerte per te!</p>
                  <Link to="/" style={{
                    marginTop: 24, borderRadius: 14, background: '#22181C', color: '#FAF7F2',
                    padding: '12px 24px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Esplora i ristoranti
                  </Link>
                </motion.div>
              )}

              {/* Deals list */}
              {!loading && discounts.length > 0 && (
                <>
                  {/* Section label */}
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: '#8A8680', margin: '20px 0 14px 2px' }}>
                    In evidenza
                  </p>

                  {/* ── HERO FEATURED DEAL ── */}
                  {featuredDeal && (
                    <motion.div
                      variants={fadeUp}
                      onClick={() => navigate(`/restaurant/${featuredDeal.restaurant?.slug || slugify(featuredDeal.restaurant?.name || '')}`)}
                      style={{
                        borderRadius: 20, overflow: 'hidden', position: 'relative',
                        marginBottom: 20, cursor: 'pointer',
                        background: '#fff', border: '1px solid #E8E0D6',
                      }}
                    >
                      {/* Photo */}
                      <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                        {featuredDeal.restaurant?.photos?.[0]?.photo_url ? (
                          <img
                            src={featuredDeal.restaurant.photos[0].photo_url}
                            alt={featuredDeal.restaurant?.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #e8d5c0, #d4c0a8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, opacity: 0.5 }}>
                            🍽️
                          </div>
                        )}
                        {/* Gradient overlay at bottom for blending */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />
                        {/* Discount badge */}
                        <div style={{
                          position: 'absolute', top: 14, right: 14,
                          background: 'linear-gradient(135deg, #a3e635, #4ade80)',
                          color: '#1a2e05', fontSize: 15, fontWeight: 800,
                          padding: '6px 14px', borderRadius: 12,
                          boxShadow: '0 4px 12px rgba(163,230,53,0.3)',
                        }}>
                          {featuredDeal.discount_value}
                        </div>
                        {/* Gold badge */}
                        <div style={{
                          position: 'absolute', top: 14, left: 14,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
                          color: '#C4A265',
                          fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                          padding: '5px 10px', borderRadius: 8,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#C4A265"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
                          Scelto da Bi
                        </div>
                        {/* Restaurant name on photo */}
                        <h3 style={{
                          position: 'absolute', bottom: 14, left: 18, right: 18,
                          fontFamily: "'TAN Songbird', serif",
                          fontSize: 22, fontWeight: 600, color: '#fff', lineHeight: 1.15,
                          textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                        }}>
                          {featuredDeal.restaurant?.name}
                        </h3>
                      </div>

                      {/* Info section */}
                      <div style={{ padding: '16px 18px 18px' }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: remaining(featuredDeal) !== null ? 12 : 0 }}>
                          <span style={{ fontSize: 12, color: '#8A8680' }}>
                            {featuredDeal.restaurant?.cuisine_type}
                          </span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D4CFC8', display: 'inline-block' }} />
                          <span style={{ fontSize: 12, color: '#8A8680' }}>
                            {featuredDeal.restaurant?.city}
                          </span>
                          {featuredDeal.title && (
                            <>
                              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D4CFC8', display: 'inline-block' }} />
                              <span style={{ fontSize: 12, color: '#22181C', fontWeight: 600 }}>
                                {featuredDeal.title}
                              </span>
                            </>
                          )}
                        </div>
                        {/* Progress bar */}
                        {remaining(featuredDeal) !== null && (
                          <div className="flex items-center gap-3">
                            <div style={{ flex: 1, height: 5, background: '#F0EBE3', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct(featuredDeal)}%`,
                                height: '100%', background: 'linear-gradient(135deg, #a3e635, #4ade80)', borderRadius: 3,
                                transition: 'width 0.6s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#8A8680', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {remaining(featuredDeal)}/{featuredDeal.max_redemptions} rimasti
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Other deals ── */}
                  {otherDeals.length > 0 && (
                    <>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: '#8A8680', margin: '4px 0 14px 2px' }}>
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
                                border: '1px solid #E8E0D6',
                                cursor: 'pointer',
                                transition: 'box-shadow 0.2s ease',
                              }}
                            >
                              {/* Photo thumbnail */}
                              <div style={{
                                width: 80, height: 80, borderRadius: 14, flexShrink: 0, overflow: 'hidden', position: 'relative',
                              }}>
                                {photo ? (
                                  <img src={photo.photo_url} alt={r?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                                    🍽️
                                  </div>
                                )}
                                {/* Discount badge on photo */}
                                <div style={{
                                  position: 'absolute', bottom: 6, right: 6,
                                  background: 'linear-gradient(135deg, #a3e635, #4ade80)',
                                  color: '#1a2e05', fontSize: 10, fontWeight: 800,
                                  padding: '3px 7px', borderRadius: 7,
                                }}>
                                  {deal.discount_value}
                                </div>
                              </div>

                              {/* Info */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <h3 style={{
                                  fontFamily: "'TAN Songbird', serif",
                                  fontSize: 16, fontWeight: 600, color: '#22181C', lineHeight: 1.2,
                                  marginBottom: 4,
                                }}>
                                  {r?.name}
                                </h3>
                                <p style={{ fontSize: 12, color: '#8A8680', marginBottom: remaining(deal) !== null ? 8 : 0 }}>
                                  {r?.cuisine_type} · {r?.city}
                                </p>
                                {remaining(deal) !== null && (
                                  <div className="flex items-center gap-2">
                                    <div style={{ flex: 1, height: 4, background: '#F0EBE3', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${pct(deal)}%`,
                                        height: '100%', background: 'linear-gradient(135deg, #a3e635, #4ade80)', borderRadius: 2,
                                      }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#8A8680', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      {remaining(deal)}/{deal.max_redemptions}
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

                  {/* ── Come funziona ── */}
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: '#8A8680', margin: '28px 0 14px 2px' }}>
                    Come funziona
                  </p>
                  <motion.div variants={fadeUp} style={{
                    background: '#fff', borderRadius: 18, padding: '20px 22px',
                    border: '1px solid #E8E0D6',
                  }}>
                    {[
                      { num: '1', title: 'Mostra il QR code', desc: 'Apri lo sconto e mostra il codice al ristorante', color: '#E8453C' },
                      { num: '2', title: 'Ottieni lo sconto', desc: 'Il ristorante valida il codice e applica lo sconto', color: '#C4A265' },
                      { num: '3', title: 'Goditi il risparmio', desc: 'Lo sconto viene applicato direttamente al conto', color: '#4ade80' },
                    ].map((step, i) => (
                      <div key={i} className="flex gap-3.5" style={{ marginBottom: i < 2 ? 18 : 0, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: step.color + '12',
                          border: `1px solid ${step.color}25`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 800, color: step.color,
                          flexShrink: 0,
                        }}>{step.num}</div>
                        <div style={{ paddingTop: 2 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#22181C', marginBottom: 3 }}>{step.title}</p>
                          <p style={{ fontSize: 12, color: '#8A8680', lineHeight: 1.5 }}>{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </>
              )}
            </>
          )}

          {/* ═══ MY DISCOUNTS TAB ═══ */}
          {tab === 'mine' && (
            <>
              {!user ? (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 60, paddingBottom: 60 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 20,
                    background: 'rgba(232,69,60,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, marginBottom: 16,
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#22181C', fontFamily: "'TAN Songbird', serif" }}>Accedi per vedere i tuoi sconti</p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginTop: 6, maxWidth: 240, lineHeight: 1.5 }}>I tuoi sconti attivi e già usati appariranno qui</p>
                  <Link to="/login" style={{
                    marginTop: 24, borderRadius: 14, background: '#E8453C', color: '#fff',
                    padding: '12px 24px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    Accedi
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  </Link>
                </motion.div>
              ) : myDiscounts.length === 0 ? (
                <motion.div variants={fadeUp} className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 60, paddingBottom: 60 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 20,
                    background: 'rgba(196,162,101,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, marginBottom: 16,
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4A265" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
                  </div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#22181C', fontFamily: "'TAN Songbird', serif" }}>Nessuno sconto riscattato</p>
                  <p style={{ fontSize: 13, color: '#8A8680', marginTop: 6, maxWidth: 240, lineHeight: 1.5 }}>Quando riscatti uno sconto, lo troverai qui</p>
                  <button
                    onClick={() => setTab('available')}
                    style={{
                      marginTop: 24, borderRadius: 14, background: '#22181C', color: '#FAF7F2',
                      padding: '12px 24px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
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

      {/* ── Footer ── */}
      <Footer />
    </div>
  )
}
