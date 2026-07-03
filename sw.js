const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = 'doctor-yiyi-' + CACHE_VERSION;

var STATIC_ASSETS = [
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', function(event) {
    console.log('[SW] 安装中... 版本:', CACHE_VERSION);
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[SW] 预缓存静态资源');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(function(err) {
                console.log('[SW] 预缓存失败（非致命）:', err);
            })
    );
});

self.addEventListener('message', function(event) {
    if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
        self.skipWaiting();
    }
});

self.addEventListener('activate', function(event) {
    console.log('[SW] 激活中... 版本:', CACHE_VERSION);
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function(name) { return name.indexOf('doctor-yiyi-') === 0 && name !== CACHE_NAME; })
                        .map(function(name) {
                            console.log('[SW] 删除旧缓存:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(function() {
                console.log('[SW] 激活完成，已接管所有页面');
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

function createOfflineFallback() {
    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Doctor亿万 - 离线</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#FBF9FF 0%,#F3E8FF 100%);color:#334155;text-align:center;padding:24px}.container{max-width:320px}.icon{font-size:64px;margin-bottom:24px}h1{font-size:22px;font-weight:700;color:#6C3CE7;margin:0 0 12px}p{font-size:15px;line-height:1.6;color:#64748B;margin:0 0 24px}button{background:linear-gradient(135deg,#6C3CE7,#7C3AED);color:#fff;border:none;padding:14px 32px;border-radius:100px;font-size:15px;font-weight:600;cursor:pointer}button:active{transform:scale(0.97)}</style></head><body><div class="container"><div class="icon">🐾</div><h1>Doctor亿万</h1><p>当前无网络连接<br>请检查网络设置后重试</p><button onclick="location.reload()">重新加载</button></div></body></html>';
    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200
    });
}
