#!/usr/bin/env node
/**
 * Backfill place_id candidati per tutti i ristoranti che non ne hanno uno.
 *
 * Usa Google Places API (New) — endpoint: searchText
 * https://places.googleapis.com/v1/places:searchText
 *
 * Per ogni ristorante senza place_id:
 *   1. Compone query da `name + address`
 *   2. Chiama searchText con locationBias su Torino (biasing per relevance)
 *   3. Se trova risultato → salva candidato con confidence basata su
 *      similarità testuale tra nome locale e displayName del candidato
 *   4. NON imposta place_id_verified_at: sarà l'admin a validare dal form
 *
 * Come usarlo:
 *   GOOGLE_PLACES_KEY=<key> \
 *   SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   node scripts/backfill-place-ids.mjs [--dry-run] [--limit 10]
 *
 * Flag:
 *   --dry-run  : non scrive su DB, stampa solo i match
 *   --limit N  : processa max N ristoranti (utile per test)
 *   --force    : riprocessa anche ristoranti che hanno già place_id (senza verified)
 */

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')
const LIMIT = (() => {
  const idx = args.indexOf('--limit')
  if (idx === -1) return null
  const n = parseInt(args[idx + 1], 10)
  return Number.isFinite(n) ? n : null
})()

const apiKey = process.env.GOOGLE_PLACES_KEY
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!apiKey) { console.error('Missing GOOGLE_PLACES_KEY'); process.exit(1) }
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/* ── Torino bounding box per locationBias ─────────────────────────── */
const TORINO_RECTANGLE = {
  low:  { latitude: 45.00, longitude: 7.55 },
  high: { latitude: 45.15, longitude: 7.80 },
}

/* ── Similarity score 0..1 per confidence ─────────────────────────── */
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(s) {
  return new Set(normalize(s).split(' ').filter(w => w.length > 1))
}

function jaccard(a, b) {
  const A = tokenSet(a)
  const B = tokenSet(b)
  if (A.size === 0 || B.size === 0) return 0
  let intersect = 0
  for (const x of A) if (B.has(x)) intersect++
  return intersect / (A.size + B.size - intersect)
}

/* ── Places API searchText ────────────────────────────────────────── */
async function searchPlace({ name, address }) {
  const query = [name, address].filter(Boolean).join(', ')
  const body = {
    textQuery: query,
    locationBias: { rectangle: TORINO_RECTANGLE },
    maxResultCount: 3,
    languageCode: 'it',
    regionCode: 'IT',
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Places ${res.status}: ${txt.slice(0, 200)}`)
  }

  const json = await res.json()
  return json.places || []
}

/* ── Main ─────────────────────────────────────────────────────────── */
async function main() {
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Backfill place_id — force=${FORCE}, limit=${LIMIT ?? 'none'}`)

  let query = supabase
    .from('restaurants')
    .select('id, name, address, place_id, place_id_verified_at')
    .order('created_at', { ascending: true })

  if (!FORCE) {
    query = query.is('place_id', null)
  } else {
    query = query.is('place_id_verified_at', null)
  }

  if (LIMIT) query = query.limit(LIMIT)

  const { data: restaurants, error } = await query
  if (error) { console.error('DB error:', error); process.exit(1) }

  console.log(`Da processare: ${restaurants.length}\n`)

  let matched = 0
  let skipped = 0
  let errors = 0

  for (const r of restaurants) {
    const label = `[${r.name}]`.padEnd(40).slice(0, 40)
    try {
      const candidates = await searchPlace({ name: r.name, address: r.address })
      if (candidates.length === 0) {
        console.log(`${label} no match`)
        skipped++
        continue
      }

      const top = candidates[0]
      const topName = top.displayName?.text || ''
      const confidence = jaccard(r.name, topName)
      const verdict = confidence >= 0.6 ? '✓ HIGH' : confidence >= 0.35 ? '~ MID' : '? LOW'

      console.log(`${label} ${verdict} ${confidence.toFixed(2)} → ${topName}`)

      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('restaurants')
          .update({
            place_id: top.id,
            place_id_confidence: confidence,
          })
          .eq('id', r.id)
        if (upErr) throw upErr
      }
      matched++
    } catch (err) {
      console.error(`${label} ERROR: ${err.message}`)
      errors++
    }

    // Gentle pacing to avoid rate limits: 10 req/sec max
    await new Promise(r => setTimeout(r, 120))
  }

  console.log(`\nSummary: matched=${matched}, skipped=${skipped}, errors=${errors}`)
  console.log(DRY_RUN
    ? 'Dry-run completato. Rilancia senza --dry-run per salvare.'
    : 'Backfill completato. Apri admin RestaurantForm e verifica manualmente i candidati.')
}

main().catch(err => { console.error(err); process.exit(1) })
