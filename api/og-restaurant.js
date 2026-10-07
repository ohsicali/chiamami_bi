/**
 * Vercel Edge Function — Pre-render meta tags per /restaurant/:slug
 *
 * Servita SOLO ai bot social / crawler (matching User-Agent in vercel.json).
 * Per gli utenti reali la rewrite catch-all serve sempre la SPA.
 * Edge runtime: NON conta nel limite 12 Serverless del piano Hobby.
 *
 * Cache CDN 10 minuti.
 *
 * Attenzione: tra quei crawler c'è Googlebot, quindi questa È la scheda che
 * Google indicizza (anche il suo renderer usa lo user-agent di Googlebot).
 * Fino al 07/10 il corpo era solo nome + tagline ("Cucina casalinga
 * piemontese") e Search Console dava le schede come "Scansionata, ma
 * attualmente non indicizzata". Ora porta lo stesso contenuto che vede chi
 * apre la scheda: recensione e consiglio di Bi, indirizzo, categorie, foto, e
 * i link alle sezioni e ad altri locali. Un locale che non c'è risponde 404
 * con noindex (prima 200 con "Ristorante", una pagina vuota per Google).
 */
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const SITE_URL = 'https://chiamamibi.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

function htmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function jsonEscape(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

const PRICE_LABEL = { 1: '€', 2: '€€', 3: '€€€', 4: '€€€€' }
const MOMENT_LABEL = { colazione: 'Colazione', pranzo: 'Pranzo', aperitivo: 'Aperitivo', cena: 'Cena', dopocena: 'Dopocena', brunch: 'Brunch', merenda: 'Merenda' }

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

// Il testo di Bi va a capo con righe vuote: un <p> per paragrafo.
function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${htmlEscape(p).replace(/\n/g, '<br />')}</p>`)
    .join('\n    ')
}

function buildBody({ restaurant, name, description, related }) {
  if (!restaurant) {
    return `<h1>Ristorante non trovato</h1>
    <p>Il ristorante che cerchi non è nella guida di Bi.</p>
    <p><a href="${SITE_URL}/list">Tutti i ristoranti di Torino consigliati da Bi</a></p>`
  }
  const city = restaurant.city || 'Torino'
  const facts = []
  if (restaurant.cuisine_type) facts.push(['Cucina', htmlEscape(restaurant.cuisine_type)])
  const price = PRICE_LABEL[restaurant.price_range] || (typeof restaurant.price_range === 'string' ? restaurant.price_range : '')
  if (price) facts.push(['Prezzo', htmlEscape(price)])
  const moments = list(restaurant.moments).map((m) => MOMENT_LABEL[m] || m)
  if (moments.length) facts.push(['Quando', htmlEscape(moments.join(', '))])
  if (restaurant.address) {
    const where = [restaurant.address, restaurant.neighborhood].filter(Boolean).join(' · ')
    facts.push(['Indirizzo', htmlEscape(where)])
  }
  if (restaurant.phone) facts.push(['Telefono', `<a href="tel:${htmlEscape(restaurant.phone.replace(/\s+/g, ''))}">${htmlEscape(restaurant.phone)}</a>`])
  if (restaurant.website) facts.push(['Sito', `<a href="${htmlEscape(restaurant.website)}" rel="nofollow noopener">${htmlEscape(restaurant.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`])

  const tags = [...new Set([...list(restaurant.category), ...list(restaurant.recommended_for)])]
  const photos = (restaurant.photos || []).map((p) => p.photo_url || p.thumb_url).filter(Boolean).slice(0, 4)

  const parts = [`<h1>${htmlEscape(name)}</h1>`]
  parts.push(`<p>${htmlEscape(restaurant.tagline || `${restaurant.cuisine_type || 'Ristorante'} a ${city}`)}</p>`)
  if (photos.length) {
    parts.push(photos.map((src, i) => `<img src="${htmlEscape(src)}" alt="${htmlEscape(`${name}${i ? ` — foto ${i + 1}` : ''}`)}" width="800" loading="lazy" />`).join('\n    '))
  }
  if (facts.length) {
    parts.push(`<dl>\n      ${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('\n      ')}\n    </dl>`)
  }
  if (restaurant.our_review) {
    parts.push(`<h2>La recensione di Bi</h2>\n    ${paragraphs(restaurant.our_review)}`)
  }
  if (restaurant.our_tip) {
    parts.push(`<h2>Il consiglio di Bi</h2>\n    ${paragraphs(restaurant.our_tip)}`)
  }
  if (!restaurant.our_review && !restaurant.our_tip && description) parts.push(`<p>${htmlEscape(description)}</p>`)
  if (tags.length) parts.push(`<p>${tags.map(htmlEscape).join(' · ')}</p>`)
  const links = [
    restaurant.google_maps_url && `<a href="${htmlEscape(restaurant.google_maps_url)}" rel="nofollow noopener">Indicazioni su Google Maps</a>`,
    restaurant.instagram_url && `<a href="${htmlEscape(restaurant.instagram_url)}" rel="nofollow noopener">Il video di Bi su Instagram</a>`,
    restaurant.tiktok_url && `<a href="${htmlEscape(restaurant.tiktok_url)}" rel="nofollow noopener">Il video di Bi su TikTok</a>`,
  ].filter(Boolean)
  if (links.length) parts.push(`<p>${links.join(' · ')}</p>`)
  if (related?.length) {
    parts.push(`<h2>Altri locali a ${htmlEscape(city)} consigliati da Bi</h2>\n    <ul>\n      ${related
      .map((r) => `<li><a href="${SITE_URL}/restaurant/${htmlEscape(r.slug)}">${htmlEscape(r.name)}</a>${r.cuisine_type ? ` — ${htmlEscape(r.cuisine_type)}` : ''}</li>`)
      .join('\n      ')}\n    </ul>`)
  }
  parts.push(`<nav>
      <a href="${SITE_URL}/">ChiamamiBi</a> ·
      <a href="${SITE_URL}/list">Tutti i ristoranti</a> ·
      <a href="${SITE_URL}/esplora">La mappa</a> ·
      <a href="${SITE_URL}/sconti">Promozioni ristoranti Torino</a>
    </nav>`)
  return parts.join('\n    ')
}

export function buildHtml({ restaurant, slug, related = [] }) {
  const url = `${SITE_URL}/restaurant/${slug}`
  const name = restaurant?.name || 'Ristorante'
  const title = `${name} — ChiamamiBi`
  const description =
    restaurant?.tagline ||
    restaurant?.our_review?.slice(0, 240) ||
    `Scopri ${name} a ${restaurant?.city || 'Torino'}: orari, indirizzo e la recensione di Bi.`
  const photo =
    restaurant?.photos?.[0]?.photo_url ||
    restaurant?.photos?.[0]?.thumb_url ||
    DEFAULT_OG_IMAGE
  const image = photo.startsWith('http') ? photo : `${SITE_URL}${photo}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name,
    url,
    image: [image],
    description,
  }
  if (restaurant?.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address,
      addressLocality: restaurant.city || 'Torino',
      addressCountry: restaurant.country || 'IT',
    }
  }
  if (restaurant?.latitude && restaurant?.longitude) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    }
  }
  if (restaurant?.phone) jsonLd.telephone = restaurant.phone
  if (restaurant?.website) jsonLd.sameAs = [restaurant.website]
  const priceRange = PRICE_LABEL[restaurant?.price_range] || (typeof restaurant?.price_range === 'string' ? restaurant.price_range : '')
  if (priceRange) jsonLd.priceRange = priceRange
  if (restaurant?.cuisine_type) jsonLd.servesCuisine = restaurant.cuisine_type

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}" />
    <link rel="canonical" href="${htmlEscape(url)}" />${restaurant ? '' : '\n    <meta name="robots" content="noindex" />'}

    <meta property="og:type" content="restaurant.restaurant" />
    <meta property="og:site_name" content="ChiamamiBi" />
    <meta property="og:title" content="${htmlEscape(title)}" />
    <meta property="og:description" content="${htmlEscape(description)}" />
    <meta property="og:url" content="${htmlEscape(url)}" />
    <meta property="og:image" content="${htmlEscape(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="it_IT" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${htmlEscape(title)}" />
    <meta name="twitter:description" content="${htmlEscape(description)}" />
    <meta name="twitter:image" content="${htmlEscape(image)}" />

    <script type="application/ld+json">${jsonEscape(jsonLd)}</script>
  </head>
  <body>
    ${buildBody({ restaurant, name, description, related })}
  </body>
