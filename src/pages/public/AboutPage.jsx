import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Footer from '../../components/Layout/Footer'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

/* Hook per caricare follower counts da Supabase */
function useSiteConfig() {
  const [config, setConfig] = useState({
    instagram_followers: '—',
    tiktok_followers: '—',
    restaurants_count: '400+',
  })

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    supabase
      .from('site_config')
      .select('key, value')
      .in('key', ['instagram_followers', 'tiktok_followers', 'restaurants_count'])
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(r => { map[r.key] = r.value })
          setConfig(prev => ({ ...prev, ...map }))
        }
      })
  }, [])

  return config
}

export default function AboutPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const config = useSiteConfig()
  const [showSuggest, setShowSuggest] = useState(false)

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-ink)' }}>
      {/* ─── STICKY HEADER (mobile only) ─── */}
      <header className="md:hidden" style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(34, 24, 28, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 18px 12px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Torna indietro"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img
              src="/logo-full.svg"
              alt="ChiamamiBi"
              style={{ height: 20, width: 'auto', filter: 'brightness(0) invert(1)' }}
            />
          </Link>
          <div style={{ width: 36, height: 36 }} />
        </div>
      </header>

      <div className="flex-1">

        {/* ── Full-bleed hero ── */}
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Background gradients */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(232, 69, 60,0.18), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(196,162,101,0.08), transparent 50%)',
            pointerEvents: 'none',
          }} />

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '40px 24px 50px',
            }}
          >
            {/* Photo with glow */}
            <motion.div variants={fadeUp} style={{ marginBottom: 28, position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: -20,
                background: 'radial-gradient(circle, rgba(232, 69, 60,0.2), transparent 70%)',
                borderRadius: '50%', filter: 'blur(20px)', pointerEvents: 'none',
              }} />
              <img
                src="/bi-photo.JPG"
                alt="Bi"
                style={{
                  position: 'relative', width: 110, height: 110, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid rgba(255,255,255,0.15)',
                }}
              />
            </motion.div>

            {/* Logo */}
            <motion.div variants={fadeUp} style={{ marginBottom: 12 }}>
              <img
                src="/logo-full.svg"
                alt="Chiamami Bi"
                style={{ height: 36, width: 'auto', filter: 'brightness(0) invert(1)' }}
                draggable={false}
              />
            </motion.div>

            {/* Tagline */}
            <motion.p variants={fadeUp} style={{
              fontSize: 13, color: 'rgba(255,255,255,0.4)',
              fontWeight: 500, textAlign: 'center', letterSpacing: 0.5,
            }}>
              La guida food di Torino, raccontata come a un'amica
            </motion.p>

            {/* Stats row */}
            <motion.div
              variants={fadeUp}
              style={{
                display: 'flex', gap: 0, marginTop: 40, width: '100%', maxWidth: 380,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {[
                { num: config.restaurants_count, label: 'Posti provati', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
                  </svg>
                )},
                { num: config.instagram_followers, label: 'Instagram', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                )},
                { num: config.tiktok_followers, label: 'TikTok', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 00-.82-.05A6.34 6.34 0 003.15 15a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.8a8.25 8.25 0 004.76 1.5V6.86a4.84 4.84 0 01-1-.17z"/>
                  </svg>
                )},
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  style={{
                    flex: 1, textAlign: 'center', padding: '18px 8px',
                    borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{stat.icon}</div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{stat.num}</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ── Content on cream ── */}
        <div style={{
          background: 'var(--color-page)',
          borderRadius: '24px 24px 0 0',
          marginTop: -1,
          position: 'relative', zIndex: 2,
        }}>

          {/* ── Pull quote ── */}
          <section style={{ padding: '36px 24px 10px', maxWidth: 600, margin: '0 auto' }}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <p style={{
                fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em',
                fontSize: 20, color: 'var(--color-ink)',
                lineHeight: 1.9, textAlign: 'center',
              }}>
                "Mi chiamavano tutti Bea,<br />e io rispondevo sempre:<br />chiamami Bi!"
              </p>
              <p style={{
                fontSize: 12, color: 'var(--color-ink-55)', textAlign: 'center',
                marginTop: 12, fontWeight: 500,
              }}>
                Da qui è nato tutto
              </p>
            </motion.div>
          </section>

          {/* ── Divider ── */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--color-oro)', opacity: 0.4 }} />
          </div>

          {/* ── Story — editorial blocks ── */}
          <section style={{ padding: '12px 24px 28px', maxWidth: 600, margin: '0 auto' }}>
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            >
              {/* Block 1 — who she is + numbers */}
              <motion.div variants={fadeUp}>
                <p style={{
                  fontSize: 16, lineHeight: 1.6, color: 'var(--color-ink)', fontWeight: 700,
                }}>
                  Beatrice, 22 anni, Torino.
                </p>
                <p style={{
                  fontSize: 14, lineHeight: 1.8, color: 'var(--color-ink-70)', fontWeight: 500, marginTop: 8, textAlign: 'justify',
                }}>
                  Studentessa di giurisprudenza e food creator, Bi è oggi una delle voci più seguite del food popolare italiano. Oltre <strong style={{ color: 'var(--color-ink)' }}>130mila follower su Instagram</strong> e milioni di visualizzazioni ogni mese tra i suoi canali: una community che si affida ai suoi consigli per decidere dove mangiare stasera a Torino.
                </p>
              </motion.div>

              {/* Block 2 — what she does, with her quote */}
              <motion.div variants={fadeUp} style={{
                borderLeft: '3px solid var(--color-oro)',
                paddingLeft: 16,
              }}>
                <p style={{
                  fontSize: 14, lineHeight: 1.8, color: 'var(--color-ink-70)', fontWeight: 500, textAlign: 'justify',
                }}>
                  Racconta il <strong style={{ color: 'var(--color-ink)' }}>cibo pop</strong>: street food, piole storiche, pizze napoletane, porzioni abbondanti e menu fissi a trenta euro. Niente cucine stellate, niente tecnicismi.
                </p>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14, lineHeight: 1.6, color: 'var(--color-ink)',
                  fontStyle: 'italic', fontWeight: 500, marginTop: 12,
                }}>
                  «Non sono una critica culinaria, non uso termini complessi: mi limito a dire cosa mi piace.»
                </p>
              </motion.div>

              {/* Block 3 — origin story with her quote */}
              <motion.div variants={fadeUp}>
                <p style={{
                  fontSize: 14, lineHeight: 1.8, color: 'var(--color-ink-70)', fontWeight: 500, textAlign: 'justify',
                }}>
                  Ha aperto la pagina Instagram a <strong style={{ color: 'var(--color-ink)' }}>marzo 2024</strong> insieme al suo ragazzo, un po' per gioco, pubblicando gli stessi consigli che dava agli amici. Due anni dopo è diventata uno dei riferimenti del food italiano sui social.
                </p>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14, lineHeight: 1.6, color: 'var(--color-ink)',
                  fontStyle: 'italic', fontWeight: 500, marginTop: 12,
                }}>
                  «Eravamo appassionati di ristorazione, andavamo in giro a provare street food a Torino e ci siamo detti: perché non proviamo a fare una guida?»
                </p>
              </motion.div>
            </motion.div>
          </section>

          {/* ── Filosofia — red card ── */}
          <section style={{ padding: '0 24px 28px', maxWidth: 600, margin: '0 auto' }}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
              variants={fadeUp}
            >
              <div style={{
                borderRadius: 'var(--radius-lg)', padding: '20px 18px',
                background: 'var(--color-oro)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>La filosofia</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.95)' }}>
                  Una cernita rigorosa: Bi pubblica solo i posti che l'hanno convinta davvero, dove tornerebbe ad occhi chiusi. Voce semplice, racconti diretti, niente paroloni — come un'amica che ti dice dove andare stasera.
                </p>
              </div>
            </motion.div>
          </section>

          {/* ── Social follow cards ── */}
          <section style={{ padding: '0 24px 28px', maxWidth: 600, margin: '0 auto' }}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
              variants={stagger}
              style={{ display: 'flex', gap: 12 }}
            >
              {/* Instagram */}
              <motion.a
                variants={fadeUp}
                href="https://instagram.com/chiamamibi"
                target="_blank" rel="noopener noreferrer"
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, textDecoration: 'none',
                  background: 'var(--color-ink)', borderRadius: 'var(--radius-lg)', padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                  background: 'radial-gradient(circle, rgba(232, 69, 60,0.15), transparent 70%)',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{config.instagram_followers}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Follower</p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: 'var(--color-corallo)',
                }}>
                  Seguimi
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-corallo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </motion.a>

              {/* TikTok */}
              <motion.a
                variants={fadeUp}
                href="https://tiktok.com/@chiamamibi"
                target="_blank" rel="noopener noreferrer"
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, textDecoration: 'none',
                  background: 'var(--color-ink)', borderRadius: 'var(--radius-lg)', padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                  background: 'radial-gradient(circle, rgba(196,162,101,0.12), transparent 70%)',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 00-.82-.05A6.34 6.34 0 003.15 15a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.8a8.25 8.25 0 004.76 1.5V6.86a4.84 4.84 0 01-1-.17z"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{config.tiktok_followers}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Follower</p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: 'var(--color-corallo)',
                }}>
                  Seguimi
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-corallo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </motion.a>
            </motion.div>
          </section>

          {/* ── Parlano di Bi — press card ── */}
          <section style={{ padding: '4px 24px 28px', maxWidth: 600, margin: '0 auto' }}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
              variants={fadeUp}
            >
              <p style={{
                fontSize: 10, fontWeight: 600, color: 'var(--color-oro)',
                letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
              }}>
                Parlano di Bi
              </p>
              <a
                href="https://www.vanityfair.it/article/chiamami-bi-social-influencer-cibo-popolare"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', textDecoration: 'none',
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-lg)', padding: '18px 18px',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em',
                      fontSize: 17, color: 'var(--color-ink)',
                      lineHeight: 1.3, marginBottom: 6,
                    }}>
                      Vanity Fair Italia
                    </p>
                    <p style={{
                      fontSize: 12, lineHeight: 1.6, color: 'var(--color-ink-55)', fontWeight: 500,
                    }}>
                      Un ritratto di Bi, la ventenne torinese che racconta il cibo popolare sui social — come una pagina nata per gioco a marzo 2024 è diventata in due anni una delle voci più seguite del food italiano, tra street food, piole e porzioni abbondanti.
                    </p>
                  </div>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 600, color: 'var(--color-corallo)',
                    flexShrink: 0, marginTop: 4,
                  }}>
                    Leggi
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-corallo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
                  </span>
                </div>
              </a>
            </motion.div>
          </section>

          {/* ── Consiglia un ristorante ── */}
          <section style={{ padding: '0 24px 40px', maxWidth: 600, margin: '0 auto' }}>
            <button
              onClick={() => setShowSuggest(true)}
              style={{
                width: '100%', background: 'var(--color-corallo)', color: '#fff',
                borderRadius: 'var(--radius-lg)', padding: 18, fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer',
              }}
            >
              Consiglia un ristorante
            </button>
          </section>
        </div>
      </div>

      {showSuggest && (
        <SuggestRestaurantSheet userId={user?.id} onClose={() => setShowSuggest(false)} />
      )}

      <Footer />
    </div>
  )
}
