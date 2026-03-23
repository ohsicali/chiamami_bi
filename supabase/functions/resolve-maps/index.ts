import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Follow redirects manually to get the final URL */
async function resolveRedirects(url: string, maxRedirects = 10): Promise<string> {
  let current = url
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
    })

    const location = res.headers.get('location')
    if (!location) return current  // no more redirects

    // Make absolute if relative
    current = location.startsWith('http') ? location : new URL(location, current).href

    // Stop as soon as we hit a google.com/maps URL with place info
    if (current.includes('google.com/maps') && (current.includes('/place/') || current.includes('@'))) {
      return current
    }
  }
  return current
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let resolvedUrl = url
    let name = ''
    let latitude: number | null = null
    let longitude: number | null = null
    let phone = ''

    try {
      resolvedUrl = await resolveRedirects(url)
    } catch (e) {
      // If redirect resolution fails, try with the original URL
      resolvedUrl = url
    }

    // Extract place name from URL: /place/Name+Here/@...
    const placeMatch = resolvedUrl.match(/\/place\/([^/@?]+)/)
    if (placeMatch) {
      name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
    }

    // Extract coordinates from @lat,lng pattern
    const coordMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (coordMatch) {
      latitude = parseFloat(coordMatch[1])
      longitude = parseFloat(coordMatch[2])
    }

    // If we got at least coords or name, return success
    if (name || latitude) {
      return new Response(JSON.stringify({
        resolved_url: resolvedUrl,
        name,
        latitude,
        longitude,
        phone,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Last resort: try fetching the page to get title
    try {
      const res = await fetch(resolvedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
      })
      const html = await res.text()
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        name = titleMatch[1].replace(/\s*[-–—]\s*Google\s+Maps?\s*$/i, '').trim()
      }
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      resolved_url: resolvedUrl,
      name,
      latitude,
      longitude,
      phone,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
