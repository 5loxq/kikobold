/**
 * Secure Storage Service
 * 
 * Inspired by ente-io/ensu's secure-storage.ts
 * Provides secure storage operations with encryption capabilities
 */

import { isTauriRuntime } from './tauri-runtime';

// Storage keys
const STORAGE_KEY_PREFIX = 'webgui_secure_';
const ENCRYPTION_KEY_KEY = `${STORAGE_KEY_PREFIX}enc_key`;

/**
 * Encrypted data structure
 */
export interface EncryptedData {
    encryptedData: string;
    iv: string;
    salt: string;
    timestamp: number;
    version: string;
}

/**
 * Secure storage options
 */
export interface SecureStorageOptions {
    encrypt?: boolean;
    compression?: boolean;
    ttl?: number; // Time to live in seconds
}

/**
 * Storage result
 */
export interface StorageResult {
    success: boolean;
    key?: string;
    error?: string;
}

/**
 * Simple in-memory cache for encrypted keys (for development)
 * In production with Tauri, this would use the Tauri secure storage
 */
const memoryCache: Map<string, string> = new Map();

/**
 * Check if encryption is available
 */
export const isEncryptionAvailable = (): boolean => {
    // For now, return true if we have the necessary APIs
    // In the future, this would check for Web Crypto API support
    return typeof window !== 'undefined' && (
        window.crypto !== undefined ||
        (window as any).msCrypto !== undefined
    );
};

/**
 * Generate a secure encryption key
 * Uses Web Crypto API or falls back to a simple hash
 */
export const generateEncryptionKey = async (): Promise<string> => {
    if (!isEncryptionAvailable()) {
        // Fallback: generate a simple random key (not cryptographically secure)
        const array = new Uint32Array(32);
        window.crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(8, '0')).join('');
    }
    
    try {
        // Use Web Crypto API to generate a secure key
        const key = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        
        // Export the key as a hex string
        const exported = await window.crypto.subtle.exportKey('jwk', key);
        return JSON.stringify(exported);
    } catch {
        // Fallback
        const array = new Uint32Array(32);
        window.crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(8, '0')).join('');
    }
};

/**
 * Simple XOR-based encryption for basic obfuscation
 * Note: This is NOT cryptographically secure, but provides basic obfuscation
 * For production use with sensitive data, use proper encryption
 */
const simpleEncrypt = (data: string, key: string): string => {
    let result = '';
    for (let i = 0; i < data.length; i++) {
        const dataChar = data.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        result += String.fromCharCode(dataChar ^ keyChar);
    }
    return btoa(result);
};

/**
 * Simple XOR-based decryption
 */
const simpleDecrypt = (encryptedData: string, key: string): string => {
    try {
        const decoded = atob(encryptedData);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            const dataChar = decoded.charCodeAt(i);
            const keyChar = key.charCodeAt(i % key.length);
            result += String.fromCharCode(dataChar ^ keyChar);
        }
        return result;
    } catch {
        return encryptedData; // Return as-is if decryption fails
    }
};

/**
 * Get the encryption key from storage or generate a new one
 */
const getEncryptionKey = async (): Promise<string> => {
    // Check memory cache first
    if (memoryCache.has(ENCRYPTION_KEY_KEY)) {
        return memoryCache.get(ENCRYPTION_KEY_KEY)!;
    }
    
    // Try to get from localStorage
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(ENCRYPTION_KEY_KEY);
        if (stored) {
            memoryCache.set(ENCRYPTION_KEY_KEY, stored);
            return stored;
        }
    }
    
    // Generate a new key
    const newKey = await generateEncryptionKey();
    
    // Store the key
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ENCRYPTION_KEY_KEY, newKey);
    }
    
    memoryCache.set(ENCRYPTION_KEY_KEY, newKey);
    return newKey;
};

/**
 * Securely store data with optional encryption
 */
export const secureSetItem = async <T>(
    key: string,
    value: T,
    options: SecureStorageOptions = {}
): Promise<StorageResult> => {
    try {
        const { encrypt = true } = options;
        
        if (!key || typeof key !== 'string' || key.length > 200) {
            return { success: false, error: 'Invalid key' };
        }
        
        let dataToStore: string;
        
        if (value instanceof Object) {
            dataToStore = JSON.stringify(value);
        } else if (typeof value === 'string') {
            dataToStore = value;
        } else {
            dataToStore = String(value);
        }
        
        // Add TTL if specified
        if (options.ttl) {
            const withTTL = {
                _expires: Date.now() + (options.ttl * 1000),
                data: dataToStore,
            };
            dataToStore = JSON.stringify(withTTL);
        }
        
        // Encrypt if requested
        if (encrypt && isEncryptionAvailable()) {
            const encryptionKey = await getEncryptionKey();
            dataToStore = simpleEncrypt(dataToStore, encryptionKey);
        }
        
        // Use Tauri secure storage if available
        if (isTauriRuntime()) {
            try {
                // Tauri uses its own secure storage
                const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                const { join } = await import('@tauri-apps/api/path');
                
                const storagePath = await join(BaseDirectory.AppData, 'secure_storage.json');
                
                // For Tauri, we use a simple JSON file approach
                // In a real implementation, we'd use Tauri's secure storage API
                let storage: Record<string, string> = {};
                
                try {
                    const { readTextFile } = await import('@tauri-apps/plugin-fs');
                    const existing = await readTextFile(storagePath);
                    storage = JSON.parse(existing);
                } catch {
                    // File doesn't exist yet
                }
                
                storage[key] = dataToStore;
                await writeTextFile(storagePath, JSON.stringify(storage));
                
                return { success: true, key };
            } catch (tauriError) {
                // Fall back to localStorage
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY_PREFIX + key, dataToStore);
                    return { success: true, key };
                }
            }
        }
        
        // Web storage
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_PREFIX + key, dataToStore);
            return { success: true, key };
        }
        
        // In-memory fallback
        memoryCache.set(STORAGE_KEY_PREFIX + key, dataToStore);
        return { success: true, key };
        
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
};

