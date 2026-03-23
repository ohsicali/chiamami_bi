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
    // Step 1: Resolve URL — follow redirects
    let resolvedUrl = url
    try {
      resolvedUrl = await followRedirects(url)
    } catch (_) {
      resolvedUrl = url
    }

    // Step 2: Fetch page HTML and extract all useful data
    let pageTitle = ''
    let canonicalUrl = ''
    let html = ''
    let ogDescription = ''
    let metaDescription = ''

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
      if (pageRes.url && pageRes.url !== pageUrl) {
        resolvedUrl = pageRes.url
      }
      html = await pageRes.text()

      // Extract <title>
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        pageTitle = titleMatch[1]
          .replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '')
          .replace(/\s*[-–—|·]\s*Google\s*$/i, '')
          .trim()
      }

      // Extract og:title as fallback for pageTitle
      if (!pageTitle) {
        const ogTitleMatch = html.match(/property="og:title"[^>]+content="([^"]+)"/i)
          || html.match(/content="([^"]+)"[^>]+property="og:title"/i)
        if (ogTitleMatch) {
          pageTitle = ogTitleMatch[1].replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '').trim()
        }
      }

      // Extract canonical URL (often contains /place/Name/)
      const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)
        || html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)
      if (canonicalMatch) canonicalUrl = canonicalMatch[1]

      // Extract og:description (often contains place name + address)
      const ogDescMatch = html.match(/property="og:description"[^>]+content="([^"]+)"/i)
        || html.match(/content="([^"]+)"[^>]+property="og:description"/i)
      if (ogDescMatch) ogDescription = ogDescMatch[1]

      // Extract meta description
      const metaDescMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)
      if (metaDescMatch) metaDescription = metaDescMatch[1]

    } catch (_) {}

    // Step 3: Build search query from all available data
    let searchQuery = ''
    let lat = null
    let lng = null

    // Extract coordinates from resolved URL or canonical URL
    for (const u of [resolvedUrl, canonicalUrl]) {
      if (!u) continue
      const m = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break }
    }

    // Check for CID in URL
    let cid = null
    for (const u of [url, resolvedUrl]) {
      try {
        const c = new URL(u).searchParams.get('cid')
        if (c) { cid = c; break }
      } catch (_) {}
    }

    // Strategy 1: Extract name from /place/Name/ in canonical URL or resolved URL
    for (const u of [canonicalUrl, resolvedUrl]) {
      if (searchQuery) break
      if (!u) continue
      const placeMatch = u.match(/\/place\/([^/@?]+)/)
      if (placeMatch) {
        searchQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
      }
    }

    // Strategy 2: Use page title (cleaned up)
    if (!searchQuery && pageTitle && pageTitle.length > 2 && !/google/i.test(pageTitle)) {
      searchQuery = pageTitle
        .replace(/[\u4e00-\u9fff\u3000-\u303f]+/g, '')
        .replace(/邮政编码[:\s]*\d+/g, '')
        .replace(/\b\d{4,6}\b/g, '')
        .replace(/\b(TO|MI|RM|NA|FI|BO|GE|PA|CT|BA|VE|PD)\b/g, '')
        .replace(/[,\s]{2,}/g, ' ')
        .trim()
    }

    // Strategy 3: Extract place name from og:description or meta description
    // These often look like: "★★★★☆ · Ristorante · Via Roma 10" or "Nome Locale, indirizzo..."
    if (!searchQuery) {
      for (const desc of [ogDescription, metaDescription]) {
        if (!desc || searchQuery) continue
        // Try extracting first meaningful segment (before · or ,)
        const cleaned = desc
          .replace(/★[★☆]*/g, '')  // remove star ratings
          .replace(/^\s*·\s*/, '')   // remove leading dot
          .trim()
        // First segment before · or , is often the category or name
        const segments = cleaned.split(/\s*[·,]\s*/).filter(Boolean)
        if (segments.length >= 2) {
          // If first segment looks like a category ("Ristorante", "Bar"), use segment[0] + segment[1]
          const categories = ['ristorante', 'bar', 'pizzeria', 'trattoria', 'osteria', 'caffè', 'café', 'gelateria', 'pasticceria', 'pub', 'birreria', 'enoteca', 'restaurant', 'bakery', 'cafe']
          if (categories.some(c => segments[0].toLowerCase().includes(c))) {
            // First segment is a category, skip it — use remaining for location context
            searchQuery = segments.slice(1).join(' ').trim()
          } else {
            searchQuery = segments[0].trim()
          }
        } else if (segments.length === 1 && segments[0].length > 3) {
          searchQuery = segments[0].trim()
        }
      }
    }

    // Strategy 4: Try ?q= parameter
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

    // Reject if searchQuery is just numbers or a common city name
    const commonCities = ['torino', 'milano', 'roma', 'napoli', 'firenze', 'bologna', 'genova', 'palermo', 'turin', 'milan', 'rome']
    if (searchQuery && (/^\d+$/.test(searchQuery) || commonCities.includes(searchQuery.toLowerCase()))) {
      searchQuery = ''
    }

    // Strategy 5: For CID URLs without any data — try fetching via Google Maps search URL
    if (!searchQuery && !lat && cid) {
      try {
        const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=cid:${cid}`
        const cidRes = await fetch(mapsSearchUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'it-IT,it;q=0.9',
          },
        })
        const cidFinalUrl = cidRes.url
        if (cidFinalUrl) {
          const pm = cidFinalUrl.match(/\/place\/([^/@?]+)/)
          if (pm) searchQuery = decodeURIComponent(pm[1].replace(/\+/g, ' '))
          const cm = cidFinalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
          if (cm) { lat = parseFloat(cm[1]); lng = parseFloat(cm[2]) }
        }
      } catch (_) {}
    }

    if (!searchQuery && !lat && !cid) {
      return res.status(200).json({
        error: `Impossibile estrarre dati. Prova a copiare l'URL lungo dalla barra del browser dopo aver aperto il link.`,
        _debug: { resolvedUrl, canonicalUrl, pageTitle, ogDescription, metaDescription },
      })
    }

    // Step 4: Find place via Google Places API
    const locationBias = lat && lng
      ? `&locationbias=circle:500@${lat},${lng}`
      : '&locationbias=circle:30000@45.0703,7.6869'

    let placeId = null

    // If we have a search query, use text search
    if (searchQuery) {
      // If we also have coords, append them to improve accuracy
      const queryWithLocation = lat && lng ? `${searchQuery} @${lat},${lng}` : searchQuery
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
        _debug: { resolvedUrl, canonicalUrl, pageTitle, ogDescription, metaDescription, searchQuery, cid },
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
      _debug: {
        originalUrl: url,
        resolvedUrl,
        canonicalUrl,
        pageTitle,
        ogDescription: ogDescription?.substring(0, 200),
        metaDescription: metaDescription?.substring(0, 200),
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
