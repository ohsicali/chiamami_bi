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
    // Step 1: Fetch the Google Maps page — follow all redirects and get HTML
    let resolvedUrl = url
    let pageTitle = ''
    let searchQuery = ''
    let lat = null
    let lng = null

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        },
      })
      resolvedUrl = response.url || url
      const html = await response.text()

      // Extract place name from <title> tag (format: "Restaurant Name - Google Maps")
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        pageTitle = titleMatch[1]
          .replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '')
          .replace(/\s*[-–—|·]\s*Google\s*$/i, '')
          .trim()
      }

      // Also try og:title
      if (!pageTitle) {
        const ogMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
          || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)
        if (ogMatch) {
          pageTitle = ogMatch[1]
            .replace(/\s*[-–—|·]\s*Google\s+Maps?\s*$/i, '')
            .trim()
        }
      }
    } catch (_) {}

    // Step 2: Extract data from the resolved URL
    const placeMatch = resolvedUrl.match(/\/place\/([^/@?]+)/)
    if (placeMatch) {
      searchQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
    }

    // Use page title as primary search query (most reliable for short URLs)
    if (pageTitle && pageTitle.length > 2 && !pageTitle.toLowerCase().includes('google maps')) {
      searchQuery = pageTitle
    }

    // Fallback to ?q= parameter
    if (!searchQuery) {
      try {
        const urlObj = new URL(resolvedUrl)
        const q = urlObj.searchParams.get('q')
        if (q) searchQuery = q.replace(/\+/g, ' ')
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
        error: `Impossibile estrarre dati dal link. Titolo: "${pageTitle}", URL: ${resolvedUrl}`,
      })
    }

    // Step 3: Find place via Google Places API
    const locationBias = lat && lng ? `&locationbias=circle:500@${lat},${lng}` : '&locationbias=circle:30000@45.0703,7.6869'  // default to Torino area
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
        warning: `Places API: ${findData.status || 'no results'} per "${searchQuery}"`,
      })
    }

    // Step 4: Get full place details
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
