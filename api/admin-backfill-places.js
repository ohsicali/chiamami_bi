/**
 * Vercel Serverless Function — One-shot admin backfill per place_id
 *
 * Usage (admin only):
 *   GET /api/admin-backfill-places?dry=1&limit=5
 *   GET /api/admin-backfill-places                    (live, tutti senza place_id)
 *   GET /api/admin-backfill-places?force=1            (riprocessa non verificati)
 *
 * Auth: Bearer token Supabase dell'admin (profiles.is_admin = true).
 *
 * NOTA: questo file è temporaneo per il backfill iniziale.
 * Rimuovere dopo l'uso.
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'

const TORINO_RECTANGLE = {
  low:  { latitude: 45.00, longitude: 7.55 },
  high: { latitude: 45.15, longitude: 7.80 },
}

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

async function searchPlace(apiKey, { name, address }) {
  const query = [name, address].filter(Boolean).join(', ')
  const body = {
    textQuery: query,
    locationBias: { rectangle: TORINO_RECTANGLE },
    maxResultCount: 3,
    languageCode: 'it',
    regionCode: 'IT',
  }
  const doFetch = () => fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(body),
  })

  let res = await doFetch()
  // Retry 2x su 403 per gestire propagazione uneven delle restriction changes
  for (let i = 0; i < 2 && res.status === 403; i++) {
    await new Promise(r => setTimeout(r, 1500))
    res = await doFetch()
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Places ${res.status}: ${txt.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.places || []
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  maybeCleanup()
  const limited = rateLimit(req, { key: 'admin-backfill', max: 10, windowMs: 60_000 })
  if (limited) return res.status(429).json({ ok: false, error: limited })

  const apiKey = process.env.GOOGLE_PLACES_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!apiKey) return res.status(500).json({ ok: false, error: 'Places API not configured' })
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ ok: false, error: 'Supabase not configured' })
  }

  // Verifica admin
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Missing authorization token' })
  }
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    return res.status(403).json({ ok: false, error: 'Admin only' })
  }

  const dry = req.query.dry === '1' || req.query.dry === 'true'
  const force = req.query.force === '1' || req.query.force === 'true'
  const limit = parseInt(req.query.limit, 10) || null
  const action = req.query.action

  // Solo ricerca (non scrive su DB): usato da RestaurantForm per cercare candidati
  if (action === 'search-only') {
    const body = req.body || {}
    const name = (body.name || '').trim()
    const address = (body.address || '').trim()
    if (!name) return res.status(400).json({ ok: false, error: 'name required' })
    try {
      const candidates = await searchPlace(apiKey, { name, address })
      const enriched = candidates.slice(0, 3).map(c => ({
        place_id: c.id,
        display_name: c.displayName?.text || '',
        address: c.formattedAddress,
        confidence: Number(jaccard(name, c.displayName?.text || '').toFixed(2)),
      }))
      return res.status(200).json({ ok: true, action, candidates: enriched })
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message })
    }
  }

  // Pulisce hours_cache per tutti (forza re-fetch in italiano)
  if (action === 'clear-hours-cache') {
    const { error: upErr, count } = await adminClient
      .from('restaurants')
      .update({ hours_cache: null, hours_cache_updated_at: null }, { count: 'exact' })
      .not('hours_cache', 'is', null)
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
    return res.status(200).json({ ok: true, action, cleared: count ?? 0 })
  }

  // Status completo: tutti i ristoranti con place_id + verified status
  if (action === 'list-all') {
    const { data, error: listErr } = await adminClient
      .from('restaurants')
      .select('id, name, address, place_id, place_id_confidence, place_id_verified_at')
      .order('name', { ascending: true })
    if (listErr) return res.status(500).json({ ok: false, error: listErr.message })
    const verified = data.filter(r => r.place_id_verified_at).length
    const unverified = data.filter(r => r.place_id && !r.place_id_verified_at).length
    const noPlaceId = data.filter(r => !r.place_id).length
    return res.status(200).json({
      ok: true, action,
      summary: { total: data.length, verified, unverified, noPlaceId },
      items: data,
    })
  }

  // Lista candidati non verificati (ordinati per confidence DESC)
  if (action === 'list-unverified') {
    const { data, error: listErr } = await adminClient
      .from('restaurants')
      .select('id, name, address, place_id, place_id_confidence, slug')
      .not('place_id', 'is', null)
      .is('place_id_verified_at', null)
      .order('place_id_confidence', { ascending: false, nullsFirst: false })
    if (listErr) return res.status(500).json({ ok: false, error: listErr.message })
    return res.status(200).json({ ok: true, action, items: data })
  }

  // Verifica singolo ristorante (o lista via ids=a,b,c)
  if (action === 'verify-one') {
    const ids = (req.query.ids || req.query.id || '').split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length === 0) return res.status(400).json({ ok: false, error: 'ids required' })
    const { error: upErr } = await adminClient
      .from('restaurants')
      .update({ place_id_verified_at: new Date().toISOString() })
      .in('id', ids)
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
    return res.status(200).json({ ok: true, action, verified: ids.length })
  }

  // Aggiorna name/address di un ristorante, poi rifai searchText e salva nuovo candidato
  if (action === 'update-and-search') {
    const id = req.query.id
    if (!id) return res.status(400).json({ ok: false, error: 'id required' })
    const body = req.body || {}
    const newName = (body.name || '').trim()
    const newAddress = (body.address || '').trim()
    if (!newName) return res.status(400).json({ ok: false, error: 'name required' })

    // Aggiorna ristorante
    const { error: upErr } = await adminClient
      .from('restaurants')
      .update({ name: newName, address: newAddress || null })
      .eq('id', id)
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message })

    // Rifai searchText
    try {
      const candidates = await searchPlace(apiKey, { name: newName, address: newAddress })
      if (candidates.length === 0) {
        // Nessun match: azzera place_id
        await adminClient
          .from('restaurants')
          .update({ place_id: null, place_id_confidence: null, place_id_verified_at: null })
          .eq('id', id)
        return res.status(200).json({ ok: true, action, found: false })
      }
      const top = candidates[0]
      const confidence = jaccard(newName, top.displayName?.text || '')
      await adminClient
        .from('restaurants')
        .update({
          place_id: top.id,
          place_id_confidence: confidence,
          place_id_verified_at: null,
          hours_cache: null,
          hours_cache_updated_at: null,
        })
        .eq('id', id)
      return res.status(200).json({
        ok: true, action, found: true,
        match: {
          id,
          name: newName,
          address: newAddress,
          place_id: top.id,
          place_id_confidence: confidence,
          matched_name: top.displayName?.text || '',
          matched_address: top.formattedAddress,
        },
      })
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message })
    }
  }

  // Rimuove place_id + confidence (admin cercherà manualmente)
  if (action === 'clear-one') {
    const id = req.query.id
    if (!id) return res.status(400).json({ ok: false, error: 'id required' })
    const { error: upErr } = await adminClient
      .from('restaurants')
      .update({ place_id: null, place_id_confidence: null, place_id_verified_at: null })
      .eq('id', id)
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
    return res.status(200).json({ ok: true, action, cleared: id })
  }

  // Azione speciale: auto-verifica tutti i candidati con confidence >= minConf
  if (action === 'verify-high') {
    const minConf = parseFloat(req.query.minConf || '0.9')
    const { data: toVerify, error: selErr } = await adminClient
      .from('restaurants')
      .select('id, name, place_id_confidence')
      .not('place_id', 'is', null)
      .is('place_id_verified_at', null)
      .gte('place_id_confidence', minConf)
    if (selErr) return res.status(500).json({ ok: false, error: selErr.message })

    if (toVerify.length === 0) {
      return res.status(200).json({ ok: true, action, verified: 0, items: [] })
    }

    const ids = toVerify.map(r => r.id)
    const { error: upErr } = await adminClient
      .from('restaurants')
      .update({ place_id_verified_at: new Date().toISOString() })
      .in('id', ids)
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message })

    return res.status(200).json({
      ok: true,
      action,
      minConf,
      verified: toVerify.length,
      items: toVerify.map(r => ({ id: r.id, name: r.name, confidence: r.place_id_confidence })),
    })
  }

  let query = adminClient
    .from('restaurants')
    .select('id, name, address, place_id, place_id_verified_at')
    .order('created_at', { ascending: true })

  if (force) query = query.is('place_id_verified_at', null)
  else query = query.is('place_id', null)
  if (limit) query = query.limit(limit)

  const { data: restaurants, error: listErr } = await query
  if (listErr) return res.status(500).json({ ok: false, error: listErr.message })

  const results = []
  let matched = 0, skipped = 0, errors = 0

  for (const r of restaurants) {
    try {
      const candidates = await searchPlace(apiKey, { name: r.name, address: r.address })
      if (candidates.length === 0) {
        results.push({ id: r.id, name: r.name, status: 'no_match' })
        skipped++
        continue
      }
      const top = candidates[0]
      const topName = top.displayName?.text || ''
      const confidence = jaccard(r.name, topName)
      const verdict = confidence >= 0.6 ? 'HIGH' : confidence >= 0.35 ? 'MID' : 'LOW'

      results.push({
        id: r.id,
        name: r.name,
        matched: topName,
        address: top.formattedAddress,
        confidence: Number(confidence.toFixed(2)),
        verdict,
        place_id: top.id,
      })

      if (!dry) {
        const { error: upErr } = await adminClient
          .from('restaurants')
          .update({ place_id: top.id, place_id_confidence: confidence })
          .eq('id', r.id)
        if (upErr) throw upErr
      }
      matched++
    } catch (err) {
      results.push({ id: r.id, name: r.name, status: 'error', error: err.message })
      errors++
    }
    await new Promise(rr => setTimeout(rr, 120))
  }

  return res.status(200).json({
    ok: true,
    dry,
    force,
    summary: { total: restaurants.length, matched, skipped, errors },
    results,
  })
}
