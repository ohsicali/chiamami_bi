import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

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

const fontFamily = 'system-ui, -apple-system, sans-serif'

/* ─── animated counter ─── */
function AnimatedCounter({ target, duration = 2 }) {
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

  return <span ref={ref}>{count.toLocaleString('it-IT')}</span>
}

/* ─── main component ─── */
export default function PartnerLandingPage() {
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
    { value: 847, label: 'utenti' },
    { value: 63, label: 'sconti usati' },
    { value: 24, label: 'ristoranti' },
  ]

  const steps = [
    { num: 1, title: 'Bi visita il tuo locale', desc: 'Prova il menu e scrive la recensione' },
    { num: 2, title: 'Entri nella Guida', desc: 'Foto, recensione e mappa di Torino' },
    { num: 3, title: 'Ricevi clienti', desc: 'I follower scoprono il tuo locale' },
  ]

  const inputClasses =
    'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors'
  const inputStyle = {
    background: '#fff',
    borderColor: '#eae7e0',
    color: '#1a1a1a',
    fontFamily,
  }

  return (
    <div
      className="min-h-dvh"
      style={{ background: '#fff', fontFamily }}
    >
      {/* ── Hero Section ── */}
      <section className="px-5 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="max-w-2xl mx-auto"
        >
          {/* Bi avatar */}
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-center mx-auto mb-6"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#FF5757',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 22,
                fontFamily,
                lineHeight: 1,
              }}
            >
              Bi
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={fadeUp}
            className="text-2xl sm:text-4xl lg:text-5xl mb-4"
            style={{
              fontWeight: 700,
              lineHeight: 1.3,
              color: '#1a1a1a',
              fontFamily,
            }}
          >
            Porta il tuo locale nella{' '}
            <span style={{ color: '#FF5757' }}>Guida di Bi</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="text-sm sm:text-base mb-0"
            style={{ color: '#888' }}
          >
            40K follower · 1.8M likes su TikTok
          </motion.p>
        </motion.div>
      </section>

      {/* ── Stats Row ── */}
      <section className="px-5 pb-12 sm:pb-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="max-w-lg mx-auto grid grid-cols-3 gap-3 sm:gap-4"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              className="flex flex-col items-center gap-1 rounded-2xl py-5 px-3"
              style={{ background: '#fff', border: '1px solid #eae7e0' }}
            >
              <span
                className="text-2xl sm:text-3xl"
                style={{ fontWeight: 700, color: '#1a1a1a', fontFamily }}
              >
                <AnimatedCounter target={stat.value} />
              </span>
              <span
                className="text-xs sm:text-sm"
                style={{ color: '#888' }}
              >
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Come funziona ── */}
      <section className="px-5 pb-12 sm:pb-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="max-w-lg mx-auto"
        >
          <motion.h2
            variants={fadeUp}
            className="text-xl sm:text-2xl mb-8"
            style={{ fontWeight: 700, color: '#1a1a1a', fontFamily }}
          >
            Come funziona
          </motion.h2>

          <div className="flex flex-col gap-6">
            {steps.map((step) => (
              <motion.div
                key={step.num}
                variants={fadeUp}
                className="flex items-start gap-4"
              >
                {/* Red numbered circle */}
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#FF5757',
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 13,
                      fontFamily,
                      lineHeight: 1,
                    }}
                  >
                    {step.num}
                  </span>
                </div>

                <div>
                  <p
                    className="text-sm sm:text-base"
                    style={{ fontWeight: 700, color: '#1a1a1a', fontFamily, marginBottom: 2 }}
                  >
                    {step.title}
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: '#888' }}
                  >
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA Section ── */}
      <section className="px-5 pb-12 sm:pb-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="max-w-lg mx-auto text-center"
        >
          <motion.p
            variants={fadeUp}
            className="text-lg sm:text-xl mb-5"
            style={{ fontWeight: 700, color: '#1a1a1a', fontFamily }}
          >
            Vuoi entrare nella Guida?
          </motion.p>

          <motion.button
            variants={fadeUp}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={scrollToForm}
            className="w-full py-4 rounded-2xl font-semibold text-base transition-colors cursor-pointer"
            style={{
              background: '#FF5757',
              color: '#fff',
              fontFamily,
              border: 'none',
            }}
          >
            Candidati ora
          </motion.button>
        </motion.div>
      </section>

      {/* ── Application Form ── */}
      <section ref={formRef} className="px-5 pb-16 sm:pb-24 scroll-mt-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="max-w-lg mx-auto"
        >
          <motion.div
            variants={fadeUp}
            className="rounded-2xl p-6 sm:p-8"
            style={{ background: '#fafafa', border: '1px solid #eae7e0' }}
          >
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-10 text-center"
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: 'rgba(34,197,94,0.1)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3
                  className="text-xl"
                  style={{ fontWeight: 700, color: '#1a1a1a', fontFamily }}
                >
                  Candidatura inviata!
                </h3>
                <p className="text-sm max-w-sm" style={{ color: '#888' }}>
                  Grazie per il tuo interesse. Ti contatteremo al più presto.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: '#888', fontFamily }}>
                      Nome ristorante <span style={{ color: '#FF5757' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="restaurant_name"
                      value={form.restaurant_name}
                      onChange={handleChange}
                      placeholder="Es. Trattoria da Mario"
                      className={inputClasses}
                      style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.1)' }}
                      onBlur={e => { e.target.style.borderColor = '#eae7e0'; e.target.style.boxShadow = 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: '#888', fontFamily }}>
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
                      onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.1)' }}
                      onBlur={e => { e.target.style.borderColor = '#eae7e0'; e.target.style.boxShadow = 'none' }}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: '#888', fontFamily }}>
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
                      onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.1)' }}
                      onBlur={e => { e.target.style.borderColor = '#eae7e0'; e.target.style.boxShadow = 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: '#888', fontFamily }}>
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
                      onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.1)' }}
                      onBlur={e => { e.target.style.borderColor = '#eae7e0'; e.target.style.boxShadow = 'none' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#888', fontFamily }}>
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
                    onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = '#eae7e0'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#888', fontFamily }}>
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
                    onFocus={e => { e.target.style.borderColor = '#FF5757'; e.target.style.boxShadow = '0 0 0 2px rgba(255,87,87,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = '#eae7e0'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium text-center"
                    style={{ color: '#ef4444' }}
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
                  style={{ background: '#FF5757', color: '#fff', fontFamily, border: 'none' }}
                >
                  {submitting ? 'Invio in corso...' : 'Invia candidatura'}
                </motion.button>
              </form>
            )}
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
