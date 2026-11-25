'use strict';
// Bump VERSION whenever any application file changes before deployment.
const VERSION = '1.0.0';
const SCOPE = self.registration.scope;
const PREFIX = `x-half-hyperfocale:${SCOPE}:`;
const CACHE = `${PREFIX}${VERSION}`;
const FILES = [
  './', './index.html', './style.css', './calculations.js', './app.js',
  './manifest.webmanifest', './installation.html', './icons/icon.svg',
  './icons/apple-touch-icon.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable-512.png'
].map(path => new URL(path, SCOPE).href);

async function fillCache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' })));
}
self.addEventListener('install', event => {
  // addAll is atomic: a failed response prevents a partially installed shell.
  event.waitUntil(fillCache());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  url.hash = '';
  if (!FILES.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(url.href);
    return cached || fetch(event.request);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === 'CHECK_CACHE') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const matches = await Promise.all(FILES.map(url => cache.match(url)));
      event.ports[0]?.postMessage({ ready: matches.every(Boolean), version: VERSION });
    })().catch(() => event.ports[0]?.postMessage({ ready: false })));
  } else if (event.data?.type === 'REPAIR_CACHE') {
    event.waitUntil(fillCache().then(
      () => event.ports[0]?.postMessage({ ready: true }),
      () => event.ports[0]?.postMessage({ ready: false })
    ));
  }
});
