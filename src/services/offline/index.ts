/**
 * Offline Support Services
 * 
 * Exports all offline-related functionality
 */

export {
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
} from './sw-registration';

export type { ServiceWorkerRegistration };
