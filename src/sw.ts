/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

const PAGE_CACHE = 'app-pages'

self.skipWaiting()
clientsClaim()

// Drop saved HTML when a new build takes over, so an offline launch cannot
// open a page that points at assets from the previous build.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(PAGE_CACHE))
})

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: PAGE_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [200] }),
      {
        handlerDidError: async () => {
          const cache = await caches.open(PAGE_CACHE)
          const keys = await cache.keys()
          const latest = keys[keys.length - 1]
          if (!latest) return undefined
          return cache.match(latest)
        },
      },
    ],
  }),
)

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)
