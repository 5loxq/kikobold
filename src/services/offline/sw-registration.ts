/**
 * Service Worker Registration and Offline Support
 * 
 * Features:
 * - Service worker registration
 * - Offline detection
 * - Cache management
 * - Background sync registration
 * - Push notification support
 * 
 * Inspired by Ensu's offline implementation
 */

// Service worker file path
const SW_PATH = '/sw.js';

// Service worker registration
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

// Offline state
let isOffline = false;

// Event listeners
const offlineListeners: Array<(offline: boolean) => void> = [];
const updateListeners: Array<() => void> = [];

/**
 * Check if the app is currently offline
 */
export const getIsOffline = (): boolean => {
    return isOffline;
};

/**
 * Register service worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    try {
        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported in this browser');
            return null;
        }

        // Register service worker
        serviceWorkerRegistration = await navigator.serviceWorker.register(SW_PATH, {
            scope: '/',
            type: 'module', // Use module type for modern service workers
        });

        console.log('✓ Service Worker registered with scope:', serviceWorkerRegistration.scope);

        // Set up update handler
        serviceWorkerRegistration.addEventListener('updatefound', () => {
            console.log('✓ Service Worker update found');
            notifyUpdateAvailable();
        });

        // Set up offline detection
        setupOfflineDetection();

        // Set up message handler
        setupMessageHandler();

        // Check for updates periodically
        setupUpdateCheck();

        return serviceWorkerRegistration;
    } catch (error) {
        console.error('✗ Failed to register Service Worker:', error);
        return null;
    }
};

/**
 * Unregister service worker
 */
export const unregisterServiceWorker = async (): Promise<void> => {
    try {
        if (serviceWorkerRegistration) {
            await serviceWorkerRegistration.unregister();
            serviceWorkerRegistration = null;
            console.log('✓ Service Worker unregistered');
        }
    } catch (error) {
        console.error('✗ Failed to unregister Service Worker:', error);
    }
};

/**
 * Check for service worker updates
 */
export const checkForUpdates = async (): Promise<boolean> => {
    try {
        if (!serviceWorkerRegistration) {
            return false;
        }

        const update = await serviceWorkerRegistration.update();
        
        if (update) {
            console.log('✓ Service Worker update found');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('✗ Failed to check for Service Worker updates:', error);
        return false;
    }
};

/**
 * Skip waiting and activate new service worker
 */
export const skipWaiting = async (): Promise<void> => {
    try {
        if (!serviceWorkerRegistration || !serviceWorkerRegistration.waiting) {
            return;
        }

        // Send skip waiting message to service worker
        serviceWorkerRegistration.waiting.postMessage({
            type: 'SKIP_WAITING',
        });

        console.log('✓ Skip waiting message sent to Service Worker');
    } catch (error) {
        console.error('✗ Failed to skip waiting:', error);
    }
};

/**
 * Clean up caches
 */
export const cleanupCaches = async (): Promise<void> => {
    try {
        if (!serviceWorkerRegistration) {
            return;
        }

        // Send cleanup message to service worker
        serviceWorkerRegistration.active?.postMessage({
            type: 'CLEANUP_CACHE',
        });

        console.log('✓ Cache cleanup message sent to Service Worker');
    } catch (error) {
        console.error('✗ Failed to cleanup caches:', error);
    }
};

/**
 * Cache a model in the service worker
 */
export const cacheModel = async (url: string, data: unknown): Promise<void> => {
    try {
        if (!serviceWorkerRegistration) {
            return;
        }

        // Send cache model message to service worker
        serviceWorkerRegistration.active?.postMessage({
            type: 'CACHE_MODEL',
            url,
            data,
        });

        console.log(`✓ Cache model message sent for ${url}`);
    } catch (error) {
        console.error(`✗ Failed to cache model ${url}:`, error);
    }
};

/**
 * Register for push notifications
 */
export const registerPushNotifications = async (): Promise<PushSubscription | null> => {
    try {
        if (!('PushManager' in window) || !serviceWorkerRegistration) {
            console.warn('Push notifications not supported');
            return null;
        }

        const subscription = await serviceWorkerRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: getApplicationServerKey(),
        });

        console.log('✓ Push notifications subscribed');
        return subscription;
    } catch (error) {
        console.error('✗ Failed to subscribe to push notifications:', error);
        return null;
    }
};

/**
 * Unregister from push notifications
 */
export const unregisterPushNotifications = async (): Promise<void> => {
    try {
        if (!serviceWorkerRegistration) {
            return;
        }

        const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('✓ Push notifications unsubscribed');
        }
    } catch (error) {
        console.error('✗ Failed to unsubscribe from push notifications:', error);
    }
};

/**
 * Show a push notification
 */
export const showNotification = async (title: string, options: NotificationOptions): Promise<void> => {
    try {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return;
        }

        // Check permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Notification permission not granted');
            return;
        }

        // Show notification
        const notification = new Notification(title, options);
        
        // Handle notification click
        notification.addEventListener('click', () => {
            // Focus or open the app
            if (options.data && (options.data as { url?: string }).url) {
                window.open((options.data as { url: string }).url, '_blank');
            } else {
                window.focus();
            }
            notification.close();
        });

        console.log('✓ Notification shown');
    } catch (error) {
        console.error('✗ Failed to show notification:', error);
    }
};

/**
 * Register for background sync
 */
