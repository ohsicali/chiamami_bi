/**
 * Vercel Serverless Function — resolve Google Maps URL and fetch place details
 *
 * Supports: maps.app.goo.gl, goo.gl, share.google, full google.com/maps/place/ URLs
 * Does NOT support: ?cid= URLs (Google serves consent page, blocked client-side)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body || {}
  if (!url) return res.status(200).json({ error: 'url is required' })

  const apiKey = process.env.VITE_GOOGLE_PLACES_KEY
  if (!apiKey) return res.status(200).json({ error: 'VITE_GOOGLE_PLACES_KEY non configurata' })

  try {
    // CID URLs can't be resolved server-side (Google serves EU consent page)
    try {
      if (new URL(url).searchParams.get('cid')) {
        return res.status(200).json({
          error: 'I link con "?cid=" non sono supportati. Dall\'app Google Maps, usa "Condividi" → "Copia link".',
        })
      }
    } catch (_) {}

    // Step 1: Follow redirects (for short URLs like maps.app.goo.gl)
    let resolvedUrl = url
    try { resolvedUrl = await followRedirects(url) } catch (_) {}

    // Step 2: Fetch page HTML to extract title/metadata
    let pageTitle = ''
    let canonicalUrl = ''
    try {
      const pageUrl = resolvedUrl !== url ? resolvedUrl : url
      const pageRes = await fetch(pageUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'it-IT,it;q=0.9',
          'Cookie': 'CONSENT=PENDING+987; SOCS=CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg',
        },
      })
      if (pageRes.url && pageRes.url !== pageUrl) resolvedUrl = pageRes.url
      const html = await pageRes.text()
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

    // Strategy 2: page title
    if (!searchQuery && pageTitle && pageTitle.length > 2) {
      searchQuery = pageTitle
    }

    // Strategy 3: ?q= parameter
    if (!searchQuery) {
      try {
        const q = new URL(resolvedUrl).searchParams.get('q')
        if (q) {
          const decoded = decodeURIComponent(q).replace(/\+/g, ' ')
          const parts = decoded.split(',').map(p => p.trim()).filter(Boolean)
          searchQuery = parts.length > 1 ? parts[parts.length - 1] : decoded
        }
      } catch (_) {}
    }

    // Reject generic queries
    if (searchQuery && isGenericQuery(searchQuery)) searchQuery = ''

    if (!searchQuery && !lat) {
      return res.status(200).json({
        error: 'Impossibile estrarre dati dal link. Prova con un link Google Maps completo.',
        _debug: { resolvedUrl, pageTitle, searchQuery },
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

    // Step 5: Get full place details
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,website,url&key=${apiKey}&language=it`
    )
    const detailsData = await detailsRes.json()
    const place = detailsData.result

    let finalName = place?.name || searchQuery || ''
    if (/^\d+$/.test(finalName)) finalName = ''

    return res.status(200).json({
      resolved_url: place?.url || resolvedUrl,
      name: finalName,
      latitude: place?.geometry?.location?.lat ?? lat,
      longitude: place?.geometry?.location?.lng ?? lng,
      address: place?.formatted_address || '',
      phone: place?.formatted_phone_number || '',
      website: place?.website || '',
      _debug: { resolvedUrl, searchQuery, placeId, placeName: place?.name || null },
    })
  } catch (err) {
    return res.status(200).json({ error: `Errore: ${err.message}` })
  }
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
  const cities = ['torino', 'milano', 'roma', 'napoli', 'firenze', 'bologna', 'genova', 'palermo', 'turin', 'milan', 'rome']
  return cities.includes(lower)
}

/** Follow redirects one by one */
async function followRedirects(url, maxRedirects = 10) {
  let current = url
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Cookie': 'CONSENT=PENDING+987; SOCS=CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg',
      },
    })
    const location = res.headers.get('location')
    if (!location) return current
    current = location.startsWith('http') ? location : new URL(location, current).href
  }
  return current
}
