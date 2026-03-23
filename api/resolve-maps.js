/**
 * Vercel Serverless Function — resolve Google Maps URL and fetch place details
 * Runs server-side: no CORS issues, API key is safe
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
    // Step 1: Resolve short URL (maps.app.goo.gl/...) to full URL
    let resolvedUrl = url
    const isShortUrl = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)\//i.test(url)
    if (isShortUrl) {
      try {
        resolvedUrl = await followRedirects(url)
      } catch (_) {
        resolvedUrl = url
      }
    }

    // Step 2: Extract search query and coords from the resolved URL
    let searchQuery = ''
    let lat = null
    let lng = null

    // Try /place/Name/@lat,lng pattern (full URLs)
    const placeMatch = resolvedUrl.match(/\/place\/([^/@?]+)/)
    if (placeMatch) searchQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))

    // Try ?q= parameter (common in resolved short URLs)
    if (!searchQuery) {
      try {
        const urlObj = new URL(resolvedUrl)
        const q = urlObj.searchParams.get('q')
        if (q) searchQuery = q.replace(/\+/g, ' ')
      } catch (_) {}
    }

    // Try @lat,lng pattern
    const coordMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (coordMatch) {
      lat = parseFloat(coordMatch[1])
      lng = parseFloat(coordMatch[2])
    }

    if (!searchQuery && !lat) {
      return res.status(200).json({
        error: `Impossibile estrarre dati dal link. URL risolto: ${resolvedUrl}`,
      })
    }

    // Step 3: Find place via Google Places API
    // Try multiple search strategies to find the right place
    const locationBias = lat && lng ? `&locationbias=circle:500@${lat},${lng}` : ''
    const parts = searchQuery.split(',').map(p => p.trim()).filter(Boolean)

    // Strategy: try different parts of the query — last part first (most likely the name),
    // then last 2 parts, then full string
    const searchAttempts = []
    if (parts.length > 1) {
      searchAttempts.push(parts[parts.length - 1])                    // last part (restaurant name)
      searchAttempts.push(parts.slice(-2).join(', '))                  // last 2 parts
    }
    searchAttempts.push(searchQuery)                                    // full string

    let placeId = null
    for (const attempt of searchAttempts) {
      const findRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(attempt)}&inputtype=textquery&fields=place_id&key=${apiKey}${locationBias}`
      )
      const findData = await findRes.json()
      if (findData.status === 'OK' && findData.candidates?.[0]?.place_id) {
        placeId = findData.candidates[0].place_id
        break
      }
    }

    if (!placeId) {
      return res.status(200).json({
        resolved_url: resolvedUrl,
        name: parts[parts.length - 1] || searchQuery,
        latitude: lat,
        longitude: lng,
        address: parts.length > 1 ? parts.slice(0, -1).reverse().join(', ') : '',
        phone: '',
        website: '',
        warning: 'Nessun risultato trovato su Google Places',
      })
    }
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,website,url&key=${apiKey}&language=it`
    )
    const detailsData = await detailsRes.json()
    const place = detailsData.result

    return res.status(200).json({
      resolved_url: place?.url || resolvedUrl,
      name: place?.name || '',
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

/** Follow redirects manually to get the final URL */
async function followRedirects(url, maxRedirects = 8) {
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
    if (current.includes('google.com/maps') && (current.includes('/place/') || current.includes('@'))) {
      return current
    }
  }
  return current
}
