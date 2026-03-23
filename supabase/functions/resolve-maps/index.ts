import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Resolve a Google Maps URL (including short links like maps.app.goo.gl/...)
 * and extract place name + coordinates from the resolved URL.
 */
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

    // Follow redirects to resolve short URLs
    let resolvedUrl = url
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; bot)',
        },
      })
      resolvedUrl = res.url || url

      // Also try to extract data from the page content (title, meta tags)
      const html = await res.text()
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const ogTitle = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i)
        || html.match(/content="([^"]+)"\s+(?:property|name)="og:title"/i)

      const pageTitle = ogTitle?.[1] || titleMatch?.[1] || ''

      // Extract place name from resolved URL: /place/Name+Here/@...
      let name = ''
      const placeMatch = resolvedUrl.match(/\/place\/([^/@]+)/)
      if (placeMatch) {
        name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
      }

      // If no name from URL, try from page title (format: "Name - Google Maps")
      if (!name && pageTitle) {
        name = pageTitle.replace(/\s*[-–—]\s*Google\s+Maps?\s*$/i, '').trim()
      }

      // Extract coordinates from @lat,lng pattern
      let latitude = null
      let longitude = null
      const coordMatch = resolvedUrl.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/)
      if (coordMatch) {
        latitude = parseFloat(coordMatch[1])
        longitude = parseFloat(coordMatch[2])
      }

      // Try to extract phone from page (sometimes in structured data)
      let phone = ''
      const phoneMatch = html.match(/"telephone"\s*:\s*"([^"]+)"/)
        || html.match(/href="tel:([^"]+)"/)
      if (phoneMatch) {
        phone = phoneMatch[1]
      }

      return new Response(JSON.stringify({
        resolved_url: resolvedUrl,
        name,
        latitude,
        longitude,
        phone,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (fetchErr) {
      return new Response(JSON.stringify({
        error: 'Failed to resolve URL',
        detail: fetchErr.message,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
