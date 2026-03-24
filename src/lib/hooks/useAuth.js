import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

export function useAuth() {
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
      // Sync email to profile if missing
      if (!data.email && authUser.email) {
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
      const { data: created } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single()
      setProfile(created || newProfile)
      // Auto-subscribe to newsletter on first registration
      if (authUser.email) {
        supabase
          .from('newsletter_subscribers')
          .upsert({ email: authUser.email, source: 'registration' }, { onConflict: 'email' })
          .then(() => {})
          .catch(() => {})
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        fetchProfile(authUser)
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

  return { user, profile, loading, isAdmin, signIn, signUp, signInWithGoogle, signOut, refreshProfile, resetPasswordForEmail }
}
