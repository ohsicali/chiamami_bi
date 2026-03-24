import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Supercluster from 'supercluster'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'

const TORINO_CENTER = [7.6869, 45.0703]
const ACCENT_COLOR = '#FF5757'
const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'
const DEBOUNCE_MS = 120
const EXIT_MS = 120

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
      will-change: transform, opacity;
    }
    .cb-marker--enter {
      transform: scale(0.5);
      opacity: 0;
    }
    .cb-marker--anim {
      animation: cb-pop-in 220ms cubic-bezier(.175,.885,.32,1.275) forwards;
    }
    @keyframes cb-pop-in {
      0%   { transform: scale(0.5); opacity: 0; }
      50%  { opacity: 1; }
      75%  { transform: scale(1.06); }
      100% { transform: scale(1);   opacity: 1; }
    }
    .cb-marker--exit {
      transition: opacity ${EXIT_MS}ms ease-out;
      opacity: 0;
      pointer-events: none;
    }
    .cb-marker--visible {
      transform: scale(1);
      opacity: 1;
    }
    .cb-marker--instant {
      transform: scale(1);
      opacity: 1;
    }
    .cb-marker--selected .cb-inner {
      transform: scale(1.2);
      box-shadow: 0 0 0 3px ${ACCENT_COLOR}44, 0 4px 16px rgba(0,0,0,0.3);
      border-color: ${ACCENT_COLOR} !important;
    }
    .cb-inner {
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .cb-marker:hover .cb-inner { transform: scale(1.1); }
    .cb-marker:active .cb-inner { transform: scale(0.92); }
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
function createPinEl(restaurant, isSaved) {
  const primaryType = (restaurant.category && restaurant.category[0]) || restaurant.cuisine_type
  const { emoji, color } = getCategoryInfo(primaryType)

  const wrap = document.createElement('div')
  wrap.className = 'cb-marker cb-marker--enter'
  wrap.style.cssText = 'cursor:pointer;pointer-events:auto;'

  const inner = document.createElement('div')
  inner.className = 'cb-inner'
  inner.style.cssText = `
    width:40px;height:40px;border-radius:50%;background:#fff;
    border:2.5px solid ${color};display:flex;align-items:center;
    justify-content:center;font-size:18px;position:relative;
    box-shadow:0 2px 8px rgba(0,0,0,0.15);user-select:none;
  `
  inner.innerHTML = `<span style="line-height:1;pointer-events:none">${emoji}</span>`

  if (isSaved) {
    const heart = document.createElement('span')
    heart.style.cssText = `
      position:absolute;top:-4px;right:-4px;width:16px;height:16px;
      background:#fff;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:9px;line-height:1;
      border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);
      pointer-events:none;
    `
    heart.textContent = '❤️'
    inner.appendChild(heart)
  }

  wrap.appendChild(inner)
  return wrap
}

function createClusterEl(count) {
  const wrap = document.createElement('div')
  wrap.className = 'cb-marker cb-marker--enter'
  wrap.style.cssText = 'cursor:pointer;pointer-events:auto;'

  const size = count >= 10 ? 48 : 44
  const inner = document.createElement('div')
  inner.className = 'cb-inner'
  inner.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;background:#fff;
    border:2.5px solid ${ACCENT_COLOR};display:flex;align-items:center;
    justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);
    user-select:none;
  `
  const label = count > 99 ? '99+' : String(count)
  inner.innerHTML = `<span style="font-weight:700;font-size:13px;color:${ACCENT_COLOR};line-height:1;pointer-events:none">${label}</span>`

  wrap.appendChild(inner)
  return wrap
}

/* ------------------------------------------------------------------ */
/*  Animate marker in (or show instantly)                              */
/* ------------------------------------------------------------------ */
function animateIn(el, animate) {
  if (!animate) {
    el.classList.remove('cb-marker--enter')
    el.classList.add('cb-marker--instant')
    return
  }
  // Start the pop-in keyframe animation
  el.classList.remove('cb-marker--enter')
  el.classList.add('cb-marker--anim')
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
  userPosition, savedIds, className,
}, ref) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const sc = useRef(null)                    // Supercluster
  const markersMap = useRef(new Map())        // key → { marker, el, type, id }
  const exitingMarkers = useRef(new Map())   // key → { marker, timer }
  const userMarker = useRef(null)
  const lastZoom = useRef(null)
  const debounceTimer = useRef(null)
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const onSelectRef = useRef(onSelectRestaurant)
  onSelectRef.current = onSelectRestaurant
  const onVisibleRef = useRef(onVisibleRestaurantsChange)
  onVisibleRef.current = onVisibleRestaurantsChange
  const restaurantsRef = useRef(restaurants)
  restaurantsRef.current = restaurants
  const savedIdsRef = useRef(savedIds)
  savedIdsRef.current = savedIds
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  useImperativeHandle(ref, () => ({
    zoomIn: () => map.current?.zoomIn({ duration: 300 }),
    zoomOut: () => map.current?.zoomOut({ duration: 300 }),
    flyToUser: (pos) => {
      if (!map.current || !pos) return
      map.current.flyTo({ center: [pos.lng, pos.lat], zoom: 16, duration: 1200, essential: true })
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
  /*  Flush in-flight animations: finish all instantly                */
  /* -------------------------------------------------------------- */
  const flushAnimations = useCallback(() => {
    // Remove any still-fading-out markers immediately
    for (const [key, { marker, timer }] of exitingMarkers.current) {
      clearTimeout(timer)
      marker.remove()
    }
    exitingMarkers.current.clear()
    // Snap any in-progress pop-in to final state
    const container = mapContainer.current
    if (!container) return
    container.querySelectorAll('.cb-marker--anim, .cb-marker--enter').forEach((el) => {
      el.classList.remove('cb-marker--enter', 'cb-marker--anim')
      el.classList.add('cb-marker--instant')
    })
  }, [])

  /* -------------------------------------------------------------- */
  /*  Core sync: diff markers with animated crossfade                */
  /* -------------------------------------------------------------- */
  const syncMarkers = useCallback((animate) => {
    const m = map.current
    const index = sc.current
    if (!m || !index) return

    // If animating, flush any in-progress animations first
    if (animate) flushAnimations()

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

    // ---- Remove stale markers ----
    for (const [key, entry] of markersMap.current) {
      if (newKeys.has(key)) continue
      markersMap.current.delete(key)

      if (animate) {
        // Fast fade-out (120ms) — overlaps with new markers popping in
        entry.el.classList.add('cb-marker--exit')
        const timer = setTimeout(() => {
          entry.marker.remove()
          exitingMarkers.current.delete(key)
        }, EXIT_MS)
        exitingMarkers.current.set(key, { marker: entry.marker, timer })
      } else {
        entry.marker.remove()
      }
    }

    // ---- Add new / update existing ----
    for (const [key, f] of newKeys) {
      if (markersMap.current.has(key)) {
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
        el = createPinEl(r, saved?.has(r.id))
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current?.(r.id)
        })
        if (selectedIdRef.current === r.id) el.classList.add('cb-marker--selected')
      }

      const [lng, lat] = f.geometry.coordinates
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(m)

      markersMap.current.set(key, {
        marker, el,
        type: f.properties.cluster ? 'cluster' : 'pin',
        id: f.properties.cluster ? null : f.properties.id,
      })

      if (animate) {
        requestAnimationFrame(() => animateIn(el, true))
      } else {
        animateIn(el, false)
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
  }, [flushAnimations])

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
      for (const { marker, timer } of exitingMarkers.current.values()) { clearTimeout(timer); marker.remove() }
      exitingMarkers.current.clear()
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
