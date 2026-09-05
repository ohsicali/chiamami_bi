/**
 * Vercel Serverless Function — resolve external links and fetch metadata
 * Runs in US region (iad1) to bypass EU consent page for CID URLs.
 *
 * Dispatcher (body.type):
 *   - default / 'maps'  → Google Maps URL resolution (legacy).
 *                         Supports: maps.app.goo.gl, goo.gl, share.google,
 *                         ?cid= URLs, full place URLs, Places text-search
 *                         by name (body.query).
 *   - 'reel'            → Instagram Reel og:image/og:title/og:description
 *                         extraction (body.url, https://instagram.com/...).
 *
 * Consolidato con l'ex endpoint /api/resolve-reel (PR17, per restare sotto
 * al cap Vercel Hobby di 12 functions).
 */

import { applyCors } from './_cors.js'

// SSRF guard: only fetch URLs on these Google-owned hosts. The endpoint
// purposefully does not accept arbitrary destinations — it's intended for
// Maps link resolution only.
const ALLOWED_HOSTS = [
  'maps.google.com',
  'www.google.com',
  'google.com',
  'maps.app.goo.gl',
  'goo.gl',
  'share.google',
  'g.co',
]

function isHostAllowed(host) {
  if (!host) return false
  const h = host.toLowerCase()
  return ALLOWED_HOSTS.some((allowed) => h === allowed || h.endsWith('.' + allowed))
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url, query, type } = req.body || {}

  // Instagram Reel metadata extraction (ex /api/resolve-reel)
  if (type === 'reel') {
    return await resolveReel(url, res)
  }

  if (!url && !query) return res.status(200).json({ error: 'url or query is required' })

  const apiKey = process.env.VITE_GOOGLE_PLACES_KEY
  if (!apiKey) return res.status(200).json({ error: 'VITE_GOOGLE_PLACES_KEY non configurata' })

  // Direct name search — bypasses URL resolution entirely, uses Places API only
  if (query && !url) {
    try {
      return await searchByName(query, apiKey, res)
    } catch (err) {
      return res.status(200).json({ error: `Errore ricerca: ${err.message}` })
    }
  }

  // Reject non-https and non-allowlisted hosts up front. We only accept
  // https URLs (Google share links are always https — http would only happen
  // through a redirect, which we re-validate inside followRedirects()).
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') {
      return res.status(400).json({ error: 'Invalid URL protocol — only https is accepted' })
    }
    if (!isHostAllowed(u.hostname)) {
      return res.status(403).json({ error: 'URL non supportato. Usa un link di Google Maps.' })
    }
  } catch {
    return res.status(400).json({ error: 'URL non valido' })
  }

  try {
    // CID URLs can't be resolved server-side (Google blocks with CAPTCHA/consent)
    try {
      if (new URL(url).searchParams.get('cid')) {
        return res.status(200).json({
          error: 'Link CID non supportato. Dall\'app Google Maps usa "Condividi" → "Copia link".',
        })
      }
    } catch (_) {}

    // Step 1: Follow redirects (for short URLs like maps.app.goo.gl)
    let resolvedUrl = url
    try { resolvedUrl = await followRedirects(url) } catch (_) {}

    // Detect Google CAPTCHA/sorry page
    if (resolvedUrl.includes('google.com/sorry')) {
      return res.status(200).json({
        error: 'Google ha bloccato la richiesta dal server. Usa la ricerca per nome qui sotto.',
        captcha: true,
      })
    }

    // Step 2: Fetch page HTML to extract title/metadata
    let pageTitle = ''
    let canonicalUrl = ''
    let htmlLength = 0
    let hasConsent = false
    try {
      const pageUrl = resolvedUrl !== url ? resolvedUrl : url
      const pageRes = await fetch(pageUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
          'Cookie': 'CONSENT=YES+cb.20231001-00-p0.en+FX+987; SOCS=CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg',
        },
      })
      if (pageRes.url && pageRes.url !== pageUrl) resolvedUrl = pageRes.url
      // Detect Google CAPTCHA/sorry page after HTML fetch
      if (resolvedUrl.includes('google.com/sorry') || (pageRes.url && pageRes.url.includes('google.com/sorry'))) {
        return res.status(200).json({
          error: 'Google ha bloccato la richiesta dal server. Usa la ricerca per nome qui sotto.',
          captcha: true,
        })
      }
      const html = await pageRes.text()
      htmlLength = html.length
      hasConsent = html.includes('consent.google') || html.includes('CONSENT')
      const extracted = extractFromHtml(html)
      pageTitle = extracted.placeName || ''
      canonicalUrl = extracted.canonicalUrl || ''
    } catch (_) {}

    // Step 3: Build search query
    let searchQuery = ''
    let lat = null
    let lng = null

    // Extract coordinates from URL
    for (const u of [resolvedUrl, canonicalUrl]) {
      if (!u) continue
      const m = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break }
    }

    // Strategy 1: /place/Name/ from URL
    for (const u of [canonicalUrl, resolvedUrl]) {
      if (searchQuery || !u) continue
      const m = u.match(/\/place\/([^/@?]+)/)
      if (m) searchQuery = decodeURIComponent(m[1].replace(/\+/g, ' '))
    }

    // Strategy 2: ?q= parameter from URL (more reliable than page title)
    if (!searchQuery) {
      for (const u of [resolvedUrl, canonicalUrl]) {
        if (searchQuery || !u) continue
        try {
          const q = new URL(u).searchParams.get('q')
          if (q) {
            const decoded = decodeURIComponent(q).replace(/\+/g, ' ')
            // First comma segment is typically the place name
            const parts = decoded.split(',').map(p => p.trim()).filter(Boolean)
            const candidate = parts[0]
            if (candidate && !isGenericQuery(candidate)) searchQuery = candidate
          }
        } catch (_) {}
      }
    }

    // Strategy 3: page title
    if (!searchQuery && pageTitle && pageTitle.length > 2) {
      searchQuery = pageTitle
    }

    // Reject generic queries
    if (searchQuery && isGenericQuery(searchQuery)) searchQuery = ''

    if (!searchQuery && !lat) {
      return res.status(200).json({
        error: 'Impossibile estrarre dati dal link. Prova con un link Google Maps completo.',
        _debug: { originalUrl: url, resolvedUrl, pageTitle, canonicalUrl, searchQuery, htmlLength, hasConsent },
      })
    }

    // Step 4: Find place via Google Places API
    const locationBias = lat && lng
      ? `&locationbias=circle:500@${lat},${lng}`
      : '&locationbias=circle:30000@45.0703,7.6869'

    let placeId = null

    if (searchQuery) {
      const findRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${apiKey}${locationBias}`
      )
      const findData = await findRes.json()
      placeId = findData.candidates?.[0]?.place_id
    }

    if (!placeId && lat && lng) {
      const nearbyRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50&key=${apiKey}&language=it`
      )
      const nearbyData = await nearbyRes.json()
      placeId = nearbyData.results?.[0]?.place_id
    }

    if (!placeId) {
      return res.status(200).json({
        resolved_url: resolvedUrl,
        name: searchQuery || '',
        latitude: lat,
        longitude: lng,
        address: '',
        phone: '',
        website: '',
        warning: 'Nessun risultato trovato. Prova con un link Google Maps più completo.',
        _debug: { resolvedUrl, searchQuery, lat, lng, placeId: null },
      })
    }

    // Step 5: Get full place details — includiamo address_components per
    // ricavare città (locality) e quartiere (neighborhood/sublocality)
    // strutturati, senza dover fare parsing della stringa raw.
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,address_components,geometry,formatted_phone_number,website,url&key=${apiKey}&language=it`
    )
    const detailsData = await detailsRes.json()
    const place = detailsData.result

    let finalName = place?.name || searchQuery || ''
    if (/^\d+$/.test(finalName)) finalName = ''

    const { city, neighborhood } = parseAddressComponents(place?.address_components)

    return res.status(200).json({
      resolved_url: place?.url || resolvedUrl,
      name: finalName,
      latitude: place?.geometry?.location?.lat ?? lat,
      longitude: place?.geometry?.location?.lng ?? lng,
      address: place?.formatted_address || '',
      city: city || '',
      neighborhood: neighborhood || '',
      phone: place?.formatted_phone_number || '',
      website: place?.website || '',
      _debug: { resolvedUrl, searchQuery, placeId, placeName: place?.name || null, city, neighborhood },
    })
  } catch (err) {
    return res.status(200).json({ error: `Errore: ${err.message}` })
  }
}

/**
 * Estrae città e quartiere dai Google Places `address_components`.
 * - città: locality → postal_town → administrative_area_level_3
 * - quartiere: neighborhood → sublocality (e livelli) → null
 * Restituisce { city, neighborhood } (stringhe vuote se assenti).
 */
function parseAddressComponents(components) {
  const out = { city: '', neighborhood: '' }
  if (!Array.isArray(components)) return out

  const byType = (type) =>
    components.find((c) => Array.isArray(c.types) && c.types.includes(type))?.long_name || ''

  out.city =
    byType('locality') ||
    byType('postal_town') ||
    byType('administrative_area_level_3') ||
    ''

  out.neighborhood =
    byType('neighborhood') ||
    byType('sublocality') ||
    byType('sublocality_level_1') ||
    byType('sublocality_level_2') ||
    ''

  return out
}

/** Extract useful data from Google Maps HTML */
function extractFromHtml(html) {
  const result = { placeName: '', canonicalUrl: '', lat: null, lng: null, source: '' }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    const title = titleMatch[1]
      .replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '')
      .replace(/\s*[-–—|·]\s*Google\s*$/i, '')
      .trim()
    if (title && title.length > 2 && !/^google/i.test(title)) {
      const cleaned = title
        .replace(/[\u4e00-\u9fff\u3000-\u303f]+/g, '')
        .replace(/\b\d{4,6}\b/g, '')
        .replace(/\b(TO|MI|RM|NA|FI|BO|GE|PA|CT|BA|VE|PD)\b/g, '')
        .replace(/[,\s]{2,}/g, ' ')
        .trim()
      if (cleaned && !isGenericQuery(cleaned)) {
        result.placeName = cleaned
        result.source = 'title'
      }
    }
  }

  if (!result.placeName) {
    const ogTitleMatch = html.match(/property="og:title"[^>]+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"[^>]+property="og:title"/i)
    if (ogTitleMatch) {
      const ogTitle = ogTitleMatch[1].replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '').trim()
      if (ogTitle && !isGenericQuery(ogTitle)) {
        result.placeName = ogTitle
        result.source = 'og_title'
      }
    }
  }

  const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)
    || html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)
  if (canonicalMatch) result.canonicalUrl = canonicalMatch[1]

  if (!result.placeName) {
    const ogDescMatch = html.match(/property="og:description"[^>]+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"[^>]+property="og:description"/i)
    if (ogDescMatch) {
      const desc = ogDescMatch[1]
      if (desc.includes('★') || desc.includes('·')) {
        const cleaned = desc.replace(/★[★☆]*/g, '').replace(/^\s*·\s*/, '').trim()
        const segments = cleaned.split(/\s*[·,]\s*/).filter(Boolean)
        const categories = ['ristorante', 'bar', 'pizzeria', 'trattoria', 'osteria', 'caffè', 'café', 'gelateria', 'pasticceria', 'pub', 'birreria', 'enoteca', 'restaurant', 'bakery', 'cafe']
        if (segments.length >= 2) {
          result.placeName = categories.some(c => segments[0].toLowerCase().includes(c))
            ? segments.slice(1).join(' ').trim()
            : segments[0].trim()
          result.source = 'og_desc'
        }
      }
    }
  }

  return result
}

/** Check if a query is generic/useless */
function isGenericQuery(q) {
  if (!q) return true
  const lower = q.toLowerCase().trim()
  const generic = ['google maps', 'google', 'find local businesses', 'trova attività', 'view maps', 'indicazioni stradali', 'visualizza mappe']
  if (generic.some(p => lower.includes(p))) return true
  if (/^\d+$/.test(lower)) return true
  // Postal code + city (e.g. "10124 Torino TO")
  if (/^\d{4,5}\s/.test(lower)) return true
  const cities = ['torino', 'milano', 'roma', 'napoli', 'firenze', 'bologna', 'genova', 'palermo', 'turin', 'milan', 'rome']
  return cities.includes(lower)
}

/** Search place by name via Google Places API (fallback when URL resolution is blocked) */
async function searchByName(query, apiKey, res) {
  const locationBias = '&locationbias=circle:30000@45.0703,7.6869' // Torino default

  const findRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${apiKey}${locationBias}`
  )
  const findData = await findRes.json()
  const placeId = findData.candidates?.[0]?.place_id

  if (!placeId) {
    return res.status(200).json({
      error: `Nessun risultato per "${query}". Prova con un nome più specifico.`,
    })
  }

  const detailsRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,website,url&key=${apiKey}&language=it`
  )
  const detailsData = await detailsRes.json()
  const place = detailsData.result

  return res.status(200).json({
    resolved_url: place?.url || '',
    name: place?.name || query,
    latitude: place?.geometry?.location?.lat ?? null,
    longitude: place?.geometry?.location?.lng ?? null,
    address: place?.formatted_address || '',
    phone: place?.formatted_phone_number || '',
    website: place?.website || '',
    _debug: { mode: 'name_search', query, placeId, placeName: place?.name || null },
  })
}

/** Follow redirects one by one. Each hop is re-validated against the
 *  host allowlist so a redirect can't land on an internal or attacker-
 *  controlled target. */
async function followRedirects(url, maxRedirects = 10) {
  let current = url
  for (let i = 0; i < maxRedirects; i++) {
    try {
      const u = new URL(current)
      if (!isHostAllowed(u.hostname)) return current
    } catch {
      return current
    }
    // Use mobile UA for goo.gl (needs mobile UA for HTTP redirect)
    // Send consent cookies only to google.com/maps domains
    const isGoogleMaps = current.includes('google.com/maps')
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    }
    if (isGoogleMaps) {
      headers['Cookie'] = 'CONSENT=YES+cb.20231001-00-p0.en+FX+987; SOCS=CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg'
      headers['Accept-Language'] = 'it-IT,it;q=0.9'
    }
    const res = await fetch(current, { redirect: 'manual', headers })
    const location = res.headers.get('location')
    if (!location) return current
    const next = location.startsWith('http') ? location : new URL(location, current).href
    // Re-validate destination host AND protocol — reject http downgrade
    // and any host outside the allowlist.
    try {
      const nextUrl = new URL(next)
      if (nextUrl.protocol !== 'https:') return current
      if (!isHostAllowed(nextUrl.hostname)) return current
    } catch {
      return current
    }
    current = next
  }
  return current
}

/* ------------------------------------------------------------------ */
/*  resolveReel — Instagram Reel og:image / og:title / og:description  */
/*  (ex /api/resolve-reel, consolidato qui per stare sotto al cap      */
/*  Vercel Hobby di 12 functions).                                     */
/* ------------------------------------------------------------------ */
async function resolveReel(url, res) {
  if (!url || typeof url !== 'string') {
    return res.status(200).json({ error: 'url is required' })
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({ error: 'URL non valido' })
  }
  if (parsed.protocol !== 'https:') {
    return res.status(403).json({ error: 'Only https allowed' })
  }
  const host = parsed.hostname.toLowerCase()
  const instagramOk = host === 'instagram.com' || host.endsWith('.instagram.com')
  if (!instagramOk) {
    return res.status(403).json({ error: 'Not an Instagram URL' })
  }

  try {
    const safeUrl = `${parsed.origin}${parsed.pathname}${parsed.search}`
    const response = await fetch(safeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    const html = await response.text()

    const pickMeta = (prop) => {
      const m = html.match(new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]+)"`, 'i'))
        || html.match(new RegExp(`content="([^"]+)"\\s+(?:property|name)="${prop}"`, 'i'))
      return m ? m[1].replace(/&amp;/g, '&') : null
    }
    const thumbnail = pickMeta('og:image')
    const title = pickMeta('og:title')
    const description = pickMeta('og:description')

    if (!thumbnail) {
      return res.status(200).json({ error: 'Could not extract thumbnail from Instagram page' })
    }
    return res.status(200).json({ thumbnail, title, description })
  } catch (err) {
    return res.status(200).json({ error: `Fetch failed: ${err.message}` })
  }
}
