import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Supercluster from 'supercluster'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'

const TORINO_CENTER = [7.6869, 45.0703]
const ACCENT_COLOR = '#FF5757'
const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'
const SOURCE_ID = 'restaurants-source'
const PIN_LAYER = 'restaurant-pins'
const HEART_LAYER = 'restaurant-hearts'

/* ------------------------------------------------------------------ */
/*  Canvas image generators                                            */
/* ------------------------------------------------------------------ */
function generatePinImage(emoji, borderColor, size = 40) {
  const scale = 2
  const s = size * scale
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 6 * scale
  ctx.shadowOffsetY = 2 * scale

  // White circle
  const borderW = 2.5 * scale
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - borderW / 2 - 2 * scale, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderW
  ctx.stroke()

  // Emoji
  ctx.shadowColor = 'transparent'
  ctx.font = `${18 * scale}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, s / 2, s / 2 + 1 * scale)

  return canvas
}

function generateClusterImage(count, size = 44) {
  const scale = 2
  const s = size * scale
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 6 * scale
  ctx.shadowOffsetY = 2 * scale

  // White circle with accent border
  const borderW = 2.5 * scale
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - borderW / 2 - 2 * scale, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = ACCENT_COLOR
  ctx.lineWidth = borderW
  ctx.stroke()

  // Count number
  ctx.shadowColor = 'transparent'
  const text = count > 99 ? '99+' : String(count)
  ctx.font = `bold ${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ACCENT_COLOR
  ctx.fillText(text, s / 2, s / 2 + 1 * scale)

  return canvas
}

function generateHeartImage() {
  const scale = 2
  const s = 18 * scale
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')

  // White circle with shadow
  ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur = 3 * scale
  ctx.shadowOffsetY = 1 * scale
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - 2 * scale, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()

  // Heart emoji
  ctx.shadowColor = 'transparent'
  ctx.font = `${10 * scale}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('❤️', s / 2, s / 2)

  return canvas
}

/* ------------------------------------------------------------------ */
/*  Add canvas image to map                                            */
/* ------------------------------------------------------------------ */
function addCanvasImage(map, id, canvas) {
  if (map.hasImage(id)) return
  const ctx = canvas.getContext('2d')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  map.addImage(id, { width: canvas.width, height: canvas.height, data: data.data }, { pixelRatio: 2 })
}

/* ------------------------------------------------------------------ */
/*  Ensure all needed images exist in the map                          */
/* ------------------------------------------------------------------ */
function ensureImages(map, restaurants) {
  // Pin images per category
  const seen = new Set()
  for (const r of restaurants || []) {
    const primaryType = (r.category && r.category[0]) || r.cuisine_type
    const key = `pin-${primaryType || 'default'}`
    if (seen.has(key)) continue
    seen.add(key)
    if (map.hasImage(key)) continue
    const { emoji, color } = getCategoryInfo(primaryType)
    addCanvasImage(map, key, generatePinImage(emoji, color))
  }

  // Heart badge
  if (!map.hasImage('heart-badge')) {
    addCanvasImage(map, 'heart-badge', generateHeartImage())
  }
}

/* ------------------------------------------------------------------ */
/*  Ensure cluster count images exist (generated on demand)            */
/* ------------------------------------------------------------------ */
function ensureClusterImage(map, count) {
  const key = `cluster-${count}`
  if (map.hasImage(key)) return key
  const size = count >= 10 ? 48 : 44
  addCanvasImage(map, key, generateClusterImage(count, size))
  return key
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
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1F2937', margin: '0 0 8px' }}>
          Configura il token Mapbox
        </h3>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.5 }}>
          Aggiungi la variabile{' '}
          <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}>
            VITE_MAPBOX_TOKEN
          </code>{' '}
          al file{' '}
          <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}>
            .env
          </code>{' '}
          per visualizzare la mappa.
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
/*  MapView — client-side clustering with supercluster                 */
/*  Single GeoJSON source, single symbol layer = zero overlap          */
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
  const cluster = useRef(null)    // Supercluster instance
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
  /*  Build supercluster input points from restaurants               */
  /* -------------------------------------------------------------- */
  const buildPoints = useCallback(() => {
    const rests = restaurantsRef.current || []
    const saved = savedIdsRef.current
    return rests
      .filter((r) => r.latitude && r.longitude)
      .map((r) => {
        const primaryType = (r.category && r.category[0]) || r.cuisine_type
        const { color } = getCategoryInfo(primaryType)
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
          properties: {
            id: r.id,
            icon: `pin-${primaryType || 'default'}`,
            color,
            saved: saved?.has(r.id) ? 1 : 0,
            isCluster: false,
          },
        }
      })
  }, [])

  /* -------------------------------------------------------------- */
  /*  Update the GeoJSON source with current clusters for this zoom  */
  /*  Uses a wide bbox so features stay visible during panning       */
  /* -------------------------------------------------------------- */
  const lastZoom = useRef(null)

  const updateSource = useCallback(() => {
    const m = map.current
    const sc = cluster.current
    if (!m || !sc || !m.getSource(SOURCE_ID)) return

    const zoom = Math.floor(m.getZoom())
    const bounds = m.getBounds()

    // Expand bbox by ~50% so pins are ready before they scroll into view
    const lngPad = (bounds.getEast() - bounds.getWest()) * 0.5
    const latPad = (bounds.getNorth() - bounds.getSouth()) * 0.5
    const bbox = [
      bounds.getWest() - lngPad,
      bounds.getSouth() - latPad,
      bounds.getEast() + lngPad,
      bounds.getNorth() + latPad,
    ]

    const features = sc.getClusters(bbox, zoom)

    for (const f of features) {
      if (f.properties.cluster) {
        const count = f.properties.point_count
        f.properties.icon = ensureClusterImage(m, count)
        f.properties.isCluster = true
        f.properties.saved = 0
      }
    }

    m.getSource(SOURCE_ID).setData({
      type: 'FeatureCollection',
      features,
    })

    lastZoom.current = zoom

    // Notify parent about visible restaurants
    if (onVisibleRef.current) {
      const rests = restaurantsRef.current || []
      const allVisibleIds = rests
        .filter((r) => r.latitude && r.longitude && bounds.contains([r.longitude, r.latitude]))
        .map((r) => r.id)
      const center = m.getCenter()
      onVisibleRef.current(allVisibleIds, { lng: center.lng, lat: center.lat })
    }
  }, [])

  // Lightweight check: only update during zoom if zoom level actually changed
  const onZoom = useCallback(() => {
    const m = map.current
    if (!m) return
    const zoom = Math.floor(m.getZoom())
    if (zoom !== lastZoom.current) {
      updateSource()
    }
  }, [updateSource])

  /* -------------------------------------------------------------- */
  /*  Rebuild supercluster index                                     */
  /* -------------------------------------------------------------- */
  const rebuildIndex = useCallback(() => {
    const points = buildPoints()
    const sc = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
    })
    sc.load(points)
    cluster.current = sc
    updateSource()
  }, [buildPoints, updateSource])

  /* -------------------------------------------------------------- */
  /*  Initialize map                                                 */
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

      // Ensure pin images
      ensureImages(m, restaurantsRef.current)

      // Empty source — will be filled by updateSource()
      m.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Single symbol layer for both clusters and pins
      m.addLayer({
        id: PIN_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['case',
            ['boolean', ['get', 'isCluster'], false], 1,
            1,
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })

      // Heart badge layer (only for non-cluster saved restaurants)
      m.addLayer({
        id: HEART_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['all', ['==', ['get', 'saved'], 1], ['==', ['get', 'isCluster'], false]],
        layout: {
          'icon-image': 'heart-badge',
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-offset': [14, -14],
        },
      })

      // Click on pin or cluster
      m.on('click', PIN_LAYER, (e) => {
        if (!e.features?.length) return
        const props = e.features[0].properties

        if (props.isCluster || props.cluster_id) {
          // Zoom into cluster
          const clusterId = props.cluster_id
          const sc = cluster.current
          if (sc && clusterId != null) {
            const expansionZoom = sc.getClusterExpansionZoom(clusterId)
            m.easeTo({
              center: e.features[0].geometry.coordinates,
              zoom: expansionZoom,
              duration: 500,
            })
          }
        } else if (props.id) {
          onSelectRef.current?.(props.id)
        }
      })

      // Cursor
      m.on('mouseenter', PIN_LAYER, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', PIN_LAYER, () => { m.getCanvas().style.cursor = '' })

      // During zoom: update only when integer zoom level changes (clusters change)
      m.on('zoom', onZoom)
      // After any movement ends: update for new viewport
      m.on('moveend', updateSource)

      // Build initial index
      rebuildIndex()
    })

    return () => {
      userMarker.current?.remove()
      userMarker.current = null
      map.current?.remove()
      map.current = null
      cluster.current = null
    }
  }, [token, updateSource, onZoom, rebuildIndex])

  /* -------------------------------------------------------------- */
  /*  Rebuild index when restaurants or savedIds change               */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const m = map.current
    if (!m) return

    if (m.isStyleLoaded() && m.getSource(SOURCE_ID)) {
      ensureImages(m, restaurants)
      rebuildIndex()
    } else {
      const handler = () => {
        ensureImages(m, restaurants)
        rebuildIndex()
      }
      m.on('load', handler)
      return () => m.off('load', handler)
    }
  }, [restaurants, savedIds, rebuildIndex])

  /* -------------------------------------------------------------- */
  /*  Highlight selected pin                                         */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const m = map.current
    if (!m || !m.getLayer(PIN_LAYER)) return

    if (selectedId) {
      m.setLayoutProperty(PIN_LAYER, 'icon-size', [
        'case',
        ['==', ['get', 'id'], selectedId], 1.3,
        1,
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
