const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `doctor-yiyi-${CACHE_VERSION}`;

// 需要缓存的关键资源
const STATIC_ASSETS = [
    './',
    './doctor-yiyi-v3.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://webapi.amap.com/loader.js',
];

// 安装事件：预缓存关键资源
self.addEventListener('install', (event) => {
    console.log('[SW] 安装中...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] 预缓存资源');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] 预缓存完成');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.log('[SW] 预缓存失败:', err);
            })
    );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('[SW] 激活中...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('doctor-yiyi-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] 删除旧缓存:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] 激活完成');
                return self.clients.claim();
            })
    );
});

// 拦截请求：Cache First 策略
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 只处理同源的请求和已知CDN资源
    const isSameOrigin = url.origin === self.location.origin;
    const isCdnAsset = [
        'cdn.tailwindcss.com',
        'cdnjs.cloudflare.com',
        'webapi.amap.com',
        'cdn.jsdelivr.net',
    ].some((domain) => url.hostname.includes(domain));

    if (!isSameOrigin && !isCdnAsset) {
        return; // 不处理第三方API请求，让其直接走网络
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // 缓存命中，后台更新缓存（stale-while-revalidate for HTML）
                    if (isSameOrigin && request.destination === 'document') {
                        // HTML页面：先返回缓存，后台网络更新
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

                // 缓存未命中：网络请求
                return fetch(request)
                    .then((networkResponse) => {
                        // 只缓存成功的GET请求
                        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // 网络失败 + 无缓存：返回离线回退页
                        if (request.destination === 'document') {
                            return createOfflineFallback();
                        }
                        return new Response('离线中', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// 生成离线回退页面
function createOfflineFallback() {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doctor亿万 - 离线</title>
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
        <div class="icon">🐾</div>
        <h1>Doctor亿万</h1>
        <p>当前无网络连接<br>请检查网络设置后重试</p>
        <button onclick="location.reload()">重新加载</button>
    </div>
</body>
</html>`;
    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200,
    });
}
