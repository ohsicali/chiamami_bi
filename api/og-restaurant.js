/**
 * Vercel Serverless Function — Pre-render meta tags per /restaurant/:slug
 *
 * Servita SOLO ai bot social / crawler (matching User-Agent in vercel.json).
 * Per gli utenti reali la rewrite catch-all serve sempre la SPA.
 *
 * Cosa fa:
 *  - Estrae slug dalla query (rewrite "/restaurant/:slug" → "/api/og-restaurant?slug=:slug")
 *  - Carica il ristorante da Supabase (RLS pubblica)
 *  - Restituisce HTML con title/description/OG/Twitter/JSON-LD specifici
 *  - Include un meta refresh + script di redirect verso la pagina reale per
 *    eventuali user agent che non sono bot e capitano qui
 *
 * Cache CDN 10 minuti.
 */
import { createClient } from '@supabase/supabase-js'

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

function buildHtml({ restaurant, slug }) {
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
  if (restaurant?.price_range) jsonLd.priceRange = restaurant.price_range
  if (restaurant?.cuisine_type) jsonLd.servesCuisine = restaurant.cuisine_type

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}" />
    <link rel="canonical" href="${htmlEscape(url)}" />

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

    <meta http-equiv="refresh" content="0; url=${htmlEscape(url)}" />
    <script type="application/ld+json">${jsonEscape(jsonLd)}</script>
  </head>
  <body>
    <h1>${htmlEscape(name)}</h1>
    <p>${htmlEscape(description)}</p>
    <p><a href="${htmlEscape(url)}">Apri ${htmlEscape(name)} su ChiamamiBi</a></p>
    <script>window.location.replace(${jsonEscape(url)})</script>
  </body>
</html>`
}

export default async function handler(req, res) {
  const slug = (req.query?.slug || '').toString().trim()
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=600, stale-while-revalidate=86400'
  )

  if (!slug) {
    res.status(200).send(buildHtml({ restaurant: null, slug: '' }))
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  let restaurant = null
  if (supabaseUrl && anonKey) {
    try {
      const supabase = createClient(supabaseUrl, anonKey)
      const { data } = await supabase
        .from('restaurants')
        .select(
          'id, name, slug, city, country, address, latitude, longitude, phone, website, cuisine_type, price_range, tagline, our_review, restaurant_photos(photo_url, thumb_url, sort_order)'
        )
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle()
      if (data) {
        const { restaurant_photos, ...rest } = data
        restaurant = {
          ...rest,
          photos: (restaurant_photos || []).sort(
            (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
          ),
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[og-restaurant] supabase error:', err?.message)
    }
  }

  res.status(200).send(buildHtml({ restaurant, slug }))
}
