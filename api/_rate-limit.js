/**
 * Lightweight per-instance in-memory rate limiter.
 *
 * Caveat: Vercel runs multiple concurrent instances, so a determined
 * attacker distributed across cold starts can still exceed the cap. For
 * proper durable rate limiting use Upstash / KV / a DB counter. This
 * helper mainly defends against naive flooding from a single client.
 *
 * Usage:
 *   import { rateLimit } from './_rate-limit.js'
 *   const limited = rateLimit(req, { key: 'correct-text', max: 20, windowMs: 60_000 })
 *   if (limited) return res.status(429).json({ error: limited })
 */
const buckets = new Map()

function clientIp(req) {
  const h = req.headers || {}
  const fwd = (h['x-forwarded-for'] || h['X-Forwarded-For'] || '').toString().split(',')[0].trim()
  return (
    fwd ||
    h['x-real-ip'] ||
    h['cf-connecting-ip'] ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown'
  )
}

export function rateLimit(req, { key = 'default', max = 30, windowMs = 60_000 } = {}) {
  const id = `${key}:${clientIp(req)}`
  const now = Date.now()
  const entry = buckets.get(id)

  if (!entry || entry.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (entry.count >= max) {
    const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return `Troppe richieste, riprova tra ${retrySec}s`
  }

  entry.count += 1
  return null
}

// Periodic cleanup to cap memory use (runs lazily).
let lastCleanup = 0
export function maybeCleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k)
  }
}
