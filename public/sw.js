const root = self.registration.scope
const prefix = 'mydiet:' + root
const cacheName = prefix + ':' + '__BUILD_VERSION__'
const assets = ['__BUILD_ASSETS__']
const assetUrls = new Set(assets.map(path => new URL(path, root).href))

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(root, {cache:'reload'})
    if (!response.ok) throw new Error('Unable to load app shell')
    const html = await response.clone().text()
    const actual = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map(match => match[1])
    if (actual.length !== assets.length || actual.some((path, index) => path !== assets[index])) {
      throw new Error('App shell does not match the worker build')
    }
    try {
      const cache = await caches.open(cacheName)
      await cache.addAll([...assetUrls].map(url => new Request(url, {cache:'reload'})))
      await cache.put(root, response)
    } catch (error) {
      await caches.delete(cacheName)
      throw error
    }
  })())
})

// Let the browser activate the update after all old app windows have closed.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key)
    }
  })())
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  const isShell = event.request.mode === 'navigate' &&
    (url.origin + url.pathname === root || url.origin + url.pathname === root + 'index.html')
  if (!isShell && !assetUrls.has(url.href)) return
  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    return await cache.match(isShell ? root : event.request) || fetch(event.request)
  })())
})
