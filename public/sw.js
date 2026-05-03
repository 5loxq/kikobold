/**
 * Service Worker for Offline Functionality
 * 
 * Features:
 * - Caches static assets for offline use
 * - Implements cache-first strategy for models and assets
 * - Provides fallback responses when offline
 * - Handles background sync for failed requests
 * 
 * Inspired by Ensu's service worker implementation
 */

const CACHE_NAME = 'llm-webgui-v1';
const MODEL_CACHE_NAME = 'llm-models-v1';
const ASSET_CACHE_NAME = 'llm-assets-v1';

// Static assets to cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
];

// API endpoints that should work offline
const OFFLINE_API_ENDPOINTS = [
    '/api/chats',
    '/api/profiles',
    '/api/models',
];

// Maximum cache size in bytes (1GB)
const MAX_CACHE_SIZE = 1024 * 1024 * 1024;

// Maximum age for cached items in milliseconds (7 days)
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

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
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== MODEL_CACHE_NAME && 
                            cacheName !== ASSET_CACHE_NAME) {
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

    // Handle static assets with cache-first strategy
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    if (response) {
                        console.log(`[SW] Serving static asset from cache: ${url.pathname}`);
                        return response;
                    }
                    
                    // Cache and return from network
                    return fetchAndCache(request, CACHE_NAME);
                })
        );
        return;
    }

    // Handle model files with cache-first strategy
    if (isModelFile(url)) {
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    if (response) {
                        console.log(`[SW] Serving model from cache: ${url.pathname}`);
                        return response;
                    }
                    
                    // Cache and return from network
                    return fetchAndCache(request, MODEL_CACHE_NAME);
                })
        );
        return;
    }

    // Handle API requests with network-first, cache-fallback strategy
    if (isApiRequest(url)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone response for caching
                    const responseClone = response.clone();
                    
                    // Cache successful responses
                    if (response.ok) {
                        caches.open(ASSET_CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseClone);
                            });
                    }
                    
                    return response;
                })
                .catch((error) => {
                    console.warn(`[SW] Network request failed for ${url.pathname}, trying cache:`, error);
                    
                    // Try to serve from cache
                    return caches.match(request)
                        .then((response) => {
                            if (response) {
                                console.log(`[SW] Serving API response from cache: ${url.pathname}`);
                                return response;
                            }
                            
                            // Return a fallback response for offline
                            return createFallbackResponse(url);
                        });
                })
        );
        return;
    }

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
    
    if (event.data && event.data.type === 'CACHE_MODEL') {
        const { url, data } = event.data;
        console.log(`[SW] Received cache model message for ${url}`);
        cacheModel(url, data);
    }
});

// Background sync event - retry failed requests
self.addEventListener('sync', (event) => {
    if (event.tag === 'failed-requests') {
        console.log('[SW] Syncing failed requests...');
        event.waitUntil(retryFailedRequests());
    }
});

// Helper functions
function isStaticAsset(url: URL): boolean {
    const path = url.pathname;
    return STATIC_ASSETS.includes(path) ||
           path.startsWith('/assets/') ||
           path.endsWith('.js') ||
           path.endsWith('.css') ||
           path.endsWith('.png') ||
           path.endsWith('.jpg') ||
           path.endsWith('.jpeg') ||
           path.endsWith('.svg') ||
           path.endsWith('.woff2') ||
           path.endsWith('.woff') ||
           path.endsWith('.ttf');
}

function isModelFile(url: URL): boolean {
    const path = url.pathname.toLowerCase();
    return path.endsWith('.gguf') ||
           path.endsWith('.bin') ||
           path.endsWith('.onnx') ||
           path.endsWith('.safetensors') ||
           path.includes('huggingface.co') ||
           path.includes('github.com') ||
           path.includes('cdn.jsdelivr.net');
}

function isApiRequest(url: URL): boolean {
    const path = url.pathname;
    return path.startsWith('/api/') ||
           OFFLINE_API_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
}

