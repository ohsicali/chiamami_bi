import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks/useAuth'
import { LogoFull } from '../../components/UI/Logo'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Must have a session (from the recovery link) to reset password
  useEffect(() => {
    if (!user) {
      // Give a moment for session to load
      const timer = setTimeout(() => {
        if (!user) navigate('/login', { replace: true })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri')
      return
    }
    if (password !== confirm) {
      setError('Le password non corrispondono')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 2500)
    } catch (err) {
      setError(err.message || 'Errore durante il reset della password')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <LogoFull height={36} />
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm text-primary font-medium">Password aggiornata con successo!</p>
          <p className="text-xs text-secondary">Reindirizzamento alla home...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-5 py-10">
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <LogoFull height={36} />

        <div className="text-center">
          <h1
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em' }}
          >
            Nuova password
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Scegli una nuova password per il tuo account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <input
            type="password"
            placeholder="Nuova password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
            required
            minLength={6}
          />

          <input
            type="password"
            placeholder="Conferma password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-2xl bg-card px-4 py-3.5 text-sm text-primary shadow-sm outline-none ring-1 ring-gray-200 focus:ring-accent transition-shadow"
            required
            minLength={6}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-500 text-center"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e64545] disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            {submitting ? '...' : 'Salva nuova password'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
