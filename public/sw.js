/**
 * Service Worker for Offline Functionality
 * 
 * Features:
 * - Caches static assets for offline use
 * - Model downloads pass through untouched (engines cache in OPFS)
 * - Provides fallback responses when offline
 */

// The version placeholder is replaced by scripts/set-sw-version.mjs during
// the build (dist/sw.js): every release gets its own cache name, so browser
// updates apply reliably and stale caches are cleaned up by the activate
// handler below.
const CACHE_NAME = 'llm-webgui-v__APP_VERSION__';

// Static assets to cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached successfully');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Also purges the legacy 'llm-models-v1' cache - model
                        // files are cached by the inference engines in OPFS,
                        // not by this service worker.
                        if (cacheName !== CACHE_NAME) {
                            console.log(`[SW] Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                        return Promise.resolve();
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim(); // Take control of all clients
            })
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const request = event.request;
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Navigations (page loads) are network-first so new deployments are
    // picked up immediately. A cache-first '/' would keep serving a stale
    // index.html that references deleted asset files (white page).
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.put('/', clone))
                            .catch(() => {});
                    }
                    return response;
                })
                .catch(() =>
                    caches.match(request).then((cached) => cached || caches.match('/'))
                )
        );
        return;
    }

    // Handle static assets with cache-first strategy
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    if (response) {
                        return response;
                    }
                    
                    // Cache and return from network
                    return fetchAndCache(request, CACHE_NAME);
                })
        );
        return;
    }

    // Model files (.gguf, MLC .bin shards) are deliberately NOT intercepted:
    // both inference engines (wllama, WebLLM) cache models in OPFS themselves.
    // Routing the huge downloads through caches.match()/cache.put() here
    // would hold the response back from the page until the entire file has
    // been buffered, which breaks download progress reporting completely.

    // Default: network-first
    event.respondWith(
        fetch(request)
            .catch(() => {
                // If network fails, try cache
                return caches.match(request)
                    .then((response) => response || createFallbackResponse(url));
            })
    );
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Received skip waiting message');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEANUP_CACHE') {
        console.log('[SW] Received cleanup cache message');
        cleanupCache();
    }
});

// Helper functions
function isStaticAsset(url) {
    const path = url.pathname;
    return STATIC_ASSETS.includes(path) ||
           path.startsWith('/assets/') ||
           path.endsWith('.js') ||
           path.endsWith('.css') ||
           path.endsWith('.png') ||
           path.endsWith('.jpg') ||
           path.endsWith('.jpeg') ||
           path.endsWith('.svg') ||
           path.endsWith('.webmanifest') ||
           path.endsWith('.woff2') ||
           path.endsWith('.woff') ||
           path.endsWith('.ttf');
}

async function fetchAndCache(request, cacheName) {
    try {
        const response = await fetch(request);

        // Only cache successful, non-HTML responses. The SPA fallback serves
        // index.html for missing files - caching that as a .js/.css response
        // would permanently break the page (white screen).
        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
                // Cache in the background. Awaiting cache.put() would delay the
                // response until the full body has been buffered, which blocks
                // the page and breaks progress reporting for large files.
                caches.open(cacheName)
                    .then((cache) => cache.put(request, response.clone()))
                    .catch(() => {});
            }
        }

        return response;
    } catch (error) {
        console.error(`[SW] Failed to fetch and cache ${request.url}:`, error);
        throw error;
    }
}

function createFallbackResponse(url) {
    const path = url.pathname;
    
    // Default fallback for HTML pages
    if (path.endsWith('.html') || path === '/') {
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Offline</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    h1 { color: #333; }
                    p { color: #666; }
                </style>
            </head>
            <body>
                <h1>You are offline</h1>
                <p>Some features may be limited. Please check your internet connection.</p>
            </body>
            </html>
        `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        });
    }
    
    // Default fallback for other requests
    return new Response(JSON.stringify({
        error: 'Offline',
        message: 'You are offline. Please check your internet connection.',
    }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function cleanupCache() {
    try {
        const cacheNames = [CACHE_NAME];
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            
            // Delete old items (older than 7 days)
            const now = Date.now();
            const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;
            
            for (const key of keys) {
                const response = await cache.match(key);
                if (response) {
                    const dateHeader = response.headers.get('date');
                    if (dateHeader) {
                        const date = new Date(dateHeader).getTime();
                        if (now - date > MAX_CACHE_AGE) {
                            await cache.delete(key);
                        }
                    }
                }
            }
            
            console.log(`[SW] Cleaned up cache ${cacheName}`);
        }
    } catch (error) {
        console.error('[SW] Failed to cleanup cache:', error);
    }
}

console.log('[SW] Service worker loaded');