</html>`
}

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
}

// Altri locali per i link in fondo: prima quelli con la stessa cucina.
export function pickRelated(restaurant, others, max = 8) {
  const pool = (others || []).filter((r) => r.slug && r.slug !== restaurant.slug)
  const same = pool.filter((r) => restaurant.cuisine_type && r.cuisine_type === restaurant.cuisine_type)
  const rest = pool.filter((r) => !same.includes(r))
  return [...same, ...rest].slice(0, max)
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const slug = (searchParams.get('slug') || '').trim()

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!slug) {
    return new Response(buildHtml({ restaurant: null, slug: '' }), { status: 404, headers: HTML_HEADERS })
  }

  let restaurant = null
  let related = []
  let failed = !(supabaseUrl && anonKey)
  if (!failed) {
    try {
      const supabase = createClient(supabaseUrl, anonKey)
      const [one, others] = await Promise.all([
        supabase
          .from('restaurants')
          .select(
            'id, name, slug, city, country, address, neighborhood, latitude, longitude, phone, website, google_maps_url, category, cuisine_type, price_range, tagline, our_review, our_tip, recommended_for, moments, instagram_url, tiktok_url, restaurant_photos(photo_url, thumb_url, sort_order)'
          )
          .eq('slug', slug)
          .eq('is_published', true)
          .maybeSingle(),
        supabase
          .from('restaurants')
          .select('slug, name, cuisine_type')
          .eq('is_published', true)
          .order('updated_at', { ascending: false })
          .limit(200),
      ])
      if (one.error) throw one.error
      if (one.data) {
        const { restaurant_photos, ...rest } = one.data
        restaurant = {
          ...rest,
          photos: (restaurant_photos || []).sort(
            (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
          ),
        }
        related = pickRelated(restaurant, others.data)
      }
    } catch (err) {
      failed = true
      // eslint-disable-next-line no-console
      console.error('[og-restaurant] supabase error:', err?.message)
    }
  }

  // Database che non risponde: 503, così Google ripassa invece di registrare
  // la scheda come vuota o inesistente.
  if (failed) {
    return new Response(buildHtml({ restaurant: null, slug }), {
      status: 503,
      headers: { ...HTML_HEADERS, 'Cache-Control': 'no-store', 'Retry-After': '600' },
    })
  }

  return new Response(buildHtml({ restaurant, slug, related }), {
    status: restaurant ? 200 : 404,
    headers: HTML_HEADERS,
  })
}
