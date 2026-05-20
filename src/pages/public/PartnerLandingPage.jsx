import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import MobileLogoHeader from '../../components/Layout/MobileLogoHeader'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import Turnstile from '../../components/Turnstile'
import MetaTags from '../../components/SEO/MetaTags'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }

/* ─── Icons ─── */
function EyeIcon({ size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function UsersIcon({ size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function TagIcon({ size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}
function CameraIcon({ size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function CheckIcon({ size = 28, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function ArrowRightIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}>
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

/* ─── Page ─── */
export default function PartnerLandingPage() {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const formRef = useRef(null)

  const [form, setForm] = useState({
    restaurant_name: '', contact_name: '', email: '', phone: '',
    address: '', instagram: '', motivation: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRequired = !!import.meta.env.VITE_TURNSTILE_SITE_KEY

  const [siteConfig, setSiteConfig] = useState({
    partner_founding_year: '2024',
    partner_monthly_views: '3M+',
  })

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    supabase
      .from('site_config')
      .select('key, value')
      .in('key', ['partner_founding_year', 'partner_monthly_views'])
      .then(({ data }) => {
        if (data?.length) {
          const map = {}
          data.forEach(r => { map[r.key] = r.value })
          setSiteConfig(prev => ({ ...prev, ...map }))
        }
      })
  }, [])

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.restaurant_name.trim() || !form.contact_name.trim() || !form.email.trim() || !form.address.trim()) {
      setError('Compila tutti i campi obbligatori')
      return
    }
    if (captchaRequired && !captchaToken) {
      setError('Attendi qualche secondo: la verifica anti-spam è in corso, poi riprova.')
      return
    }
    setSubmitting(true)
    try {
      const resp = await fetch('/api/partner-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, captcha_token: captchaToken }),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || 'Invio fallito, riprova tra poco')
      }
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message || 'Si è verificato un errore. Riprova più tardi.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success state ── */
  if (submitted) {
    return (
      <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-page)' }}>
        {!isDesktop && <MobileLogoHeader />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 22px', textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-green-a), var(--color-green-b))',
              display: 'grid', placeItems: 'center',
              marginBottom: 24,
              boxShadow: '0 8px 24px rgba(74,222,128,.3)',
            }}
          >
            <CheckIcon />
          </motion.div>
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em',
            fontSize: 26, color: 'var(--color-ink)', marginBottom: 12, lineHeight: 1.15,
          }}>
            Candidatura inviata!
          </h2>
          <p style={{
            fontSize: 14, color: 'var(--color-ink-70)', lineHeight: 1.6, maxWidth: 380, marginBottom: 28,
          }}>
            Bi e il suo team analizzeranno la tua proposta entro 7 giorni. Se verrà accettata ti contatteremo per scoprire come promuovere il tuo brand o locale sui suoi canali social e sul sito.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'var(--color-ink)', color: '#fff',
              border: 0, borderRadius: 999,
              padding: '13px 22px', fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Torna alla mappa
          </button>
        </div>
        <Footer />
      </div>
    )
  }

  /* ── Main page ── */
  const benefits = [
    { Icon: EyeIcon, color: 'var(--color-corallo)', bg: 'rgba(232,69,60,.10)', title: 'Visibilità', desc: 'Primo piano sulla mappa, nella guida e sui social di Bi' },
    { Icon: UsersIcon, color: 'var(--color-oro)', bg: 'rgba(176,137,84,.12)', title: `${siteConfig.partner_monthly_views} views/mese`, desc: 'Migliaia di persone ogni giorno tra sito, Instagram e TikTok' },
    { Icon: TagIcon, color: '#1a4731', bg: 'rgba(74,222,128,.18)', title: 'Sconti & Drop', desc: 'Offerte esclusive e drop a tempo per far provare il tuo locale' },
    { Icon: CameraIcon, color: 'var(--color-corallo-ink)', bg: 'rgba(197,58,51,.10)', title: 'Racconto', desc: 'Foto, video e contenuti curati da Bi per i canali social' },
  ]
  const steps = [
    { title: 'Invia la candidatura', desc: 'Raccontaci in due minuti chi sei e cosa proponi' },
    { title: 'Analisi della proposta', desc: 'Bi e il team leggono e valutano la candidatura entro 7 giorni' },
    { title: 'Collaborazione', desc: 'Se la proposta viene accettata ti contattiamo per definire come promuovere il tuo locale sui canali social e sul sito di Bi' },
  ]

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-page)', overflowX: 'hidden' }}>
      <MetaTags
        title="Diventa partner ChiamamiBi — Porta il tuo ristorante nella guida di Bi"
        description="Vuoi entrare nella guida ristoranti di Bi a Torino? Candidati come partner: visibilità a 3M+ persone al mese, recensione curata, sconti e drop dedicati."
        url="https://chiamamibi.com/partner"
        canonical="https://chiamamibi.com/partner"
        type="website"
      />
      {!isDesktop && <MobileLogoHeader />}

      <main style={{
        flex: 1, width: '100%',
        maxWidth: 760, margin: '0 auto',
        padding: isDesktop ? '32px 32px 60px' : '8px 18px 36px',
      }}>
        {/* ── Eyebrow + page title ── */}
        <motion.div
          initial="hidden" animate="visible" variants={stagger}
          style={{ paddingTop: isDesktop ? 0 : 8, paddingBottom: isDesktop ? 24 : 18 }}
        >
          <motion.div variants={fadeUp} style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--color-corallo-ink)', marginBottom: 10,
          }}>
            Per ristoranti e brand
          </motion.div>
          <motion.h1 variants={fadeUp} style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900,
            fontSize: isDesktop ? 44 : 30,
            letterSpacing: '-0.025em', lineHeight: 1.05,
            color: 'var(--color-ink)', margin: 0,
          }}>
            Promuovi il tuo locale<br />sui canali di Bi.
          </motion.h1>
          <motion.p variants={fadeUp} style={{
            fontSize: isDesktop ? 15 : 14, color: 'var(--color-ink-70)',
            marginTop: 12, lineHeight: 1.55, maxWidth: 580,
          }}>
            Bi racconta ristoranti dal <strong style={{ color: 'var(--color-ink)' }}>{siteConfig.partner_founding_year}</strong>. I suoi canali superano i <strong style={{ color: 'var(--color-ink)' }}>{siteConfig.partner_monthly_views} di visualizzazioni al mese</strong> — porta il tuo brand davanti a chi cerca ogni giorno dove mangiare.
          </motion.p>
        </motion.div>

        {/* ── Hero corallo card (CTA) ── */}
        <motion.section
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          style={{
            position: 'relative', overflow: 'hidden',
            background: 'var(--color-corallo)', color: '#fff',
            borderRadius: isDesktop ? 28 : 22,
            padding: isDesktop ? '28px 30px' : '22px',
            boxShadow: '0 8px 24px rgba(34,24,28,.08)',
          }}
        >
          <span aria-hidden style={{
            position: 'absolute', top: -60, right: -40,
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'grid',
            gridTemplateColumns: isDesktop ? '1fr auto' : '1fr',
            gap: isDesktop ? 24 : 16, alignItems: 'center',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,.85)', marginBottom: 8,
              }}>
                Candidati
              </div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 900,
                fontSize: isDesktop ? 24 : 20, letterSpacing: '-0.02em', lineHeight: 1.15,
                marginBottom: 6,
              }}>
                Vuoi che Bi racconti il tuo locale?
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', lineHeight: 1.45, maxWidth: 460 }}>
                Compila la candidatura. Risposta entro 7 giorni, nessun impegno.
              </div>
            </div>
            <button
              type="button"
              onClick={scrollToForm}
              style={{
                background: 'var(--color-ink)', color: '#fff',
                border: 0, borderRadius: 999,
                padding: isDesktop ? '13px 20px' : '12px 18px',
                fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
                boxShadow: '0 6px 14px rgba(34,24,28,.25)',
              }}
            >
              Candidati ora <ArrowRightIcon size={14} color="#fff" />
            </button>
          </div>
        </motion.section>

        {/* ── Cosa ottieni ── */}
        <section style={{ marginTop: isDesktop ? 40 : 32 }}>
          <SectionLabel>Cosa ottieni</SectionLabel>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            style={{
              display: 'grid', gap: 10,
              gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
            }}
          >
            {benefits.map((b) => (
              <motion.div
                key={b.title}
                variants={fadeUp}
                style={{
                  background: '#fff', border: '1px solid var(--color-ink-05)',
                  borderRadius: 16, padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: b.bg, display: 'grid', placeItems: 'center',
                }}>
                  <b.Icon size={18} color={b.color} />
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontWeight: 800,
                    fontSize: 14, letterSpacing: '-0.01em',
                    color: 'var(--color-ink)', marginBottom: 4,
                  }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-70)', lineHeight: 1.5 }}>
                    {b.desc}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Come funziona ── */}
        <section style={{ marginTop: isDesktop ? 40 : 32 }}>
          <SectionLabel>Come funziona</SectionLabel>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            style={{
              display: 'grid', gap: isDesktop ? 12 : 0,
              gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr',
            }}
          >
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                variants={fadeUp}
                style={{
                  background: '#fff', border: '1px solid var(--color-ink-05)',
                  borderRadius: 16, padding: isDesktop ? '20px' : '16px 18px',
                  display: 'flex',
                  flexDirection: isDesktop ? 'column' : 'row',
                  alignItems: 'flex-start',
                  gap: 12, marginBottom: isDesktop ? 0 : 10,
                }}
              >
                <div style={{
                  width: 32, minWidth: 32, height: 32, borderRadius: '50%',
                  background: 'var(--color-corallo)', color: '#fff',
                  fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 14,
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontWeight: 800,
                    fontSize: 14.5, letterSpacing: '-0.01em',
                    color: 'var(--color-ink)', marginBottom: 4,
                  }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-ink-70)', lineHeight: 1.5 }}>
                    {s.desc}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Form ── */}
        <section ref={formRef} style={{ marginTop: isDesktop ? 40 : 32, scrollMarginTop: 16 }}>
          <SectionLabel>Candidati</SectionLabel>
          <div style={{
            background: '#fff', border: '1px solid var(--color-ink-05)',
            borderRadius: isDesktop ? 20 : 18,
            padding: isDesktop ? '26px 28px' : '20px 18px',
          }}>
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'grid', gap: 14,
                gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
              }}
            >
              <Field label="Nome del ristorante o brand *">
                <Input name="restaurant_name" value={form.restaurant_name} onChange={handleChange} placeholder="Es. Trattoria da Mario" required />
              </Field>
              <Field label="Nome e cognome *">
                <Input name="contact_name" value={form.contact_name} onChange={handleChange} placeholder="Mario Rossi" required />
              </Field>
              <Field label="Email *">
                <Input type="email" name="email" value={form.email} onChange={handleChange} placeholder="mario@ristorante.it" required />
              </Field>
              <Field label="Telefono">
                <Input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+39 333 1234567" />
              </Field>
              <Field label="Indirizzo o sede *">
                <Input name="address" value={form.address} onChange={handleChange} placeholder="Via Roma 10, Torino" required />
              </Field>
              <Field label="Link Instagram">
                <Input name="instagram" value={form.instagram} onChange={handleChange} placeholder="@nomeprofilo" />
              </Field>
              <Field label="Perché dovremmo sceglierti?" full={isDesktop}>
                <textarea
                  name="motivation"
                  value={form.motivation}
                  onChange={handleChange}
                  placeholder="Raccontaci cosa rende unico il tuo locale..."
                  style={{ ...inputBase(), minHeight: 96, resize: 'vertical' }}
                />
              </Field>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    gridColumn: isDesktop ? '1 / -1' : 'auto',
                    fontSize: 13, color: 'var(--color-corallo-ink)', fontWeight: 600,
                    textAlign: 'center', padding: '10px 14px',
                    background: 'var(--color-corallo-wash)', border: '1px solid rgba(232,69,60,.18)',
                    borderRadius: 12,
                  }}
                >
                  {error}
                </motion.div>
              )}

              <div style={{ gridColumn: isDesktop ? '1 / -1' : 'auto', display: 'flex', justifyContent: 'center' }}>
                <Turnstile onToken={setCaptchaToken} action="partner-application" />
              </div>

              <motion.button
                type="submit" disabled={submitting}
                whileTap={{ scale: 0.98 }}
                style={{
                  gridColumn: isDesktop ? '1 / -1' : 'auto',
                  width: '100%',
                  background: submitting ? 'var(--color-ink-15)' : 'var(--color-corallo)',
                  color: '#fff', border: 0, borderRadius: 999,
                  padding: 15, fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)', marginTop: 4,
                  boxShadow: submitting ? 'none' : '0 6px 14px rgba(232,69,60,.30)',
                }}
              >
                {submitting ? 'Invio in corso…' : 'Invia candidatura'}
              </motion.button>

              <p style={{
                gridColumn: isDesktop ? '1 / -1' : 'auto',
                fontSize: 11, color: 'var(--color-ink-55)',
                textAlign: 'center', marginTop: 2,
              }}>
                Risposta entro 7 giorni · Nessun impegno
              </p>
            </form>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

/* ─── Small UI helpers ─── */
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
      textTransform: 'uppercase', color: 'var(--color-corallo-ink)',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function Field({ label, children, full }) {
  return (
    <label style={{ display: 'block', gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{
        fontSize: 11.5, fontWeight: 700,
        color: 'var(--color-ink)', marginBottom: 6,
        letterSpacing: '-0.005em',
      }}>{label}</div>
      {children}
    </label>
  )
}

function inputBase() {
  return {
    width: '100%',
    background: 'var(--color-page)',
    border: '1px solid var(--color-ink-05)',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14, color: 'var(--color-ink)',
    outline: 'none', fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
    transition: 'border-color .15s, background .15s',
  }
}

function Input(props) {
  return (
    <input
      {...props}
      style={inputBase()}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)'; e.currentTarget.style.background = '#fff' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-ink-05)'; e.currentTarget.style.background = 'var(--color-page)' }}
    />
  )
}
