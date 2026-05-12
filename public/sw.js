// ChiamamiBi Service Worker — Push + Offline Shell
// Bump version to invalidate old caches on deploy.
const VERSION = 'v4-claim-fix'
const STATIC_CACHE = `chiamamibi-static-${VERSION}`
const RUNTIME_CACHE = `chiamamibi-runtime-${VERSION}`
const IMAGE_CACHE = `chiamamibi-img-${VERSION}`

// Minimal app shell pre-cache. Hashed JS/CSS are picked up at runtime.
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/favicon-192.png',
  '/favicon-512.png',
  '/logo-guida-bi.svg',
  '/icons.svg',
  '/bi-photo.webp',
  '/og-image.png',
]

// Hard cap so we don't fill the device storage with restaurant images.
// Bumped to fit hero photos served via /api/img on top of local assets.
const IMAGE_CACHE_LIMIT = 150

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length <= max) return
  for (const k of keys.slice(0, keys.length - max)) await cache.delete(k)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch(() => {})
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// Network/Cache strategy router
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip cross-origin + known dynamic endpoints
  if (url.origin !== self.location.origin) return

  // /api/img is the Supabase storage image proxy — cache aggressively under
  // IMAGE_CACHE so restaurant photos visited once load instantly on repeat
  // navigations (and survive offline). Match by full request (query string
  // included) since the proxy keys content by ?url=…
  if (url.pathname === '/api/img') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(IMAGE_CACHE).then(async (c) => {
              await c.put(request, copy)
              trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT)
            }).catch(() => {})
          }
          return res
        })
      })
    )
    return
  }

  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/auth/')) return

  // Navigation (HTML) → network-first, fallback to cached index
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    )
    return
  }

  // Hashed static assets from Vite build → cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
      })
    )
    return
  }

  // Same-origin images → cache-first with size cap (most are restaurant photos
  // proxied through /api/img which we already excluded above; these are local
  // SVG/PNG/WebP assets like the logo + bi-photo).
  if (/\.(svg|png|jpe?g|webp|gif|avif|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(IMAGE_CACHE).then(async (c) => {
              await c.put(request, copy)
              trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT)
            }).catch(() => {})
          }
          return res
        })
      })
    )
    return
  }

  // Web fonts → cache-first, never expire (versioned URLs from Google Fonts).
  if (/\.(woff2?|ttf|otf)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
      })
    )
  }
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'ChiamamiBi'
  const options = {
    body: data.body || '',
    icon: '/logo-bi.svg',
    badge: '/logo-bi.svg',
    tag: data.tag || 'chiamamibi',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
