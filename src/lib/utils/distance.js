// Haversine formula for distance between two GPS points
export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg) { return deg * Math.PI / 180 }

export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

// Estimate driving time in city traffic (~25 km/h average)
export function formatDrivingTime(km) {
  const minutes = Math.round((km / 25) * 60)
  if (minutes < 1) return '1 min'
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m} min` : `${h}h`
  }
  return `${minutes} min`
}
