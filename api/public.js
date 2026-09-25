/**
 * Vercel Serverless Function — letture pubbliche in cache CDN.
 *
 * GET /api/public?r=restaurants|categories|discounts|ads
 *
 * Esegue su Supabase la stessa query che il browser farebbe con la chiave
 * pubblica (vedi `src/lib/publicQueries.js`) e la restituisce con
 * `s-maxage`: la CDN di Vercel la tiene per tutti i visitatori, e Supabase
 * riceve circa una richiesta al minuto per risorsa invece di una per
 * visitatore. `stale-while-revalidate` fa sì che, se Supabase rallenta,
 * i visitatori continuino a ricevere subito l'ultima copia buona mentre
 * la CDN aggiorna in background.
 *
 * Nato il 22/09 (giorno del lancio): con il traffico, le letture dirette dei
 * visitatori hanno saturato il progetto Supabase e con lui anche l'auth —
 * nessuno riusciva più a registrarsi.
 *
 * Solo la chiave anon: stesso perimetro RLS/GRANT del browser, niente
 * service role.
 *
 * Edge runtime: NON conta nel limite 12 Serverless del piano Hobby. Come
 * funzione Node era la tredicesima, e su Hobby un file in più fa fallire il
 * deploy dell'intero sito (25/09, ritorno da Pro a Hobby).
 */

import { publicQueryParams } from '../src/lib/publicQueries.js'

export const config = { runtime: 'edge' }

// Secondi di freschezza per risorsa. Gli sconti cambiano (posti di un drop
// che finiscono) e stanno più corti; il limite vero lo applica comunque il DB
// al momento del riscatto, qui è solo quanto può essere vecchio ciò che si vede.
const MAX_AGE = { restaurants: 120, categories: 600, discounts: 30, ads: 120 }
const STALE = 86400

function json(body, status, cacheControl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  })
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json({ error: 'Method not allowed' }, 405, 'no-store')
  }

  const resource = new URL(req.url).searchParams.get('r') || ''
  const q = publicQueryParams(resource, new Date().toISOString())
  if (!q) return json({ error: 'Unknown resource' }, 400, 'no-store')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Supabase not configured' }, 500, 'no-store')
  }

  const url = `${supabaseUrl}/rest/v1/${q.table}?${new URLSearchParams(q.params)}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const upstream = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (!upstream.ok) {
      const text = (await upstream.text()).slice(0, 300)
      console.error(`public ${resource} upstream ${upstream.status}: ${text}`)
      return json({ error: 'Upstream error' }, 502, 'no-store')
    }
    const data = await upstream.json()
    const maxAge = MAX_AGE[resource] || 60
    // Il browser non la tiene (max-age=0): la cache vive sulla CDN, che si
    // rinnova da sola; così un cambio fatto dall'admin arriva a tutti entro
    // `maxAge` secondi. `stale-if-error`: se al rinnovo Supabase risponde con
    // un errore (riavvio per cambio compute, sovraccarico) la CDN continua a
    // dare l'ultima copia buona invece del 502/504 — senza, il 22/09 durante
    // il passaggio a Small i visitatori nuovi vedevano la lista vuota.
    return json(data, 200, `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${STALE}, stale-if-error=${STALE}`)
  } catch (err) {
    console.error(`public ${resource} error:`, err?.name || '', err?.message || err)
    return json({ error: 'Upstream timeout' }, 504, 'no-store')
  } finally {
    clearTimeout(timer)
  }
}
