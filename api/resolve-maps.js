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
    // Step 1: Resolve URL — try manual redirect following
    let resolvedUrl = url
    let pageTitle = ''

    try {
      resolvedUrl = await followRedirects(url)
    } catch (_) {
      resolvedUrl = url
    }

    // Step 2: Try to fetch the page HTML for the <title> tag
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
      // Update resolved URL if fetch followed further redirects
      if (pageRes.url && pageRes.url !== pageUrl) {
        resolvedUrl = pageRes.url
      }
      const html = await pageRes.text()
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        pageTitle = titleMatch[1]
          .replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '')
          .replace(/\s*[-–—|·]\s*Google\s*$/i, '')
          .trim()
      }
      if (!pageTitle) {
        const ogMatch = html.match(/property="og:title"[^>]+content="([^"]+)"/i)
          || html.match(/content="([^"]+)"[^>]+property="og:title"/i)
        if (ogMatch) {
          pageTitle = ogMatch[1].replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '').trim()
        }
      }
    } catch (_) {}

    // Step 3: Build search query from all available data
    let searchQuery = ''
    let lat = null
    let lng = null

    // Extract coordinates from URL
    const coordMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (coordMatch) {
      lat = parseFloat(coordMatch[1])
      lng = parseFloat(coordMatch[2])
    }

    // Check for CID URL — use Google Place Details via CID directly
    let cid = null
    try {
      const urlObj = new URL(resolvedUrl)
      cid = cid || urlObj.searchParams.get('cid')
      // Also check original URL for cid
      const origObj = new URL(url)
      cid = cid || origObj.searchParams.get('cid')
    } catch (_) {}

    // Best: page title (e.g. "Gastronomia HUI WEI XIANG Crêpes Cinesi")
    if (pageTitle && pageTitle.length > 2 && !/google/i.test(pageTitle)) {
      // Clean up: remove Chinese chars, postal codes, extra metadata
      searchQuery = pageTitle
        .replace(/[\u4e00-\u9fff\u3000-\u303f]+/g, '')  // remove Chinese characters
        .replace(/邮政编码[:\s]*\d+/g, '')                  // remove "邮政编码: 10123"
        .replace(/\b\d{4,6}\b/g, '')                       // remove postal codes (4-6 digits)
        .replace(/\b(TO|MI|RM|NA|FI|BO|GE|PA|CT|BA|VE|PD)\b/g, '') // remove Italian province codes
        .replace(/[,\s]{2,}/g, ' ')                        // collapse separators
        .trim()
    }

    // Reject searchQuery if it's empty, just numbers, or a city name
    const commonCities = ['torino', 'milano', 'roma', 'napoli', 'firenze', 'bologna', 'genova', 'palermo', 'turin', 'milan', 'rome']
    if (searchQuery && (/^\d+$/.test(searchQuery) || commonCities.includes(searchQuery.toLowerCase()))) {
      searchQuery = ''
    }

    // Try /place/Name/ pattern from URL
    if (!searchQuery) {
      const placeMatch = resolvedUrl.match(/\/place\/([^/@?]+)/)
      if (placeMatch) searchQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
    }

    // Try ?q= parameter
    if (!searchQuery) {
      try {
        const urlObj = new URL(resolvedUrl)
        const q = urlObj.searchParams.get('q')
        if (q) {
          const decoded = decodeURIComponent(q).replace(/\+/g, ' ')
          const parts = decoded.split(',').map(p => p.trim()).filter(Boolean)
          searchQuery = parts.length > 1 ? parts[parts.length - 1] : decoded
        }
      } catch (_) {}
    }

    if (!searchQuery && !lat && !cid) {
      return res.status(200).json({
        error: `Impossibile estrarre dati. Prova a copiare l'URL lungo dalla barra del browser dopo aver aperto il link.`,
        debug: { resolvedUrl, pageTitle },
      })
    }

    // Step 4: Find place via Google Places API
    const locationBias = lat && lng
      ? `&locationbias=circle:500@${lat},${lng}`
      : '&locationbias=circle:30000@45.0703,7.6869'

    let placeId = null

    // If we have a search query, use text search
    if (searchQuery) {
      const findRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${apiKey}${locationBias}`
      )
      const findData = await findRes.json()
      placeId = findData.candidates?.[0]?.place_id
    }

    // If text search failed but we have coordinates, try nearby search
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
        warning: `Nessun risultato trovato. Prova con un link Google Maps più completo.`,
      })
    }

    // Step 5: Get full place details
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,website,url&key=${apiKey}&language=it`
    )
    const detailsData = await detailsRes.json()
    const place = detailsData.result

    // Final name: prefer place.name, but reject if it looks like a postal code
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
        originalUrl: url,
        resolvedUrl,
        pageTitle,
        searchQuery,
        cid,
        placeId,
        placeName: place?.name || null,
      },
    })
  } catch (err) {
    return res.status(200).json({ error: `Errore: ${err.message}` })
  }
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
