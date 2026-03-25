import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { LogoFull } from '../../components/UI/Logo'
import Footer from '../../components/Layout/Footer'

/* ─── animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

/* ─── icons ─── */
function ClipboardIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function PhoneCallIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
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
      // ease-out
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
  const { t } = useTranslation()
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
      // Validate required fields
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
        // Simulate network delay when Supabase is not configured
        await new Promise((resolve) => setTimeout(resolve, 800))
      }

      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Si è verificato un errore. Riprova più tardi.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClasses =
    'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors'
  const inputStyle = {
    background: '#2a2a2a',
    borderColor: '#444',
    color: '#fff',
  }

  const stats = [
    { value: 10000, suffix: '+', label: 'utenti attivi' },
    { value: 50, suffix: '+', label: 'ristoranti partner' },
    { value: 100000, suffix: '+', label: 'piatti scoperti' },
  ]

  const steps = [
    { icon: <ClipboardIcon />, title: 'Candidati', desc: 'Compila il modulo qui sotto con le informazioni del tuo ristorante.' },
    { icon: <PhoneCallIcon />, title: 'Ti contattiamo', desc: 'Il nostro team valuta la candidatura e ti ricontatta entro 48 ore.' },
    { icon: <RocketIcon />, title: 'Sei online', desc: 'Il tuo ristorante diventa visibile a migliaia di foodie su La Guida di Bi.' },
  ]

  return (
    <div className="flex flex-col min-h-dvh overflow-y-auto" style={{ background: '#1a1a1a' }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b"
        style={{ background: 'rgba(26,26,26,0.9)', borderColor: '#333' }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
          <Link to="/" aria-label="Home">
            <LogoFull height={22} variant="light" />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-100"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <MapPinIcon />
            <span>Torna alla mappa</span>
          </Link>
        </div>
      </header>

      <div className="flex-1">
        {/* ── Hero Section ── */}
        <section className="relative px-5 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center overflow-hidden">
          {/* Decorative dots */}
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, #FF5757 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="relative z-10 max-w-3xl mx-auto"
          >
            <motion.h1
              variants={fadeUp}
              className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-6"
              style={{ fontWeight: 700, lineHeight: 1.3, color: '#fff' }}
            >
              Porta il tuo ristorante davanti a migliaia di{' '}
              <span style={{ color: '#FF5757' }}>foodie</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              La Guida di Bi è la guida gastronomica più amata di Torino. Entra nella nostra
              community e fai scoprire il tuo locale a chi cerca esperienze autentiche.
            </motion.p>

            <motion.button
              variants={fadeUp}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base transition-colors"
              style={{ background: '#FF5757', color: '#fff', boxShadow: '0 8px 24px rgba(255,87,87,0.25)' }}
            >
              Candidati ora
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </motion.button>
          </motion.div>
        </section>

        {/* ── Social Proof Numbers ── */}
        <section className="px-5 py-16">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="flex flex-col items-center gap-2 rounded-2xl p-8"
                style={{ background: '#242424', border: '1px solid #333' }}
              >
                <span
                  className="text-3xl sm:text-4xl font-bold"
                  style={{ fontWeight: 700, color: '#FF5757' }}
                >
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </span>
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{stat.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── How It Works ── */}
        <section className="px-5 py-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="max-w-4xl mx-auto"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold text-center mb-14"
              style={{ fontWeight: 700, color: '#fff' }}
            >
              Come funziona
            </motion.h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-4">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  className="relative flex flex-col items-center text-center rounded-2xl p-6 sm:p-8 mt-4"
                  style={{ background: '#242424', border: '1px solid #333' }}
                >
                  {/* Step number badge */}
                  <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-md"
                    style={{ background: '#FF5757', color: '#fff' }}
                  >
                    {i + 1}
                  </div>
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5"
                    style={{ background: 'rgba(255,87,87,0.15)', color: '#FF5757' }}
                  >
                    {step.icon}
                  </div>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{ fontWeight: 700, color: '#fff' }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Application Form ── */}
        <section ref={formRef} className="px-5 py-16 scroll-mt-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="max-w-2xl mx-auto"
          >
            <motion.div
              variants={fadeUp}
              className="rounded-2xl p-8 sm:p-10"
              style={{ background: '#242424', border: '1px solid #333' }}
            >
              <h2
                className="text-2xl sm:text-3xl font-bold mb-2 text-center"
                style={{ fontWeight: 700, color: '#fff' }}
              >
                Candidatura partner
              </h2>
              <p className="text-sm text-center mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Compila il modulo e ti ricontatteremo entro 48 ore.
              </p>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-10 text-center"
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3
                    className="text-xl font-bold"
                    style={{ fontWeight: 700, color: '#fff' }}
                  >
                    Candidatura inviata!
                  </h3>
                  <p className="text-sm max-w-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Grazie per il tuo interesse. Il nostro team ti contatterà al più presto
                    per i prossimi passi.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Nome ristorante <span style={{ color: '#FF5757' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="restaurant_name"
                        value={form.restaurant_name}
                        onChange={handleChange}
                        placeholder="Es. Trattoria da Mario"
                        className={inputClasses}
                        style={{
                          ...inputStyle,
                          '--placeholder-color': 'rgba(255,255,255,0.4)',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.15)' }}
                        onBlur={e => { e.target.style.borderColor = '#444'; e.target.style.boxShadow = 'none' }}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Nome referente <span style={{ color: '#FF5757' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="contact_name"
                        value={form.contact_name}
                        onChange={handleChange}
                        placeholder="Mario Rossi"
                        className={inputClasses}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.15)' }}
                        onBlur={e => { e.target.style.borderColor = '#444'; e.target.style.boxShadow = 'none' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Email <span style={{ color: '#FF5757' }}>*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="mario@ristorante.it"
                        className={inputClasses}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.15)' }}
                        onBlur={e => { e.target.style.borderColor = '#444'; e.target.style.boxShadow = 'none' }}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Telefono <span style={{ color: '#FF5757' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+39 333 1234567"
                        className={inputClasses}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.15)' }}
                        onBlur={e => { e.target.style.borderColor = '#444'; e.target.style.boxShadow = 'none' }}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Città
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      placeholder="Torino"
                      className={inputClasses}
                      style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.15)' }}
                      onBlur={e => { e.target.style.borderColor = '#444'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Messaggio
                    </label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Raccontaci del tuo ristorante..."
                      rows={4}
                      className={`${inputClasses} resize-none`}
                      style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.15)' }}
                      onBlur={e => { e.target.style.borderColor = '#444'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-medium text-center"
                      style={{ color: '#f87171' }}
                    >
                      {error}
                    </motion.p>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                    style={{ background: '#FF5757', color: '#fff' }}
                  >
                    {submitting ? 'Invio in corso...' : 'Invia candidatura'}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </motion.div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
