/**
 * Tauri Runtime Detection Service
 * 
 * Detects if the application is running in Tauri environment
 */

/**
 * Check if the current runtime is Tauri
 */
export const isTauriRuntime = (): boolean => {
    try {
        // Check for Tauri-specific global objects
        if (typeof window !== 'undefined') {
            // Check for __TAURI__ global (Tauri v2+)
            if ((window as Window & { __TAURI__?: unknown }).__TAURI__ !== undefined) {
                return true;
            }
            
            // Check for tauri API availability
            if ((window as Window & { tauri?: unknown }).tauri !== undefined) {
                return true;
            }
            
            // Check for Tauri-specific user agent
            if (navigator.userAgent.includes('Tauri')) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
};

/**
 * Get the current runtime environment
 */
export type RuntimeEnvironment = 'tauri' | 'web' | 'unknown';

export const getRuntimeEnvironment = (): RuntimeEnvironment => {
    if (isTauriRuntime()) {
        return 'tauri';
    }
    
    if (typeof window !== 'undefined') {
        return 'web';
    }
    
    return 'unknown';
};

/**
 * Check if running in a desktop environment (Tauri or Electron)
 */
export const isDesktopEnvironment = (): boolean => {
    return isTauriRuntime() || isElectronRuntime();
};

/**
 * Check if running in Electron
 */
export const isElectronRuntime = (): boolean => {
    try {
        if (typeof window !== 'undefined') {
            // Check for Electron-specific global objects
            const w = window as unknown as { electron?: unknown; process?: { versions?: { electron?: string } } };
            if (w.electron !== undefined) {
                return true;
            }
            
            // Check for Electron-specific user agent
            if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
                return true;
            }
            
            // Check for process.versions.electron
            if (typeof process !== 'undefined' && 
                process.versions !== undefined && 
                (process.versions as { electron?: string }).electron !== undefined) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
};

/**
 * Check if running in a browser extension
 */
export const isBrowserExtension = (): boolean => {
    try {
        if (typeof window !== 'undefined') {
            // Check for extension-specific contexts
            const w = window as unknown as { chrome?: { extension?: unknown }; browser?: { extension?: unknown } };
            if (w.chrome !== undefined && w.chrome.extension !== undefined) {
                return true;
            }
            
            if (w.browser !== undefined && w.browser.extension !== undefined) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
};

export default {
    isTauriRuntime,
    getRuntimeEnvironment,
    isDesktopEnvironment,
    isElectronRuntime,
    isBrowserExtension,
};
