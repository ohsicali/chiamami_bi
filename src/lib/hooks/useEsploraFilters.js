import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getDistance } from '../utils/distance'
import { isOpenForMoment } from '../hours'

// URL schema (deep-linkable dalla home):
//   cat    = comma-separated slugs           — multi-select
//   price  = comma-separated (1,2,3,4)       — multi-select
//   moment = colazione|pranzo|aperitivo|cena|dopocena  — single
//   diet   = comma-separated (vegan,vegetarian,healthy,gluten-free)
//   disc   = '1' | absent
//   area   = km (float, es. '1.2')
//   view   = 'map' | 'list'   (solo mobile; desktop ignora)
//
// Il hook espone:
//   filters          — stato raw (array/string/bool)
//   activeCount      — numero di sezioni filtro attive (esclusi view/area default)
//   legacyFilters    — forma compatibile con useRestaurants (pre-PR19): { category, priceRange, moment }
//   setters          — update URL in place (replace:true) per non inquinare history

const DEFAULT_AREA_KM = null // null = nessun limite

const MOMENTS = ['colazione', 'pranzo', 'aperitivo', 'cena', 'dopocena']
const DIETS = ['vegan', 'vegetarian', 'healthy', 'gluten-free']

function parseCsv(v) {
  if (!v) return []
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

function parsePriceCsv(v) {
  return parseCsv(v).map(Number).filter(n => n >= 1 && n <= 4)
}

export function useEsploraFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => {
    const cat = parseCsv(searchParams.get('cat'))
    const price = parsePriceCsv(searchParams.get('price'))
    const momentRaw = searchParams.get('moment')
    const moment = momentRaw && MOMENTS.includes(momentRaw) ? momentRaw : null
    const diet = parseCsv(searchParams.get('diet')).filter(d => DIETS.includes(d))
    const disc = searchParams.get('disc') === '1'
    const areaRaw = searchParams.get('area')
    const area = areaRaw && !Number.isNaN(Number(areaRaw)) ? Number(areaRaw) : DEFAULT_AREA_KM
    const viewRaw = searchParams.get('view')
    const view = viewRaw === 'list' ? 'list' : 'map'
    return { cat, price, moment, diet, disc, area, view }
  }, [searchParams])

  // Conta "sezioni" filtro attive (badge pill Filtri).
  // cat è fuori dal badge Filtri perché ha la sua pill Categorie → seguiamo mockup.
  const activeCount = useMemo(() => {
    let n = 0
    if (filters.moment) n++
    if (filters.price.length) n++
    if (filters.diet.length) n++
    if (filters.area && filters.area > 0) n++
    return n
  }, [filters.moment, filters.price, filters.diet, filters.area])

  const hasAnyFilter = useMemo(() => (
    filters.cat.length > 0 ||
    filters.price.length > 0 ||
    !!filters.moment ||
    filters.diet.length > 0 ||
    filters.disc ||
    (filters.area != null && filters.area > 0)
  ), [filters])

  const legacyFilters = useMemo(() => ({
    // Compat hook useRestaurants: category può essere array
    category: filters.cat.length === 0 ? null : filters.cat,
    // useRestaurants supporta solo singolo priceRange → passiamo il primo, il resto lo filtriamo dopo con applyEsploraFilters
    priceRange: filters.price[0] ?? null,
    moment: filters.moment,
    sortBy: 'name',
  }), [filters])

  const update = useCallback((patch) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0) || v === false) {
        next.delete(k)
      } else if (Array.isArray(v)) {
        next.set(k, v.join(','))
      } else if (v === true) {
        next.set(k, '1')
      } else {
        next.set(k, String(v))
      }
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const setCat = useCallback((cats) => update({ cat: cats }), [update])
  const toggleCat = useCallback((slug) => {
    const set = new Set(filters.cat)
    if (set.has(slug)) set.delete(slug)
    else set.add(slug)
    update({ cat: Array.from(set) })
  }, [filters.cat, update])

  const setPrice = useCallback((prices) => update({ price: prices }), [update])
  const togglePrice = useCallback((n) => {
    const set = new Set(filters.price)
    if (set.has(n)) set.delete(n)
    else set.add(n)
    update({ price: Array.from(set) })
  }, [filters.price, update])

  const setMoment = useCallback((m) => update({ moment: m }), [update])
  const toggleMoment = useCallback((m) => {
    update({ moment: filters.moment === m ? null : m })
  }, [filters.moment, update])

  const setDiet = useCallback((diets) => update({ diet: diets }), [update])
  const toggleDiet = useCallback((d) => {
    const set = new Set(filters.diet)
    if (set.has(d)) set.delete(d)
    else set.add(d)
    update({ diet: Array.from(set) })
  }, [filters.diet, update])

  const setDisc = useCallback((b) => update({ disc: !!b }), [update])
  const toggleDisc = useCallback(() => update({ disc: !filters.disc }), [filters.disc, update])

  const setArea = useCallback((km) => update({ area: km }), [update])

  const setView = useCallback((v) => update({ view: v === 'list' ? 'list' : null }), [update])

  const reset = useCallback(() => {
    const next = new URLSearchParams()
    // Preserva view (è un'impostazione di navigazione, non un filtro)
    if (filters.view === 'list') next.set('view', 'list')
    setSearchParams(next, { replace: true })
  }, [filters.view, setSearchParams])

  return {
    filters,
    activeCount,
    hasAnyFilter,
    legacyFilters,
    setCat, toggleCat,
    setPrice, togglePrice,
    setMoment, toggleMoment,
    setDiet, toggleDiet,
    setDisc, toggleDisc,
    setArea,
    setView,
    reset,
  }
}

