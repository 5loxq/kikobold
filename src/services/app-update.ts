/**
 * App Update Service
 * 
 * Inspired by ente-io/ensu's app-update.ts
 * Handles application updates for Tauri and web environments
 */

import { isTauriRuntime } from './tauri-runtime';
import { log, warn } from './logging';

/**
 * Update information structure
 */
export interface UpdateInfo {
    version: string;
    description?: string;
    releaseNotes?: string;
    releaseDate?: string;
    downloadUrl?: string;
    isMandatory?: boolean;
    available: boolean;
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion?: string;
    updateInfo?: UpdateInfo;
    error?: string;
}

/**
 * Update progress event
 */
export interface UpdateProgressEvent {
    type: 'checking' | 'available' | 'downloading' | 'installing' | 'completed' | 'error';
    progress?: number; // 0-100
    message?: string;
    error?: string;
}

/**
 * Update options
 */
export interface UpdateOptions {
    autoCheck?: boolean;
    autoDownload?: boolean;
    autoInstall?: boolean;
    intervalMs?: number; // Check interval in milliseconds
}

// Configuration
const UPDATE_CHECK_URL = 'https://api.github.com/repos/roman/webgui/releases/latest';
const DEFAULT_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const CURRENT_VERSION = '1.0.0'; // This should be set from package.json

// State
let updateInfo: UpdateInfo | null = null;
let isChecking = false;
let isDownloading = false;
let downloadProgress = 0;
let updateListeners: Array<(event: UpdateProgressEvent) => void> = [];
let checkInterval: NodeJS.Timeout | null = null;

/**
 * Get current application version
 */
export const getCurrentVersion = (): string => {
    // Try to get version from package.json
    try {
        // In Tauri, we can read from the package
        if (isTauriRuntime()) {
            try {
                const { invoke } = require('@tauri-apps/api/core');
                return invoke('get_app_version') as string;
            } catch {
                // Fallback
            }
        }
        
        // In web, try to read from import.meta.env or window
        if (typeof window !== 'undefined') {
            if ((window as any).APP_VERSION) {
                return (window as any).APP_VERSION;
            }
        }
        
        return CURRENT_VERSION;
    } catch {
        return CURRENT_VERSION;
    }
};

/**
 * Compare version strings
 * Returns 1 if a > b, 0 if a == b, -1 if a < b
 */
export const compareVersions = (a: string, b: string): number => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart > bPart) return 1;
        if (aPart < bPart) return -1;
    }
    
    return 0;
};

/**
 * Check for updates by fetching the latest release from GitHub
 */
