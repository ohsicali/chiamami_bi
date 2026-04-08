// Vercel serverless image proxy — serves Supabase Storage images through Vercel's CDN
// Usage: /api/img?url=https://xxx.supabase.co/storage/v1/object/public/photos/...
// Reduces Supabase egress by caching aggressively on Vercel's edge CDN.

export const config = {
  // Keep the function small; the heavy lifting is done by the CDN cache.
  maxDuration: 10,
}

export default async function handler(req, res) {
  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  // Only allow Supabase storage URLs
  if (!url.includes('supabase.co/storage/')) {
    return res.status(403).json({ error: 'Only Supabase storage URLs allowed' })
  }

  try {
    const response = await fetch(url)

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
