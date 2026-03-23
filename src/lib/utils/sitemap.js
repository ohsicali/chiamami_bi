const BASE_URL = 'https://chiamamibi.com'

const STATIC_ROUTES = ['/', '/about', '/deals', '/login']

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function generateSitemapXml(restaurants = []) {
  const today = new Date().toISOString().split('T')[0]

  const staticEntries = STATIC_ROUTES.map(
    (route) =>
      `  <url>\n    <loc>${BASE_URL}${route}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${route === '/' ? '1.0' : '0.8'}</priority>\n  </url>`
  )

  const restaurantEntries = restaurants.map((r) => {
    const slug = r.slug || slugify(r.name)
    return `  <url>\n    <loc>${BASE_URL}/restaurant/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...restaurantEntries].join('\n')}
</urlset>`
}
