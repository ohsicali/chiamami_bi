import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../supabase'
import { slotsForPath, MAX_ADS_PER_PAGE } from '../adSlots'
import { DEMO_ADS, isDemoAds } from '../demoAds'

/**
 * Motore degli annunci.
 *
 * Un fetch per sessione (le campagne attive sono poche righe), poi per ogni
 * pagina si estrae un vincitore per posizione. Tre regole tengono in piedi la
 * cosa:
 *
 *  1. L'estrazione è stabile dentro la sessione per una data pagina. Se fosse
 *     rifatta a ogni render il banner cambierebbe cliente mentre l'utente
 *     scorre; se cambiasse a ogni navigazione, tornare indietro mostrerebbe un
 *     altro annuncio al posto di quello appena visto. Pagine diverse pescano
 *     in modo indipendente, e a ogni nuova visita del sito si riparte.
 *  2. Lo stesso cliente non esce due volte nella stessa pagina.
 *  3. Non si superano MAX_ADS_PER_PAGE annunci contemporanei; le posizioni si
 *     riempiono nell'ordine dichiarato nel registro.
 */

export const AdsContext = createContext({ bySlot: {}, loading: false })

const SELECT = `
  *,
  restaurant:restaurants(id, name, slug, cuisine_type, category, price_range, address, tagline, hours_cache, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)),
  discount:discounts(id, title, description, discount_type, discount_value, conditions, valid_until)
`

// Cambia a ogni caricamento dell'app: è quello che rende l'estrazione diversa
// tra una visita e l'altra. Vive fuori dal render, quindi non introduce
// impurità nei componenti.
const SESSION_SEED = (Math.random() * 0xffffffff) >>> 0

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** PRNG deterministico: stesso seme, stessa estrazione. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isLive(ad, now) {
  if (!ad.active) return false
  if (ad.start_at && new Date(ad.start_at).getTime() > now) return false
  if (ad.end_at && new Date(ad.end_at).getTime() <= now) return false
  return true
}

/** Un annuncio senza destinazione raggiungibile non va mostrato: sarebbe un
 *  banner che al tap non fa niente. */
export function adHref(ad) {
  if (!ad) return null
  if (ad.link_type === 'external') {
    return ad.cta_url ? { href: ad.cta_url, external: true } : null
  }
  if (ad.restaurant?.slug) return { href: `/restaurant/${ad.restaurant.slug}`, external: false }
  // Campagna interna senza ristorante collegato: ripieghiamo sull'URL se c'è.
  return ad.cta_url ? { href: ad.cta_url, external: true } : null
}

function clampWeight(w) {
  const n = Number(w)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(10, Math.round(n))
}

function weightedPick(items, rand) {
  const total = items.reduce((sum, it) => sum + clampWeight(it.weight), 0)
  let ticket = rand * total
  for (const it of items) {
    ticket -= clampWeight(it.weight)
    if (ticket <= 0) return it
  }
  return items[items.length - 1]
}

/** Estrae un vincitore per posizione, con anti-doppione e tetto pagina. */
function drawForPage(ads, pathname, now) {
  const live = ads.filter((ad) => isLive(ad, now) && adHref(ad))
  const bySlot = {}
  const used = new Set()
  let shown = 0

  // Solo le posizioni che esistono su questa pagina: contando anche le altre,
  // il tetto verrebbe speso da slot non montati e le posizioni in fondo
  // all'ordine (l'elenco ristoranti) non uscirebbero mai.
  for (const slot of slotsForPath(pathname)) {
    if (shown >= MAX_ADS_PER_PAGE) break
    const pool = live.filter((ad) => ad.slot === slot.key && !used.has(ad.id))
    if (pool.length === 0) continue
    const rand = mulberry32(hashString(`${pathname}|${slot.key}`) ^ SESSION_SEED)()
    const winner = weightedPick(pool, rand)
    if (!winner) continue
    bySlot[slot.key] = winner
    used.add(winner.id)
    shown++
  }
  return bySlot
}

/** Stato del provider. Sta qui e non nel componente per tenere il file del
 *  provider fatto di sola JSX. */
export function useAdsValue() {
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(() => isSupabaseConfigured())
  const { pathname, search } = useLocation()
  const demo = isDemoAds(search)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let cancelled = false
    const nowIso = new Date().toISOString()
    supabase
      .from('sponsored_placements')
      .select(SELECT)
      .eq('active', true)
      .lte('start_at', nowIso)
      .gt('end_at', nowIso)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[useAds]', error.message)
          setAds([])
        } else {
          setAds(data || [])
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Istante di riferimento per la finestra di validità: la query ha già
  // filtrato per date, questo è il secondo controllo lato client.
  const [mountedAt] = useState(() => Date.now())
  const bySlot = useMemo(
    () => drawForPage(demo ? DEMO_ADS : ads, pathname, mountedAt),
    [ads, demo, pathname, mountedAt]
  )

  return useMemo(() => ({ bySlot, loading }), [bySlot, loading])
}

/** Ritorna la campagna estratta per questa posizione, o null. */
export function useAdSlot(slotKey) {
  const { bySlot, loading } = useContext(AdsContext)
  return { ad: bySlot[slotKey] || null, loading }
}
