import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { CUISINE_CATEGORIES } from '../../lib/hooks/useRestaurants'

const TORINO_CENTER = [7.6869, 45.0703]
const ACCENT_COLOR = '#E85D3A'

function getCategoryInfo(cuisineType) {
  const cat = CUISINE_CATEGORIES.find((c) => c.name === cuisineType)
  return cat || { emoji: '🍴', color: '#9CA3AF' }
}

function createPinElement(restaurant, isSelected) {
  const { emoji, color } = getCategoryInfo(restaurant.cuisine_type)

  const el = document.createElement('div')
  el.className = 'chiamami-pin'
  el.dataset.restaurantId = restaurant.id
  el.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #fff;
    border: 2.5px solid ${color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    user-select: none;
    position: relative;
  `

  el.innerHTML = `<span style="line-height:1">${emoji}</span>`

  if (isSelected) {
    applySelectedStyle(el, color)
  }

  el.addEventListener('mouseenter', () => {
    if (!el.dataset.selected) {
      el.style.transform = 'scale(1.1)'
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
    }
  })
  el.addEventListener('mouseleave', () => {
    if (!el.dataset.selected) {
      el.style.transform = 'scale(1)'
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
    }
  })

  return el
}

function applySelectedStyle(el, color) {
  el.dataset.selected = 'true'
  el.style.transform = 'scale(1.25)'
  el.style.boxShadow = `0 0 0 3px ${ACCENT_COLOR}44, 0 4px 16px rgba(0,0,0,0.3)`
  el.style.borderColor = ACCENT_COLOR
  el.style.zIndex = '10'
  el.style.animation = 'chiamami-pin-pulse 2s infinite'
}

function removeSelectedStyle(el, color) {
  delete el.dataset.selected
  el.style.transform = 'scale(1)'
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
  el.style.borderColor = color
  el.style.zIndex = ''
  el.style.animation = ''
}

// Inject keyframes once
const STYLE_ID = 'chiamami-pin-styles'
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
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

function PlaceholderMap({ restaurants, className }) {
  const categories = CUISINE_CATEGORIES
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
      {/* Decorative dots representing restaurants */}
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

      {/* Message overlay */}
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

export default function MapView({
  restaurants,
  selectedId,
  onSelectRestaurant,
  userPosition,
  className,
}) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef([]) // { marker, restaurant, el }
  const userMarker = useRef(null)
  const token = import.meta.env.VITE_MAPBOX_TOKEN

  // Initialize map
  useEffect(() => {
    if (!token || !mapContainer.current) return

    ensureStyles()
    mapboxgl.accessToken = token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: TORINO_CENTER,
      zoom: 13,
      pitch: 15,
    })

    map.current.on('load', () => {
      // Hide default POI labels to avoid clutter
      const layers = map.current.getStyle().layers
      layers.forEach((layer) => {
        if (layer.id.includes('poi')) {
          map.current.setLayoutProperty(layer.id, 'visibility', 'none')
        }
      })

      // Add clustered GeoJSON source
      map.current.addSource('restaurants-cluster', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      // Cluster circle layer
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'restaurants-cluster',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ACCENT_COLOR,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            5, 22,
            10, 28,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })

      // Cluster count label layer
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'restaurants-cluster',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })

      // Click clusters to zoom in
      map.current.on('click', 'clusters', (e) => {
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        })
        if (!features.length) return
        const clusterId = features[0].properties.cluster_id
        map.current
          .getSource('restaurants-cluster')
          .getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return
            map.current.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom,
              duration: 1000,
            })
          })
      })

      // Pointer cursor on clusters
      map.current.on('mouseenter', 'clusters', () => {
        map.current.getCanvas().style.cursor = 'pointer'
      })
      map.current.on('mouseleave', 'clusters', () => {
        map.current.getCanvas().style.cursor = ''
      })
    })

    return () => {
      markers.current.forEach(({ marker }) => marker.remove())
      markers.current = []
      userMarker.current?.remove()
      userMarker.current = null
      map.current?.remove()
      map.current = null
    }
  }, [token])

  // Update markers and cluster source when restaurants change
  useEffect(() => {
    if (!map.current || !restaurants?.length) return

    const onReady = () => {
      // Remove old markers
      markers.current.forEach(({ marker }) => marker.remove())
      markers.current = []

      // Update cluster source
      const source = map.current.getSource('restaurants-cluster')
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: restaurants.map((r) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [r.longitude, r.latitude],
            },
            properties: { id: r.id },
          })),
        })
      }

      // Create individual markers (visible only when unclustered)
      restaurants.forEach((r) => {
        const isSelected = r.id === selectedId
        const el = createPinElement(r, isSelected)

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRestaurant?.(r.id)
        })

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([r.longitude, r.latitude])
          .addTo(map.current)

        markers.current.push({ marker, restaurant: r, el })
      })
    }

    if (map.current.isStyleLoaded()) {
      onReady()
    } else {
      map.current.on('load', onReady)
    }
  }, [restaurants, selectedId, onSelectRestaurant])

  // Update selected marker styles when selectedId changes
  useEffect(() => {
    markers.current.forEach(({ restaurant, el }) => {
      const { color } = getCategoryInfo(restaurant.cuisine_type)
      if (restaurant.id === selectedId) {
        applySelectedStyle(el, color)
      } else {
        removeSelectedStyle(el, color)
      }
    })
  }, [selectedId])

  // FlyTo selected restaurant
  useEffect(() => {
    if (!map.current || !selectedId || !restaurants?.length) return

    const restaurant = restaurants.find((r) => r.id === selectedId)
    if (!restaurant) return

    map.current.flyTo({
      center: [restaurant.longitude, restaurant.latitude],
      zoom: 15,
      duration: 1000,
      essential: true,
    })
  }, [selectedId, restaurants])

  // User position blue dot
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
}