export const registerBackgroundSync = async (tag: string): Promise<void> => {
    try {
        if (!('SyncManager' in window) || !serviceWorkerRegistration) {
            console.warn('Background sync not supported');
            return;
        }

        await serviceWorkerRegistration.sync.register(tag);
        console.log(`✓ Background sync registered for tag: ${tag}`);
    } catch (error) {
        console.error(`✗ Failed to register background sync for ${tag}:`, error);
    }
};

/**
 * Get application server key for push notifications
 */
const getApplicationServerKey = (): Uint8Array | null => {
    // In a real implementation, you would get this from your server
    // This is a placeholder - replace with your actual VAPID public key
    const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    
    if (!vapidPublicKey) {
        console.warn('VAPID public key not configured');
        return null;
    }

    try {
        // Convert base64 URL-safe to Uint8Array
        const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    } catch (error) {
        console.error('Failed to parse VAPID public key:', error);
        return null;
    }
};

/**
 * Set up offline detection
 */
const setupOfflineDetection = (): void => {
    // Listen for online/offline events
    window.addEventListener('online', () => {
        isOffline = false;
        console.log('✓ Back online');
        notifyOfflineState(false);
    });

    window.addEventListener('offline', () => {
        isOffline = true;
        console.log('✗ Went offline');
        notifyOfflineState(true);
    });

    // Initial check
    isOffline = !navigator.onLine;
    if (isOffline) {
        console.log('✗ Currently offline');
    }
};

/**
 * Set up message handler for service worker messages
 */
const setupMessageHandler = (): void => {
    if (!navigator.serviceWorker) {
        return;
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        
        switch (data.type) {
            case 'OFFLINE_STATE':
                isOffline = data.offline;
                notifyOfflineState(isOffline);
                break;
            
            case 'UPDATE_AVAILABLE':
                notifyUpdateAvailable();
                break;
            
            case 'CACHE_CLEANUP_COMPLETE':
                console.log(`✓ Cache cleanup completed: ${data.deletedCount} items deleted`);
                break;
            
            default:
                console.log(`[SW Message] Unknown message type: ${data.type}`);
        }
    });
};

/**
 * Set up periodic update check
 */
const setupUpdateCheck = (): void => {
    // Check for updates every hour
    setInterval(async () => {
        try {
            const updateAvailable = await checkForUpdates();
            if (updateAvailable) {
                console.log('✓ Update available');
            }
        } catch (error) {
            console.error('✗ Failed to check for updates:', error);
        }
    }, 60 * 60 * 1000); // 1 hour
};

/**
 * Notify listeners about offline state change
 */
const notifyOfflineState = (offline: boolean): void => {
    isOffline = offline;
    offlineListeners.forEach(listener => {
        try {
            listener(offline);
        } catch (error) {
            console.error('Error in offline listener:', error);
        }
    });
};

/**
 * Notify listeners about update availability
 */
const notifyUpdateAvailable = (): void => {
    updateListeners.forEach(listener => {
        try {
            listener();
        } catch (error) {
            console.error('Error in update listener:', error);
        }
    });
};

/**
 * Add offline state listener
 */
export const onOfflineStateChange = (listener: (offline: boolean) => void): (() => void) => {
    offlineListeners.push(listener);
    
    // Call listener immediately with current state
    listener(isOffline);
    
    // Return cleanup function
    return () => {
        const index = offlineListeners.indexOf(listener);
        if (index !== -1) {
            offlineListeners.splice(index, 1);
        }
    };
};

/**
 * Add update listener
 */
export const onUpdateAvailable = (listener: () => void): (() => void) => {
    updateListeners.push(listener);
    
    // Return cleanup function
    return () => {
        const index = updateListeners.indexOf(listener);
        if (index !== -1) {
            updateListeners.splice(index, 1);
        }
    };
};

/**
 * Get the current service worker registration
 */
export const getServiceWorkerRegistration = (): ServiceWorkerRegistration | null => {
    return serviceWorkerRegistration;
};

/**
 * Check if service worker is supported
 */
export const isServiceWorkerSupported = (): boolean => {
    return 'serviceWorker' in navigator;
};

/**
 * Check if push notifications are supported
 */
export const isPushSupported = (): boolean => {
    return 'PushManager' in window && 'Notification' in window;
};

/**
 * Check if background sync is supported
 */
export const isBackgroundSyncSupported = (): boolean => {
    return 'SyncManager' in window;
};

/**
 * Initialize offline support
 */
export const initOfflineSupport = async (): Promise<void> => {
    try {
        // Register service worker
        await registerServiceWorker();
        
        // Register for push notifications if supported
        if (isPushSupported()) {
            await registerPushNotifications();
        }
        
        console.log('✓ Offline support initialized');
    } catch (error) {
        console.error('✗ Failed to initialize offline support:', error);
    }
};

export default {
    registerServiceWorker,
    unregisterServiceWorker,
    checkForUpdates,
    skipWaiting,
    cleanupCaches,
    cacheModel,
    registerPushNotifications,
    unregisterPushNotifications,
    showNotification,
    registerBackgroundSync,
    getIsOffline,
    onOfflineStateChange,
    onUpdateAvailable,
    getServiceWorkerRegistration,
    isServiceWorkerSupported,
    isPushSupported,
    isBackgroundSyncSupported,
    initOfflineSupport,
};
