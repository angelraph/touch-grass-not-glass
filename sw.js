// Cache the app shell so field mode works with zero signal.
const CACHE = 'touch-grass-v8';
const SHELL = [
  './', 'index.html', 'app.html', 'docs.html', 'app.js', 'ollama.js', 'store.js', 'manifest.webmanifest',
  'assets/base.css', 'assets/app.css', 'assets/site.css', 'assets/site.js',
  'assets/mark-96.png', 'assets/icon-192.png', 'assets/fonts/fraunces.woff2', 'assets/fonts/fraunces-italic.woff2', 'assets/fonts/inter.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network-first for the shell (fresh when online), cache when offline. Never touch model calls.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('.mp4')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
