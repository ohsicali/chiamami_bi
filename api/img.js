// Vercel serverless image proxy — serves Supabase Storage images through Vercel's CDN
// Usage: /api/img?url=https://xxx.supabase.co/storage/v1/object/public/photos/...
// Reduces Supabase egress by caching on Vercel's edge CDN

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
      return res.status(response.status).end()
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await response.arrayBuffer())

    // Cache for 1 year on Vercel CDN, 1 week in browser
    // s-maxage = Vercel CDN cache, max-age = browser cache
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=604800, stale-while-revalidate=86400')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch image' })
  }
}
