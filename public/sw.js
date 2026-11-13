const prefix = 'mydiet:' + self.registration.scope
const cacheName = prefix + ':v1'
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const root = self.registration.scope
    const response = await fetch(root, {cache:'reload'})
    if (!response.ok) throw new Error('Unable to cache app shell')
    const html = await response.clone().text()
    const cache = await caches.open(cacheName)
    const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map(match => new URL(match[1], root).href)
    await cache.addAll(assets)
    await cache.put(root, response)
    await self.skipWaiting()
  })())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key)
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return
  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request) }
      catch { return await cache.match(self.registration.scope) || Response.error() }
    }
    return await cache.match(event.request) || fetch(event.request)
  })())
})

