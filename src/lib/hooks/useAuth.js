import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { applyPendingAnnouncementsOff } from '../emailPrefs'

// Single source of truth for the auth+profile state. Previously each call
// site of `useAuth()` ran its own getSession + fetch profile effect — so
// mounting N components that use this hook triggered N duplicate
// `GET /rest/v1/profiles?...` requests (flagged by Supabase advisor).
// Now the fetch runs once inside AuthProvider and all consumers share it.
const AuthContext = createContext(null)

/**
 * Nessuna chiamata di autenticazione può restare appesa per sempre.
 *
 * `signInWithPassword` e compagni non hanno un tempo massimo: se la richiesta
 * parte e la risposta non arriva mai — rete mobile che cade a metà, tunnel,
 * scheda messa in pausa da iOS mentre si va a prendere la password dal
 * gestore — la promessa non si risolve e non fallisce. In pagina si vedeva
 * così: premi "Accedi", il bottone passa allo stato in corso e ci resta.
 * Nessun messaggio, nessun modo di riprovare se non ricaricare.
 *
 * Qui, passati AUTH_TIMEOUT_MS, la promessa fallisce con un errore che
 * `authErrorMessage` sa tradurre: chi sta davanti legge cos'è successo e il
 * bottone torna premibile. Se la risposta arriva dopo, non fa danni: Supabase
 * ha comunque salvato la sessione e `onAuthStateChange` fa il suo lavoro.
 *
 * 20 secondi e non 5: su 3G lenta un accesso legittimo può metterci parecchio,
 * e troncarlo troppo presto vorrebbe dire dare buca a chi stava per entrare.
 */
const AUTH_TIMEOUT_MS = 20000

export class AuthTimeoutError extends Error {
  constructor() {
    super('auth request timed out')
    this.name = 'AuthTimeoutError'
  }
}

