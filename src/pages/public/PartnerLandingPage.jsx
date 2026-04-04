import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import Footer from '../../components/Layout/Footer'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'

/* ─── animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

/* ─── icons ─── */
function ClipboardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function PhoneCallIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

/* ─── animated counter ─── */
function AnimatedCounter({ target, suffix = '', duration = 2 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const [count, setCount] = useState(0)
  const hasAnimated = useRef(false)

  if (isInView && !hasAnimated.current) {
    hasAnimated.current = true
    const start = performance.now()
    const step = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  return (
    <span ref={ref}>
      {count.toLocaleString('it-IT')}{suffix}
    </span>
  )
}

/* ─── main component ─── */
export default function PartnerLandingPage() {
  const navigate = useNavigate()
  const formRef = useRef(null)

  const [form, setForm] = useState({
    restaurant_name: '',
    contact_name: '',
    email: '',
    phone: '',
    city: 'Torino',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (!form.restaurant_name || !form.contact_name || !form.email || !form.phone) {
        throw new Error('Compila tutti i campi obbligatori.')
      }

      if (isSupabaseConfigured()) {
        const { error: dbError } = await supabase
          .from('partner_applications')
          .insert([{
            restaurant_name: form.restaurant_name,
            contact_name: form.contact_name,
            email: form.email,
            phone: form.phone,
            city: form.city,
            message: form.message,
          }])

        if (dbError) throw dbError
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800))
      }

      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Si è verificato un errore. Riprova più tardi.')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = [
    { value: 10000, suffix: '+', label: 'utenti attivi' },
    { value: 50, suffix: '+', label: 'ristoranti partner' },
    { value: 100000, suffix: '+', label: 'piatti scoperti' },
  ]

  const steps = [
    { icon: <ClipboardIcon />, title: 'Candidati', desc: 'Compila il modulo qui sotto con le informazioni del tuo ristorante.' },
    { icon: <PhoneCallIcon />, title: 'Ti contattiamo', desc: 'Il nostro team valuta la candidatura e ti ricontatta entro 48 ore.' },
    { icon: <RocketIcon />, title: 'Sei online', desc: 'Il tuo ristorante diventa visibile a migliaia di foodie su ChiamamiBi.' },
  ]

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid var(--color-bordo)',
    background: '#fff',
    fontSize: 14,
    color: 'var(--color-primary)',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  }

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-secondary)',
    marginBottom: 6,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--color-bg)' }}>
      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: '#FAF7F2',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
          <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, textDecoration: 'none' }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: 'var(--color-secondary)', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>by Chiamami Bi</span>
          </Link>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Torna alla mappa
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-bordo)', margin: '0 -22px' }} />
      </div>

      <div style={{ flex: 1 }}>
        {/* ── Hero Section ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          style={{ padding: '48px 22px 36px', textAlign: 'center' }}
        >
          <motion.h1
            variants={fadeUp}
            style={{
              fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--color-primary)',
              lineHeight: 1.3,
              marginBottom: 14,
            }}
          >
            Porta il tuo ristorante davanti a migliaia di{' '}
            <span style={{ color: 'var(--color-accent)' }}>foodie</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            style={{
              fontSize: 14,
              color: 'var(--color-secondary)',
              lineHeight: 1.6,
              maxWidth: 340,
              margin: '0 auto 28px',
            }}
          >
            ChiamamiBi è la guida gastronomica più amata di Torino. Entra nella nostra
            community e fai scoprire il tuo locale a chi cerca esperienze autentiche.
          </motion.p>

          <motion.button
            variants={fadeUp}
            whileTap={{ scale: 0.97 }}
            onClick={scrollToForm}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '16px 32px', borderRadius: 16,
              background: 'var(--color-accent)', color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, fontWeight: 700,
              border: 'none', cursor: 'pointer',
            }}
          >
            Candidati ora
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </motion.button>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          style={{ display: 'flex', gap: 10, padding: '0 22px 32px' }}
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              style={{
                flex: 1,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid var(--color-bordo)',
                padding: '20px 8px',
                textAlign: 'center',
              }}
            >
              <div style={{
                fontFamily: "'TAN Songbird', serif",
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-accent)',
                lineHeight: 1,
              }}>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-secondary)', marginTop: 6 }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── How It Works ── */}
        <div style={{ padding: '0 22px 40px' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              style={{
                fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-primary)',
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              Come funziona
            </motion.h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    background: '#fff',
                    borderRadius: 16,
                    border: '1px solid var(--color-bordo)',
                    padding: 18,
                  }}
                >
                  {/* Step number + icon */}
                  <div style={{
                    width: 50, minWidth: 50, height: 50,
                    borderRadius: 14,
                    background: 'rgba(232,69,60,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-accent)',
                    position: 'relative',
                  }}>
                    {step.icon}
                    <div style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--color-accent)', color: '#fff',
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i + 1}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      marginBottom: 4,
                    }}>
                      {step.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-secondary)', lineHeight: 1.5 }}>
                      {step.desc}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Application Form ── */}
        <div ref={formRef} style={{ padding: '0 22px 40px', scrollMarginTop: 80 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.div
              variants={fadeUp}
              style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid var(--color-bordo)',
                padding: 22,
              }}
            >
              <h2 style={{
                fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-primary)',
                textAlign: 'center',
                marginBottom: 4,
              }}>
                Candidatura partner
              </h2>
              <p style={{
                fontSize: 12,
                color: 'var(--color-secondary)',
                textAlign: 'center',
                marginBottom: 24,
              }}>
                Compila il modulo e ti ricontatteremo entro 48 ore.
              </p>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '30px 0', textAlign: 'center' }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(34,197,94,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#22c55e',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 style={{
                    fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                  }}>
                    Candidatura inviata!
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--color-secondary)', maxWidth: 280 }}>
                    Grazie per il tuo interesse. Il nostro team ti contatterà al più presto
                    per i prossimi passi.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>
                      Nome ristorante <span style={{ color: 'var(--color-accent)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="restaurant_name"
                      value={form.restaurant_name}
                      onChange={handleChange}
                      placeholder="Es. Trattoria da Mario"
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Nome referente <span style={{ color: 'var(--color-accent)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="contact_name"
                      value={form.contact_name}
                      onChange={handleChange}
                      placeholder="Mario Rossi"
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Email <span style={{ color: 'var(--color-accent)' }}>*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="mario@ristorante.it"
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Telefono <span style={{ color: 'var(--color-accent)' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+39 333 1234567"
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Città</label>
                    <input
                      type="text"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      placeholder="Torino"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Messaggio</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Raccontaci del tuo ristorante..."
                      rows={4}
                      style={{ ...inputStyle, resize: 'none' }}
                    />
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 600, textAlign: 'center' }}
                    >
                      {error}
                    </motion.p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: 16,
                      borderRadius: 16,
                      background: submitting ? 'var(--color-secondary)' : 'var(--color-accent)',
                      color: '#fff',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 15,
                      fontWeight: 700,
                      border: 'none',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      marginTop: 4,
                    }}
                  >
                    {submitting ? 'Invio in corso...' : 'Invia candidatura'}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div style={{ paddingBottom: TAB_BAR_HEIGHT }}>
        <Footer />
      </div>
    </div>
  )
}
