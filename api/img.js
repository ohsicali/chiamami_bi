// Vercel serverless image proxy — serves Supabase Storage images through Vercel's CDN
// Usage: /api/img?url=https://xxx.supabase.co/storage/v1/object/public/photos/...
// Reduces Supabase egress by caching aggressively on Vercel's edge CDN.

export const config = {
  // Keep the function small; the heavy lifting is done by the CDN cache.
  maxDuration: 10,
}

// Resolve the Supabase project host from env — we only proxy images from
// THIS project's storage. Fallback to a strict "*.supabase.co" allowlist if
// the env variable isn't set.
function getAllowedHost() {
  const configured = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  if (configured) {
    try {
      return new URL(configured).hostname.toLowerCase()
    } catch {
      /* fall through */
    }
  }
  return null
}

export default async function handler(req, res) {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  // SSRF guard: parse the URL and allowlist hostname + protocol + path prefix.
  // A plain substring check on `url` is bypassable with e.g.
  //   https://evil.com/?r=supabase.co/storage/
  // or userinfo tricks like https://supabase.co/storage@evil.com
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid url' })
  }

  if (parsed.protocol !== 'https:') {
    return res.status(403).json({ error: 'Only https allowed' })
  }

  const allowedHost = getAllowedHost()
  const host = parsed.hostname.toLowerCase()
  const hostOk = allowedHost
    ? host === allowedHost
    : host.endsWith('.supabase.co') || host.endsWith('.supabase.in')

  if (!hostOk) {
    return res.status(403).json({ error: 'Host not allowed' })
  }

  if (!parsed.pathname.startsWith('/storage/v1/object/')) {
    return res.status(403).json({ error: 'Only storage object paths allowed' })
  }

  try {
    // Reconstruct from the parsed URL so query-string tricks can't be used
    // to bypass the allowlist.
    const safeUrl = `${parsed.origin}${parsed.pathname}${parsed.search}`
    const response = await fetch(safeUrl)

    if (!response.ok) {
      // Cache errors for a short time so we don't hammer Supabase on misses
      res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=60')
      return res.status(response.status).end()
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await response.arrayBuffer())

    // Aggressive caching:
    // - s-maxage=31536000 → Vercel CDN holds the asset for 1 year
    // - max-age=2592000   → browser keeps it for 30 days
    // - immutable         → browser never revalidates
    // - stale-while-revalidate → serve stale while refetching in background
    // - stale-if-error   → keep serving stale if origin fails (protects against Supabase outages/quota)
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=31536000, max-age=2592000, immutable, stale-while-revalidate=604800, stale-if-error=86400'
    )
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=31536000, immutable')
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=31536000, immutable')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch image' })
  }
}
