import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
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
  transition: 'border-color 0.15s',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, signIn, signUp, signInWithGoogle, resetPasswordForEmail } = useAuth()

  const [mode, setMode] = useState('login') // 'login', 'register', 'forgot', 'recovery_forgot', 'recovery_otp', 'recovery_newpwd'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recoveryOtp, setRecoveryOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [maskedRecovery, setMaskedRecovery] = useState('')

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      if (mode === 'forgot') {
        await resetPasswordForEmail(email)
        setSuccess('Email inviata! Controlla la tua casella di posta per reimpostare la password.')
      } else if (mode === 'recovery_forgot') {
        // Send recovery OTP for password reset
        const resp = await fetch('/api/recovery-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, action: 'reset_password' }),
        })
        const data = await resp.json()
        if (data.no_recovery) {
          setError('Nessuna email di recupero configurata per questo account. Contatta supporto@chiamamibi.com')
        } else if (data.success) {
          setMaskedRecovery(data.masked_email || '')
          setMode('recovery_otp')
          setSuccess(`Codice inviato a ${data.masked_email || 'email di recupero'}`)
        } else {
          setError(data.error || 'Errore')
        }
      } else if (mode === 'recovery_otp') {
        // Verify recovery OTP
        if (!recoveryOtp.trim() || recoveryOtp.length < 6) {
          setError('Inserisci il codice a 6 cifre')
        } else {
          setMode('recovery_newpwd')
          setSuccess('Codice verificato! Inserisci la nuova password.')
        }
      } else if (mode === 'recovery_newpwd') {
        // Set new password via recovery
        if (newPassword.length < 6) {
          setError('La password deve avere almeno 6 caratteri')
        } else if (newPassword !== confirmPassword) {
          setError('Le password non coincidono')
        } else {
          const resp = await fetch('/api/verify-recovery-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp: recoveryOtp, new_password: newPassword }),
          })
          const data = await resp.json()
          if (data.success) {
            setSuccess('Password reimpostata! Ora puoi accedere.')
            setMode('login')
            setPassword('')
            setRecoveryOtp('')
            setNewPassword('')
            setConfirmPassword('')
          } else {
            setError(data.error || 'Codice non valido o scaduto')
          }
        }
      } else if (mode === 'login') {
        await signIn(email, password)
        navigate('/', { replace: true })
      } else {
        await signUp(email, password, fullName)
        setSuccess('Registrazione completata! Controlla la tua email per confermare.')
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email o password non corretti'
        : err.message === 'For security purposes, you can only request this once every 60 seconds'
        ? 'Per sicurezza, puoi richiedere il reset solo ogni 60 secondi'
        : err.message || 'Si è verificato un errore')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Errore con Google')
    }
  }

  const titleText =
    mode === 'forgot' ? 'Password dimenticata?'
    : mode === 'recovery_forgot' ? 'Recupero account'
    : mode === 'recovery_otp' ? 'Inserisci il codice'
    : mode === 'recovery_newpwd' ? 'Nuova password'
    : mode === 'login' ? 'Ciao di nuovo!'
    : 'Unisciti a noi'

  const subtitleText =
    mode === 'forgot' ? 'Inserisci la tua email e ti invieremo un link per reimpostarla'
    : mode === 'recovery_forgot' ? 'Ti invieremo un codice sull\u2019email di recupero'
    : mode === 'recovery_otp' ? `Abbiamo inviato un codice a ${maskedRecovery || 'la tua email di recupero'}`
    : mode === 'recovery_newpwd' ? 'Scegli una nuova password per il tuo account'
    : mode === 'login' ? 'Accedi per salvare i tuoi ristoranti preferiti e sbloccare gli sconti esclusivi'
    : 'Crea un account per salvare i tuoi posti del cuore'

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ background: 'var(--color-bg)', overflowX: 'hidden' }}
    >
      {/* ─── HEADER — logo + Esplora la mappa (mobile only) ─── */}
      <header
        className="md:hidden"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'var(--color-bg)',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
          padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link
            to="/"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 1,
              textDecoration: 'none',
            }}
          >
            <img
              src="/logo-guida-bi.png"
              alt="La Guida di Bi"
              style={{ height: 22, width: 'auto' }}
            />
            <span
              style={{
                fontSize: 9,
                color: 'var(--color-secondary)',
                fontWeight: 500,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              by Chiamami Bi
            </span>
          </Link>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--color-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              padding: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Esplora la mappa
          </button>
        </div>
      </header>

      {/* ─── CONTENUTO CENTRATO ─── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `16px 22px`,
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${TAB_BAR_HEIGHT + 16}px)`,
        }}
      >
        <motion.div
          className="w-full max-w-[380px]"
          style={{ margin: '0 auto' }}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {/* Title */}
          <motion.h1
            variants={itemVariants}
            style={{
              fontFamily: "'TAN Songbird', 'DM Sans', serif",
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--color-primary)',
              textAlign: 'center',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {titleText}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            style={{
              fontSize: 13,
              color: 'var(--color-secondary)',
              textAlign: 'center',
              lineHeight: 1.5,
              marginTop: 8,
              marginBottom: 20,
            }}
          >
            {subtitleText}
          </motion.p>

          {/* Google OAuth — hidden in forgot/recovery modes */}
          {(mode === 'login' || mode === 'register') && (
            <>
              <motion.button
                type="button"
                onClick={handleGoogle}
                variants={itemVariants}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid var(--color-bordo)',
                  borderRadius: 14,
                  padding: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  marginBottom: 14,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continua con Google
              </motion.button>

              {/* Divider */}
              <motion.div
                variants={itemVariants}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ flex: 1, height: 1, background: 'var(--color-bordo)' }} />
                <span style={{ fontSize: 12, color: '#B5B0AA' }}>oppure</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-bordo)' }} />
              </motion.div>
            </>
          )}

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            variants={itemVariants}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.input
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  type="text"
                  placeholder="Il tuo nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 12 }}
                  required
                />
              )}
            </AnimatePresence>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputStyle, marginBottom: (mode === 'login' || mode === 'register') ? 12 : 18 }}
              required
            />

            {/* Password — login / register */}
            <AnimatePresence mode="wait">
              {(mode === 'login' || mode === 'register') && (
                <motion.div
                  key="password-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 8 }}
                    required
                    minLength={6}
                  />
                  {mode === 'login' && (
                    <div style={{ textAlign: 'right', marginBottom: 18 }}>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                        style={{
                          fontSize: 12,
                          color: 'var(--color-accent)',
                          fontWeight: 500,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Password dimenticata?
                      </button>
                    </div>
                  )}
                  {mode === 'register' && <div style={{ marginBottom: 10 }} />}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forgot mode — "Non ho accesso all'email" link */}
            <AnimatePresence mode="wait">
              {mode === 'forgot' && (
                <motion.div
                  key="forgot-recovery"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: 18 }}
                >
                  <button
                    type="button"
                    onClick={() => { setMode('recovery_forgot'); setError(''); setSuccess('') }}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-secondary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Non ho accesso all'email
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recovery OTP input */}
            <AnimatePresence mode="wait">
              {mode === 'recovery_otp' && (
                <motion.div
                  key="recovery-otp-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: 18 }}
                >
                  <input
                    type="text"
                    placeholder="Codice a 6 cifre"
                    value={recoveryOtp}
                    onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    style={{
                      ...inputStyle,
                      textAlign: 'center',
                      letterSpacing: 8,
                      fontFamily: 'monospace',
                      fontSize: 18,
                    }}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recovery new password fields */}
            <AnimatePresence mode="wait">
              {mode === 'recovery_newpwd' && (
                <motion.div
                  key="recovery-pwd-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}
                >
                  <input
                    type="password"
                    placeholder="Nuova password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={inputStyle}
                    required
                    minLength={6}
                  />
                  <input
                    type="password"
                    placeholder="Conferma password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={inputStyle}
                    required
                    minLength={6}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Consent checkboxes — only in register mode */}
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="consent"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: 14 }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      style={{ marginTop: 2, accentColor: 'var(--color-accent)' }}
                      required
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-secondary)', lineHeight: 1.5 }}>
                      Ho letto e accetto la{' '}
                      <Link to="/privacy" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }} target="_blank">Privacy Policy</Link>
                      {' '}e i{' '}
                      <Link to="/terms" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }} target="_blank">Termini di Servizio</Link>
                    </span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error / success */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    fontSize: 12,
                    color: 'var(--color-accent)',
                    textAlign: 'center',
                    marginTop: 4,
                    marginBottom: 12,
                  }}
                >
                  {error}
                </motion.p>
              )}
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    fontSize: 12,
                    color: 'var(--color-success)',
                    textAlign: 'center',
                    marginTop: 4,
                    marginBottom: 12,
                  }}
                >
                  {success}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
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
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              {submitting
                ? '...'
                : mode === 'forgot'
                  ? 'Invia link di reset'
                  : mode === 'recovery_forgot'
                  ? 'Invia codice di recupero'
                  : mode === 'recovery_otp'
                  ? 'Verifica codice'
                  : mode === 'recovery_newpwd'
                  ? 'Reimposta password'
                  : mode === 'login'
                  ? 'Accedi'
                  : 'Crea account'}
            </motion.button>
          </motion.form>

          {/* Toggle mode */}
          <motion.p
            variants={itemVariants}
            style={{
              fontSize: 14,
              color: 'var(--color-secondary)',
              textAlign: 'center',
              marginBottom: 28,
            }}
          >
            {(mode === 'forgot' || mode === 'recovery_forgot' || mode === 'recovery_otp' || mode === 'recovery_newpwd') ? (
              <>
                Ricordi la password?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); setRecoveryOtp(''); setNewPassword(''); setConfirmPassword('') }}
                  style={{ color: 'var(--color-accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Torna al login
                </button>
              </>
            ) : mode === 'login' ? (
              <>
                Non hai un account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setSuccess('') }}
                  style={{ color: 'var(--color-accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Registrati
                </button>
              </>
            ) : (
              <>
                Hai già un account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                  style={{ color: 'var(--color-accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Accedi
                </button>
              </>
            )}
          </motion.p>

          {/* Scopri Bi */}
          <motion.div variants={itemVariants}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-bordo)' }} />
              <span style={{ fontSize: 10, color: '#B5B0AA', letterSpacing: 1.5, fontWeight: 600 }}>SCOPRI BI</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-bordo)' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate('/partner')}
                style={{
                  flex: 1,
                  background: '#fff',
                  border: '1px solid var(--color-bordo)',
                  borderRadius: 12,
                  padding: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                Ristoratori
              </button>
              <button
                type="button"
                onClick={() => navigate('/about')}
                style={{
                  flex: 1,
                  background: '#fff',
                  border: '1px solid var(--color-bordo)',
                  borderRadius: 12,
                  padding: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Chi è Bi
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Desktop footer */}
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  )
}
