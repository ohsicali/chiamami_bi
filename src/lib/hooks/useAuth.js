import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

// Single source of truth for the auth+profile state. Previously each call
// site of `useAuth()` ran its own getSession + fetch profile effect — so
// mounting N components that use this hook triggered N duplicate
// `GET /rest/v1/profiles?...` requests (flagged by Supabase advisor).
// Now the fetch runs once inside AuthProvider and all consumers share it.
const AuthContext = createContext(null)

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
      // Auto-subscribe to newsletter + send welcome email on first registration
      if (authUser.email) {
        supabase
          .from('newsletter_subscribers')
          .upsert({ email: authUser.email, source: 'registration' }, { onConflict: 'email' })
          .then(() => {})
          .catch(() => {})
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        fetchProfile(authUser).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(() => {
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        fetchProfile(authUser)
        // Sync email to profiles when it changes (e.g. after email change confirmation)
        // Skip for Google OAuth users — their profile email is managed separately as a contact email
        const isGoogleUser = authUser.app_metadata?.provider === 'google' || authUser.app_metadata?.providers?.includes('google')
        if (event === 'USER_UPDATED' && authUser.email && !isGoogleUser) {
          supabase.from('profiles').update({ email: authUser.email }).eq('id', authUser.id)
        }
      } else {
        setProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email, password, fullName) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
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

  const value = { user, profile, loading, isAdmin, signIn, signUp, signInWithGoogle, signOut, refreshProfile, resetPasswordForEmail }
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
