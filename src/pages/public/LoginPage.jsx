import { useState, useEffect, useRef } from 'react'
import { authErrorMessage } from '../../lib/utils/authErrors'
import { TR_REVEAL } from '../../lib/motion'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { setAnnouncementsEnabled, rememberAnnouncementsOff } from '../../lib/emailPrefs'
import Footer from '../../components/Layout/Footer'
import BiLogoMark from '../../components/UI/BiLogoMark'
import Turnstile from '../../components/Turnstile'
import MetaTags from '../../components/SEO/MetaTags'

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: TR_REVEAL,
  },
}

const inputStyle = {
  width: '100%',
  background: 'var(--color-card)',
  border: '1.5px solid var(--color-ink-15)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px 16px',
  fontSize: 14.5,
  color: 'var(--color-ink)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

/**
 * Cosa dice il bottone mentre aspetta la risposta.
 *
 * Un verbo al presente e non "Caricamento...": dice quale delle azioni della
 * pagina è in corso, che qui cambiano a ogni passo (accesso, registrazione,
 * codice, password).
 */
const SUBMITTING_LABEL = {
  login: 'Accedo\u2026',
  register: 'Creo l\u2019account\u2026',
  confirm_signup: 'Controllo il codice\u2026',
  forgot: 'Invio l\u2019email\u2026',
  recovery_forgot: 'Invio il codice\u2026',
  recovery_otp: 'Verifico\u2026',
  recovery_newpwd: 'Reimposto\u2026',
}

/**
 * Le porte che portano qui senza che l'utente abbia chiesto di accedere.
 * La chiave arriva in `location.state.reason` da chi fa il redirect.
 */
const GATE_REASONS = {
  saved: {
    title: 'I tuoi salvati',
    login: 'Accedi e ritrovi i posti che hai salvato, su qualsiasi telefono.',
    register: 'Con un account i posti che salvi restano tuoi e te li ritrovi ovunque. Gratis, 20 secondi.',
  },
  profile: {
    title: 'Il tuo profilo',
    login: 'Accedi per vedere il tuo profilo, gli sconti presi e le tue liste.',
    register: 'Il profilo tiene insieme gli sconti che prendi e le liste che salvi. Gratis, 20 secondi.',
  },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signIn, signUp, verifySignupOtp, resendSignupOtp, signInWithGoogle, resetPasswordForEmail } = useAuth()

  // Continuità "Chiedi a Bi" (PR20 §8.2): se atterriamo qui da AuthGate
  // o dalla Home con uno state, dopo login portiamo l'utente a returnTo
  // mantenendo il messaggio iniziale.
  const returnTo = location.state?.returnTo || '/'
  const pendingInitialMessage = location.state?.initialMessage || null

  // Perché sei finito qui. Chi arriva dalla tab bar ("Salvati", "Profilo")
  // non ha chiesto di accedere: ha toccato una sezione e si è ritrovato
  // davanti a un modulo. Senza una riga che lo dica, la pagina sembra un
  // muro comparso dal nulla — e per uno che un account non l'ha mai avuto,
  // "Bentornato" è pure sbagliato.
  const gateReason = GATE_REASONS[location.state?.reason] || null
  const redirectAfterAuth = () => {
    if (returnTo && returnTo !== '/') {
      navigate(returnTo, { replace: true, state: pendingInitialMessage ? { initialMessage: pendingInitialMessage } : undefined })
    } else {
      navigate('/', { replace: true })
    }
  }

  // 'login' | 'register' | 'confirm_signup' | 'forgot'
  //   | 'recovery_forgot' | 'recovery_otp' | 'recovery_newpwd'
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = useState(() => location.state?.mode === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [newsletterOptIn, setNewsletterOptIn] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recoveryOtp, setRecoveryOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Conferma password della registrazione. Sta a parte da `confirmPassword`,
  // che appartiene al recupero: due percorsi diversi che non devono passarsi
  // valori addosso quando si cambia schermata.
  const [registerConfirm, setRegisterConfirm] = useState('')
  // Codice di conferma della registrazione, separato da `recoveryOtp`: sono
  // due codici diversi, con due scadenze diverse, e mescolarli vorrebbe dire
  // mandare a verificare quello sbagliato.
  const [signupOtp, setSignupOtp] = useState('')
  const [resending, setResending] = useState(false)
  // Acceso solo dopo che il codice è stato accettato: tiene l'animazione di
  // conferma finché non si passa alla pagina successiva.
  const [confirmed, setConfirmed] = useState(false)
  const [maskedRecovery, setMaskedRecovery] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRequired = !!import.meta.env.VITE_TURNSTILE_SITE_KEY

  // Redirect if already logged in
  useEffect(() => {
    if (user) redirectAfterAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  /**
   * Cambiando passo si torna in cima.
   *
   * Ogni modalità mostra campi diversi, e passando da "registrati" a
   * "conferma la tua email" la pagina si accorcia parecchio: spariscono
   * nome, email, password, Google e i due riquadri. Chi aveva scrollato in
   * fondo per premere il bottone resta con lo sguardo dove il bottone non
   * c'è più, e la schermata nuova — titolo compreso — è tutta sopra di lui.
   * Da fuori sembra che non sia successo niente.
   *
   * Il primo render è escluso: chi arriva da un link con `state.mode` non
   * deve vedere la pagina saltare appena si apre.
   */
  const primoRender = useRef(true)
  useEffect(() => {
    if (primoRender.current) {
      primoRender.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [mode, reduceMotion])

  /**
   * Il benvenuto di Bi, che è cosa nostra e passa da Resend — da non
   * confondere con la mail del codice, che la manda Supabase.
   *
   * Parte senza essere attesa: se Resend è lento o giù, la persona deve
   * comunque entrare. Un benvenuto mancato è un fastidio, una registrazione
   * bloccata è un utente perso.
   */
  const sendWelcomeEmail = () => {
    fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'user',
        email,
        name: fullName || email.split('@')[0],
      }),
    }).catch(() => {})
  }

  const handleResendOtp = async () => {
    setResending(true)
    setError('')
    try {
      await resendSignupOtp(email)
      setSuccess('Codice rimandato. Controlla la posta.')
    } catch (err) {
      setError(authErrorMessage(err, 'Non sono riuscito a rimandare il codice. Riprova fra poco.'))
    }
    setResending(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Il controllo lo facciamo noi invece di lasciare `required` al browser:
    // il fumetto nativo parla la lingua del browser, non quella del sito, e
    // su un telefono in inglese usciva "Please check this box if you want to
    // proceed" in mezzo a una pagina italiana — per giunta sopra il bottone,
    // che copriva.
    if (mode === 'register' && !acceptTerms) {
      setError('Per creare l\u2019account devi accettare la Privacy Policy e i Termini di Servizio.')
      return
    }

    if (mode === 'register' && password !== registerConfirm) {
      setError('Le due password non coincidono. Ricontrollale.')
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'forgot') {
        await resetPasswordForEmail(email)
        setSuccess('Email inviata! Controlla la tua casella di posta per reimpostare la password.')
      } else if (mode === 'recovery_forgot') {
        // Send recovery OTP for password reset
        if (captchaRequired && !captchaToken) {
          setError('Attendi qualche secondo: la verifica anti-spam è in corso, poi riprova.')
          setSubmitting(false)
          return
        }
        const resp = await fetch('/api/recovery-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, action: 'reset_password', captcha_token: captchaToken }),
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
          // Endpoint consolidato in /api/recovery-otp (PR21): se body
          // contiene `otp` esegue la verify, altrimenti il request.
          const resp = await fetch('/api/recovery-otp', {
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
      } else if (mode === 'confirm_signup') {
        if (signupOtp.length < 6) {
          setError('Il codice è più corto di quello che ti ho mandato. Ricontrollalo.')
          setSubmitting(false)
          return
        }
        await verifySignupOtp(email, signupOtp)
        // Il benvenuto parte adesso e non alla registrazione: chi non
        // conferma non è un iscritto, e non ha senso dargli il benvenuto.
        sendWelcomeEmail()
        setConfirmed(true)
        // Il tempo dell'animazione, poi si va avanti.
        setTimeout(() => redirectAfterAuth(), 1600)
      } else if (mode === 'login') {
        await signIn(email, password)
        redirectAfterAuth()
      } else {
        const { needsConfirmation } = await signUp(email, password, fullName)
        // La spunta "newsletter": chi si registra riceve gli annunci di
        // default (email_preferences, creata dal DB). Chi la toglie va
        // spento — subito se c'è già una sessione, altrimenti al primo
        // accesso (lib/emailPrefs.js). Prima scriveva nella lista vecchia,
        // che rispondeva 400 e comunque non decideva niente.
        if (!newsletterOptIn) {
          const { data: sess } = await supabase.auth.getSession()
          const uid = sess?.session?.user?.id
          if (uid) setAnnouncementsEnabled(uid, false).catch(() => rememberAnnouncementsOff(email))
          else rememberAnnouncementsOff(email)
        }
        if (needsConfirmation) {
          // Niente "controlla la tua email" e basta: si resta qui e si
          // scrive il codice, così la sessione è la stessa da cui si è
          // partiti e alla fine si è già dentro.
          setSignupOtp('')
          setMode('confirm_signup')
        } else {
          // Conferma disattivata su Supabase: si è già dentro.
          sendWelcomeEmail()
          redirectAfterAuth()
        }
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(authErrorMessage(err, 'Non siamo riusciti a completare l\u2019accesso con Google. Riprova.'))
    }
  }

  const titleText =
    mode === 'forgot' ? 'Password dimenticata?'
    : mode === 'confirm_signup' ? 'Conferma la tua email'
    : mode === 'recovery_forgot' ? 'Recupero account'
    : mode === 'recovery_otp' ? 'Inserisci il codice'
    : mode === 'recovery_newpwd' ? 'Nuova password'
    : mode === 'login' ? (gateReason?.title || 'Ciao di nuovo!')
    : 'Unisciti a noi'

  const subtitleText =
    mode === 'forgot' ? 'Inserisci la tua email e ti invieremo un link per reimpostarla'
    : mode === 'confirm_signup' ? `Ti ho mandato un codice a ${email}. Scrivilo qui sotto e sei dentro.`
    : mode === 'recovery_forgot' ? 'Ti invieremo un codice sull\u2019email di recupero'
    : mode === 'recovery_otp' ? `Abbiamo inviato un codice a ${maskedRecovery || 'la tua email di recupero'}`
    : mode === 'recovery_newpwd' ? 'Scegli una nuova password per il tuo account'
    : mode === 'login' ? (gateReason?.login || 'Accedi per salvare i tuoi ristoranti preferiti e sbloccare gli sconti esclusivi')
    : (gateReason?.register || 'Crea un account per salvare i tuoi posti del cuore')

  return (
    <div
      className="flex flex-col min-h-dvh md:min-h-[calc(100dvh-80px)]"
      style={{ background: 'var(--color-bg)', overflowX: 'hidden' }}
    >
      <AnimatePresence>
        {confirmed && <RegistrationDone key="registration-done" name={fullName} />}
      </AnimatePresence>
      <MetaTags title="Accedi — ChiamamiBi" noindex />
      {/* ─── HEADER — wordmark + Esplora la mappa (mobile only) ─── */}
      <header
        className="md:hidden"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-ink-05)',
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
              lineHeight: 0.92,
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
                fontSize: 18,
                letterSpacing: '0.02em',
                color: 'var(--color-corallo)',
              }}
            >
              LA GUIDA DI BI
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 8,
                color: 'var(--color-ink-55)',
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: 3,
              }}
            >
              by Chiamami Bi
            </span>
          </Link>
          <button
            type="button"
            onClick={() => navigate('/esplora')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12.5,
              color: 'var(--color-corallo-ink)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
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
          padding: `24px 22px`,
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 24px)`,
        }}
      >
        <motion.div
          className="w-full max-w-[400px]"
          style={{ margin: '0 auto' }}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {/* Bi mark — corallo circle with the brand B. Replaces the
             generic gradient heart so the auth screen carries the same
             wordmark identity as the rest of the site. */}
          <motion.div
            variants={itemVariants}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              // Colore per esteso, come il bottone di invio: vedi lì.
              backgroundColor: '#E8453C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              boxShadow: '0 10px 24px rgba(232, 69, 60, 0.28)',
              color: '#fff',
            }}
          >
            <BiLogoMark style={{ width: 38, height: 38 }} />
          </motion.div>

          {/* Accedi | Registrati — in cima e ben visibile. Prima il passaggio
              stava solo in una riga piccola in fondo al modulo, e chi arrivava
              dalla scheda Profilo (che apre la registrazione) non trovava più
              come entrare con un account che aveva già. */}
          {(mode === 'login' || mode === 'register') && (
            <motion.div
              variants={itemVariants}
              role="tablist"
              aria-label="Accedi o registrati"
              style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                margin: '0 auto 16px',
                maxWidth: 320,
                background: 'rgba(34,24,28,.06)',
                borderRadius: 999,
              }}
            >
              {[
                { key: 'login', label: 'Accedi' },
                { key: 'register', label: 'Registrati' },
              ].map(({ key, label }) => {
                const active = mode === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { if (!active) { setMode(key); setError(''); setSuccess('') } }}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: 'none',
                      cursor: active ? 'default' : 'pointer',
                      background: active ? 'var(--color-ink)' : 'transparent',
                      color: active ? '#fff' : 'var(--color-ink-70)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      fontWeight: 800,
                      transition: 'background .15s ease, color .15s ease',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </motion.div>
          )}

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 38,
              color: 'var(--color-ink)',
              textAlign: 'center',
              lineHeight: 1.04,
              letterSpacing: '-.03em',
              margin: 0,
            }}
          >
            {titleText}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            style={{
              fontSize: 14,
              color: 'var(--color-ink-70)',
              textAlign: 'center',
              lineHeight: 1.5,
              marginTop: 8,
              marginBottom: 22,
            }}
          >
            {subtitleText}
          </motion.p>

          {/* Benefits strip — register only, mobile only */}
          {mode === 'register' && (
            <motion.div
              variants={itemVariants}
              className="md:hidden"
              style={{
                background: 'var(--color-cream-deep)',
                borderRadius: 16,
                padding: '16px 18px',
                margin: '18px 0 22px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-70)',
                  marginBottom: 10,
                }}
              >
                Cosa ottieni
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, padding: 0, margin: 0 }}>
                {[
                  'Sconti veri nei 70+ locali che ho provato a Torino',
                  'Drop settimanali a posti limitati (scadono)',
                  'Liste tue per organizzare i posti che salvi',
                ].map((t) => (
                  <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.45 }}>
                    <span style={{ color: 'var(--color-corallo)', fontWeight: 900, flex: '0 0 auto' }}>✓</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

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
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-ink-15)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: 'var(--color-ink)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  marginBottom: 14,
                  boxShadow: 'var(--shadow-sm)',
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
                  gap: 10,
                  margin: '18px 0',
                }}
              >
                <div style={{ flex: 1, height: 1, background: 'var(--color-ink-15)' }} />
                <span style={{ fontSize: 11, color: 'var(--color-ink-55)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>oppure</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-ink-15)' }} />
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
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 12 }}
                  required
                />
              )}
            </AnimatePresence>

            {mode !== 'confirm_signup' && (
              <input
                type="email"
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ ...inputStyle, marginBottom: (mode === 'login' || mode === 'register') ? 12 : 18 }}
                required
              />
            )}

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
                    /* Su "accedi" è la password che hai già, su "registrati"
                       è nuova: detto così il gestore password propone la
                       compilazione nel primo caso e la generazione nel
                       secondo, invece di offrire sempre la cosa sbagliata. */
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
                          color: 'var(--color-corallo-ink)',
                          fontWeight: 700,
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
                  {/* Conferma password — compare solo quando la prima è stata
                      scritta: chiedere due volte una cosa non ancora iniziata
                      è solo un campo vuoto in più da guardare. */}
                  <AnimatePresence>
                    {mode === 'register' && password.length > 0 && (
                      <motion.div
                        key="password-confirm"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Ripeti la password"
                          value={registerConfirm}
                          onChange={(e) => setRegisterConfirm(e.target.value)}
                          aria-label="Ripeti la password"
                          aria-invalid={registerConfirm.length > 0 && registerConfirm !== password}
                          style={{
                            ...inputStyle,
                            marginBottom: 6,
                            // Il bordo si tinge solo quando c'è qualcosa da
                            // dire: mentre si scrive non deve diventare rosso
                            // a ogni lettera prima che la parola sia finita.
                            ...(registerConfirm.length > 0 && registerConfirm !== password
                              ? { borderColor: 'var(--color-corallo)' }
                              : {}),
                          }}
                        />
                        <div
                          aria-live="polite"
                          style={{
                            minHeight: 18, marginBottom: 4, fontSize: 12.5, fontWeight: 600,
                            color: registerConfirm === password
                              ? 'var(--color-verde, #3F9D63)'
                              : 'var(--color-corallo)',
                          }}
                        >
                          {registerConfirm.length === 0
                            ? ''
                            : registerConfirm === password
                              ? '\u2713 Le password coincidono'
                              : 'Le password non coincidono'}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                      color: 'var(--color-ink-70)',
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

            {/* Codice di conferma della registrazione */}
            <AnimatePresence mode="wait">
              {mode === 'confirm_signup' && (
                <motion.div
                  key="signup-otp-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: 14 }}
                >
                  {/* Quanto è lungo il codice lo decide Supabase, non noi:
                      l'impostazione "Email OTP Length" sta nel suo dashboard e
                      va da 6 a 10. Fissare 6 qui dentro vuol dire tagliare le
                      cifre in più e far fallire una conferma valida — è
                      successo davvero con un codice da 8. Accettiamo l'intero
                      intervallo, così la cosa non si rompe più se un domani
                      qualcuno tocca quel campo. */}
                  <input
                    type="text"
                    className="otp-field"
                    placeholder="Scrivi il codice"
                    value={signupOtp}
                    onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label="Codice di conferma ricevuto per email"
                    autoFocus
                    style={{
                      ...inputStyle,
                      textAlign: 'center',
                      letterSpacing: 8,
                      fontFamily: 'monospace',
                      fontSize: 18,
                      marginBottom: 12,
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    style={{
                      display: 'block', margin: '0 auto', background: 'none', border: 'none',
                      padding: 4, cursor: resending ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                      color: 'var(--color-ink-70)', textDecoration: 'underline',
                    }}
                  >
                    {resending ? 'Rimando\u2026' : 'Non \u00e8 arrivato? Rimandamelo'}
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
                    className="otp-field"
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
                  style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newsletterOptIn}
                      onChange={(e) => setNewsletterOptIn(e.target.checked)}
                      style={{ marginTop: 3, accentColor: 'var(--color-corallo)', width: 16, height: 16, flex: '0 0 auto' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-ink-70)', lineHeight: 1.45 }}>
                      Voglio ricevere la newsletter di Bi — una mail al mese con novità, drop e locali nuovi a Torino.
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      style={{ marginTop: 3, accentColor: 'var(--color-corallo)', width: 16, height: 16, flex: '0 0 auto' }}
                      aria-describedby="accept-terms-label"
                    />
                    <span id="accept-terms-label" style={{ fontSize: 12, color: 'var(--color-ink-70)', lineHeight: 1.45 }}>
                      Ho letto e accetto la{' '}
                      <Link to="/privacy" style={{ color: 'var(--color-ink-70)', textDecoration: 'underline' }} target="_blank">Privacy Policy</Link>
                      {' '}e i{' '}
                      <Link to="/terms" style={{ color: 'var(--color-ink-70)', textDecoration: 'underline' }} target="_blank">Termini di Servizio</Link>
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
                    color: 'var(--color-corallo)',
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

            {mode === 'recovery_forgot' && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <Turnstile onToken={setCaptchaToken} action="recovery-otp" />
              </div>
            )}

            {/* Submit —
                In attesa il bottone resta corallo. Prima diventava grigio
                chiarissimo (`ink-15`) con tre puntini grigi sopra: su fondo
                crema non si distingueva più dalla pagina, e la segnalazione
                che ci è arrivata era «clicco il bottone, scompare ma non
                succede niente». Il bottone non spariva, spariva alla vista —
                e quello che sembrava un bottone rotto era un accesso in corso.
                Adesso il colore non cambia, gira una rotella e c'è scritto
                cosa sta succedendo. */}
            {/* Bottone normale, non motion.button, e colore scritto per
                esteso: il 22/09 su Safari iPhone il bottone (e il cerchio
                "Bi" qui sopra, stesso schema) comparivano senza sfondo —
                testo bianco su crema, cioè invisibili — e nessuno riusciva a
                entrare o registrarsi con email. L'effetto pressione lo fa la
                classe `press` in CSS, senza passare da Framer. */}
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="press hover-lift-sm"
              style={{
                width: '100%',
                backgroundColor: '#E8453C',
                color: '#fff',
                opacity: submitting ? 0.75 : 1,
                border: 'none',
                borderRadius: 16,
                padding: '15px 16px',
                fontSize: 15,
                fontWeight: 800,
                cursor: submitting ? 'progress' : 'pointer',
                fontFamily: 'var(--font-sans)',
                textAlign: 'center',
                letterSpacing: '-.01em',
                marginBottom: 20,
                boxShadow: '0 8px 20px rgba(232,69,60,.28)',
                transition: 'transform 0.15s, opacity 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              }}
            >
              {submitting && (
                <svg
                  className="animate-spin"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  style={{ flex: 'none' }}
                >
                  <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {submitting
                ? SUBMITTING_LABEL[mode] || 'Un attimo\u2026'
                : mode === 'confirm_signup'
                  ? 'Conferma ed entra'
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
            </button>
          </motion.form>

          {/* Toggle mode */}
          <motion.p
            variants={itemVariants}
            style={{
              fontSize: 13,
              color: 'var(--color-ink-70)',
              textAlign: 'center',
              marginBottom: 28,
            }}
          >
            {mode === 'confirm_signup' ? (
              <>
                Hai sbagliato indirizzo?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); setSignupOtp('') }}
                  style={{ color: 'var(--color-corallo-ink)', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Ricomincia
                </button>
              </>
            ) : (mode === 'forgot' || mode === 'recovery_forgot' || mode === 'recovery_otp' || mode === 'recovery_newpwd') ? (
              <>
                Ricordi la password?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); setRecoveryOtp(''); setNewPassword(''); setConfirmPassword('') }}
                  style={{ color: 'var(--color-corallo-ink)', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                  style={{ color: 'var(--color-corallo-ink)', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                  style={{ color: 'var(--color-corallo-ink)', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Accedi
                </button>
              </>
            )}
          </motion.p>

          {/* Scopri Bi */}
          <motion.div variants={itemVariants}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-ink-15)' }} />
              <span style={{ fontSize: 10.5, color: 'var(--color-ink-55)', letterSpacing: '0.14em', fontWeight: 800, textTransform: 'uppercase' }}>Scopri Bi</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-ink-15)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate('/about')}
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-ink-05)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6, lineHeight: 1 }}>👋</div>
                <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Chi è Bi</div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2, lineHeight: 1.3 }}>La storia della guida</div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/partner')}
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-ink-05)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6, lineHeight: 1 }}>🏪</div>
                <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Ristoratori</div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2, lineHeight: 1.3 }}>Candida il tuo locale</div>
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

/* ============================================================================
   La conferma che la registrazione è andata.

   Sta su tutto lo schermo e non è un messaggio verde in mezzo al modulo: è
   la fine di un percorso di cinque campi più un codice preso dalla posta, e
   merita di essere detta chiaramente una volta sola invece di essere cercata
   fra le righe di un form.

   Dura quanto il rimando alla pagina successiva (1,6s): non c'è niente da
   leggere oltre due parole, e trattenere qualcuno davanti a un'animazione
   dopo che ha finito è farlo aspettare per il nostro gusto, non per il suo.

   Con "riduci animazioni" attivo resta tutto, ma fermo: chi ha chiesto meno
   movimento vuole meno movimento, non meno informazioni.
   ========================================================================= */
function RegistrationDone({ name }) {
  const reduce = useReducedMotion()
  const primo = String(name || '').trim().split(/\s+/)[0]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      role="status"
      aria-live="assertive"
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'var(--color-bg, #FAF7F2)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 22,
        padding: 24, textAlign: 'center',
      }}
    >
      <motion.div
        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'var(--color-corallo, #E8453C)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 10px 30px rgba(232,69,60,.32)',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 52 52" fill="none" aria-hidden="true">
          <motion.path
            d="M14 27.5 L22.5 36 L38 18"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: reduce ? 0 : 0.18, duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.3, duration: reduce ? 0 : 0.3 }}
      >
        <h2 style={{
          fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28,
          letterSpacing: '-0.02em', color: 'var(--color-ink)', margin: '0 0 6px',
        }}>
          {primo ? `Ci sei, ${primo}.` : 'Ci sei.'}
        </h2>
        <p style={{ fontSize: 14.5, color: 'var(--color-ink-70)', margin: 0 }}>
          Account confermato. Ti porto dentro…
        </p>
      </motion.div>
    </motion.div>
  )
}
