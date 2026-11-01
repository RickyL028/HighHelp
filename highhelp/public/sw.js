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

// Timetable change alerts (src/timetablePush.ts). Every push must show a notification: iOS revokes the
// subscription of a web app that receives pushes silently.
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {}
    event.waitUntil(self.registration.showNotification(data.title || 'HighHelp', {
        body: data.body || '',
        icon: '/icon-2.png',
        badge: '/icon-2.png',
        tag: data.tag,
        renotify: !!data.tag,
        data: { url: data.url || '/timetable' }
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = new URL((event.notification.data && event.notification.data.url) || '/timetable', self.location.origin);
    // Only ever open our own pages.
    if (url.origin !== self.location.origin) return;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const open = windows.find((w) => new URL(w.url).origin === url.origin);
        if (open) {
            try {
                // navigate() only works on windows this worker controls.
                const target = open.url === url.href ? open : await open.navigate(url.href);
                if (target) {
                    await target.focus();
                    return;
                }
            } catch (e) {}
        }
        await self.clients.openWindow(url.href);
    })());
});

// The push service rotated this device's subscription: re-register it so alerts keep arriving.
self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil((async () => {
        const old = event.oldSubscription;
        const options = old ? old.options : null;
        if (!options || !options.applicationServerKey) return;
        const sub = event.newSubscription || await self.registration.pushManager.subscribe(options);
        await fetch('/api/auth/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON(), replaces: old.endpoint })
        });
    })());
});
