const CACHE_VERSION = 'v3.3.0';
const CACHE_NAME = 'doctor-yiyi-' + CACHE_VERSION;

var STATIC_ASSETS = [
    './manifest.json',
    './tailwind.min.js',
    './fontawesome.min.css',
    './supabase.min.js',
    './webfonts/fa-solid-900.woff2',
    './webfonts/fa-regular-400.woff2',
    './webfonts/fa-brands-400.woff2'
];

self.addEventListener('install', function(event) {
    console.log('[SW] install, version: ' + CACHE_VERSION);
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            console.log('[SW] pre-cache static assets');
            return cache.addAll(STATIC_ASSETS);
        }).catch(function(err) {
            console.log('[SW] pre-cache failed (non-fatal): ' + err);
        })
    );
});

self.addEventListener('message', function(event) {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', function(event) {
    console.log('[SW] activate, version: ' + CACHE_VERSION);
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(name) {
                    return name.indexOf('doctor-yiyi-') === 0 && name !== CACHE_NAME;
                }).map(function(name) {
                    console.log('[SW] delete old cache: ' + name);
                    return caches.delete(name);
                })
            );
        }).then(function() {
            console.log('[SW] activated, claiming clients');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    var request = event.request;
    var url;
    try {
        url = new URL(request.url);
    } catch(e) {
        return;
    }

    var isSameOrigin = url.origin === self.location.origin;
    var isCdnAsset = ['webapi.amap.com', 'cdn.jsdelivr.net', 'unpkg.com'].some(function(domain) {
        return url.hostname.indexOf(domain) !== -1;
    });

    if (!isSameOrigin && !isCdnAsset) {
        return;
    }

    if (isSameOrigin && request.destination === 'document') {
        event.respondWith(
            fetch(request).then(function(networkResponse) {
                if (networkResponse && networkResponse.status === 200) {
                    var copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(request, copy);
                    });
                }
                return networkResponse;
            }).catch(function() {
                return caches.match(request).then(function(cached) {
                    if (cached) return cached;
                    return new Response('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Doctoräº¿ä¸‡ - ç¦»çº¿</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f3e8ff;color:#334155;text-align:center;padding:24px}h1{font-size:22px;font-weight:700;color:#6C3CE7;margin:0 0 12px}p{font-size:15px;line-height:1.6;color:#64748B;margin:0 0 24px}</style></head><body><h1>Doctoräº¿ä¸‡</h1><p>å½“å‰æ— ç½‘ç»œè¿žæŽ¥<br>è¯·æ£€æŸ¥ç½‘ç»œè®¾ç½®åŽé‡è¯•</p></body></html>', {
                        headers: {'Content-Type': 'text/html; charset=utf-8'},
                        status: 200
                    });
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(function(cachedResponse) {
            if (cachedResponse) {
                var fetchPromise = fetch(request).then(function(networkResponse) {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                        var copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(request, copy);
                        });
                    }
                    return networkResponse;
                }).catch(function() { return null; });
                event.waitUntil(fetchPromise);
                return cachedResponse;
            }
            return fetch(request).then(function(networkResponse) {
                if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
                    var copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(request, copy);
                    });
                }
                return networkResponse;
            }).catch(function() {
                if (request.destination === 'document') {
                    return new Response('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title></head><body><p>No connection</p></body></html>', {
                        headers: {'Content-Type': 'text/html; charset=utf-8'},
                        status: 200
                    });
                }
                return new Response('', {status: 503, statusText: 'Service Unavailable'});
            });
        })
    );
});
