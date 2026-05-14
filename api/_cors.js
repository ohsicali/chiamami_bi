/**
 * Shared CORS helper.
 *
 * Sets Access-Control-Allow-Origin to the request Origin only if it matches
 * an allowed origin (production domain + Vercel preview URLs + local dev).
 * If no allowed Origin header is present (e.g. server-to-server, curl), no
 * ACAO is set, which means browsers will refuse cross-origin reads.
 *
 * Also handles OPTIONS preflight: returns 204 and stops the handler.
 *
 * Usage:
 *   import { applyCors } from './_cors.js'
 *   if (applyCors(req, res)) return  // preflight handled
 */

const ALLOWED_ORIGINS = new Set([
  'https://chiamamibi.com',
  'https://www.chiamamibi.com',
])

const ALLOWED_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i, // Vercel preview deploys
  /^http:\/\/localhost(:\d+)?$/i,         // local dev
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,      // local dev
]

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  return ALLOWED_PATTERNS.some((re) => re.test(origin))
}

/**
 * @returns {boolean} true if the request was a preflight and the response is
 *                    already finalised (caller should return immediately).
 */
export function applyCors(req, res, { methods = 'POST, OPTIONS' } = {}) {
  const origin = req.headers?.origin
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '600')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