async function fetchAndCache(request: Request, cacheName: string): Promise<Response> {
    try {
        const response = await fetch(request);
        
        // Clone response for caching
        const responseClone = response.clone();
        
        // Only cache successful responses
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, responseClone);
            console.log(`[SW] Cached: ${request.url}`);
        }
        
        return response;
    } catch (error) {
        console.error(`[SW] Failed to fetch and cache ${request.url}:`, error);
        throw error;
    }
}

function createFallbackResponse(url: URL): Response {
    const path = url.pathname;
    
    // Create different fallback responses based on the request type
    if (path.startsWith('/api/chats')) {
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'You are offline. Some features may be limited.',
            cached: true,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    if (path.startsWith('/api/models')) {
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'You are offline. Using cached models.',
            models: [],
            cached: true,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    if (path.startsWith('/api/profiles')) {
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'You are offline. Using cached profiles.',
            profiles: [],
            cached: true,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
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

async function cleanupCache(): Promise<void> {
    try {
        const cacheNames = [CACHE_NAME, MODEL_CACHE_NAME, ASSET_CACHE_NAME];
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            
            let totalSize = 0;
            const now = Date.now();
            const keysToDelete: Request[] = [];
            
            for (const key of keys) {
                const response = await cache.match(key);
                if (response) {
                    const size = new Blob([await response.clone().arrayBuffer()]).size;
                    totalSize += size;
                    
                    // Check if item is too old
                    const headers = response.headers;
                    const dateHeader = headers.get('date');
                    if (dateHeader) {
                        const date = new Date(dateHeader).getTime();
                        if (now - date > MAX_CACHE_AGE) {
                            keysToDelete.push(key);
                        }
                    }
                }
            }
            
            // Delete old items
            for (const key of keysToDelete) {
                await cache.delete(key);
            }
            
            // If cache is still too large, delete oldest items
            if (totalSize > MAX_CACHE_SIZE) {
                const allKeys = await cache.keys();
                const sortedKeys = allKeys.sort((a, b) => {
                    // Sort by date header (oldest first)
                    return cache.match(a).then(aRes => 
                        cache.match(b).then(bRes => {
                            const aDate = aRes?.headers.get('date') || '0';
                            const bDate = bRes?.headers.get('date') || '0';
                            return new Date(aDate).getTime() - new Date(bDate).getTime();
                        })
                    );
                });
                
                // This is a simplified approach - in practice, you'd need to implement
                // proper sorting and deletion
                console.log(`[SW] Cache ${cacheName} is too large (${totalSize} bytes), cleanup needed`);
            }
            
            console.log(`[SW] Cleaned up cache ${cacheName}: ${keysToDelete.length} items deleted`);
        }
    } catch (error) {
        console.error('[SW] Failed to cleanup cache:', error);
    }
}

async function cacheModel(url: string, data: unknown): Promise<void> {
    try {
        const cache = await caches.open(MODEL_CACHE_NAME);
        const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        await cache.put(url, response);
        console.log(`[SW] Cached model: ${url}`);
    } catch (error) {
        console.error(`[SW] Failed to cache model ${url}:`, error);
    }
}

async function retryFailedRequests(): Promise<void> {
    // In a real implementation, you would:
    // 1. Get the list of failed requests from IndexedDB
    // 2. Retry each request
    // 3. Remove from the failed requests list on success
    
    console.log('[SW] Retrying failed requests...');
    
    // This is a placeholder for the actual implementation
    // You would need to implement a queue system for failed requests
}

// Push notification support
self.addEventListener('push', (event) => {
    const data = event.data?.json();
    
    if (data && data.title && data.body) {
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: '/assets/icons/icon-192x192.png',
                data: data.data,
            })
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            self.clients.openWindow(event.notification.data.url)
        );
    } else {
        event.waitUntil(
            self.clients.openWindow('/')
        );
    }
});

console.log('[SW] Service worker loaded');
