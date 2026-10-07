/**
 * La scheda di un locale come la vede Google (api/og-restaurant.js, servita a
 * Googlebot dalla rewrite in vercel.json). Prima era nome + tagline e Search
 * Console la dava "Scansionata, ma attualmente non indicizzata".
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHtml, pickRelated } from '../api/og-restaurant.js'

const restaurant = {
  name: 'Locanda Bellezia',
  slug: 'locanda-bellezia-mn3urcik',
  city: 'Torino',
  address: 'Via Bellezia 1',
  cuisine_type: 'Piemontese',
  price_range: 2,
  tagline: 'Cucina casalinga piemontese',
  our_review: 'Uno dei miei preferiti.\n\nIl posto è minuscolo & ha un dehors.',
  our_tip: 'Prendete la bagna cauda.',
  category: ['Piemontese', 'Vino'],
  recommended_for: ['Appuntamento'],
  moments: ['pranzo', 'cena'],
  photos: [{ photo_url: 'https://x.supabase.co/a.jpg' }],
}

test('la scheda porta il racconto di Bi e i link per proseguire', () => {
  const html = buildHtml({ restaurant, slug: restaurant.slug, related: [{ slug: 'altro', name: 'Altro', cuisine_type: 'Pizza' }] })
  assert.match(html, /<h1>Locanda Bellezia<\/h1>/)
  assert.match(html, /La recensione di Bi/)
  assert.match(html, /<p>Il posto è minuscolo &amp; ha un dehors.<\/p>/)
  assert.match(html, /Prendete la bagna cauda/)
  assert.match(html, /Pranzo, Cena/)
  assert.match(html, /<img src="https:\/\/x.supabase.co\/a.jpg" alt="Locanda Bellezia"/)
  assert.match(html, /href="https:\/\/chiamamibi.com\/restaurant\/altro"/)
  assert.match(html, /href="https:\/\/chiamamibi.com\/sconti"/)
  assert.match(html, /<link rel="canonical" href="https:\/\/chiamamibi.com\/restaurant\/locanda-bellezia-mn3urcik" \/>/)
  assert.match(html, /"priceRange":"€€"/)
  assert.doesNotMatch(html, /noindex/)
})

test('un locale che non c\'è chiede di non essere indicizzato', () => {
  const html = buildHtml({ restaurant: null, slug: 'non-esiste' })
  assert.match(html, /<meta name="robots" content="noindex" \/>/)
  assert.match(html, /Ristorante non trovato/)
})

test('altri locali: prima la stessa cucina, mai se stesso', () => {
  const others = [
    { slug: 'a', name: 'A', cuisine_type: 'Pizza' },
    { slug: restaurant.slug, name: restaurant.name, cuisine_type: 'Piemontese' },
    { slug: 'b', name: 'B', cuisine_type: 'Piemontese' },
    { slug: null, name: 'Senza slug' },
  ]
  assert.deepEqual(pickRelated(restaurant, others).map((r) => r.slug), ['b', 'a'])
})
