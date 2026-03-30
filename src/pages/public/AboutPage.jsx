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
    <div className="flex flex-col min-h-dvh" style={{ background: '#FAF7F2' }}>
      <div className="flex-1">

        {/* ── Hero dark section ── */}
        <section style={{
          background: '#22181C',
          position: 'relative',
          overflow: 'hidden',
          paddingBottom: 60,
        }}>
          {/* Gradient accents */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 70% 0%, rgba(232,69,60,0.15), transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(196,162,101,0.1), transparent 50%)',
            pointerEvents: 'none',
          }} />

          {/* Back button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute', top: 16, left: 16, zIndex: 20,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
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
              paddingTop: 80, paddingLeft: 24, paddingRight: 24,
            }}
          >
            {/* Photo */}
            <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
              <img
                src="/bi-photo.JPG"
                alt="Bi"
                style={{
                  width: 120, height: 120, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid rgba(232,69,60,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              />
            </motion.div>

            {/* Title */}
            <motion.h1 variants={fadeUp} style={{
              fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
              fontSize: 32, fontWeight: 700, color: '#fff',
              marginBottom: 8, textAlign: 'center',
            }}>
              Chiamami<span style={{ color: '#E8453C' }}>Bi</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p variants={fadeUp} style={{
              fontSize: 16, color: 'rgba(255,255,255,0.5)',
              fontWeight: 500, textAlign: 'center',
            }}>
              La tua guida a Torino
            </motion.p>
          </motion.div>

          {/* Curved bottom edge */}
          <div style={{
            position: 'absolute', bottom: -1, left: 0, right: 0, height: 40,
            background: '#FAF7F2', borderRadius: '20px 20px 0 0',
          }} />
        </section>

        {/* ── Story section ── */}
        <section style={{ padding: '0 24px 32px', maxWidth: 600, margin: '0 auto' }}>
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
              al fine dining stellato — ho assaggiato tutto quello che questa città ha da offrire.
            </motion.p>

            <motion.p variants={fadeUp} style={{
              fontSize: 16, lineHeight: 1.8, color: '#22181C', fontWeight: 600,
            }}>
              Gli amici hanno iniziato a chiedermi: "Dove mangiamo stasera?" E così è
              nata l'idea di ChiamamiBi: una guida personale, sincera, fatta di posti
              che ho provato davvero e dove tornerei ad occhi chiusi.
            </motion.p>
          </motion.div>
        </section>

        {/* ── Filosofia — red card (like Cosa prendere) ── */}
        <section style={{ padding: '0 24px 32px', maxWidth: 600, margin: '0 auto' }}>
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

        {/* ── Numeri / Stats ── */}
        <section style={{ padding: '0 24px 32px', maxWidth: 600, margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-30px' }}
            variants={stagger}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}
          >
            {[
              { num: '100+', label: 'Posti provati' },
              { num: '2+', label: 'Visite minimo' },
              { num: '0', label: 'Sponsorizzazioni' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                style={{
                  background: '#F0EBE3', borderRadius: 14, padding: '20px 12px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: 24, fontWeight: 800, color: '#22181C', marginBottom: 4 }}>{stat.num}</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#8A8680', lineHeight: 1.3 }}>{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Social — dark card (like Chi è Bi) ── */}
        <section style={{ padding: '0 24px 32px', maxWidth: 600, margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-30px' }}
            variants={fadeUp}
          >
            <div style={{
              background: '#F0EBE3', borderRadius: 16, padding: '24px 20px',
            }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#22181C', marginBottom: 6 }}>Seguimi</p>
              <p style={{ fontSize: 14, color: '#8A8680', marginBottom: 18, lineHeight: 1.5 }}>
                Nuove scoperte ogni settimana
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <a href="https://instagram.com/chiamamibi" target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#22181C', borderRadius: 12, padding: '14px 16px',
                  textDecoration: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                  Instagram
                </a>
                <a href="https://tiktok.com/@chiamamibi" target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#22181C', borderRadius: 12, padding: '14px 16px',
                  textDecoration: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 00-.82-.05A6.34 6.34 0 003.15 15a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.8a8.25 8.25 0 004.76 1.5V6.86a4.84 4.84 0 01-1-.17z"/>
                  </svg>
                  TikTok
                </a>
              </div>
            </div>
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

      <Footer />
    </div>
  )
}
