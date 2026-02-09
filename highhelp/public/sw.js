// Basic Service Worker for PWA installation
const CACHE_NAME = 'highhelp-v1';

self.addEventListener('install', (event) => {
    // Perform install steps
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Respond with cached resources if needed, otherwise fetch from network
    // For now, we just fetch from network
    event.respondWith(fetch(event.request).catch(() => {
        return caches.match(event.request);
    }));
});
