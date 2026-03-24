import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'

const TORINO_CENTER = [7.6869, 45.0703]
const ACCENT_COLOR = '#FF5757'
const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'
const SOURCE_ID = 'restaurants-source'
const CLUSTER_LAYER = 'clusters'
const CLUSTER_COUNT_LAYER = 'cluster-count'
const UNCLUSTERED_LAYER = 'unclustered-point' // invisible, used for hit detection

function createPinElement(restaurant, isSaved) {
  const primaryType = (restaurant.category && restaurant.category[0]) || restaurant.cuisine_type
  const { emoji, color } = getCategoryInfo(primaryType)

  // Outer element — Mapbox controls its transform for positioning.
  const el = document.createElement('div')
  el.className = 'chiamami-pin'
  el.dataset.restaurantId = restaurant.id
  el.style.cssText = `
    width: 40px;
    height: 40px;
    cursor: pointer;
    pointer-events: auto;
  `

  // Inner visual circle — all styling & scale animations go here
  const inner = document.createElement('div')
  inner.className = 'chiamami-pin-inner'
  inner.dataset.color = color
  inner.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #fff;
    border: 2.5px solid ${color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    user-select: none;
    position: relative;
  `

  inner.innerHTML = `<span style="line-height:1;pointer-events:none">${emoji}</span>`

  if (isSaved) {
    const heart = document.createElement('span')
    heart.style.cssText = `
      position: absolute;
      top: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      line-height: 1;
      border: 1.5px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      pointer-events: none;
    `
    heart.textContent = '❤️'
    inner.appendChild(heart)
  }

  el.appendChild(inner)
  return el
}

// Inject keyframes once
const STYLE_ID = 'chiamami-pin-styles'
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* Outer .chiamami-pin: NO transform transitions — Mapbox owns its transform */
    .chiamami-pin[data-selected="true"] {
      z-index: 10 !important;
    }
    /* Inner element gets all visual transitions & animations */
    .chiamami-pin-inner {
      transition: transform 0.15s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.15s ease;
    }
    .chiamami-pin:hover .chiamami-pin-inner {
      transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .chiamami-pin:active .chiamami-pin-inner {
      transform: scale(0.9);
      transition: transform 0.08s ease;
    }
    .chiamami-pin[data-selected="true"] .chiamami-pin-inner {
      transform: scale(1.25);
      box-shadow: 0 0 0 3px ${ACCENT_COLOR}44, 0 4px 16px rgba(0,0,0,0.3);
      border-color: ${ACCENT_COLOR} !important;
      animation: chiamami-pin-pulse 2s infinite;
    }
    @keyframes chiamami-pin-pulse {
      0%, 100% { box-shadow: 0 0 0 3px ${ACCENT_COLOR}44, 0 4px 16px rgba(0,0,0,0.3); }
      50% { box-shadow: 0 0 0 6px ${ACCENT_COLOR}22, 0 4px 16px rgba(0,0,0,0.3); }
    }
    @keyframes chiamami-user-pulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.3); }
      50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.15); }
    }
  `
  document.head.appendChild(style)
}

/* ------------------------------------------------------------------ */
/*  Build GeoJSON FeatureCollection from restaurant array              */
/* ------------------------------------------------------------------ */
function buildGeoJSON(restaurants) {
  return {
    type: 'FeatureCollection',
    features: (restaurants || [])
      .filter((r) => r.latitude && r.longitude)
      .map((r) => ({
        type: 'Feature',
        id: r.id,
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: { id: r.id },
      })),
  }
}

/* ------------------------------------------------------------------ */
/*  Placeholder when no Mapbox token                                   */
/* ------------------------------------------------------------------ */
function PlaceholderMap({ restaurants, className }) {
  return (
    <div
      className={className}
      style={{
        background: '#F5F5F3',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '60px 24px',
          opacity: 0.3,
        }}
      >
        {(restaurants || []).map((r) => {
          const { emoji, color } = getCategoryInfo(r.cuisine_type)
          return (
            <div
              key={r.id}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}
            >
              {emoji}
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          padding: '32px',
          background: 'rgba(255,255,255,0.92)',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          maxWidth: 360,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `${ACCENT_COLOR}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            margin: '0 auto 16px',
          }}
        >
          🗺️
        </div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#1F2937',
            margin: '0 0 8px',
          }}
        >
          Configura il token Mapbox
        </h3>
        <p
          style={{
            fontSize: 14,
            color: '#6B7280',
            margin: '0 0 16px',
            lineHeight: 1.5,
          }}
        >
          Aggiungi la variabile <code
            style={{
              background: '#F3F4F6',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'monospace',
            }}
          >VITE_MAPBOX_TOKEN</code> al
          file <code
            style={{
              background: '#F3F4F6',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'monospace',
            }}
          >.env</code> per visualizzare la mappa.
        </p>
        <div
          style={{
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '12px',
            fontSize: 13,
            fontFamily: 'monospace',
            color: '#374151',
            textAlign: 'left',
          }}
        >
          VITE_MAPBOX_TOKEN=pk.eyJ1...
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MapView component                                                  */
/* ------------------------------------------------------------------ */
const MapView = forwardRef(function MapView({
  restaurants,
  selectedId,
  onSelectRestaurant,
  userPosition,
  savedIds,
  className,
}, ref) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef({}) // id → { marker, el }
  const userMarker = useRef(null)
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const onSelectRef = useRef(onSelectRestaurant)
  onSelectRef.current = onSelectRestaurant
  const restaurantsRef = useRef(restaurants)
  restaurantsRef.current = restaurants
  const savedIdsRef = useRef(savedIds)
  savedIdsRef.current = savedIds

  useImperativeHandle(ref, () => ({
    zoomIn: () => map.current?.zoomIn({ duration: 300 }),
    zoomOut: () => map.current?.zoomOut({ duration: 300 }),
    flyToUser: (pos) => {
      if (!map.current || !pos) return
      map.current.flyTo({
        center: [pos.lng, pos.lat],
        zoom: 16,
        duration: 1200,
        essential: true,
      })
    },
  }))

  /* -------------------------------------------------------------- */
  /*  Sync HTML markers for unclustered points                       */
  /* -------------------------------------------------------------- */
  const syncMarkers = useCallback(() => {
    const m = map.current
    if (!m || !m.getSource(SOURCE_ID)) return

    const rests = restaurantsRef.current || []
    const saved = savedIdsRef.current

    // Which restaurant IDs are visible as unclustered points right now?
    const visibleFeatures = m.querySourceFeatures(SOURCE_ID, { sourceLayer: '' })
    const visibleIds = new Set()
    visibleFeatures.forEach((f) => {
      // Only unclustered features (not cluster aggregates)
      if (!f.properties.cluster) {
        visibleIds.add(f.properties.id)
      }
    })

    // Remove markers that are no longer visible (got clustered)
    for (const id of Object.keys(markers.current)) {
      if (!visibleIds.has(id)) {
        markers.current[id].marker.remove()
        delete markers.current[id]
      }
    }

    // Add markers for newly visible unclustered points
    for (const id of visibleIds) {
      if (markers.current[id]) continue // already exists

      const r = rests.find((r) => r.id === id)
      if (!r) continue

      const el = createPinElement(r, saved?.has(r.id))

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current?.(r.id)
      })
      el.addEventListener('touchend', (e) => {
        e.stopPropagation()
        onSelectRef.current?.(r.id)
      }, { passive: true })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([r.longitude, r.latitude])
        .addTo(m)

      markers.current[id] = { marker, el }
    }
  }, [])

  /* -------------------------------------------------------------- */
  /*  Initialize map + cluster source & layers                       */
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

      // Hide default POI labels to avoid clutter
      m.getStyle().layers.forEach((layer) => {
        if (layer.id.includes('poi')) {
          m.setLayoutProperty(layer.id, 'visibility', 'none')
        }
      })

      // Add GeoJSON source with clustering
      m.addSource(SOURCE_ID, {
        type: 'geojson',
        data: buildGeoJSON(restaurantsRef.current),
        cluster: true,
        clusterMaxZoom: 14,   // stop clustering at this zoom
        clusterRadius: 50,    // px radius to cluster points
      })

      // Cluster circles
      m.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#fff',
          'circle-radius': ['step', ['get', 'point_count'], 22, 5, 26, 10, 30],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': ACCENT_COLOR,
          'circle-opacity': 1,
        },
      })

      // Cluster count labels
      m.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': ACCENT_COLOR,
        },
      })

      // Invisible layer for unclustered points (needed for querySourceFeatures)
      m.addLayer({
        id: UNCLUSTERED_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 0,
          'circle-opacity': 0,
        },
      })

      // Click on cluster → zoom in to expand
      m.on('click', CLUSTER_LAYER, (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] })
        if (!features.length) return
        const clusterId = features[0].properties.cluster_id
        m.getSource(SOURCE_ID).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          m.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
            duration: 500,
          })
        })
      })

      // Pointer cursor on clusters
      m.on('mouseenter', CLUSTER_LAYER, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', CLUSTER_LAYER, () => { m.getCanvas().style.cursor = '' })

      // Sync HTML markers after every render frame
      m.on('render', syncMarkers)
      // Also on moveend/zoomend for safety
      m.on('moveend', syncMarkers)

      // Initial sync
      syncMarkers()
    })

    return () => {
      Object.values(markers.current).forEach(({ marker }) => marker.remove())
      markers.current = {}
      userMarker.current?.remove()
      userMarker.current = null
      map.current?.remove()
      map.current = null
    }
  }, [token, syncMarkers])

  /* -------------------------------------------------------------- */
  /*  Update GeoJSON source when restaurants change                  */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current) return
    const m = map.current

    const update = () => {
      const src = m.getSource(SOURCE_ID)
      if (src) {
        src.setData(buildGeoJSON(restaurants))
      }
    }

    if (m.isStyleLoaded() && m.getSource(SOURCE_ID)) {
      update()
    } else {
      m.on('load', update)
    }
  }, [restaurants])

  /* -------------------------------------------------------------- */
  /*  Rebuild markers when savedIds change (heart badge)             */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    // Clear all HTML markers so they get recreated with updated saved status
    Object.values(markers.current).forEach(({ marker }) => marker.remove())
    markers.current = {}
    syncMarkers()
  }, [savedIds, syncMarkers])

  /* -------------------------------------------------------------- */
  /*  Update selected marker style                                   */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    Object.values(markers.current).forEach(({ el }) => {
      delete el.dataset.selected
    })
    if (selectedId && markers.current[selectedId]) {
      markers.current[selectedId].el.dataset.selected = 'true'
    }
  }, [selectedId])

  /* -------------------------------------------------------------- */
  /*  FlyTo selected restaurant                                      */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current || !selectedId) return

    const r = restaurantsRef.current?.find((r) => r.id === selectedId)
    if (!r) return

    map.current.flyTo({
      center: [r.longitude, r.latitude],
      zoom: Math.max(map.current.getZoom(), 15),
      duration: 1000,
      essential: true,
    })
  }, [selectedId])

  /* -------------------------------------------------------------- */
  /*  User position blue dot                                         */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!map.current) return

    if (userMarker.current) {
      userMarker.current.remove()
      userMarker.current = null
    }

    if (!userPosition) return

    const el = document.createElement('div')
    el.style.cssText = `
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #3B82F6;
      border: 3px solid #fff;
      box-shadow: 0 0 0 4px rgba(59,130,246,0.3);
      animation: chiamami-user-pulse 2s infinite;
    `

    userMarker.current = new mapboxgl.Marker({ element: el })
      .setLngLat([userPosition.lng, userPosition.lat])
      .addTo(map.current)
  }, [userPosition])

  if (!token) {
    return <PlaceholderMap restaurants={restaurants} className={className} />
  }

  return (
    <div
      ref={mapContainer}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  )
})

export default MapView
