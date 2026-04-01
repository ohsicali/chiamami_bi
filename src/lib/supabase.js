import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create client only if credentials are available, otherwise use mock mode
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseConfigured = () => !!supabase

// Proxy Supabase storage images through Vercel CDN to reduce egress
export function proxyImg(url) {
  if (!url || !url.includes('supabase.co/storage/')) return url
  return `/api/img?url=${encodeURIComponent(url)}`
}
