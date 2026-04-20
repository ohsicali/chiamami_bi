/**
 * useOrariStatus — fetcha gli orari Places del locale e calcola
 * stato aperto/chiuso localmente (indipendente da openNow cachato).
 *
 * Condiviso da OrariLocale (accordion giorni) e dal chip "Aperto · chiude"
 * nella scheda ristorante.
 *
 * Dedup: tieniamo un cache in-memory per id → promise, così componenti multipli
 * che chiedono lo stesso restaurant fanno 1 sola fetch.
 */
import { useEffect, useState } from 'react'

const cache = new Map() // restaurantId → { data, ts }
const inflight = new Map() // restaurantId → Promise<data>
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min client-side

function formatTime(hour, minute) {
  const h = String(hour ?? 0).padStart(2, '0')
  const m = String(minute ?? 0).padStart(2, '0')
  return `${h}:${m}`
}

export function computeStatus(data) {
  // Usiamo regularOpeningHours per coerenza con la griglia settimanale
  // mostrata da OrariLocale. currentOpeningHours può divergere (festività,
  // aperture speciali) generando il mismatch "hours dicono aperto / chip chiuso".
  const source = data?.regularOpeningHours || data?.currentOpeningHours
  if (!source) return null
  const periods = source.periods || []
  if (!periods.length) return null

  // Tempo nel fuso del locale via utcOffsetMinutes. Spostiamo i ms UTC in
  // avanti di utcOffset minuti e leggiamo con .getUTC* — risultato: orario
  // del locale indipendente dal fuso del browser.
  const utcOffset = typeof data.utcOffsetMinutes === 'number' ? data.utcOffsetMinutes : null
  const nowReal = new Date()
  let todayDow, nowHM
  if (utcOffset !== null) {
    const shifted = new Date(nowReal.getTime() + utcOffset * 60_000)
    todayDow = shifted.getUTCDay()
    nowHM = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  } else {
    todayDow = nowReal.getDay()
    nowHM = nowReal.getHours() * 60 + nowReal.getMinutes()
  }

  for (const p of periods) {
    const openDay = p.open?.day
    if (openDay == null) continue
    const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)

    if (!p.close) {
      return { openNow: true, closesAt: null }
    }

    const closeDay = p.close.day
    const closeMin = (p.close.hour || 0) * 60 + (p.close.minute || 0)
    const closeStr = formatTime(p.close.hour, p.close.minute)

    if (openDay === closeDay) {
      // Edge case: Google rappresenta la chiusura a mezzanotte come
      // close.hour = 0, minute = 0 talvolta con close.day = open.day
      // (periodo "da 19:00 a fine giornata"). Se closeMin <= openMin,
      // consideriamo la chiusura come 24:00 dello stesso giorno.
      const effectiveClose = closeMin <= openMin ? 24 * 60 : closeMin
      if (todayDow === openDay && nowHM >= openMin && nowHM < effectiveClose) {
        return { openNow: true, closesAt: closeStr }
      }
      continue
    }
    if (todayDow === openDay && nowHM >= openMin) {
      return { openNow: true, closesAt: closeStr }
    }
    if (todayDow === closeDay && nowHM < closeMin) {
      return { openNow: true, closesAt: closeStr }
    }
  }

  return { openNow: false, closesAt: null }
}

export function useOrariStatus(restaurant) {
  const id = restaurant?.id
  const hasVerified = !!restaurant?.place_id && !!restaurant?.place_id_verified_at
  const [data, setData] = useState(() => {
    const c = id && cache.get(id)
    return c && Date.now() - c.ts < CACHE_TTL_MS ? c.data : null
  })
  const [loading, setLoading] = useState(!data && hasVerified)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!id || !hasVerified) {
      setLoading(false)
      return
    }
    const cached = cache.get(id)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setData(cached.data)
      setLoading(false)
      return
    }
    let cancelled = false
    const existing = inflight.get(id)
    const promise = existing || (async () => {
      try {
        const r = await fetch(`/api/places-details?restaurantId=${id}`)
        const json = await r.json()
        if (json.ok && json.data) {
          cache.set(id, { data: json.data, ts: Date.now() })
          return json.data
        }
        return null
      } finally {
        inflight.delete(id)
      }
    })()
    if (!existing) inflight.set(id, promise)

    promise
      .then((d) => {
        if (cancelled) return
        if (d) setData(d)
        else setFailed(true)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [id, hasVerified])

  const status = data ? computeStatus(data) : null
  return { data, status, loading, failed, hasVerified }
}
