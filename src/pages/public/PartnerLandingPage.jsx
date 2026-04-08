import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'

/* ─── Benefit icons ─── */
function EyeIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function UsersIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function TagIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function CameraIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

/* ─── Main component ─── */
export default function PartnerLandingPage() {
  const navigate = useNavigate()
  const formRef = useRef(null)

  const [form, setForm] = useState({
    restaurant_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    instagram: '',
    motivation: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.restaurant_name.trim() || !form.contact_name.trim() || !form.email.trim() || !form.address.trim()) {
      setError('Compila tutti i campi obbligatori')
      return
    }

    setSubmitting(true)
    try {
      const resp = await fetch('/api/partner-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-primary)',
    marginBottom: 6,
  }
  const inputStyle = {
    width: '100%',
    background: '#fff',
    border: '1px solid var(--color-bordo)',
    borderRadius: 12,
    padding: '14px 16px',
    fontSize: 14,
    color: 'var(--color-primary)',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
  }
  const labelPillStyle = {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-secondary)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  }

  const benefits = [
    {
      icon: EyeIcon,
      iconColor: 'var(--color-accent)',
      iconBg: 'rgba(232,69,60,0.1)',
      title: 'Visibilità',
      desc: 'Card In Evidenza sulla mappa e nella lista dei ristoranti',
    },
    {
      icon: UsersIcon,
      iconColor: 'var(--color-oro)',
      iconBg: 'rgba(196,162,101,0.1)',
      title: 'Community',
      desc: 'Accesso a migliaia di foodie torinesi attivi ogni mese',
    },
    {
      icon: TagIcon,
      iconColor: 'var(--color-success)',
      iconBg: 'rgba(74,222,128,0.1)',
      title: 'Sconti & Drop',
      desc: 'Crea sconti esclusivi e drop a tempo per portare clienti',
    },
    {
      icon: CameraIcon,
      iconColor: 'var(--color-accent)',
      iconBg: 'rgba(232,69,60,0.1)',
      title: 'Contenuti',
      desc: 'Foto e video professionali con Bi per i tuoi social',
    },
  ]

  const steps = [
    { title: 'Candidati', desc: 'Compila il form qui sotto con le info del tuo locale' },
    { title: 'Ti contattiamo', desc: 'Bi valuta la candidatura e ti ricontatta entro 48h' },
    { title: 'Sei nella guida', desc: 'Il tuo ristorante appare In Evidenza sulla mappa e nella lista' },
  ]

  /* ── Success state ── */
  if (submitted) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 22px', textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
              boxShadow: '0 8px 24px rgba(74,222,128,0.3)',
            }}
          >
            <CheckIcon />
          </motion.div>
          <h2 style={{
            fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
            fontSize: 24, fontWeight: 700, color: 'var(--color-primary)',
            marginBottom: 12,
            lineHeight: 1.2,
          }}>
            Candidatura inviata!
          </h2>
          <p style={{
            fontSize: 13,
            color: 'var(--color-secondary)',
            lineHeight: 1.6,
            maxWidth: 320,
            marginBottom: 32,
          }}>
            Ti ricontatteremo entro 48 ore per parlare di come portare il tuo locale nella guida.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              background: '#fff',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-bordo)',
              borderRadius: 14,
              padding: '14px 28px',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Torna alla mappa
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* ─── HERO — DARK ─── */}
      <section style={{
        background: 'var(--color-primary)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 22px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(232,69,60,0.15), transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'relative', zIndex: 1,
          marginBottom: 56,
        }}>
          <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, textDecoration: 'none' }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto', filter: 'brightness(0) invert(1) drop-shadow(0 0 0 #E8453C)' }} />
          </Link>
          <Link
            to="/"
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            ← Torna alla mappa
          </Link>
        </div>

        {/* Hero content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-oro)',
            letterSpacing: 2,
            marginBottom: 12,
            textTransform: 'uppercase',
          }}>
            Per i ristoratori
          </div>
          <h1 style={{
            fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.1,
            marginBottom: 16,
          }}>
            Fatti scoprire da migliaia di foodie a Torino
          </h1>
          <p style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.6,
            marginBottom: 32,
          }}>
            Entra nella guida gastronomica più seguita della città. Il tuo ristorante in evidenza davanti alla community di Bi.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={scrollToForm}
            style={{
              width: '100%',
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: 16,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(232,69,60,0.3)',
            }}
          >
            Candidati ora
            <ArrowRightIcon />
          </motion.button>
        </motion.div>
      </section>

      {/* ─── WARM CONTENT WRAPPER (rounds off the dark hero) ─── */}
      <div style={{
        background: 'var(--color-bg)',
        borderRadius: '24px 24px 0 0',
        marginTop: -16,
        paddingTop: 36,
        flex: 1,
      }}>

        {/* ─── COSA OTTIENI ─── */}
        <section style={{ padding: '0 22px 44px' }}>
          <div style={labelPillStyle}>Cosa ottieni</div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            {benefits.map((b) => {
              const Icon = b.icon
              return (
                <motion.div
                  key={b.title}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
                  }}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 16,
                    border: '1px solid var(--color-bordo)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: b.iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon color={b.iconColor} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      marginBottom: 4,
                    }}>
                      {b.title}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--color-secondary)',
                      lineHeight: 1.5,
                    }}>
                      {b.desc}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </section>

        {/* ─── COME FUNZIONA ─── */}
        <section style={{ padding: '0 22px 44px' }}>
          <div style={labelPillStyle}>Come funziona</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 32, minWidth: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    fontSize: 14, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      marginBottom: 4,
                    }}>
                      {step.title}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--color-secondary)',
                      lineHeight: 1.5,
                    }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    width: 1,
                    height: 16,
                    background: 'var(--color-bordo)',
                    marginLeft: 16,
                    marginTop: 6,
                    marginBottom: 6,
                  }} />
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* ─── FORM ─── */}
        <section ref={formRef} style={{ padding: '0 22px 48px', scrollMarginTop: 16 }}>
          <div style={labelPillStyle}>Candidati</div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome del ristorante *</label>
              <input
                type="text"
                name="restaurant_name"
                value={form.restaurant_name}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Es. Trattoria da Mario"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Nome e cognome *</label>
              <input
                type="text"
                name="contact_name"
                value={form.contact_name}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Mario Rossi"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                style={inputStyle}
                placeholder="mario@ristorante.it"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Telefono</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                style={inputStyle}
                placeholder="+39 333 1234567"
              />
            </div>

            <div>
              <label style={labelStyle}>Indirizzo del locale *</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Via Roma 10, Torino"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Link Instagram</label>
              <input
                type="text"
                name="instagram"
                value={form.instagram}
                onChange={handleChange}
                style={inputStyle}
                placeholder="@nomeprofilo"
              />
            </div>

            <div>
              <label style={labelStyle}>Perché dovremmo sceglierti?</label>
              <textarea
                name="motivation"
                value={form.motivation}
                onChange={handleChange}
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
                placeholder="Raccontaci cosa rende unico il tuo locale..."
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: 13,
                  color: 'var(--color-accent)',
                  fontWeight: 500,
                  textAlign: 'center',
                  padding: '8px 12px',
                  background: 'rgba(232,69,60,0.08)',
                  borderRadius: 10,
                }}
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                background: submitting ? 'var(--color-secondary)' : 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                padding: 16,
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                marginTop: 6,
              }}
            >
              {submitting ? 'Invio in corso...' : 'Invia candidatura'}
            </motion.button>

            <p style={{
              fontSize: 11,
              color: 'var(--color-secondary)',
              textAlign: 'center',
              marginTop: 4,
            }}>
              Rispondiamo entro 48 ore · Nessun impegno
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
