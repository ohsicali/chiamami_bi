import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { LogoFull } from '../../components/UI/Logo'

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
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

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-5 py-10">
      {/* Back button */}
      <Link
        to="/"
        className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Torna alla mappa
      </Link>

      <motion.div
        className="w-full max-w-sm flex flex-col items-center gap-8"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {/* Logo */}
        <motion.div variants={itemVariants}>
          <LogoFull height={36} />
        </motion.div>

        {/* Title */}
        <motion.div className="text-center" variants={itemVariants}>
          <h1
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {mode === 'forgot' ? 'Password dimenticata?' : mode === 'login' ? 'Bentornata!' : 'Unisciti a noi'}
          </h1>
          <p className="mt-2 text-sm text-secondary">
            {mode === 'forgot'
              ? 'Inserisci la tua email e ti invieremo un link per reimpostarla'
              : mode === 'login'
              ? 'Accedi per salvare i tuoi ristoranti preferiti'
              : 'Crea un account per salvare i tuoi posti del cuore'}
          </p>
        </motion.div>

        {/* Google OAuth — hidden in forgot mode */}
        {mode !== 'forgot' && (
          <>
            <motion.button
              type="button"
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-card px-5 py-3.5 text-sm font-semibold text-primary shadow-sm transition-shadow hover:shadow-md"
              variants={itemVariants}
              whileTap={{ scale: 0.97 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continua con Google
            </motion.button>

            {/* Divider */}
            <motion.div
              className="flex w-full items-center gap-3"
              variants={itemVariants}
            >
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-secondary">oppure</span>
              <div className="h-px flex-1 bg-gray-200" />
            </motion.div>
          </>
        )}

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-4"
          variants={itemVariants}
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
                className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
                required
              />
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
            required
          />

          {/* Password — hidden in forgot/recovery modes */}
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
                  className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
                  required
                  minLength={6}
                />
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                    className="mt-2 text-xs text-accent hover:underline"
                  >
                    Password dimenticata?
                  </button>
                )}
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
              >
                <button
                  type="button"
                  onClick={() => { setMode('recovery_forgot'); setError(''); setSuccess('') }}
                  className="text-xs text-secondary hover:text-accent transition-colors"
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
              >
                <input
                  type="text"
                  placeholder="Codice a 6 cifre"
                  value={recoveryOtp}
                  onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary text-center tracking-widest font-mono shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
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
                className="flex flex-col gap-3"
              >
                <input
                  type="password"
                  placeholder="Nuova password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
                  required
                  minLength={6}
                />
                <input
                  type="password"
                  placeholder="Conferma password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
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
                className="flex flex-col gap-2"
              >
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 rounded accent-accent"
                    required
                  />
                  <span className="text-xs text-secondary leading-relaxed">
                    Ho letto e accetto la{' '}
                    <Link to="/privacy" className="text-accent underline" target="_blank">Privacy Policy</Link>
                    {' '}e i{' '}
                    <Link to="/terms" className="text-accent underline" target="_blank">Termini di Servizio</Link>
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
                className="text-sm text-red-500 text-center"
              >
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-success text-center"
              >
                {success}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e64545] disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
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
        <motion.p className="text-sm text-secondary" variants={itemVariants}>
          {(mode === 'forgot' || mode === 'recovery_forgot' || mode === 'recovery_otp' || mode === 'recovery_newpwd') ? (
            <>
              Ricordi la password?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); setRecoveryOtp(''); setNewPassword(''); setConfirmPassword('') }}
                className="font-semibold text-accent"
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
                className="font-semibold text-accent"
              >
                Registrati
              </button>
            </>
          ) : (
            <>
              Hai gia un account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                className="font-semibold text-accent"
              >
                Accedi
              </button>
            </>
          )}
        </motion.p>
      </motion.div>
    </div>
  )
}