// Filtro client-side complementare: applica multi-select price, diet, disc e area.
// Il hook `useRestaurants` già applica cat (array OK), priceRange (singolo), moment.
// Qui facciamo il resto. `discountIds` è un Set di restaurant_id con sconto attivo.
export function applyEsploraFilters(restaurants, filters, userPosition, discountIds) {
  let result = restaurants

  // Multi-select price: se ci sono più valori, useRestaurants ne ha filtrato solo uno; qui rifiltriamo con l'intera lista
  if (filters.price && filters.price.length > 1) {
    const set = new Set(filters.price)
    result = result.filter(r => set.has(r.price_range))
  }

  // Diet — tags_dietary potrebbe non esistere ancora nel DB (migration pending). No-op se assente.
  if (filters.diet && filters.diet.length > 0) {
    result = result.filter(r => {
      const tags = r.tags_dietary || r.dietary_tags || []
      if (!Array.isArray(tags) || tags.length === 0) return false
      return filters.diet.every(d => tags.includes(d))
    })
  }

  // Sconti toggle
  if (filters.disc && discountIds) {
    result = result.filter(r => discountIds.has(r.id))
  }

  // Area di ricerca (km)
  if (filters.area && filters.area > 0 && userPosition) {
    result = result.filter(r => {
      if (!r.latitude || !r.longitude) return false
      return getDistance(userPosition.lat, userPosition.lng, r.latitude, r.longitude) <= filters.area
    })
  }

  return result
}

// Stima live count per il CTA "Mostra N locali" nel filter sheet (preview filtri non ancora applicati).
// Usato nel sheet mentre l'utente seleziona: serve riprodurre l'intera pipeline di useRestaurants
// + applyEsploraFilters usando un "filters" ipotetico.
export function countMatching(allRestaurants, hypoFilters, userPosition, discountIds) {
  let result = allRestaurants.filter(r => r.is_published)
  if (hypoFilters.cat && hypoFilters.cat.length > 0) {
    const sel = new Set(hypoFilters.cat)
    result = result.filter(r => {
      const cats = r.category || (r.cuisine_type ? [r.cuisine_type] : [])
      return cats.some(c => sel.has(c))
    })
  }
  if (hypoFilters.price && hypoFilters.price.length > 0) {
    const sel = new Set(hypoFilters.price)
    result = result.filter(r => sel.has(r.price_range))
  }
  if (hypoFilters.moment) {
    result = result.filter(r => isOpenForMoment(r.hours_cache, hypoFilters.moment).match)
  }
  if (hypoFilters.diet && hypoFilters.diet.length > 0) {
    result = result.filter(r => {
      const tags = r.tags_dietary || r.dietary_tags || []
      if (!Array.isArray(tags) || tags.length === 0) return false
      return hypoFilters.diet.every(d => tags.includes(d))
    })
  }
  if (hypoFilters.disc && discountIds) {
    result = result.filter(r => discountIds.has(r.id))
  }
  if (hypoFilters.area && hypoFilters.area > 0 && userPosition) {
    result = result.filter(r => {
      if (!r.latitude || !r.longitude) return false
      return getDistance(userPosition.lat, userPosition.lng, r.latitude, r.longitude) <= hypoFilters.area
    })
  }
  return result.length
}
