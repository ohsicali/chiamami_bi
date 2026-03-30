import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Footer from '../../components/Layout/Footer'

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

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: '#22181C' }}>
      <div className="flex-1">

        {/* ── Full-bleed hero ── */}
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Background gradients */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(232,69,60,0.18), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(196,162,101,0.08), transparent 50%)',
            pointerEvents: 'none',
          }} />

          {/* Back button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute', top: 16, left: 16, zIndex: 20,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
            aria-label="Torna indietro"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </motion.button>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '90px 24px 50px',
            }}
          >
            {/* Photo with glow */}
            <motion.div variants={fadeUp} style={{ marginBottom: 28, position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: -20,
                background: 'radial-gradient(circle, rgba(232,69,60,0.2), transparent 70%)',
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

            {/* Title */}
            <motion.h1 variants={fadeUp} style={{
              fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
              fontSize: 36, fontWeight: 700, color: '#fff',
              marginBottom: 12, textAlign: 'center', letterSpacing: -0.5,
            }}>
              Chiamami<span style={{ color: '#E8453C' }}>Bi</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p variants={fadeUp} style={{
              fontSize: 15, color: 'rgba(255,255,255,0.4)',
              fontWeight: 500, textAlign: 'center', letterSpacing: 0.5,
            }}>
              La guida che non sapevi di volere
            </motion.p>

            {/* Stats row — integrated in hero */}
            <motion.div
              variants={fadeUp}
              style={{
                display: 'flex', gap: 0, marginTop: 40, width: '100%', maxWidth: 380,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 16, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {[
                { num: '100+', label: 'Posti provati', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
                  </svg>
                )},
                { num: '25K', label: 'Instagram', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                )},
                { num: '50K', label: 'TikTok', icon: (
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
          background: '#FAF7F2',
          borderRadius: '24px 24px 0 0',
          marginTop: -1,
          position: 'relative', zIndex: 2,
        }}>

          {/* ── Story ── */}
          <section style={{ padding: '36px 24px 28px', maxWidth: 600, margin: '0 auto' }}>
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
            >
              <motion.p variants={fadeUp} style={{
                fontSize: 16, lineHeight: 1.8, color: '#22181C', fontWeight: 600,
                marginBottom: 16,
              }}>
                Torino è una città che si scopre a tavola. Dietro ogni portone del centro,
                nelle vie strette del Quadrilatero, tra i palazzi liberty di San Salvario,
                si nascondono trattorie, osterie e ristoranti che raccontano storie di
                passione e tradizione.
              </motion.p>

              <motion.p variants={fadeUp} style={{
                fontSize: 16, lineHeight: 1.8, color: '#22181C', fontWeight: 600,
                marginBottom: 16,
              }}>
                Ho iniziato a esplorare la scena gastronomica torinese per pura curiosità,
                provando un posto nuovo ogni settimana. Dalle piole storiche dove il vino
                si beve sfuso ai ramen bar più autentici, dalla pizza napoletana verace
                al fine dining stellato — ho assaggiato tutto.
              </motion.p>

              <motion.p variants={fadeUp} style={{
                fontSize: 16, lineHeight: 1.8, color: '#22181C', fontWeight: 600,
              }}>
                Gli amici hanno iniziato a chiedermi: "Dove mangiamo stasera?" E così è
                nata l'idea di ChiamamiBi — una guida personale, sincera, fatta di posti
                che ho provato davvero e dove tornerei ad occhi chiusi.
              </motion.p>
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
                borderRadius: 16, padding: '20px 18px',
                background: '#E8453C',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>La mia filosofia</span>
                </div>
                <p style={{ fontSize: 16, lineHeight: 1.8, color: 'rgba(255,255,255,0.95)' }}>
                  Consiglio solo posti dove tornerei. Ogni ristorante su ChiamamiBi è un posto dove sono stata almeno due volte. Niente collaborazioni a pagamento, niente recensioni di cortesia — solo consigli genuini, come quelli che daresti alla tua migliore amica.
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
                  background: '#22181C', borderRadius: 16, padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                  background: 'radial-gradient(circle, rgba(232,69,60,0.15), transparent 70%)',
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
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 2 }}>25K</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Follower Instagram</p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: '#E8453C',
                }}>
                  Seguimi
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
                  background: '#22181C', borderRadius: 16, padding: '20px 16px',
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
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 2 }}>50K</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Follower TikTok</p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: '#E8453C',
                }}>
                  Seguimi
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </motion.a>
            </motion.div>
          </section>

          {/* ── Suggerisci un posto ── */}
          <section style={{ padding: '0 24px 40px', maxWidth: 600, margin: '0 auto' }}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
              variants={fadeUp}
            >
              <div style={{
                background: '#fff', borderRadius: 16, padding: '24px 20px',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#22181C' }}>Suggerisci un posto</p>
                </div>
                <p style={{ fontSize: 14, color: '#8A8680', marginBottom: 18, lineHeight: 1.5 }}>
                  Conosci un ristorante che dovrei provare? Scrivimi!
                </p>

                <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="text"
                    placeholder="Il tuo nome"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.08)', background: '#FAF7F2',
                      fontSize: 14, color: '#22181C', outline: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Nome del ristorante"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.08)', background: '#FAF7F2',
                      fontSize: 14, color: '#22181C', outline: 'none',
                    }}
                  />
                  <textarea
                    placeholder="Perché lo consigli?"
                    rows={3}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.08)', background: '#FAF7F2',
                      fontSize: 14, color: '#22181C', outline: 'none', resize: 'none',
                    }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    style={{
                      width: '100%', padding: '14px 20px', borderRadius: 12,
                      background: '#F0EBE3', color: '#22181C', border: 'none',
                      fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Invia suggerimento
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  )
}
