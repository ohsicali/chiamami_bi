import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useCity } from '../../lib/CityContext'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

function countRestaurantsInCity(cityName, restaurants) {
  if (!restaurants?.length || !cityName) return 0
  const lower = cityName.toLowerCase()
  return restaurants.filter(r => r.city?.toLowerCase() === lower).length
}

function CityRow({ name, count, onSelect }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!MAPBOX_TOKEN) return
    setLoading(true)
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json?access_token=${MAPBOX_TOKEN}&country=it&types=place,locality&language=it&limit=1`
      const res = await fetch(url)
      const data = await res.json()
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].center
        onSelect(name, lng, lat)
      }
    } catch {} finally { setLoading(false) }
  }

  return (
    <button onClick={handleClick} disabled={loading} className="flex items-center justify-between w-full" style={{
      padding: '12px 14px', borderRadius: 14, background: '#fff', border: '1.5px solid #E8E5DE',
      cursor: 'pointer', opacity: loading ? 0.6 : 1,
    }}>
      <div className="flex items-center gap-3">
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ddd' }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: '#22181C' }}>{name}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#22181C', background: 'rgba(0,0,0,0.05)', padding: '3px 8px', borderRadius: 10 }}>
        {count} locali
      </span>
    </button>
  )
}

/**
 * CityPickerSheet — reusable city picker bottom sheet.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - selectedCity: string (default "Torino")
 * - onCityChange: ({ name, lng, lat }) => void  — if provided, called directly (used in HomePage)
 *   If NOT provided, navigates to "/" with city in state.
 * - restaurants: array (optional, for showing counts)
 */
export default function CityPickerSheet({ open, onClose, onCityChange, restaurants: propRestaurants }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { city: currentCity, selectCity } = useCity()
  const selectedCity = currentCity.name
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [restaurants, setRestaurants] = useState(propRestaurants || [])
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // If no restaurants passed, fetch city counts from DB
  useEffect(() => {
    if (propRestaurants) { setRestaurants(propRestaurants); return }
    if (!open || !isSupabaseConfigured()) return
    supabase.from('restaurants').select('id, city').eq('is_published', true)
      .then(({ data }) => { if (data) setRestaurants(data) })
  }, [open, propRestaurants])

  const availableCities = useCallback(() => {
    const cityMap = {}
    ;(restaurants || []).forEach(r => {
      if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1
    })
    return cityMap
  }, [restaurants])

  const searchCities = useCallback(async (q) => {
    if (!q || q.length < 2 || !MAPBOX_TOKEN) { setSuggestions([]); return }
    setSearching(true)
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=it&types=place,locality&language=it&limit=4`
      const res = await fetch(url)
      const data = await res.json()
      if (data.features) {
        setSuggestions(data.features.map(f => ({
          name: f.text,
          fullName: f.place_name?.replace(', Italia', '').replace(', Italy', ''),
          lng: f.center[0],
          lat: f.center[1],
        })))
      }
    } catch { setSuggestions([]) } finally { setSearching(false) }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCities(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, searchCities])

  function handleCitySelect(name, lng, lat) {
    inputRef.current?.blur()
    setQuery('')
    setSuggestions([])
    onClose()
    // Save to shared context so all pages update
    selectCity({ name, lng, lat })
    if (onCityChange) {
      // Direct callback (used in HomePage where map is available)
      setTimeout(() => onCityChange({ name, lng, lat }), 300)
    } else {
      // Navigate to home with city in state
      navigate('/', { state: { city: { name, lng, lat } } })
    }
  }

  if (!open) return null

  const showSuggestions = query.length >= 2 && suggestions.length > 0
  const showPopular = query.length < 2
  const cities = availableCities()

  return createPortal(
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#FAF7F2', borderRadius: '28px 28px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          maxHeight: '60%', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '10px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#22181C' }}>Dove vuoi esplorare?</h3>
          <button onClick={onClose} style={{ padding: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 14, border: '1.5px solid #E8E5DE', padding: '12px 14px' }}>
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cerca città, paese o comune..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontWeight: 500, color: '#22181C', fontFamily: "'DM Sans', sans-serif" }}
            />
            {query && (
              <button onClick={() => { setQuery(''); setSuggestions([]) }} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="px-5 pb-4" style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          {/* Currently selected */}
          {showPopular && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680', textTransform: 'uppercase', letterSpacing: 1 }}>Selezionata</span>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 14, marginTop: 6,
                background: '#22181C', border: '1.5px solid #22181C',
              }}>
                <div className="flex items-center gap-3">
                  <span style={{ position: 'relative', width: 8, height: 8 }}>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80' }} />
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#FAF7F2' }}>{selectedCity}</span>
                </div>
                <div className="flex items-center gap-2">
                  {cities[selectedCity] > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{cities[selectedCity]} locali</span>
                  )}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              </div>
            </div>
          )}

          {/* Search suggestions */}
          {showSuggestions && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680', textTransform: 'uppercase', letterSpacing: 1 }}>Risultati</span>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {suggestions.map((s, i) => {
                  const count = countRestaurantsInCity(s.name, restaurants)
                  return (
                    <button key={`${s.name}-${i}`} onClick={() => handleCitySelect(s.name, s.lng, s.lat)} className="flex items-center justify-between w-full" style={{
                      padding: '12px 14px', borderRadius: 14, background: '#fff', border: '1.5px solid #E8E5DE', cursor: 'pointer', textAlign: 'left',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#22181C' }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: '#8A8680', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.fullName}</div>
                      </div>
                      {count > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#22181C', background: 'rgba(0,0,0,0.05)', padding: '3px 8px', borderRadius: 10, flexShrink: 0, marginLeft: 10 }}>
                          {count} locali
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {query.length >= 2 && searching && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#8A8680', fontSize: 13 }}>Cerco...</div>
          )}
          {query.length >= 2 && !searching && suggestions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#8A8680', fontSize: 13 }}>Nessun risultato per "{query}"</div>
          )}

          {/* Other cities with restaurants */}
          {showPopular && Object.keys(cities).filter(c => c !== selectedCity).length > 0 && (
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680', textTransform: 'uppercase', letterSpacing: 1 }}>Altre città</span>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(cities).filter(([c]) => c !== selectedCity).map(([cityName, count]) => (
                  <CityRow key={cityName} name={cityName} count={count} onSelect={handleCitySelect} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
