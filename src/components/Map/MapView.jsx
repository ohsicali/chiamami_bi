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
const PIN_LAYER = 'restaurant-pins'
const HEART_LAYER = 'restaurant-hearts'

/* ------------------------------------------------------------------ */
/*  Generate pin image on canvas and add to map                        */
/* ------------------------------------------------------------------ */
function generatePinImage(emoji, borderColor, size = 40) {
  const scale = 2 // retina
  const s = size * scale
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')

  // White circle with colored border
  const borderW = 2.5 * scale
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - borderW / 2, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderW
  ctx.stroke()

  // Drop shadow (simple approximation)
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 4 * scale
  ctx.shadowOffsetY = 1 * scale

  // Emoji centered
  ctx.shadowColor = 'transparent'
  ctx.font = `${18 * scale}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, s / 2, s / 2 + 1 * scale)

  return { canvas, width: s, height: s }
}

function generateHeartImage() {
  const scale = 2
  const s = 16 * scale
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')

  // White circle
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5 * scale
  ctx.stroke()

  // Heart emoji
  ctx.font = `${9 * scale}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('❤️', s / 2, s / 2 + 1)

  return { canvas, width: s, height: s }
}

/* ------------------------------------------------------------------ */
/*  Build GeoJSON FeatureCollection from restaurant array              */
/* ------------------------------------------------------------------ */
function buildGeoJSON(restaurants, savedIds) {
  return {
    type: 'FeatureCollection',
    features: (restaurants || [])
      .filter((r) => r.latitude && r.longitude)
      .map((r) => {
        const primaryType = (r.category && r.category[0]) || r.cuisine_type
        const { emoji, color } = getCategoryInfo(primaryType)
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
          properties: {
            id: r.id,
            icon: `pin-${primaryType || 'default'}`,
            emoji,
            color,
            saved: savedIds?.has(r.id) ? 1 : 0,
          },
        }
      }),
  }
}

/* ------------------------------------------------------------------ */
/*  Ensure all category pin images are loaded into the map             */
/* ------------------------------------------------------------------ */
function ensurePinImages(map, restaurants) {
  const seen = new Set()
  for (const r of restaurants || []) {
    const primaryType = (r.category && r.category[0]) || r.cuisine_type
    const key = `pin-${primaryType || 'default'}`
    if (seen.has(key) || map.hasImage(key)) continue
    seen.add(key)

    const { emoji, color } = getCategoryInfo(primaryType)
    const { canvas, width, height } = generatePinImage(emoji, color)
    map.addImage(key, { width, height, data: canvas.getContext('2d').getImageData(0, 0, width, height).data }, { pixelRatio: 2 })
  }

  // Heart badge image
  if (!map.hasImage('heart-badge')) {
    const { canvas, width, height } = generateHeartImage()
    map.addImage('heart-badge', { width, height, data: canvas.getContext('2d').getImageData(0, 0, width, height).data }, { pixelRatio: 2 })
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
/*  MapView component — fully native Mapbox layers (no HTML markers)   */
/* ------------------------------------------------------------------ */
const MapView = forwardRef(function MapView({
  restaurants,
  selectedId,
  onSelectRestaurant,
  onVisibleRestaurantsChange,
  userPosition,
  savedIds,
  className,
}, ref) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const userMarker = useRef(null)
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const onSelectRef = useRef(onSelectRestaurant)
  onSelectRef.current = onSelectRestaurant
  const onVisibleRef = useRef(onVisibleRestaurantsChange)
  onVisibleRef.current = onVisibleRestaurantsChange
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
  /*  Notify parent about visible restaurants in viewport            */
  /* -------------------------------------------------------------- */
  const notifyVisible = useCallback(() => {
    const m = map.current
    if (!m || !onVisibleRef.current) return
    const rests = restaurantsRef.current || []
    const bounds = m.getBounds()
    const allVisibleIds = rests
      .filter((r) => r.latitude && r.longitude && bounds.contains([r.longitude, r.latitude]))
      .map((r) => r.id)
    const center = m.getCenter()
    onVisibleRef.current(allVisibleIds, { lng: center.lng, lat: center.lat })
  }, [])

  /* -------------------------------------------------------------- */
  /*  Initialize map + source + all layers                           */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!token || !mapContainer.current) return

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

      // Hide default POI labels
      m.getStyle().layers.forEach((layer) => {
        if (layer.id.includes('poi')) {
          m.setLayoutProperty(layer.id, 'visibility', 'none')
        }
      })

      // Generate pin images for all restaurant categories
      ensurePinImages(m, restaurantsRef.current)

      // Add GeoJSON source with clustering
      m.addSource(SOURCE_ID, {
        type: 'geojson',
        data: buildGeoJSON(restaurantsRef.current, savedIdsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      // --- Cluster circle ---
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
        },
      })

      // --- Cluster count label ---
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

      // --- Individual restaurant pins (symbol layer) ---
      m.addLayer({
        id: PIN_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })

      // --- Heart badge for saved restaurants ---
      m.addLayer({
        id: HEART_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'saved'], 1]],
        layout: {
          'icon-image': 'heart-badge',
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-offset': [12, -12], // top-right of the pin
        },
      })

      // --- Click on cluster → zoom to expand ---
      m.on('click', CLUSTER_LAYER, (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] })
        if (!features.length) return
        const clusterId = features[0].properties.cluster_id
        m.getSource(SOURCE_ID).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          m.easeTo({ center: features[0].geometry.coordinates, zoom, duration: 500 })
        })
      })

      // --- Click on restaurant pin ---
      m.on('click', PIN_LAYER, (e) => {
        if (!e.features?.length) return
        const id = e.features[0].properties.id
        if (id) onSelectRef.current?.(id)
      })

      // Cursor feedback
      m.on('mouseenter', CLUSTER_LAYER, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', CLUSTER_LAYER, () => { m.getCanvas().style.cursor = '' })
      m.on('mouseenter', PIN_LAYER, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', PIN_LAYER, () => { m.getCanvas().style.cursor = '' })

      // Notify parent about visible restaurants
      m.on('moveend', notifyVisible)
      m.on('idle', notifyVisible)
    })

    return () => {
      userMarker.current?.remove()
      userMarker.current = null
      map.current?.remove()
      map.current = null
    }
  }, [token, notifyVisible])

  /* -------------------------------------------------------------- */
  /*  Update source data when restaurants or savedIds change          */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const m = map.current
    if (!m) return

    const update = () => {
      ensurePinImages(m, restaurants)
      const src = m.getSource(SOURCE_ID)
      if (src) {
        src.setData(buildGeoJSON(restaurants, savedIds))
      }
    }

    if (m.isStyleLoaded() && m.getSource(SOURCE_ID)) {
      update()
    } else {
      m.on('load', update)
    }
  }, [restaurants, savedIds])

  /* -------------------------------------------------------------- */
  /*  Highlight selected pin                                         */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const m = map.current
    if (!m || !m.getLayer(PIN_LAYER)) return

    // Use a filter or icon-size expression to highlight selected
    if (selectedId) {
      m.setLayoutProperty(PIN_LAYER, 'icon-size', [
        'case', ['==', ['get', 'id'], selectedId], 1.3, 1
      ])
    } else {
      m.setLayoutProperty(PIN_LAYER, 'icon-size', 1)
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
    // Inject pulse animation if needed
    if (!document.getElementById('chiamami-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'chiamami-pulse-style'
      style.textContent = `
        @keyframes chiamami-user-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.15); }
        }
      `
      document.head.appendChild(style)
    }

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
