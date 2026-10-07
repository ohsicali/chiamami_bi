// Dopo `vite build`: una copia di dist/index.html per ogni sezione principale
// (/esplora, /sconti, /list, /about, /partner, /privacy, /terms) con titolo, descrizione e
// canonical suoi già scritti nell'HTML, in dist/seo/<nome>.html. Le rewrite in
// vercel.json servono quella copia per l'indirizzo della sezione; il resto del
// sito continua a ricevere index.html.
//
// Perché: senza, ogni sezione arrivava a Google con il titolo della home e
// `<link rel="canonical" href="https://chiamamibi.com/">`, cioè "sono un
// doppione della home". Il titolo giusto lo metteva solo React (MetaTags),
// dopo. Con le sezioni riconosciute come pagine a sé Google le può mostrare
// come link sotto il risultato di ChiamamiBi (sitelink).
//
// Titoli e descrizioni: src/lib/seoPages.js (gli stessi di MetaTags).
// Se una sostituzione non trova il suo tag lo script si ferma e con lui la
// build: meglio un deploy fallito (resta online il precedente) che le rewrite
// verso file che non esistono. Test: tests/seo-pages.test.mjs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEO_PAGES, SITE_URL } from '../src/lib/seoPages.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Nome del file per un percorso: '/sconti' → 'sconti'.
export function seoFileName(path) {
  return path.replace(/^\//, '').replace(/\//g, '-')
}

// Le sezioni che hanno una copia propria (la home è index.html).
export const SEO_PAGE_PATHS = Object.keys(SEO_PAGES).filter((p) => p !== '/')

export function renderSeoPage(html, path) {
  const page = SEO_PAGES[path]
  if (!page) throw new Error(`[seo-pages] nessun titolo per ${path}`)
  const url = `${SITE_URL}${path}`
  const title = attr(page.title)
  const description = attr(page.description)

  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${title}</title>`],
    [/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`],
    [/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`],
    [/<link rel="alternate" hreflang="it" href="[^"]*"\s*\/?>/, `<link rel="alternate" hreflang="it" href="${url}" />`],
    [/<link rel="alternate" hreflang="x-default" href="[^"]*"\s*\/?>/, `<link rel="alternate" hreflang="x-default" href="${url}" />`],
    [/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${title}" />`],
    [/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${description}" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`],
    [/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`],
    [/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${description}" />`],
  ]

  let out = html
  for (const [re, replacement] of swaps) {
    if (!re.test(out)) throw new Error(`[seo-pages] ${path}: non trovo ${re} in index.html`)
    out = out.replace(re, replacement)
  }

  // Briciole di pane: dicono a Google che la sezione sta sotto la home.
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ChiamamiBi', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: page.name || page.title, item: url },
    ],
  }
  const ld = `<script type="application/ld+json">${JSON.stringify(breadcrumb).replace(/</g, '\\u003c')}</script>\n  </head>`
  if (!out.includes('</head>')) throw new Error(`[seo-pages] ${path}: manca </head>`)
  return out.replace('</head>', ld)
}

function main() {
  const dist = join(ROOT, 'dist')
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  mkdirSync(join(dist, 'seo'), { recursive: true })
  for (const path of SEO_PAGE_PATHS) {
    const file = join(dist, 'seo', `${seoFileName(path)}.html`)
    writeFileSync(file, renderSeoPage(html, path))
    console.log(`[seo-pages] ${path} → dist/seo/${seoFileName(path)}.html`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
