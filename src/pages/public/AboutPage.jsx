import { useState, useEffect } from 'react'
import { TR_REVEAL } from '../../lib/motion'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Footer from '../../components/Layout/Footer'
import MobileLogoHeader from '../../components/Layout/MobileLogoHeader'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import { useAuth } from '../../lib/hooks/useAuth'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import MetaTags from '../../components/SEO/MetaTags'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: TR_REVEAL },
}
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }

function useSiteConfig() {
  const [config, setConfig] = useState({
    instagram_followers: '130k+',
    tiktok_followers: '50k+',
    restaurants_count: '400+',
  })
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    supabase
      .from('site_config')
      .select('key, value')
      .in('key', ['instagram_followers', 'tiktok_followers', 'restaurants_count'])
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(r => { map[r.key] = r.value })
        setConfig(prev => ({ ...prev, ...map }))
      })
  }, [])
  return config
}

function IconInstagram({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function IconTikTok({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 00-.82-.05A6.34 6.34 0 003.15 15a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.8a8.25 8.25 0 004.76 1.5V6.86a4.84 4.84 0 01-1-.17z" />
    </svg>
  )
}
function IconArrow({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
function IconExternal({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M7 7h10v10" />
    </svg>
  )
}

export default function AboutPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isDesktop = useIsDesktop()
  const config = useSiteConfig()
  const [showSuggest, setShowSuggest] = useState(false)

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-page)', overflowX: 'hidden' }}>
      <MetaTags
        title="Chi è Bi — La guida ristoranti di Torino | ChiamamiBi"
        description="Bi è una community di food lover di Torino: 130k+ su Instagram, 50k+ su TikTok, oltre 400 ristoranti consigliati. Scopri la storia dietro ChiamamiBi."
        url="https://chiamamibi.com/about"
        canonical="https://chiamamibi.com/about"
        type="website"
      />
      {!isDesktop && <MobileLogoHeader />}

      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: 720,
        margin: '0 auto',
        padding: isDesktop ? '32px 32px 60px' : '8px 18px 36px',
      }}>
        {/* ── Eyebrow + page title ── */}
        <motion.div
          initial="hidden" animate="visible" variants={stagger}
          style={{ paddingTop: isDesktop ? 0 : 8, paddingBottom: isDesktop ? 28 : 18 }}
        >
          <motion.div variants={fadeUp} style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--color-corallo-ink)', marginBottom: 10,
          }}>
            Chi è Bi
          </motion.div>
          <motion.h1 variants={fadeUp} style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900,
            fontSize: isDesktop ? 44 : 30,
            letterSpacing: '-0.025em', lineHeight: 1.05,
            color: 'var(--color-ink)', margin: 0,
          }}>
            La guida food di Torino,<br />raccontata come a un'amica.
          </motion.h1>
          <motion.p variants={fadeUp} style={{
            fontSize: isDesktop ? 15 : 14,
            color: 'var(--color-ink-70)', marginTop: 12,
            lineHeight: 1.5, maxWidth: 540,
          }}>
            Niente cucine stellate, niente paroloni — solo i posti che valgono davvero, scelti uno per uno.
          </motion.p>
        </motion.div>

        {/* ── Hero corallo card (foto Bi + stats) ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          style={{
            position: 'relative', overflow: 'hidden',
            background: 'var(--color-cta)', color: '#fff',
            borderRadius: isDesktop ? 28 : 22,
            padding: isDesktop ? 28 : 22,
            display: 'grid',
            gridTemplateColumns: isDesktop ? '120px 1fr' : '88px 1fr',
            gap: isDesktop ? 22 : 16,
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(34,24,28,.08)',
          }}
        >
          {/* decorative blob */}
          <span aria-hidden style={{
            position: 'absolute', top: -50, right: -60,
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Photo */}
          <div style={{
            width: isDesktop ? 120 : 88, height: isDesktop ? 120 : 88,
            borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            border: '3px solid rgba(255,255,255,.85)',
            boxShadow: '0 6px 18px rgba(34,24,28,.18)',
            background: 'rgba(255,255,255,.1)',
          }}>
            <img
              src="/bi-photo.webp"
              alt="Bi"
              width="240"
              height="240"
              decoding="async"
              fetchpriority="high"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>

          {/* Body */}
          <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontWeight: 900,
              fontSize: isDesktop ? 26 : 20, letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              Beatrice, 22, Torino
            </div>
            <div style={{ fontSize: isDesktop ? 13 : 12, color: 'rgba(255,255,255,.85)', marginTop: 6, lineHeight: 1.45 }}>
              Studentessa di giurisprudenza e food creator. Una delle voci più seguite del food popolare italiano.
            </div>

            {/* Inline stats */}
            <div style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}>
              {[
                { num: config.restaurants_count, lbl: 'Posti provati' },
                { num: config.instagram_followers, lbl: 'Instagram' },
                { num: config.tiktok_followers, lbl: 'TikTok' },
              ].map(s => (
                <div key={s.lbl} style={{
                  background: 'rgba(255,255,255,.14)',
                  border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 12,
                  padding: isDesktop ? '10px 8px' : '9px 6px',
                  textAlign: 'center',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontWeight: 900,
                    fontSize: isDesktop ? 18 : 16, letterSpacing: '-0.02em',
                    lineHeight: 1, color: '#fff',
                  }}>{s.num}</div>
                  <div style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,.75)',
                    marginTop: 5,
                  }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Pull quote editorial (Caveat) ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          style={{ padding: isDesktop ? '40px 0 12px' : '32px 6px 8px', textAlign: 'center' }}
        >
          <div style={{
            fontFamily: 'var(--font-editorial, "Caveat", cursive)',
            fontSize: isDesktop ? 38 : 30, lineHeight: 1.15,
            color: 'var(--color-ink)',
          }}>
            "Mi chiamavano tutti Bea, e io rispondevo<br />sempre: chiamami Bi!"
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--color-ink-55)',
            marginTop: 10,
          }}>
            Da qui è nato tutto
          </div>
        </motion.section>

        {/* ── Storia (white cards) ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
            paddingTop: 18,
          }}
        >
          {/* Card 1 — chi è */}
          <motion.div variants={fadeUp} style={cardStyle()}>
            <div style={kickerStyle('var(--color-corallo-ink)')}>La voce</div>
            <p style={bodyStyle()}>
              Oltre <strong style={{ color: 'var(--color-ink)' }}>130mila follower su Instagram</strong> e milioni di visualizzazioni al mese: una community che si affida ai consigli di Bi per decidere dove mangiare stasera a Torino.
            </p>
          </motion.div>

          {/* Card 2 — il cibo pop */}
          <motion.div variants={fadeUp} style={cardStyle()}>
            <div style={kickerStyle('var(--color-corallo-ink)')}>Cosa racconta</div>
            <p style={bodyStyle()}>
              <strong style={{ color: 'var(--color-ink)' }}>Cibo pop</strong>: street food, piole storiche, pizze napoletane, porzioni abbondanti e menu fissi a trenta euro.
            </p>
            <p style={{
              fontFamily: 'var(--font-editorial, "Caveat", cursive)',
              fontSize: 22, lineHeight: 1.2, color: 'var(--color-ink)',
              marginTop: 12,
            }}>
              "Non sono una critica culinaria, mi limito a dire cosa mi piace."
            </p>
          </motion.div>

          {/* Card 3 — origine, span 2 col su desktop */}
          <motion.div variants={fadeUp} style={{ ...cardStyle(), gridColumn: isDesktop ? '1 / -1' : 'auto' }}>
            <div style={kickerStyle('var(--color-corallo-ink)')}>Come è nato</div>
            <p style={bodyStyle()}>
              Bi ha aperto la pagina Instagram a <strong style={{ color: 'var(--color-ink)' }}>marzo 2024</strong> insieme al suo ragazzo, un po' per gioco, pubblicando gli stessi consigli che dava agli amici. Due anni dopo è diventata uno dei riferimenti del food italiano sui social.
            </p>
            <p style={{
              fontFamily: 'var(--font-editorial, "Caveat", cursive)',
              fontSize: 22, lineHeight: 1.2, color: 'var(--color-ink)',
              marginTop: 12,
            }}>
              "Eravamo appassionati di ristorazione, andavamo in giro a provare street food a Torino e ci siamo detti: perché non proviamo a fare una guida?"
            </p>
          </motion.div>
        </motion.section>

        {/* ── Filosofia — oro accent block ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          style={{
            marginTop: 22,
            background: 'linear-gradient(135deg, rgba(176,137,84,.12), rgba(176,137,84,.04))',
            border: '1px solid rgba(176,137,84,.35)',
            borderRadius: 18,
            padding: isDesktop ? '22px 24px' : '20px 18px',
          }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--color-oro-deep, #8E6B3E)',
            marginBottom: 8,
          }}>
            La filosofia
          </div>
          <p style={{
            fontFamily: 'var(--font-editorial, "Caveat", cursive)',
            fontSize: isDesktop ? 26 : 22, lineHeight: 1.25,
            color: 'var(--color-ink)',
          }}>
            Pubblico solo i posti che mi hanno convinta davvero, dove tornerei ad occhi chiusi. Voce semplice, racconti diretti — come un'amica che ti dice dove andare stasera.
          </p>
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'var(--color-ink-70)', marginTop: 8,
          }}>
            — Bi
          </div>
        </motion.section>

        {/* ── Social cards (ink) ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          style={{
            marginTop: 22,
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(2, 1fr)',
          }}
        >
          <motion.a
            variants={fadeUp}
            href="https://instagram.com/chiamamibi"
            target="_blank" rel="noopener noreferrer"
            style={socialCardStyle()}
          >
            <span aria-hidden style={socialBlobStyle('rgba(232,69,60,.18)')} />
            <div style={socialIconStyle()}><IconInstagram size={18} /></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', color: '#fff' }}>
                {config.instagram_followers}
              </div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontWeight: 600, marginTop: 2 }}>
                Follower Instagram
              </div>
            </div>
            <div style={socialCtaStyle()}>
              Seguimi <IconArrow color="var(--color-corallo)" />
            </div>
          </motion.a>

          <motion.a
            variants={fadeUp}
            href="https://tiktok.com/@chiamamibi"
            target="_blank" rel="noopener noreferrer"
            style={socialCardStyle()}
          >
            <span aria-hidden style={socialBlobStyle('rgba(176,137,84,.18)')} />
            <div style={socialIconStyle()}><IconTikTok size={18} /></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', color: '#fff' }}>
                {config.tiktok_followers}
              </div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontWeight: 600, marginTop: 2 }}>
                Follower TikTok
              </div>
            </div>
            <div style={socialCtaStyle()}>
              Seguimi <IconArrow color="var(--color-corallo)" />
            </div>
          </motion.a>
        </motion.section>

        {/* ── Press card ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          style={{ marginTop: 22 }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--color-corallo-ink)',
            marginBottom: 10,
          }}>
            Parlano di Bi
          </div>
          <a
            href="https://www.vanityfair.it/article/chiamami-bi-social-influencer-cibo-popolare"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              gap: 14, textDecoration: 'none',
              background: '#fff', border: '1px solid var(--color-ink-05)',
              borderRadius: 16, padding: isDesktop ? '20px 22px' : '16px 18px',
              transition: 'border-color .15s, transform .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-ink-05)'; e.currentTarget.style.transform = '' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 900,
                fontSize: isDesktop ? 18 : 16, letterSpacing: '-0.02em',
                color: 'var(--color-ink)', marginBottom: 6,
              }}>
                Vanity Fair Italia
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-ink-70)' }}>
                Un ritratto di Bi, la ventenne torinese che racconta il cibo popolare sui social — da pagina nata per gioco a riferimento del food italiano.
              </div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, color: 'var(--color-corallo)',
              flexShrink: 0, marginTop: 4,
            }}>
              Leggi <IconExternal color="var(--color-corallo)" />
            </span>
          </a>
        </motion.section>

        {/* ── CTA Suggerisci (ink card + corallo button, come HomeFeedV4) ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          style={{ marginTop: 22 }}
        >
          <div style={{
            position: 'relative', overflow: 'hidden',
            background: 'var(--color-ink)', color: '#fff',
            borderRadius: isDesktop ? 24 : 20,
            padding: isDesktop ? 26 : 22,
            display: 'grid',
            gridTemplateColumns: isDesktop ? '1fr auto' : '1fr',
            gap: isDesktop ? 18 : 14,
            alignItems: 'center',
          }}>
            <span aria-hidden style={{
              position: 'absolute', top: -40, right: -40, width: 160, height: 160,
              background: 'radial-gradient(circle, rgba(232,69,60,.25), transparent 70%)',
              borderRadius: '50%',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 900,
                fontSize: isDesktop ? 22 : 18, letterSpacing: '-0.01em', lineHeight: 1.15,
                marginBottom: 6,
              }}>
                Conosci un posto che manca?
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.4, maxWidth: 380 }}>
                Scrivimi nome + zona. Se è buono, entra nella guida.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSuggest(true)}
              style={{
                padding: isDesktop ? '12px 18px' : '12px 16px',
                background: 'var(--color-cta)', color: '#fff',
                borderRadius: 999, fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
                whiteSpace: 'nowrap', position: 'relative', zIndex: 1,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 6px 14px rgba(232,69,60,.35)',
              }}
            >
              Suggerisci →
            </button>
          </div>
        </motion.section>
      </main>

      {showSuggest && (
        <SuggestRestaurantSheet
          userId={user?.id}
          userEmail={user?.email ?? null}
          userName={user?.user_metadata?.full_name ?? null}
          onClose={() => setShowSuggest(false)}
        />
      )}

      <Footer />
    </div>
  )
}

function cardStyle() {
  return {
    background: '#fff',
    border: '1px solid var(--color-ink-05)',
    borderRadius: 16,
    padding: '18px 18px',
  }
}
function kickerStyle(color) {
  return {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color,
    marginBottom: 8,
  }
}
function bodyStyle() {
  return {
    fontSize: 14, lineHeight: 1.65, color: 'var(--color-ink-70)',
    fontWeight: 500,
  }
}
function socialCardStyle() {
  return {
    position: 'relative', overflow: 'hidden', textDecoration: 'none',
    background: 'var(--color-ink)', color: '#fff',
    borderRadius: 18, padding: '20px 18px',
    display: 'flex', flexDirection: 'column', gap: 12,
  }
}
function socialBlobStyle(color) {
  return {
    position: 'absolute', top: -30, right: -30, width: 120, height: 120,
    background: `radial-gradient(circle, ${color}, transparent 70%)`,
    pointerEvents: 'none',
  }
}
function socialIconStyle() {
  return {
    width: 36, height: 36, borderRadius: 10,
    background: 'rgba(255,255,255,.08)',
    display: 'grid', placeItems: 'center',
    position: 'relative', zIndex: 1,
  }
}
function socialCtaStyle() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 700,
    color: 'var(--color-corallo)',
    position: 'relative', zIndex: 1,
  }
}
