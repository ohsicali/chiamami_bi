// Vercel serverless image proxy — serves Supabase Storage images through
// Vercel's CDN, optionally resized + transcoded with sharp.
//
// Usage:
//   /api/img?url=https://xxx.supabase.co/storage/v1/object/public/photos/...
//   /api/img?url=...&w=600           → resize to 600px wide, keep aspect ratio
//   /api/img?url=...&w=600&q=82      → custom quality (1-100, default 82)
//
// AVIF is served when the browser sends `Accept: image/avif` and a transform
// is applied. WebP is the default transform output. When no `w` is set we
// stream the original bytes through (back-compat with old call sites).
import sharp from 'sharp'

export const config = {
  // Sharp resize is fast (~200-500ms cold, ~50-150ms warm) so 10s is plenty.
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

// Clamp width to a reasonable range so a malicious caller can't ask for a
// 100000px image to burn function time. Sizes match the canvas the FE asks
// for: small card (~600), medium (~900), hero (~1600).
function parseWidth(raw) {
  if (!raw) return null
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 32 || n > 2400) return null
  return n
}

function parseQuality(raw) {
  if (!raw) return 82
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 30 || n > 95) return 82
  return n
}

export default async function handler(req, res) {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  const width = parseWidth(req.query.w)
  const quality = parseQuality(req.query.q)
  const accept = (req.headers['accept'] || '').toString()
  const wantsAvif = accept.includes('image/avif')

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

    const originalContentType = response.headers.get('content-type') || 'image/jpeg'
    const originalBuffer = Buffer.from(await response.arrayBuffer())

    let outBuffer = originalBuffer
    let outContentType = originalContentType

    // Apply transform only when a width is requested. Without ?w we keep
    // the original bytes (and old behavior) so legacy callers are
    // unaffected and we don't burn function time on a no-op.
    if (width) {
      try {
        let pipeline = sharp(originalBuffer, { failOn: 'none' }).rotate()
        const meta = await pipeline.metadata().catch(() => null)
        // Don't upscale: if the source is already smaller than target, just
        // re-encode without resizing.
        if (meta?.width && meta.width > width) {
          pipeline = pipeline.resize({ width, withoutEnlargement: true })
        }
        if (wantsAvif) {
          outBuffer = await pipeline.avif({ quality, effort: 4 }).toBuffer()
          outContentType = 'image/avif'
        } else {
          outBuffer = await pipeline.webp({ quality }).toBuffer()
          outContentType = 'image/webp'
        }
      } catch {
        // If sharp fails for any reason (corrupt input, unusual format),
        // fall back to streaming the original bytes — never block the user.
        outBuffer = originalBuffer
        outContentType = originalContentType
      }
    }

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
    // Tell the CDN to vary the cache by Accept so AVIF and WebP each get
    // their own cache entry per URL+width combination.
    if (width) res.setHeader('Vary', 'Accept')
    res.setHeader('Content-Type', outContentType)
    res.setHeader('Content-Length', outBuffer.length)
    res.send(outBuffer)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch image' })
  }
}
