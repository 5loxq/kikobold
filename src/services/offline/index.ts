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
    getIsOffline,
    onOfflineStateChange,
    getServiceWorkerRegistration,
    isServiceWorkerSupported,
    initOfflineSupport,
} from './sw-registration';
