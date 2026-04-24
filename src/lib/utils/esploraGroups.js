import { getDistance } from './distance'
import { MOMENT_SLOTS } from '../hours'

const NEAR_THRESHOLD_KM = 0.5 // 500 m

// Raggruppa per distanza: < 500m ("Aperto per <moment> · ora" o "Vicino a te") vs resto ("Oltre i 500 metri").
// Se userPosition mancante → ritorna null (il caller mostrerà una lista piatta).
export function groupByDistance(restaurants, userPosition, momentKey = null) {
  if (!userPosition || !Array.isArray(restaurants) || restaurants.length === 0) return null

  const withDist = restaurants
    .filter(r => r.latitude != null && r.longitude != null)
    .map(r => ({ r, d: getDistance(userPosition.lat, userPosition.lng, r.latitude, r.longitude) }))
    .sort((a, b) => a.d - b.d)

  const nearby = withDist.filter(x => x.d < NEAR_THRESHOLD_KM).map(x => x.r)
  const far = withDist.filter(x => x.d >= NEAR_THRESHOLD_KM).map(x => x.r)

  const nearLabel = momentKey && MOMENT_SLOTS[momentKey]
    ? `${MOMENT_SLOTS[momentKey].emoji} Aperto per ${MOMENT_SLOTS[momentKey].label.toLowerCase()} · ora`
    : 'Vicino a te'

  const groups = []
  if (nearby.length > 0) groups.push({ label: nearLabel, items: nearby })
  if (far.length > 0) groups.push({ label: 'Oltre i 500 metri', items: far })
  return groups.length > 0 ? groups : null
}
