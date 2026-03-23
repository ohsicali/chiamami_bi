const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export async function geocodeAddress(address) {
  if (!MAPBOX_TOKEN) return null
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.features?.length > 0) {
      const [lng, lat] = data.features[0].center
      return { latitude: lat, longitude: lng, place_name: data.features[0].place_name }
    }
    return null
  } catch { return null }
}

export async function reverseGeocode(lat, lng) {
  if (!MAPBOX_TOKEN) return null
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`
  try {
    const res = await fetch(url)
    const data = await res.json()
    return data.features?.[0]?.place_name || null
  } catch { return null }
}
