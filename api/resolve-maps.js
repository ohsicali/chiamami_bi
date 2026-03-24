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
 * Google blocks server-side resolution of CID URLs completely.
 * Solution: convert CID to hex ftid and use Google's internal place lookup,
 * or scrape the HTML for embedded place data (URLs, coords in JS).
 */
async function handleCidUrl(cid, originalUrl, apiKey, res) {
  let searchQuery = ''
  let lat = null
  let lng = null
  let resolvedUrl = originalUrl
  let debugInfo = { strategy: 'none', cidHex: null, triedUrls: [] }

  // Convert CID to hex for ftid lookups
  let cidHex = null
  try { cidHex = BigInt(cid).toString(16); debugInfo.cidHex = cidHex } catch (_) {}

  // Strategy A: Fetch CID page and deep-parse the FULL HTML for embedded data
  // Google Maps pages embed place data in JavaScript even when title is generic
  const urlsToTry = [
    `https://www.google.com/maps?cid=${cid}&hl=it&gl=it`,
    cidHex ? `https://www.google.com/maps/place/?ftid=0x0:0x${cidHex}` : null,
    `https://www.google.com/maps/place/?cid=${cid}`,
  ].filter(Boolean)

  for (const tryUrl of urlsToTry) {
    if (searchQuery && lat) break
    debugInfo.triedUrls.push(tryUrl)
    try {
      const pageRes = await fetch(tryUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
      })
      const finalUrl = pageRes.url
      resolvedUrl = finalUrl || tryUrl

      // Check if redirect gave us a /place/ URL
      const pm = finalUrl?.match(/\/place\/([^/@?]+)/)
      if (pm) {
        searchQuery = decodeURIComponent(pm[1].replace(/\+/g, ' '))
        debugInfo.strategy = 'redirect_place'
      }
      const cm = finalUrl?.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (cm) { lat = parseFloat(cm[1]); lng = parseFloat(cm[2]) }

      // Deep parse HTML — look for embedded data, coordinates, and place names in JS
      if (!searchQuery || !lat) {
        const html = await pageRes.text()

        // Look for /place/ActualName/ URLs in the HTML (not query strings like ?ftid=)
        if (!searchQuery) {
          // Match /place/ followed by a URL-encoded name (letters, numbers, +, %, etc.)
          const placeUrls = html.match(/\/place\/([A-Za-z0-9%+][^/@"'\s\\]{2,})/g)
          if (placeUrls) {
            for (const pu of placeUrls) {
              const m = pu.match(/\/place\/([A-Za-z0-9%+][^/@"'\s\\]{2,})/)
              if (m) {
                const candidate = decodeURIComponent(m[1].replace(/\+/g, ' '))
                // Filter out technical strings (ftid, hex, data, query params)
                if (candidate.length > 2
                    && !isGenericQuery(candidate)
                    && !/^(data|ftid|0x|cid)/i.test(candidate)
                    && !/^[0-9a-f:]+$/i.test(candidate)
                    && /[a-zA-Z]{2,}/.test(candidate)) {
                  searchQuery = candidate
                  debugInfo.strategy = 'html_embedded_place_url'
                  break
                }
              }
            }
          }
        }

        // Look for coordinates in the HTML — broad patterns
        if (!lat) {
          const coordPatterns = [
            // Google Maps embeds coords in various JS formats
            /@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
            /\[(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})\]/,
            /null,null,(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
            /center=(-?\d{1,3}\.\d{3,})%2C(-?\d{1,3}\.\d{3,})/,
            /ll=(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})/,
          ]
          for (const pattern of coordPatterns) {
            const m = html.match(pattern)
            if (m) {
              const candidateLat = parseFloat(m[1])
              const candidateLng = parseFloat(m[2])
              // Sanity check: must be valid world coordinates, not some random number
              if (candidateLat >= -90 && candidateLat <= 90 && candidateLng >= -180 && candidateLng <= 180
                  && candidateLat !== 0 && candidateLng !== 0) {
                lat = candidateLat
                lng = candidateLng
                debugInfo.strategy = (debugInfo.strategy === 'none' ? '' : debugInfo.strategy + '+') + 'html_coords'
                break
              }
            }
          }
        }

        // Standard HTML extraction (title, og tags, canonical)
        if (!searchQuery) {
          const extracted = extractFromHtml(html)
          if (extracted.placeName && !isGenericQuery(extracted.placeName)) {
            searchQuery = extracted.placeName
            debugInfo.strategy = 'html_' + extracted.source
          }
          if (!lat && extracted.lat) { lat = extracted.lat; lng = extracted.lng }
        }

        // Save HTML sample for debugging (first successful fetch only)
        if (!debugInfo.htmlSample) {
          // Look for interesting snippets in the HTML
          const snippets = []
          // Find any /place/ references
          const placeRefs = html.match(/\/place\/[^"'\s]{3,50}/g)
          if (placeRefs) snippets.push('placeRefs: ' + placeRefs.slice(0, 5).join(' | '))
          // Find any coordinate-like patterns
          const coordRefs = html.match(/@-?\d+\.\d+,-?\d+\.\d+/g)
          if (coordRefs) snippets.push('coords: ' + coordRefs.slice(0, 3).join(' | '))
          // Find APP_INITIALIZATION_STATE
          if (html.includes('APP_INITIALIZATION_STATE')) snippets.push('HAS_APP_INIT_STATE')
          // Find any text that looks like a place name near cid
          const cidContext = html.match(new RegExp('.{0,100}' + cid + '.{0,100}'))
          if (cidContext) snippets.push('cidContext: ' + cidContext[0].substring(0, 200))
          debugInfo.htmlSample = snippets.join(' || ') || 'no useful patterns found'
          debugInfo.htmlLength = html.length
        }
      }
    } catch (_) {}
  }

  // Reject garbage
  if (searchQuery && isGenericQuery(searchQuery)) searchQuery = ''

  // Use Places API
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
