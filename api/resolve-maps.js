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

    // Best: page title (e.g. "Gastronomia HUI WEI XIANG Crêpes Cinesi")
    if (pageTitle && pageTitle.length > 2 && !/google/i.test(pageTitle)) {
      // Clean up: remove Chinese chars, postal codes, extra metadata
      searchQuery = pageTitle
        .replace(/[\u4e00-\u9fff\u3000-\u303f]+/g, '')  // remove Chinese characters
        .replace(/邮政编码[:\s]*\d+/g, '')                  // remove "邮政编码: 10123"
        .replace(/\d{5,}/g, '')                            // remove standalone postal codes
        .replace(/\s{2,}/g, ' ')                           // collapse whitespace
        .trim()
    }

    // Try /place/Name/ pattern from URL
    if (!searchQuery) {
      const placeMatch = resolvedUrl.match(/\/place\/([^/@?]+)/)
      if (placeMatch) searchQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
    }

    // Try ?q= parameter — use last comma part (restaurant name, not city)
    if (!searchQuery) {
      try {
        const urlObj = new URL(resolvedUrl)
        const q = urlObj.searchParams.get('q')
        if (q) {
          const decoded = decodeURIComponent(q).replace(/\+/g, ' ')
          const parts = decoded.split(',').map(p => p.trim()).filter(Boolean)
          // Restaurant name is usually the last part
          searchQuery = parts.length > 1 ? parts[parts.length - 1] : decoded
        }
      } catch (_) {}
    }

    // Extract coordinates
    const coordMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (coordMatch) {
      lat = parseFloat(coordMatch[1])
      lng = parseFloat(coordMatch[2])
    }

    if (!searchQuery && !lat) {
      return res.status(200).json({
        error: `Impossibile estrarre dati. Prova a copiare l'URL lungo dalla barra del browser dopo aver aperto il link.`,
        debug: { resolvedUrl, pageTitle },
      })
    }

    // Step 4: Search Google Places API
    // Default location bias to Torino if no coords
    const locationBias = lat && lng
      ? `&locationbias=circle:500@${lat},${lng}`
      : '&locationbias=circle:30000@45.0703,7.6869'

    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${apiKey}${locationBias}`
    )
    const findData = await findRes.json()

    if (findData.status !== 'OK' || !findData.candidates?.[0]?.place_id) {
      return res.status(200).json({
        resolved_url: resolvedUrl,
        name: searchQuery,
        latitude: lat,
        longitude: lng,
        address: '',
        phone: '',
        website: '',
        warning: `Places API findplacefromtext: status=${findData.status}, error=${findData.error_message || 'none'}, query="${searchQuery}"`,
      })
    }

    // Step 5: Get full place details
    const placeId = findData.candidates[0].place_id
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,website,url&key=${apiKey}&language=it`
    )
    const detailsData = await detailsRes.json()
    const place = detailsData.result

    return res.status(200).json({
      resolved_url: place?.url || resolvedUrl,
      name: place?.name || searchQuery,
      latitude: place?.geometry?.location?.lat ?? lat,
      longitude: place?.geometry?.location?.lng ?? lng,
      address: place?.formatted_address || '',
      phone: place?.formatted_phone_number || '',
      website: place?.website || '',
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
