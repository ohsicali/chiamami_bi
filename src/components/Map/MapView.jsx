import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Supercluster from 'supercluster'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'

const TORINO_CENTER = [7.6869, 45.0703]
const ACCENT_COLOR = '#E8453C'
const GOLD_COLOR = '#C4A265'
const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'
const DEBOUNCE_MS = 120
const CROSSFADE_MS = 200

/* ------------------------------------------------------------------ */
/*  Inject styles once                                                 */
/* ------------------------------------------------------------------ */
const STYLE_ID = 'chiamami-pin-styles'
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    .cb-marker {
      will-change: opacity;
    }
    /* New markers: start invisible, full size */
    .cb-marker--hidden {
      opacity: 0;
      transform: scale(0.85);
    }
    /* Crossfade transition (applied to both old and new) */
    .cb-marker--fade {
      transition: opacity ${CROSSFADE_MS}ms ease, transform ${CROSSFADE_MS}ms ease;
    }
    /* Exit: fade to invisible */
    .cb-marker--exit {
      opacity: 0;
      transform: scale(0.85);
      pointer-events: none;
    }
    /* Enter: fade to visible */
    .cb-marker--show {
      opacity: 1;
      transform: scale(1);
    }
    /* Instant (no animation) */
    .cb-marker--visible {
      opacity: 1;
      transform: scale(1);
    }
    .cb-marker--selected .cb-inner {
      transform: scale(1.2);
      box-shadow: 0 0 0 4px ${ACCENT_COLOR}33, 0 4px 20px rgba(232,69,60,0.5);
    }
    .cb-inner {
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .cb-marker:hover .cb-inner { transform: scale(1.15); }
    .cb-marker:active .cb-inner { transform: scale(0.92); }
    @keyframes cb-bounce {
      0% { transform: scale(0); }
      50% { transform: scale(1.15); }
      70% { transform: scale(0.9); }
      85% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    .cb-inner--bounce {
      animation: cb-bounce 0.5s ease-out;
    }
    @keyframes cb-breathe {
      0%, 100% { box-shadow: 0 4px 20px rgba(232,69,60,0.4), 0 0 0 3px rgba(232,69,60,0.15); }
      50% { box-shadow: 0 4px 28px rgba(232,69,60,0.6), 0 0 0 8px rgba(232,69,60,0.08); }
    }
    @keyframes cb-pulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.3); }
      50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.15); }
    }
  `
  document.head.appendChild(s)
}

/* ------------------------------------------------------------------ */
/*  Create DOM elements for markers                                    */
/* ------------------------------------------------------------------ */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function createPinEl(restaurant, isSaved, discountValue) {
  const primaryType = (restaurant.category && restaurant.category[0]) || restaurant.cuisine_type
  const { emoji, color } = getCategoryInfo(primaryType)
  const pinColor = color || ACCENT_COLOR
  const rgb = hexToRgb(pinColor)

  const wrap = document.createElement('div')
  wrap.className = 'cb-marker'
  wrap.style.cssText = 'cursor:pointer;pointer-events:auto;'

  const inner = document.createElement('div')
  inner.className = 'cb-inner cb-inner--bounce'
  inner.style.cssText = `
    width:44px;height:44px;border-radius:50%;
    background:${pinColor};opacity:0.85;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;position:relative;user-select:none;
    box-shadow:0 4px 16px rgba(${rgb},0.4), 0 0 0 3px rgba(${rgb},0.15);
  `
  inner.innerHTML = `<span style="line-height:1;pointer-events:none">${emoji}</span>`

  if (isSaved) {
    const heart = document.createElement('span')
    heart.style.cssText = `
      position:absolute;top:-4px;right:-4px;width:18px;height:18px;
      background:#fff;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:10px;line-height:1;
      box-shadow:0 2px 6px rgba(0,0,0,0.2);
      pointer-events:none;
    `
    heart.textContent = '❤️'
    inner.appendChild(heart)
  }

  if (discountValue) {
    const badge = document.createElement('span')
    badge.style.cssText = `
      position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);
      background:#4ADE80;color:#fff;
      font-size:8px;font-weight:800;letter-spacing:0.3px;
      padding:2px 5px;border-radius:6px;white-space:nowrap;
      box-shadow:0 2px 6px rgba(74,222,128,0.4);
      pointer-events:none;
    `
    badge.textContent = discountValue
    inner.appendChild(badge)
  }

  wrap.appendChild(inner)
  return wrap
}

function createClusterEl(count) {
  const wrap = document.createElement('div')
  wrap.className = 'cb-marker'
  wrap.style.cssText = 'cursor:pointer;pointer-events:auto;'

  const size = count >= 10 ? 52 : 46
  const inner = document.createElement('div')
  inner.className = 'cb-inner'
  inner.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:rgba(255,255,255,0.88);
    backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    border:1.5px solid rgba(0,0,0,0.08);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 12px rgba(0,0,0,0.1);
    user-select:none;
  `
  const label = count > 99 ? '99+' : String(count)
  inner.innerHTML = `<span style="font-weight:700;font-size:14px;color:#111;line-height:1;pointer-events:none">${label}</span>`

  wrap.appendChild(inner)
  return wrap
}

