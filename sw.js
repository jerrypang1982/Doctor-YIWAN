const CACHE_VERSION = 'v1.4.0';
const CACHE_NAME = `doctor-yiyi-${CACHE_VERSION}`;

// éœ€è¦ç¼“å­˜çš„å…³é”®èµ„æº
const STATIC_ASSETS = [
    './',
    './index.html',
    './doctor-yiyi-v3.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://webapi.amap.com/loader.js',
];

// å®‰è£…äº‹ä»¶ï¼šé¢„ç¼“å­˜å…³é”®èµ„æº
self.addEventListener('install', (event) => {
    console.log('[SW] å®‰è£…ä¸­... ç‰ˆæœ¬:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] é¢„ç¼“å­˜èµ„æº');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] é¢„ç¼“å­˜å®Œæˆ');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.log('[SW] é¢„ç¼“å­˜å¤±è´¥:', err);
            })
    );
});

// ç›‘å¬æ¥è‡ªé¡µé¢çš„æ¶ˆæ¯ï¼ˆå¼ºåˆ¶è·³è¿‡ç­‰å¾…ï¼‰
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// æ¿€æ´»äº‹ä»¶ï¼šæ¸…ç†æ—§ç¼“å­˜
self.addEventListener('activate', (event) => {
    console.log('[SW] æ¿€æ´»ä¸­...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('doctor-yiyi-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] åˆ é™¤æ—§ç¼“å­˜:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] æ¿€æ´»å®Œæˆ');
                return self.clients.claim();
            })
    );
});

// æ‹¦æˆªè¯·æ±‚ï¼šCache First ç­–ç•¥
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // åªå¤„ç†åŒæºçš„è¯·æ±‚å’Œå·²çŸ¥CDNèµ„æº
    const isSameOrigin = url.origin === self.location.origin;
    const isCdnAsset = [
        'cdn.tailwindcss.com',
        'cdnjs.cloudflare.com',
        'webapi.amap.com',
        'cdn.jsdelivr.net',
    ].some((domain) => url.hostname.includes(domain));

    if (!isSameOrigin && !isCdnAsset) {
        return; // ä¸å¤„ç†ç¬¬ä¸‰æ–¹APIè¯·æ±‚ï¼Œè®©å…¶ç›´æŽ¥èµ°ç½‘ç»œ
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // ç¼“å­˜å‘½ä¸­ï¼ŒåŽå°æ›´æ–°ç¼“å­˜ï¼ˆstale-while-revalidate for HTMLï¼‰
                    if (isSameOrigin && request.destination === 'document') {
                        // HTMLé¡µé¢ï¼šå…ˆè¿”å›žç¼“å­˜ï¼ŒåŽå°ç½‘ç»œæ›´æ–°
                        const fetchPromise = fetch(request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    const responseClone = networkResponse.clone();
                                    caches.open(CACHE_NAME).then((cache) => {
                                        cache.put(request, responseClone);
                                    });
                                }
                            })
                            .catch(() => {});
                        event.waitUntil(fetchPromise);
                    }
                    return cachedResponse;
                }

                // ç¼“å­˜æœªå‘½ä¸­ï¼šç½‘ç»œè¯·æ±‚
                return fetch(request)
                    .then((networkResponse) => {
                        // åªç¼“å­˜æˆåŠŸçš„GETè¯·æ±‚
                        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // ç½‘ç»œå¤±è´¥ + æ— ç¼“å­˜ï¼šè¿”å›žç¦»çº¿å›žé€€é¡µ
                        if (request.destination === 'document') {
                            return createOfflineFallback();
                        }
                        return new Response('ç¦»çº¿ä¸­', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// ç”Ÿæˆç¦»çº¿å›žé€€é¡µé¢
function createOfflineFallback() {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doctoräº¿ä¸‡ - ç¦»çº¿</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #FBF9FF 0%, #F3E8FF 100%);
            color: #334155;
            text-align: center;
            padding: 24px;
        }
        .container { max-width: 320px; }
        .icon { font-size: 64px; margin-bottom: 24px; }
        h1 { font-size: 22px; font-weight: 700; color: #6C3CE7; margin: 0 0 12px; }
        p { font-size: 15px; line-height: 1.6; color: #64748B; margin: 0 0 24px; }
        button {
            background: linear-gradient(135deg, #6C3CE7, #7C3AED);
            color: #fff;
            border: none;
            padding: 14px 32px;
            border-radius: 100px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(108,60,231,.3);
        }
        button:active { transform: scale(0.97); }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">ðŸ¾</div>
        <h1>Doctoräº¿ä¸‡</h1>
        <p>å½“å‰æ— ç½‘ç»œè¿žæŽ¥<br>è¯·æ£€æŸ¥ç½‘ç»œè®¾ç½®åŽé‡è¯•</p>
        <button onclick="location.reload()">é‡æ–°åŠ è½½</button>
    </div>
</body>
</html>`;
    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200,
    });
}
