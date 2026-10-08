/**
 * Service Worker Registration and Offline Support
 *
 * Features:
 * - Service worker registration
 * - Offline detection
 * - Cache management
 */

import { log, error as logError, warn as logWarn } from '../logging';

// Service worker file path
const SW_PATH = '/sw.js';

// Service worker registration
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

// Offline state
let isOffline = false;

// Event listeners
const offlineListeners: Array<(offline: boolean) => void> = [];

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
            logWarn('Service Worker not supported in this browser');
            return null;
        }

        // Register service worker
        serviceWorkerRegistration = await navigator.serviceWorker.register(SW_PATH, {
            scope: '/',
        });

        log('✓ Service Worker registered with scope:', serviceWorkerRegistration.scope);

        // Set up update handler
        serviceWorkerRegistration.addEventListener('updatefound', () => {
            log('✓ Service Worker update found');
        });

        // Set up offline detection
        setupOfflineDetection();

        return serviceWorkerRegistration;
    } catch (error) {
        logError('✗ Failed to register Service Worker:', error);
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
            log('✓ Service Worker unregistered');
        }
    } catch (error) {
        logError('✗ Failed to unregister Service Worker:', error);
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

        const registration = await serviceWorkerRegistration.update();

        // update() always resolves with a registration; an update was only
        // found when a newly installed worker is waiting to take over.
        const hasUpdate = Boolean(
            registration.waiting && registration.active && registration.waiting !== registration.active
        );

        if (hasUpdate) {
            log('✓ Service Worker update found');
            return true;
        }

        return false;
    } catch (error) {
        logError('✗ Failed to check for Service Worker updates:', error);
        return false;
    }
};

/**
 * Skip waiting and activate new service worker
 */
export const skipWaiting = async (): Promise<void> => {
    try {
        if (!serviceWorkerRegistration?.waiting) {
            return;
        }

        // Send skip waiting message to service worker
        serviceWorkerRegistration.waiting.postMessage({
            type: 'SKIP_WAITING',
        });

        log('✓ Skip waiting message sent to Service Worker');
    } catch (error) {
        logError('✗ Failed to skip waiting:', error);
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

        log('✓ Cache cleanup message sent to Service Worker');
    } catch (error) {
        logError('✗ Failed to cleanup caches:', error);
    }
};

/**
 * Set up offline detection. Guarded so a second call of
 * registerServiceWorker() cannot attach duplicate online/offline listeners
 * to the window.
 */
let offlineDetectionSetup = false;

const setupOfflineDetection = (): void => {
    if (offlineDetectionSetup) {
        return;
    }
    offlineDetectionSetup = true;

    // Listen for online/offline events
    window.addEventListener('online', () => {
        isOffline = false;
        log('✓ Back online');
        notifyOfflineState(false);
    });

    window.addEventListener('offline', () => {
        isOffline = true;
        log('✗ Went offline');
        notifyOfflineState(true);
    });

    // Initial check
    isOffline = !navigator.onLine;
    if (isOffline) {
        log('✗ Currently offline');
    }
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
            logError('Error in offline listener:', error);
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
 * Initialize offline support
 */
export const initOfflineSupport = async (): Promise<void> => {
    try {
        // Register service worker
        await registerServiceWorker();
        
        log('✓ Offline support initialized');
    } catch (error) {
        logError('✗ Failed to initialize offline support:', error);
    }
};

export default {
    registerServiceWorker,
    unregisterServiceWorker,
    checkForUpdates,
    skipWaiting,
    cleanupCaches,
    getIsOffline,
    onOfflineStateChange,
    getServiceWorkerRegistration,
    isServiceWorkerSupported,
    initOfflineSupport,
};
