/**
 * Vercel Edge Function — sitemap.xml dinamico
 *
 * Espone https://chiamamibi.com/sitemap.xml (via rewrite in vercel.json).
 * Include rotte statiche pubbliche + tutti i ristoranti pubblicati.
 * Edge runtime: NON conta nel limite 12 Serverless del piano Hobby.
 *
 * Env richieste:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const SITE_URL = 'https://chiamamibi.com'

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/esplora', priority: '0.9', changefreq: 'daily' },
  { path: '/list', priority: '0.9', changefreq: 'daily' },
  { path: '/sconti', priority: '0.9', changefreq: 'daily' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/partner', priority: '0.6', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
]

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function urlEntry({ loc, lastmod, priority, changefreq }) {
  const parts = [`    <loc>${xmlEscape(loc)}</loc>`]
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`)
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`)
  if (priority) parts.push(`    <priority>${priority}</priority>`)
  return `  <url>\n${parts.join('\n')}\n  </url>`
}

export default async function handler() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  let restaurants = []
  if (supabaseUrl && anonKey) {
    try {
      const supabase = createClient(supabaseUrl, anonKey)
      const { data } = await supabase
        .from('restaurants')
        .select('slug, name, updated_at')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
      restaurants = data || []
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[sitemap] supabase fetch failed:', err?.message)
    }
  }

  const urls = []

  for (const r of STATIC_ROUTES) {
    urls.push(urlEntry({
      loc: `${SITE_URL}${r.path}`,
      priority: r.priority,
      changefreq: r.changefreq,
    }))
  }

  for (const r of restaurants) {
    const slug = r.slug || (r.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) continue
    urls.push(urlEntry({
      loc: `${SITE_URL}/restaurant/${slug}`,
      lastmod: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: '0.8',
    }))
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