/* ------------------------------------------------------------------ */
/*  Placeholder                                                        */
/* ------------------------------------------------------------------ */
function PlaceholderMap({ restaurants, className }) {
  return (
    <div
      className={className}
      style={{
        background: '#F5F5F3', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
        overflow: 'hidden', width: '100%', height: '100%',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'center', gap: '24px',
        padding: '60px 24px', opacity: 0.3,
      }}>
        {(restaurants || []).map((r) => {
          const { emoji, color } = getCategoryInfo(r.cuisine_type)
          return (
            <div key={r.id} style={{
              width: 32, height: 32, borderRadius: '50%', background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>{emoji}</div>
          )
        })}
      </div>
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center', padding: '32px',
        background: 'rgba(255,255,255,0.92)', borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 360,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: `${ACCENT_COLOR}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 16px',
        }}>🗺️</div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1F2937', margin: '0 0 8px' }}>
          Configura il token Mapbox
        </h3>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.5 }}>
          Aggiungi <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}>VITE_MAPBOX_TOKEN</code> al file <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}>.env</code>
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MapView — supercluster + animated HTML markers                     */
/* ------------------------------------------------------------------ */
const MapView = forwardRef(function MapView({
  restaurants, selectedId, onSelectRestaurant, onVisibleRestaurantsChange,
  userPosition, savedIds, discountMap, className,
}, ref) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const sc = useRef(null)                    // Supercluster
  const markersMap = useRef(new Map())        // key → { marker, el, type, id }
  const userMarker = useRef(null)
  const lastZoom = useRef(null)
  const debounceTimer = useRef(null)
  const crossfadeTimer = useRef(null)
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const onSelectRef = useRef(onSelectRestaurant)
  onSelectRef.current = onSelectRestaurant
  const onVisibleRef = useRef(onVisibleRestaurantsChange)
  onVisibleRef.current = onVisibleRestaurantsChange
  const restaurantsRef = useRef(restaurants)
  restaurantsRef.current = restaurants
  const savedIdsRef = useRef(savedIds)
  savedIdsRef.current = savedIds
  const discountMapRef = useRef(discountMap)
  discountMapRef.current = discountMap
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  useImperativeHandle(ref, () => ({
    zoomIn: () => map.current?.zoomIn({ duration: 300 }),
    zoomOut: () => map.current?.zoomOut({ duration: 300 }),
    flyToUser: (pos) => {
      if (!map.current || !pos) return
      map.current.flyTo({ center: [pos.lng, pos.lat], zoom: 14, duration: 1200, essential: true })
    },
    flyToCity: (lng, lat, zoom = 13) => {
      if (!map.current) return
      map.current.flyTo({ center: [lng, lat], zoom, duration: 1400, essential: true })
    },
  }))

  /* -------------------------------------------------------------- */
  /*  Build supercluster index                                       */
  /* -------------------------------------------------------------- */
  const buildIndex = useCallback(() => {
    const rests = restaurantsRef.current || []
    const saved = savedIdsRef.current
    const points = rests
      .filter((r) => r.latitude && r.longitude)
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: { id: r.id, saved: saved?.has(r.id) ? true : false },
      }))

    const index = new Supercluster({ radius: 60, maxZoom: 16 })
    index.load(points)
    sc.current = index
  }, [])

  /* -------------------------------------------------------------- */
  /*  Core sync                                                      */
  /* -------------------------------------------------------------- */
  const syncMarkers = useCallback((animate) => {
    const m = map.current
    const index = sc.current
    if (!m || !index) return

    // Cancel any in-flight crossfade cleanup
    clearTimeout(crossfadeTimer.current)

    const zoom = Math.floor(m.getZoom())
    const bounds = m.getBounds()
    const pad = 0.5
    const lngPad = (bounds.getEast() - bounds.getWest()) * pad
    const latPad = (bounds.getNorth() - bounds.getSouth()) * pad
    const bbox = [
      bounds.getWest() - lngPad, bounds.getSouth() - latPad,
      bounds.getEast() + lngPad, bounds.getNorth() + latPad,
    ]

    const features = index.getClusters(bbox, zoom)
    const rests = restaurantsRef.current || []
    const saved = savedIdsRef.current

    // Build target state
    const newKeys = new Map()
    for (const f of features) {
      const key = f.properties.cluster
        ? `cluster-${f.properties.cluster_id}`
        : `pin-${f.properties.id}`
      newKeys.set(key, f)
    }

    // Collect markers to exit and markers to enter
    const toExit = []   // { key, entry } — old markers that should leave
    const toEnter = []  // { key, el, marker } — new markers to show

    // ---- Identify stale markers ----
    for (const [key, entry] of markersMap.current) {
      if (!newKeys.has(key)) {
        toExit.push({ key, entry })
      }
    }

    // ---- Add new / update existing ----
    for (const [key, f] of newKeys) {
      if (markersMap.current.has(key)) {
        // Update position of existing marker
        const entry = markersMap.current.get(key)
        const [lng, lat] = f.geometry.coordinates
        entry.marker.setLngLat([lng, lat])
        continue
      }

      let el
      if (f.properties.cluster) {
        el = createClusterEl(f.properties.point_count)
        const clusterId = f.properties.cluster_id
        const coords = f.geometry.coordinates
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          const expZoom = index.getClusterExpansionZoom(clusterId)
          m.easeTo({ center: coords, zoom: expZoom, duration: 500 })
        })
      } else {
        const r = rests.find((r) => r.id === f.properties.id)
        if (!r) continue
        el = createPinEl(r, saved?.has(r.id), discountMapRef.current?.[r.id])
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current?.(r.id)
        })
        if (selectedIdRef.current === r.id) el.classList.add('cb-marker--selected')
      }

      if (animate) {
        // Start hidden — will be revealed in crossfade
        el.classList.add('cb-marker--hidden')
      } else {
        el.classList.add('cb-marker--visible')
      }

      const [lng, lat] = f.geometry.coordinates
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(m)

      const entry = {
        marker, el,
        type: f.properties.cluster ? 'cluster' : 'pin',
        id: f.properties.cluster ? null : f.properties.id,
      }
      markersMap.current.set(key, entry)
      toEnter.push({ key, el, marker })
    }

    // ---- Crossfade or instant swap ----
    if (animate && (toExit.length > 0 || toEnter.length > 0)) {
      // Step 1: add transition class to all involved markers
      for (const { entry } of toExit) {
        entry.el.classList.add('cb-marker--fade')
      }
      for (const { el } of toEnter) {
        el.classList.add('cb-marker--fade')
      }

      // Step 2: in next frame, trigger both transitions simultaneously
      requestAnimationFrame(() => {
        // Old markers → fade out
        for (const { entry } of toExit) {
          entry.el.classList.add('cb-marker--exit')
        }
        // New markers → fade in
        for (const { el } of toEnter) {
          el.classList.remove('cb-marker--hidden')
          el.classList.add('cb-marker--show')
        }
      })

      // Step 3: after transition, clean up old markers from DOM
      crossfadeTimer.current = setTimeout(() => {
        for (const { key, entry } of toExit) {
          entry.marker.remove()
        }
        // Clean up transition classes from new markers
        for (const { el } of toEnter) {
          el.classList.remove('cb-marker--fade', '  cb-marker--show')
          el.classList.add('cb-marker--visible')
        }
      }, CROSSFADE_MS + 20)

      // Remove exiting keys from map immediately (so they don't interfere with future syncs)
      for (const { key } of toExit) {
        markersMap.current.delete(key)
      }
    } else {
      // Instant: just remove old markers
      for (const { key, entry } of toExit) {
        markersMap.current.delete(key)
        entry.marker.remove()
      }
    }

    lastZoom.current = zoom

    // Notify parent
    if (onVisibleRef.current) {
      const allVisibleIds = rests
        .filter((r) => r.latitude && r.longitude && bounds.contains([r.longitude, r.latitude]))
        .map((r) => r.id)
      const center = m.getCenter()
      onVisibleRef.current(allVisibleIds, { lng: center.lng, lat: center.lat })
    }
  }, [])

  /* -------------------------------------------------------------- */
  /*  Zoom handler: just record that zoom level changed.             */
  /*  Actual sync happens at moveend to avoid mid-animation gaps.    */
  /* -------------------------------------------------------------- */
  const zoomChanged = useRef(false)
  const onZoom = useCallback(() => {
    const m = map.current
    if (!m) return
    const zoom = Math.floor(m.getZoom())
    if (zoom !== lastZoom.current) {
      zoomChanged.current = true
    }
  }, [])

  /* -------------------------------------------------------------- */
  /*  Initialize map                                                 */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!token || !mapContainer.current) return
    ensureStyles()
    mapboxgl.accessToken = token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: TORINO_CENTER,
      zoom: 13,
      pitch: 15,
    })

    map.current.on('load', () => {
      const m = map.current
      if (!m) return

      // Hide POI labels
      m.getStyle().layers.forEach((layer) => {
        if (layer.id.includes('poi')) m.setLayoutProperty(layer.id, 'visibility', 'none')
      })

      // During zoom: record that zoom changed (don't sync mid-animation)
      m.on('zoom', onZoom)

      // During movement: update visible restaurant count in real-time
      let moveRaf = null
      m.on('move', () => {
        if (moveRaf) return
        moveRaf = requestAnimationFrame(() => {
          moveRaf = null
          if (!onVisibleRef.current) return
          const rests = restaurantsRef.current || []
          const bounds = m.getBounds()
          const ids = rests
            .filter((r) => r.latitude && r.longitude && bounds.contains([r.longitude, r.latitude]))
            .map((r) => r.id)
          const center = m.getCenter()
          onVisibleRef.current(ids, { lng: center.lng, lat: center.lat })
        })
      })

      // After all movement settles: sync with animation if zoom changed
      m.on('moveend', () => {
        clearTimeout(debounceTimer.current)
        if (zoomChanged.current) {
          zoomChanged.current = false
          syncMarkers(true) // animated crossfade for cluster ↔ pin
        } else {
          debounceTimer.current = setTimeout(() => syncMarkers(false), DEBOUNCE_MS)
        }
      })

      // Initial render (instant, no animation needed)
      buildIndex()
      syncMarkers(false)
    })

    return () => {
      clearTimeout(debounceTimer.current)
      clearTimeout(crossfadeTimer.current)
      for (const { marker } of markersMap.current.values()) marker.remove()
      markersMap.current.clear()
      userMarker.current?.remove()
      userMarker.current = null
      map.current?.remove()
      map.current = null
      sc.current = null
    }
  }, [token, onZoom, syncMarkers, buildIndex])

  /* -------------------------------------------------------------- */
  /*  Rebuild when data changes                                      */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current || !sc.current) return
    buildIndex()
    // Clear existing markers to rebuild with new saved states
    for (const { marker } of markersMap.current.values()) marker.remove()
    markersMap.current.clear()
    syncMarkers(false) // instant — data changed, not a zoom transition
  }, [restaurants, savedIds, buildIndex, syncMarkers])

  /* -------------------------------------------------------------- */
  /*  Selected state                                                 */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    for (const [, entry] of markersMap.current) {
      if (entry.type !== 'pin') continue
      if (entry.id === selectedId) {
        entry.el.classList.add('cb-marker--selected')
      } else {
        entry.el.classList.remove('cb-marker--selected')
      }
    }
  }, [selectedId])

  /* -------------------------------------------------------------- */
  /*  FlyTo selected                                                 */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current || !selectedId) return
    const r = restaurantsRef.current?.find((r) => r.id === selectedId)
    if (!r) return
    map.current.flyTo({
      center: [r.longitude, r.latitude],
      zoom: Math.max(map.current.getZoom(), 15),
      duration: 1000, essential: true,
    })
  }, [selectedId])

  /* -------------------------------------------------------------- */
  /*  User position                                                  */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current) return
    if (userMarker.current) { userMarker.current.remove(); userMarker.current = null }
    if (!userPosition) return

    const el = document.createElement('div')
    el.style.cssText = `
      width:16px;height:16px;border-radius:50%;background:#3B82F6;
      border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.3);
      animation:cb-pulse 2s infinite;
    `
    userMarker.current = new mapboxgl.Marker({ element: el })
      .setLngLat([userPosition.lng, userPosition.lat])
      .addTo(map.current)
  }, [userPosition])

  if (!token) return <PlaceholderMap restaurants={restaurants} className={className} />

  return (
    <div ref={mapContainer} className={className} style={{ width: '100%', height: '100%' }} />
  )
})

export default MapView
