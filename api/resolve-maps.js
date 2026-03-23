/**
 * Vercel Serverless Function — resolve Google Maps URL and fetch place details
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
    // Check for CID in original URL
    let cid = null
    try { cid = new URL(url).searchParams.get('cid') } catch (_) {}

    // For CID URLs, try multiple resolution strategies
    if (cid) {
      return await handleCidUrl(cid, url, apiKey, res)
    }

    // Non-CID URLs: standard flow
    return await handleStandardUrl(url, apiKey, res)
  } catch (err) {
    return res.status(200).json({ error: `Errore: ${err.message}` })
  }
}

/**
 * Handle CID URLs (from Google Maps app sharing)
 * CID pages serve generic HTML server-side, so we need alternative strategies
 */
async function handleCidUrl(cid, originalUrl, apiKey, res) {
  let searchQuery = ''
  let lat = null
  let lng = null
  let resolvedUrl = originalUrl
  let debugInfo = { strategy: 'none' }

  // Strategy A: Try /maps/place/ URL format with CID (sometimes redirects to real place page)
  const cidUrlFormats = [
    `https://www.google.com/maps/place/?cid=${cid}`,
    `https://www.google.com/maps?cid=${cid}&hl=it&gl=it`,
  ]

  for (const cidUrl of cidUrlFormats) {
    if (searchQuery) break
    try {
      const cidRes = await fetch(cidUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
      })
      const finalUrl = cidRes.url
      if (finalUrl) {
        // Check if we got redirected to a /place/ URL
        const pm = finalUrl.match(/\/place\/([^/@?]+)/)
        if (pm) {
          searchQuery = decodeURIComponent(pm[1].replace(/\+/g, ' '))
          resolvedUrl = finalUrl
          debugInfo.strategy = 'cid_redirect_place'
        }
        const cm = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
        if (cm) { lat = parseFloat(cm[1]); lng = parseFloat(cm[2]) }
      }

      // Even if no redirect, try to extract data from HTML
      if (!searchQuery) {
        const html = await cidRes.text()
        const extracted = extractFromHtml(html)
        if (extracted.placeName) {
          searchQuery = extracted.placeName
          debugInfo.strategy = 'cid_html_' + extracted.source
        }
        if (!lat && extracted.lat) { lat = extracted.lat; lng = extracted.lng }
        if (extracted.canonicalUrl) {
          const pm2 = extracted.canonicalUrl.match(/\/place\/([^/@?]+)/)
          if (pm2) {
            searchQuery = decodeURIComponent(pm2[1].replace(/\+/g, ' '))
            debugInfo.strategy = 'cid_canonical'
          }
        }
      }
    } catch (_) {}
  }

  // Strategy B: Convert CID to hex and try ftid-based URL
  if (!searchQuery) {
    try {
      const cidBigInt = BigInt(cid)
      const cidHex = cidBigInt.toString(16)
      const ftidUrl = `https://www.google.com/maps/place/?ftid=0x0:0x${cidHex}`
      const ftidRes = await fetch(ftidUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
      })
      const ftidFinalUrl = ftidRes.url
      if (ftidFinalUrl) {
        const pm = ftidFinalUrl.match(/\/place\/([^/@?]+)/)
        if (pm) {
          searchQuery = decodeURIComponent(pm[1].replace(/\+/g, ' '))
          resolvedUrl = ftidFinalUrl
          debugInfo.strategy = 'ftid_redirect'
        }
        const cm = ftidFinalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
        if (cm && !lat) { lat = parseFloat(cm[1]); lng = parseFloat(cm[2]) }
      }

      // Try HTML extraction too
      if (!searchQuery) {
        const html = await ftidRes.text()
        const extracted = extractFromHtml(html)
        if (extracted.placeName) {
          searchQuery = extracted.placeName
          debugInfo.strategy = 'ftid_html_' + extracted.source
        }
        if (!lat && extracted.lat) { lat = extracted.lat; lng = extracted.lng }
      }
    } catch (_) {}
  }

  // Strategy C: Try fetching as Googlebot (Google serves richer HTML to its own crawler)
  if (!searchQuery) {
    try {
      const botRes = await fetch(`https://www.google.com/maps?cid=${cid}`, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
      })
      const html = await botRes.text()
      const extracted = extractFromHtml(html)
      if (extracted.placeName) {
        searchQuery = extracted.placeName
        debugInfo.strategy = 'googlebot_' + extracted.source
      }
      if (!lat && extracted.lat) { lat = extracted.lat; lng = extracted.lng }
    } catch (_) {}
  }

  // Reject garbage search queries
  if (searchQuery && isGenericQuery(searchQuery)) {
    searchQuery = ''
  }

  // Now use Places API to find the place
  return await findAndReturnPlace(searchQuery, lat, lng, cid, resolvedUrl, apiKey, debugInfo, res)
}

/**
 * Handle standard (non-CID) URLs
 */
