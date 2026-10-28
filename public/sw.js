/* Service worker: alleen voor als er GEEN internet is.
   Pagina's komen altijd gewoon van de server; lukt dat niet omdat er geen verbinding is (wifi weg, vliegtuigmodus),
   dan toont hij offline.html (QR Runner) en laadt de pagina vanzelf opnieuw zodra de verbinding terug is.
   Niets anders wordt bewaard: geen oude versies van de app, geen API-antwoorden. */
const CACHE = 'qrc-offline-8dff0d8459';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request('/offline.html', { cache: 'reload' }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate' || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match('/offline.html').then((r) => r || Response.error())));
});
