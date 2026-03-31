/**
 * Vercel Serverless Function — extract thumbnail from Instagram Reel URL
 * Fetches the page HTML and extracts og:image meta tag.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body || {}
  if (!url) return res.status(200).json({ error: 'url is required' })

  // Validate it's an Instagram URL
  if (!url.includes('instagram.com')) {
    return res.status(200).json({ error: 'Not an Instagram URL' })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })

    const html = await response.text()

    // Extract og:image
    let thumbnail = null
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i)
    if (ogMatch) {
      thumbnail = ogMatch[1].replace(/&amp;/g, '&')
    }

    // Extract og:title for description
    let title = null
    const titleMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"\s+(?:property|name)="og:title"/i)
    if (titleMatch) {
      title = titleMatch[1].replace(/&amp;/g, '&')
    }

    // Extract og:description
    let description = null
    const descMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"\s+(?:property|name)="og:description"/i)
    if (descMatch) {
      description = descMatch[1].replace(/&amp;/g, '&')
    }

    if (!thumbnail) {
      return res.status(200).json({ error: 'Could not extract thumbnail from Instagram page' })
    }

    return res.status(200).json({ thumbnail, title, description })
  } catch (err) {
    return res.status(200).json({ error: `Fetch failed: ${err.message}` })
  }
}
