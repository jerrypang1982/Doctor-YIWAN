const CACHE_VERSION = 'v1.8.0';
const CACHE_NAME = 'doctor-yiyi-' + CACHE_VERSION;

// ä»…ç¼“å­˜é™æ€èµ„æºï¼Œç»å¯¹ä¸ç¼“å­˜ HTML
var STATIC_ASSETS = [
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// å®‰è£…äº‹ä»¶ï¼šç«‹å³è·³è¿‡ç­‰å¾…
self.addEventListener('install', function(event) {
    console.log('[SW] å®‰è£…ä¸­... ç‰ˆæœ¬:', CACHE_VERSION);
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[SW] é¢„ç¼“å­˜é™æ€èµ„æº');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(function(err) {
                console.log('[SW] é¢„ç¼“å­˜å¤±è´¥ï¼ˆéžè‡´å‘½ï¼‰:', err);
            })
    );
});

// ç›‘å¬æ¥è‡ªé¡µé¢çš„æ¶ˆæ¯
self.addEventListener('message', function(event) {
    if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
        self.skipWaiting();
    }
});

// æ¿€æ´»äº‹ä»¶ï¼šæ¸…ç†æ‰€æœ‰æ—§ç¼“å­˜ + ç«‹å³æŽ¥ç®¡
self.addEventListener('activate', function(event) {
    console.log('[SW] æ¿€æ´»ä¸­... ç‰ˆæœ¬:', CACHE_VERSION);
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function(name) { return name.indexOf('doctor-yiyi-') === 0 && name !== CACHE_NAME; })
                        .map(function(name) {
                            console.log('[SW] åˆ é™¤æ—§ç¼“å­˜:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(function() {
                console.log('[SW] æ¿€æ´»å®Œæˆï¼Œå·²æŽ¥ç®¡æ‰€æœ‰é¡µé¢');
                return self.clients.claim();
            })
    );
});

// æ‹¦æˆªè¯·æ±‚
self.addEventListener('fetch', function(event) {
    var request = event.request;
    var url;
    try {
        url = new URL(request.url);
    } catch(e) {
        return;
    }

    var isSameOrigin = url.origin === self.location.origin;
    var isCdnAsset = [
        'cdn.tailwindcss.com',
        'cdnjs.cloudflare.com',
        'webapi.amap.com',
        'cdn.jsdelivr.net',
        'unpkg.com'
    ].some(function(domain) { return url.hostname.indexOf(domain) !== -1; });

    if (!isSameOrigin && !isCdnAsset) {
        return;
    }

    // HTMLæ–‡æ¡£ï¼šNetwork Firstï¼ˆå§‹ç»ˆä»Žç½‘ç»œèŽ·å–æœ€æ–°ï¼‰
    if (isSameOrigin && request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then(function(networkResponse) {
                    if (networkResponse && networkResponse.status === 200) {
                        var responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(function() {
                    return caches.match(request).then(function(cached) {
                        if (cached) return cached;
                        return createOfflineFallback();
                    });
                })
        );
        return;
    }

    // å…¶ä»–èµ„æºï¼šCache First
    event.respondWith(
        caches.match(request)
            .then(function(cachedResponse) {
                if (cachedResponse) {
                    var fetchPromise = fetch(request)
                        .then(function(networkResponse) {
                            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                                var responseClone = networkResponse.clone();
                                caches.open(CACHE_NAME).then(function(cache) {
                                    cache.put(request, responseClone);
                                });
                            }
                            return networkResponse;
                        })
                        .catch(function() { return null; });
                    event.waitUntil(fetchPromise);
                    return cachedResponse;
                }
                return fetch(request)
                    .then(function(networkResponse) {
                        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
                            var responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then(function(cache) {
                                cache.put(request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(function() {
                        if (request.destination === 'document') {
                            return createOfflineFallback();
                        }
                        return new Response('', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});

// ç¦»çº¿å›žé€€é¡µé¢
function createOfflineFallback() {
    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Doctoräº¿ä¸‡ - ç¦»çº¿</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#FBF9FF 0%,#F3E8FF 100%);color:#334155;text-align:center;padding:24px}.container{max-width:320px}.icon{font-size:64px;margin-bottom:24px}h1{font-size:22px;font-weight:700;color:#6C3CE7;margin:0 0 12px}p{font-size:15px;line-height:1.6;color:#64748B;margin:0 0 24px}button{background:linear-gradient(135deg,#6C3CE7,#7C3AED);color:#fff;border:none;padding:14px 32px;border-radius:100px;font-size:15px;font-weight:600;cursor:pointer}button:active{transform:scale(0.97)}</style></head><body><div class="container"><div class="icon">ðŸ¾</div><h1>Doctoräº¿ä¸‡</h1><p>å½“å‰æ— ç½‘ç»œè¿žæŽ¥<br>è¯·æ£€æŸ¥ç½‘ç»œè®¾ç½®åŽé‡è¯•</p><button onclick="location.reload()">é‡æ–°åŠ è½½</button></div></body></html>';
    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200
    });
}