export const checkForUpdates = async (force = false): Promise<UpdateCheckResult> => {
    // Don't check if already checking
    if (isChecking && !force) {
        return {
            hasUpdate: false,
            currentVersion: getCurrentVersion(),
            error: 'Update check already in progress',
        };
    }
    
    isChecking = true;
    const currentVersion = getCurrentVersion();
    
    emitUpdateEvent({ type: 'checking', message: 'Checking for updates...' });
    
    try {
        // For Tauri, use Tauri updater if available
        if (isTauriRuntime()) {
            return await checkTauriUpdates(currentVersion);
        }
        
        // For web, check GitHub releases
        return await checkGitHubUpdates(currentVersion);
        
    } catch (err) {
        emitUpdateEvent({
            type: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
        });
        
        return {
            hasUpdate: false,
            currentVersion,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    } finally {
        isChecking = false;
    }
};

/**
 * Check for updates using Tauri updater
 */
const checkTauriUpdates = async (currentVersion: string): Promise<UpdateCheckResult> => {
    try {
        const { checkUpdate } = await import('@tauri-apps/plugin-updater');
        
        emitUpdateEvent({ type: 'checking', message: 'Checking Tauri for updates...' });
        
        const update = await checkUpdate();
        
        if (update?.available) {
            const version = update.version;
            const hasUpdate = compareVersions(version, currentVersion) > 0;
            
            if (hasUpdate) {
                updateInfo = {
                    version,
                    description: 'New version available',
                    releaseNotes: (update as any).body || (update as any).releaseNotes,
                    releaseDate: (update as any).date?.toISOString(),
                    downloadUrl: (update as any).url,
                    isMandatory: false,
                    available: true,
                };
                
                emitUpdateEvent({
                    type: 'available',
                    message: `Update to version ${version} available`,
                });
                
                return {
                    hasUpdate: true,
                    currentVersion,
                    latestVersion: version,
                    updateInfo: updateInfo,
                };
            }
        }
        
        emitUpdateEvent({ type: 'completed', message: 'No updates available' });
        return { hasUpdate: false, currentVersion };
        
    } catch (err) {
        warn('Tauri update check failed:', err);
        return { hasUpdate: false, currentVersion };
    }
};

/**
 * Check for updates from GitHub releases
 */
const checkGitHubUpdates = async (currentVersion: string): Promise<UpdateCheckResult> => {
    try {
        emitUpdateEvent({ type: 'checking', message: 'Checking GitHub for updates...' });
        
        const response = await fetch(UPDATE_CHECK_URL, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'webgui-app',
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const release = await response.json();
        
        // Handle GitHub API rate limits
        if (response.headers.get('X-RateLimit-Remaining') === '0') {
            const resetTime = Number(response.headers.get('X-RateLimit-Reset')) * 1000;
            const now = Date.now();
            const waitTime = Math.ceil((resetTime - now) / 1000 / 60);
            
            emitUpdateEvent({
                type: 'error',
                error: `GitHub API rate limit exceeded. Try again in ${waitTime} minutes.`,
            });
            
            return {
                hasUpdate: false,
                currentVersion,
                error: 'Rate limit exceeded',
            };
        }
        
        const latestVersion = release.tag_name || release.name;
        
        // Remove 'v' prefix if present
        const cleanLatestVersion = latestVersion.startsWith('v') 
            ? latestVersion.substring(1) 
            : latestVersion;
        
        const hasUpdate = compareVersions(cleanLatestVersion, currentVersion) > 0;
        
        if (hasUpdate) {
            updateInfo = {
                version: cleanLatestVersion,
                description: release.name || 'New version available',
                releaseNotes: release.body || '',
                releaseDate: release.published_at || release.created_at,
                downloadUrl: release.html_url,
                isMandatory: false,
                available: true,
            };
            
            emitUpdateEvent({
                type: 'available',
                message: `Update to version ${cleanLatestVersion} available`,
            });
            
            return {
                hasUpdate: true,
                currentVersion,
                latestVersion: cleanLatestVersion,
                updateInfo: updateInfo,
            };
        }
        
        emitUpdateEvent({ type: 'completed', message: 'No updates available' });
        return { hasUpdate: false, currentVersion };
        
    } catch (err) {
        warn('GitHub update check failed:', err);
        return {
            hasUpdate: false,
            currentVersion,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
};

/**
 * Download and install the update
 */
export const installUpdate = async (): Promise<void> => {
    if (!updateInfo?.available) {
        throw new Error('No update available');
    }
    
    if (isDownloading) {
        throw new Error('Update already in progress');
    }
    
    isDownloading = true;
    downloadProgress = 0;
    
    try {
        if (isTauriRuntime()) {
            await installTauriUpdate();
        } else {
            await installWebUpdate();
        }
        
        emitUpdateEvent({ type: 'completed', message: 'Update installed successfully' });
        
    } catch (err) {
        emitUpdateEvent({
            type: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
    } finally {
        isDownloading = false;
    }
};

/**
 * Install update using Tauri updater
 */
const installTauriUpdate = async (): Promise<void> => {
    try {
        const { installUpdate } = await import('@tauri-apps/plugin-updater');
        
        emitUpdateEvent({ type: 'installing', progress: 0, message: 'Preparing to install update...' });
        
        await installUpdate({
            onProgress: (progress: number) => {
                downloadProgress = Math.round(progress * 100);
                emitUpdateEvent({
                    type: 'installing',
                    progress: downloadProgress,
                    message: `Installing update... ${downloadProgress}%`,
                });
            },
        });
        
        emitUpdateEvent({ type: 'completed', progress: 100, message: 'Update installed' });
        
    } catch (err) {
        warn('Tauri update installation failed:', err);
        throw err;
    }
};

/**
 * Install update for web environment
 * This typically just shows a notification and reloads
 */
const installWebUpdate = async (): Promise<void> => {
    try {
        emitUpdateEvent({ type: 'installing', progress: 0, message: 'Reloading to apply update...' });
        
        // For web apps, we typically need to reload
        if (typeof window !== 'undefined') {
            // Show a message and reload
            emitUpdateEvent({
                type: 'completed',
                progress: 100,
                message: 'Please reload the page to apply the update',
            });
            
            // Auto-reload after a delay
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
        
    } catch (err) {
        warn('Web update installation failed:', err);
        throw err;
    }
};

/**
 * Start automatic update checking
 */
export const startAutoUpdateCheck = (options: UpdateOptions = {}): void => {
    const { intervalMs = DEFAULT_CHECK_INTERVAL } = options;
    
    // Check immediately
    checkForUpdates().catch(err => {
        warn('Initial update check failed:', err);
    });
    
    // Set up periodic checks
    if (checkInterval) {
        clearInterval(checkInterval);
    }
    
    checkInterval = setInterval(() => {
        checkForUpdates().catch(err => {
            warn('Periodic update check failed:', err);
        });
    }, intervalMs);
    
    log(`Auto update check started with interval: ${intervalMs}ms`);
};

/**
 * Stop automatic update checking
 */
export const stopAutoUpdateCheck = (): void => {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
        log('Auto update check stopped');
    }
};

/**
 * Add a listener for update events
 */
export const addUpdateListener = (listener: (event: UpdateProgressEvent) => void): void => {
    updateListeners.push(listener);
};

/**
 * Remove a listener for update events
 */
export const removeUpdateListener = (listener: (event: UpdateProgressEvent) => void): void => {
    updateListeners = updateListeners.filter(l => l !== listener);
};

/**
 * Emit an update event to all listeners
 */
const emitUpdateEvent = (event: UpdateProgressEvent): void => {
    updateListeners.forEach(listener => {
        try {
            listener(event);
        } catch (err) {
            warn('Error in update listener:', err);
        }
    });
};

/**
 * Get the current update info
 */
export const getUpdateInfo = (): UpdateInfo | null => {
    return updateInfo;
};

/**
 * Get update status
 */
export const getUpdateStatus = (): {
    isChecking: boolean;
    isDownloading: boolean;
    downloadProgress: number;
    updateAvailable: boolean;
} => {
    return {
        isChecking,
        isDownloading,
        downloadProgress,
        updateAvailable: !!updateInfo?.available,
    };
};

export default {
    getCurrentVersion,
    compareVersions,
    checkForUpdates,
    installUpdate,
    startAutoUpdateCheck,
    stopAutoUpdateCheck,
    addUpdateListener,
    removeUpdateListener,
    getUpdateInfo,
    getUpdateStatus,
};