async function handleStandardUrl(url, apiKey, res) {
  let resolvedUrl = url
  try { resolvedUrl = await followRedirects(url) } catch (_) {}

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
      },
    })
    if (pageRes.url && pageRes.url !== pageUrl) resolvedUrl = pageRes.url
    const html = await pageRes.text()
    const extracted = extractFromHtml(html)
    pageTitle = extracted.placeName || ''
    canonicalUrl = extracted.canonicalUrl || ''
  } catch (_) {}

  let searchQuery = ''
  let lat = null
  let lng = null

  // Extract coordinates
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

  if (searchQuery && isGenericQuery(searchQuery)) searchQuery = ''

  return await findAndReturnPlace(searchQuery, lat, lng, null, resolvedUrl, apiKey, { strategy: 'standard' }, res)
}

/**
 * Extract useful data from Google Maps HTML page
 */
function extractFromHtml(html) {
  const result = { placeName: '', canonicalUrl: '', lat: null, lng: null, source: '' }

  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    const title = titleMatch[1]
      .replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '')
      .replace(/\s*[-–—|·]\s*Google\s*$/i, '')
      .trim()
    if (title && title.length > 2 && !/^google/i.test(title)) {
      // Clean up: remove Chinese chars, postal codes, province codes
      const cleaned = title
        .replace(/[\u4e00-\u9fff\u3000-\u303f]+/g, '')
        .replace(/邮政编码[:\s]*\d+/g, '')
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

  // Try og:title
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

  // Try canonical URL
  const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)
    || html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)
  if (canonicalMatch) result.canonicalUrl = canonicalMatch[1]

  // Try og:description — BUT only if it contains place-specific data (stars, ·, address-like)
  if (!result.placeName) {
    const ogDescMatch = html.match(/property="og:description"[^>]+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"[^>]+property="og:description"/i)
    if (ogDescMatch) {
      const desc = ogDescMatch[1]
      // Only use if it looks place-specific (has stars, or starts with a category)
      if (desc.includes('★') || desc.includes('·')) {
        const cleaned = desc.replace(/★[★☆]*/g, '').replace(/^\s*·\s*/, '').trim()
        const segments = cleaned.split(/\s*[·,]\s*/).filter(Boolean)
        const categories = ['ristorante', 'bar', 'pizzeria', 'trattoria', 'osteria', 'caffè', 'café', 'gelateria', 'pasticceria', 'pub', 'birreria', 'enoteca', 'restaurant', 'bakery', 'cafe']
        if (segments.length >= 2) {
          if (categories.some(c => segments[0].toLowerCase().includes(c))) {
            result.placeName = segments.slice(1).join(' ').trim()
          } else {
            result.placeName = segments[0].trim()
          }
          result.source = 'og_desc'
        }
      }
    }
  }

  // Extract coordinates from JSON in HTML
  const coordMatch = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (coordMatch) {
    result.lat = parseFloat(coordMatch[1])
    result.lng = parseFloat(coordMatch[2])
  }

  return result
}

/**
 * Check if a query is generic/useless
 */
function isGenericQuery(q) {
  if (!q) return true
  const lower = q.toLowerCase().trim()
  const genericPatterns = [
    'google maps', 'google', 'find local businesses', 'trova attività',
    'view maps', 'get driving directions', 'indicazioni stradali',
    'visualizza mappe',
  ]
  if (genericPatterns.some(p => lower.includes(p))) return true
  if (/^\d+$/.test(lower)) return true
  const commonCities = ['torino', 'milano', 'roma', 'napoli', 'firenze', 'bologna', 'genova', 'palermo', 'turin', 'milan', 'rome']
  if (commonCities.includes(lower)) return true
  return false
}

/**
 * Find place via Places API and return response
 */
async function findAndReturnPlace(searchQuery, lat, lng, cid, resolvedUrl, apiKey, debugInfo, res) {
  if (!searchQuery && !lat && !cid) {
    return res.status(200).json({
      error: `Impossibile estrarre dati dal link CID. Prova ad aprire il link in Google Maps nel browser, poi copia l'URL dalla barra degli indirizzi (sarà più lungo e completo).`,
      _debug: { ...debugInfo, resolvedUrl, searchQuery, lat, lng, cid },
    })
  }

  const locationBias = lat && lng
    ? `&locationbias=circle:500@${lat},${lng}`
    : '&locationbias=circle:30000@45.0703,7.6869'

  let placeId = null

  // Text search
  if (searchQuery) {
    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${apiKey}${locationBias}`
    )
    const findData = await findRes.json()
    placeId = findData.candidates?.[0]?.place_id
  }

  // Nearby search fallback
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
      warning: `Nessun risultato trovato. Prova con un link Google Maps più completo (apri il link nel browser e copia l'URL dalla barra degli indirizzi).`,
      _debug: { ...debugInfo, resolvedUrl, searchQuery, lat, lng, cid, placeId: null },
    })
  }

  // Get full place details
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
    _debug: {
      ...debugInfo,
      originalUrl: resolvedUrl,
      searchQuery,
      cid,
      placeId,
      placeName: place?.name || null,
    },
  })
}

/** Follow redirects one by one to get the final URL */
async function followRedirects(url, maxRedirects = 10) {
  let current = url
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    })
    const location = res.headers.get('location')
    if (!location) return current
    current = location.startsWith('http') ? location : new URL(location, current).href
  }
  return current
}