function withTimeout(promise, ms = AUTH_TIMEOUT_MS) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AuthTimeoutError()), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch or create profile from profiles table
  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser || !isSupabaseConfigured()) {
      setProfile(null)
      return null
    }
    // Try to get existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (data) {
      // Sync email to profile if missing (but don't overwrite for Google users who may have a different contact email)
      const isGoogleUser = authUser.app_metadata?.provider === 'google' || authUser.app_metadata?.providers?.includes('google')
      if (!data.email && authUser.email && !isGoogleUser) {
        supabase.from('profiles').update({ email: authUser.email }).eq('id', authUser.id)
        data.email = authUser.email
      } else if (!data.email && authUser.email && isGoogleUser) {
        // For Google users, set initial email but don't overwrite later changes
        supabase.from('profiles').update({ email: authUser.email }).eq('id', authUser.id)
        data.email = authUser.email
      }
      setProfile(data)
      // La spunta "newsletter" tolta alla registrazione, prima di avere una
      // sessione: si applica adesso (lib/emailPrefs.js).
      applyPendingAnnouncementsOff(authUser.id, authUser.email)
      return data
    }

    // Profile doesn't exist yet — create it (first login)
    if (error?.code === 'PGRST116') {
      const newProfile = {
        id: authUser.id,
        full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
        avatar_url: authUser.user_metadata?.avatar_url || null,
        is_admin: false,
      }
      const { data: created, error: insertError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single()
      if (insertError) {
        // Insert failed — try upsert (profile might partially exist)
        const { data: upserted } = await supabase
          .from('profiles')
          .upsert(newProfile, { onConflict: 'id' })
          .select()
          .single()
        setProfile(upserted || newProfile)
      } else {
        setProfile(created || newProfile)
      }
      // Il benvenuto alla prima registrazione. Qui c'era anche l'iscrizione a
      // `newsletter_subscribers`, ma rispondeva 400 a ogni registrazione (la
      // colonna `source` non esiste, e l'upsert vuole un permesso di UPDATE
      // che nessuno ha): la lista è quella vecchia, le email agli iscritti
      // partono da `email_preferences`, che il DB crea da sé alla
      // registrazione (vedi CLAUDE.md, "Chi le riceve").
      if (authUser.email) {
        // Send welcome email (fire and forget)
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'user',
            email: authUser.email,
            name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
          }),
        }).catch(() => {})
      }
      return created || newProfile
    }

    return null
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    // Se il fetch del profilo per l'utente attuale non torna mai (rete che
    // muore a metà), non lasciamo `profile` orfano per sempre: dopo
    // AUTH_TIMEOUT_MS mettiamo un profilo minimo non-admin, così chi aspetta
    // `isAdmin` non resta bloccato. Vedi il commento su `profileMatchesUser`
    // più sotto per perché questo conta.
    const fetchProfileSafely = (authUser) => {
      withTimeout(fetchProfile(authUser)).catch(() => {
        setProfile((p) => (p && p.id === authUser.id ? p : { id: authUser.id, is_admin: false }))
      })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        fetchProfileSafely(authUser)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        // Il `setTimeout(0)` non è un ritardo estetico: dentro la callback di
        // onAuthStateChange non si possono chiamare altre funzioni Supabase.
        // La callback viene eseguita — e attesa — mentre il client di
        // autenticazione tiene il lucchetto su navigator.locks; qualsiasi
        // query fatta da qui dentro chiede a sua volta la sessione, quindi lo
        // stesso lucchetto, e resta in attesa di sé stessa. Con il rinvio a
        // fine giro il lucchetto è già stato rilasciato. È la raccomandazione
        // di Supabase stesso; noi l'abbiamo sempre fatto al contrario.
        setTimeout(() => {
          fetchProfileSafely(authUser)
          // Sync email to profiles when it changes (e.g. after email change confirmation)
          // Skip for Google OAuth users — their profile email is managed separately as a contact email
          const isGoogleUser = authUser.app_metadata?.provider === 'google' || authUser.app_metadata?.providers?.includes('google')
          if (event === 'USER_UPDATED' && authUser.email && !isGoogleUser) {
            supabase.from('profiles').update({ email: authUser.email }).eq('id', authUser.id)
          }
        }, 0)
      } else {
        setProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }))
    if (error) throw error
  }, [])

  /**
   * Restituisce { needsConfirmation } — vero quando Supabase non ha aperto
   * una sessione perché aspetta la conferma dell'indirizzo. Serve a chi
   * chiama per sapere se mostrare la schermata del codice o entrare e basta.
   *
   * `emailRedirectTo` resta anche se ora confermiamo col codice: chi apre una
   * vecchia email col link, o chi ha il client di posta che lo pre-carica,
   * deve comunque atterrare da qualche parte di sensato.
   */
  const signUp = useCallback(async (email, password, fullName) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { data, error } = await withTimeout(supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    }))
    if (error) throw error
    return { needsConfirmation: !data?.session }
  }, [])

  /**
   * Conferma la registrazione col codice a 6 cifre arrivato per email.
   *
   * `type: 'signup'` è quello giusto: 'email' verificherebbe un cambio di
   * indirizzo, non una registrazione, e fallirebbe con un messaggio che non
   * dice niente a nessuno. A verifica riuscita Supabase apre già la sessione,
   * quindi non serve un login dopo.
   */
  const verifySignupOtp = useCallback(async (email, token) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { error } = await withTimeout(supabase.auth.verifyOtp({ email, token, type: 'signup' }))
    if (error) throw error
  }, [])

  /** Rimanda il codice a chi non l'ha ricevuto o l'ha lasciato scadere. */
  const resendSignupOtp = useCallback(async (email) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { error } = await withTimeout(supabase.auth.resend({ type: 'signup', email }))
    if (error) throw error
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }, [])

  const resetPasswordForEmail = useCallback(async (email) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    }))
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user)
  }, [user, fetchProfile])

  const isAdmin = profile?.is_admin === true

  // Dopo un login vero, `user` viene valorizzato subito ma il profilo (quindi
  // `is_admin`) arriva un attimo dopo con un fetch asincrono — rimandato di
  // proposito per non chiedere il lucchetto `navigator.locks` mentre il
  // client di autenticazione lo tiene già (vedi sopra). Se le pagine admin
  // considerassero `loading` finito in quella finestra, leggerebbero
  // `isAdmin === false` (profilo non ancora arrivato, o ancora quello
  // dell'utente precedente) e rimbalzerebbero su `/admin/login` — che a sua
  // volta rimanda a `/admin` appena vede `user`: un ping-pong di
  // `history.replaceState()` che su rete lenta arriva a superare il limite
  // di sicurezza di Safari/WebKit e manda in crash la pagina (successo il
  // 16-17/09, vedi docs/v4-status.md).
  //
  // Un tentativo precedente provava a inseguire l'evento `SIGNED_IN` per
  // riportare `loading` a `true` — ma l'ordine esatto fra la promise di
  // `signIn()` e il fire di quell'evento non è garantito, quindi la corsa
  // poteva ripresentarsi. Qui invece `loading` dipende da un confronto
  // diretto: finché c'è un `user` ma `profile` non è ancora il SUO profilo
  // (`profile.id !== user.id`, vero anche appena dopo il login quando
  // `profile` è ancora `null` o è rimasto quello della sessione precedente),
  // l'app è considerata "in caricamento" — a prescindere da quale evento
  // l'abbia scatenato o da quando è arrivato.
  const profileMatchesUser = !user || (profile != null && profile.id === user.id)
  const effectiveLoading = loading || (!!user && !profileMatchesUser)

  const value = { user, profile, loading: effectiveLoading, isAdmin, signIn, signUp, verifySignupOtp, resendSignupOtp, signInWithGoogle, signOut, refreshProfile, resetPasswordForEmail }
  return React.createElement(AuthContext.Provider, { value }, children)
}

// Public hook — unchanged signature so all 30 consumer sites keep working.
// Throws if used outside the Provider to catch misconfiguration early.
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Wrap the app tree in main.jsx.')
  }
  return ctx
}