/**
 * Retrieve data from secure storage with optional decryption
 */
export const secureGetItem = async <T>(
    key: string,
    options: SecureStorageOptions = {}
): Promise<T | null> => {
    try {
        const { encrypt = true } = options;
        
        if (!key || typeof key !== 'string' || key.length > 200) {
            return null;
        }
        
        let data: string | null = null;
        
        // Try Tauri secure storage first
        if (isTauriRuntime()) {
            try {
                const { readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                const { join } = await import('@tauri-apps/api/path');
                
                const storagePath = await join(BaseDirectory.AppData, 'secure_storage.json');
                
                try {
                    const storageContent = await readTextFile(storagePath);
                    const storage: Record<string, string> = JSON.parse(storageContent);
                    data = storage[key] || null;
                } catch {
                    // File doesn't exist
                }
            } catch {
                // Tauri not available, fall back to localStorage
            }
        }
        
        // Try localStorage
        if (!data && typeof localStorage !== 'undefined') {
            data = localStorage.getItem(STORAGE_KEY_PREFIX + key);
        }
        
        // Try in-memory cache
        if (!data) {
            data = memoryCache.get(STORAGE_KEY_PREFIX + key) ?? null;
        }
        
        if (!data) {
            return null;
        }
        
        // Decrypt if encrypted
        if (encrypt && isEncryptionAvailable()) {
            try {
                const encryptionKey = await getEncryptionKey();
                data = simpleDecrypt(data, encryptionKey);
            } catch {
                // Decryption failed, return as-is
            }
        }
        
        // Check TTL
        try {
            const parsed = JSON.parse(data);
            if (parsed._expires && parsed._expires < Date.now()) {
                // Expired, remove and return null
                await secureRemoveItem(key);
                return null;
            }
            return parsed.data as T;
        } catch {
            // Not JSON or no TTL
        }
        
        // Try to parse as JSON
        try {
            return JSON.parse(data) as T;
        } catch {
            return data as unknown as T;
        }
        
    } catch (error) {
        return null;
    }
};

/**
 * Remove an item from secure storage
 */
export const secureRemoveItem = async (key: string): Promise<StorageResult> => {
    try {
        if (!key || typeof key !== 'string' || key.length > 200) {
            return { success: false, error: 'Invalid key' };
        }
        
        const storageKey = STORAGE_KEY_PREFIX + key;
        
        // Remove from Tauri storage if available
        if (isTauriRuntime()) {
            try {
                const { readTextFile, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                const { join } = await import('@tauri-apps/api/path');
                
                const storagePath = await join(BaseDirectory.AppData, 'secure_storage.json');
                
                try {
                    const storageContent = await readTextFile(storagePath);
                    const storage: Record<string, string> = JSON.parse(storageContent);
                    delete storage[key];
                    await writeTextFile(storagePath, JSON.stringify(storage));
                } catch {
                    // File doesn't exist
                }
            } catch {
                // Tauri not available
            }
        }
        
        // Remove from localStorage
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(storageKey);
        }
        
        // Remove from memory cache
        memoryCache.delete(storageKey);
        
        return { success: true, key };
        
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
};

/**
 * Clear all secure storage items
 */
export const secureClearAll = async (): Promise<StorageResult> => {
    try {
        if (isTauriRuntime()) {
            try {
                const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                const { join } = await import('@tauri-apps/api/path');
                
                const storagePath = await join(BaseDirectory.AppData, 'secure_storage.json');
                await writeTextFile(storagePath, '{}');
            } catch {
                // Tauri not available
            }
        }
        
        if (typeof localStorage !== 'undefined') {
            // Remove all items with our prefix
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(STORAGE_KEY_PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
        }
        
        memoryCache.clear();
        return { success: true };
        
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
};

/**
 * List all keys in secure storage
 */
export const secureListKeys = async (): Promise<string[]> => {
    const keys: string[] = [];
    
    try {
        // Check Tauri storage
        if (isTauriRuntime()) {
            try {
                const { readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
                const { join } = await import('@tauri-apps/api/path');
                
                const storagePath = await join(BaseDirectory.AppData, 'secure_storage.json');
                const storageContent = await readTextFile(storagePath);
                const storage: Record<string, string> = JSON.parse(storageContent);
                keys.push(...Object.keys(storage));
            } catch {
                // Tauri not available or file doesn't exist
            }
        }
        
        // Check localStorage
        if (typeof localStorage !== 'undefined') {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(STORAGE_KEY_PREFIX)) {
                    keys.push(key.substring(STORAGE_KEY_PREFIX.length));
                }
            }
        }
        
        // Check memory cache
        for (const key of memoryCache.keys()) {
            if (key.startsWith(STORAGE_KEY_PREFIX)) {
                keys.push(key.substring(STORAGE_KEY_PREFIX.length));
            }
        }
        
        return Array.from(new Set(keys)); // Remove duplicates
        
    } catch {
        return [];
    }
};

export default {
    isEncryptionAvailable,
    generateEncryptionKey,
    secureSetItem,
    secureGetItem,
    secureRemoveItem,
    secureClearAll,
    secureListKeys,
};
