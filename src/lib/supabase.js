import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create client only if credentials are available, otherwise use mock mode
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseConfigured = () => !!supabase

// Proxy Supabase storage images through Vercel CDN to reduce egress.
// Optional opts:
//   - w: target width in px (32-2400). The proxy resizes via sharp and
//     transcodes to WebP, or AVIF when the browser accepts it. Each size+
//     format combination is cached separately on the CDN.
//   - q: encoder quality (30-95, default 82).
// When `w` is omitted the proxy streams the original bytes through (legacy
// behavior).
export function proxyImg(url, opts) {
  if (!url || !url.includes('supabase.co/storage/')) return url
  const params = new URLSearchParams({ url })
  if (opts?.w) params.set('w', String(opts.w))
  if (opts?.q) params.set('q', String(opts.q))
  return `/api/img?${params.toString()}`
}

// Build a responsive srcSet for a Supabase Storage image. Browsers pick the
// smallest variant that fits the slot × devicePixelRatio, so an oversized
// proxy width is never downloaded just because the source is huge.
// `widths` defaults cover the common card/hero sizes used across the app.
export function proxyImgSrcSet(url, widths = [300, 600, 900, 1200, 1600]) {
  if (!url || !url.includes('supabase.co/storage/')) return undefined
  return widths.map((w) => `${proxyImg(url, { w })} ${w}w`).join(', ')
}
