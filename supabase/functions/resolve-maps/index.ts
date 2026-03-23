import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok = (data: object) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/** Follow redirects manually to get the final URL */
async function resolveRedirects(url: string, maxRedirects = 8): Promise<string> {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    if (!url) return ok({ error: 'url is required' })

    const apiKey = Deno.env.get('GOOGLE_PLACES_KEY')
    if (!apiKey) return ok({ error: 'Secret GOOGLE_PLACES_KEY non configurato su Supabase' })

    // Step 1: Resolve short URL
    let resolvedUrl = url
    const isShortUrl = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)\//i.test(url)
    if (isShortUrl) {
      try {
        resolvedUrl = await resolveRedirects(url)
      } catch (e) {
        resolvedUrl = url
      }
    }

    // Step 2: Extract name and coords from URL
    let name = ''
    let lat: number | null = null
    let lng: number | null = null

    const placeMatch = resolvedUrl.match(/\/place\/([^/@?]+)/)
    if (placeMatch) {
      name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
    }
    const coordMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (coordMatch) {
      lat = parseFloat(coordMatch[1])
      lng = parseFloat(coordMatch[2])
    }

    // If short URL resolution failed and we have no name/coords, return error
    if (!name && !lat) {
      return ok({
        error: `Impossibile estrarre dati dal link. URL risolto: ${resolvedUrl}. Prova con un link completo di Google Maps.`,
      })
    }

    // Step 3: Find place via Google Places API
    const searchInput = name || `${lat},${lng}`
    const locationBias = lat && lng ? `&locationbias=circle:500@${lat},${lng}` : ''
    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchInput)}&inputtype=textquery&fields=place_id&key=${apiKey}${locationBias}`
    )
    const findData = await findRes.json()

    if (findData.status !== 'OK') {
      // Places API failed — return what we have from the URL
      return ok({
        resolved_url: resolvedUrl,
        name,
        latitude: lat,
        longitude: lng,
        address: '',
        phone: '',
        website: '',
        warning: `Google Places API: ${findData.status} — ${findData.error_message || ''}`,
      })
    }

    const placeId = findData.candidates?.[0]?.place_id
    if (!placeId) {
      return ok({
        resolved_url: resolvedUrl,
        name,
        latitude: lat,
        longitude: lng,
        address: '',
        phone: '',
        website: '',
      })
    }

    // Step 4: Get full place details
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,website,url&key=${apiKey}&language=it`
    )
    const detailsData = await detailsRes.json()
    const place = detailsData.result

    return ok({
      resolved_url: place?.url || resolvedUrl,
      name: place?.name || name,
      latitude: place?.geometry?.location?.lat ?? lat,
      longitude: place?.geometry?.location?.lng ?? lng,
      address: place?.formatted_address || '',
      phone: place?.formatted_phone_number || '',
      website: place?.website || '',
    })

  } catch (err) {
    return ok({ error: `Errore interno: ${err.message}` })
  }
})
