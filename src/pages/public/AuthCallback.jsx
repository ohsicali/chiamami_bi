import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LogoFull } from '../../components/UI/Logo'

/**
 * Handles redirects from Supabase auth emails:
 * - Email confirmation (signup)
 * - Password reset
 * - Email change
 * - Magic link login
 *
 * Supabase redirects here with ?code=... which we exchange for a session.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const type = searchParams.get('type') // signup, recovery, email_change, magiclink
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Handle error from Supabase
      if (errorParam) {
        // Google OAuth: if trigger failed but user was created, try to recover session
        if (errorDescription?.includes('Database error saving new user')) {
          // The user might exist but profile creation failed — check if there's a session
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            // Session exists! Profile will be created by useAuth.fetchProfile
            setStatus('success')
            setMessage('Account creato! Benvenuta su La Guida di Bi!')
            setTimeout(() => navigate('/', { replace: true }), 1500)
            return
          }
        }
        setStatus('error')
        setMessage(errorDescription || 'Si è verificato un errore durante la verifica.')
        return
      }

      // Exchange code for session (PKCE flow)
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error

          // Route based on auth event type
          if (type === 'recovery') {
            setStatus('success')
            setMessage('Identità verificata. Reindirizzamento...')
            setTimeout(() => navigate('/reset-password', { replace: true }), 1000)
            return
          }

          if (type === 'email_change') {
            setStatus('success')
            setMessage('Email aggiornata con successo!')
            setTimeout(() => navigate('/profile', { replace: true }), 2000)
            return
          }

          // signup or magiclink — confirmed, redirect to home
          setStatus('success')
          setMessage(type === 'signup'
            ? 'Email confermata! Benvenuta su La Guida di Bi!'
            : 'Accesso effettuato!')
          setTimeout(() => navigate('/', { replace: true }), 2000)
        } catch (err) {
          setStatus('error')
          setMessage(err.message || 'Errore durante la verifica del codice.')
        }
        return
      }

      // No code — check if session already exists from hash fragment
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStatus('success')
        setMessage('Accesso effettuato!')
        setTimeout(() => navigate('/', { replace: true }), 1500)
      } else {
        setStatus('error')
        setMessage('Link non valido o scaduto. Riprova.')
      }
    }

    handleCallback()
  }, [navigate, searchParams])

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <LogoFull height={36} />

        {status === 'loading' && (
          <>
            <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-secondary">Verifica in corso...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-sm text-primary font-medium">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-red-500 font-medium">{message}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium"
            >
              Torna al login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
