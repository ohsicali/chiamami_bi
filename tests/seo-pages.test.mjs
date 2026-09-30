/**
 * Le sezioni del sito come pagine a sé per Google (src/lib/seoPages.js,
 * scripts/seo-pages.mjs): ognuna col suo titolo e il suo canonical già
 * nell'HTML, servita dalla sua rewrite. Se una di queste cose si stacca dalle
 * altre, la sezione torna a sembrare un doppione della home.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SEO_PAGES, SITE_URL, seoMeta } from '../src/lib/seoPages.js'
import { SEO_PAGE_PATHS, renderSeoPage, seoFileName } from '../scripts/seo-pages.mjs'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const sitemap = readFileSync(new URL('../api/sitemap.js', import.meta.url), 'utf8')

test('ogni sezione ha titolo e canonical suoi nell\'HTML', () => {
  for (const path of SEO_PAGE_PATHS) {
    const html = renderSeoPage(indexHtml, path)
    const url = `${SITE_URL}${path}`
    assert.ok(html.includes(`<link rel="canonical" href="${url}" />`), path)
    assert.ok(html.includes(`<meta property="og:url" content="${url}" />`), path)
    assert.equal(html.match(/<title>([^<]*)<\/title>/)[1], SEO_PAGES[path].title.replace(/&/g, '&amp;'))
    assert.ok(!html.includes('<link rel="canonical" href="https://chiamamibi.com/" />'), `${path}: canonical ancora verso la home`)
    assert.ok(html.includes('"@type":"BreadcrumbList"'), path)
    // Lo stesso punto d'ingresso dell'app: cambia solo il <head>.
    assert.ok(html.includes('<div id="root"></div>'), path)
  }
})

test('titoli e descrizioni diversi per ogni sezione', () => {
  const titles = Object.values(SEO_PAGES).map((p) => p.title)
  const descriptions = Object.values(SEO_PAGES).map((p) => p.description)
  assert.equal(new Set(titles).size, titles.length)
  assert.equal(new Set(descriptions).size, descriptions.length)
})

test('i due sitelink chiesti portano dove devono', () => {
  assert.match(SEO_PAGES['/sconti'].title, /^Promozioni ristoranti Torino/)
  assert.match(SEO_PAGES['/esplora'].title, /^I migliori ristoranti di Torino/)
})

test('ogni sezione ha la sua rewrite, prima di quella che manda tutto alla SPA', () => {
  const rewrites = vercel.rewrites
  const catchAll = rewrites.findIndex((r) => r.source === '/((?!api/).*)')
  assert.ok(catchAll > -1)
  for (const path of SEO_PAGE_PATHS) {
    const i = rewrites.findIndex((r) => r.source === path)
    assert.ok(i > -1, `manca la rewrite per ${path}`)
    assert.ok(i < catchAll, `${path}: la rewrite va prima del catch-all`)
    assert.equal(rewrites[i].destination, `/seo/${seoFileName(path)}.html`)
  }
})

test('/deals porta a /sconti, e le sezioni sono nella sitemap', () => {
  assert.ok(vercel.redirects.some((r) => r.source === '/deals' && r.destination === '/sconti' && r.permanent))
  for (const path of SEO_PAGE_PATHS) assert.ok(sitemap.includes(`path: '${path}'`), `${path} manca in api/sitemap.js`)
})

test('seoMeta dà a MetaTags gli stessi valori', () => {
  const m = seoMeta('/sconti')
  assert.equal(m.title, SEO_PAGES['/sconti'].title)
  assert.equal(m.canonical, `${SITE_URL}/sconti`)
})
