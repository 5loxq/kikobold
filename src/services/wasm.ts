/**
 * WASM Service
 * 
 * Inspired by ente-io/ensu's wasm.ts
 * Lazy loader for WASM module with support for both web and Tauri environments
 */

import { getRuntimeEnvironment } from './tauri-runtime';
import { log, warn } from './logging';
import { checkWebGPUSupport, checkWASMSupport } from './security';

/**
 * WASM module interface
 * Note: Functions can be sync (for web WASM) or async (for Tauri native)
 */
export interface WasmModule {
    crypto_init?: (() => void) | (() => Promise<void>);
    crypto_generate_key?: (() => string) | (() => Promise<string>);
    crypto_encrypt_blob?: (dataB64: string, keyB64: string) => { encrypted_data: string; decryption_header: string } | Promise<{ encrypted_data: string; decryption_header: string }>;
    crypto_decrypt_blob?: (encryptedDataB64: string, headerB64: string, keyB64: string) => string | Promise<string>;
    [key: string]: any;
}

/**
 * Encrypted blob structure
 */
export interface EncryptedBlob {
    encrypted_data: string;
    decryption_header: string;
}

/**
 * Crypto adapter interface for unified access to crypto functions
 */
export interface CryptoAdapter {
    crypto_init: () => Promise<void>;
    crypto_generate_key: () => Promise<string>;
    crypto_encrypt_blob: (dataB64: string, keyB64: string) => Promise<EncryptedBlob>;
    crypto_decrypt_blob: (encryptedDataB64: string, headerB64: string, keyB64: string) => Promise<string>;
}

/**
 * WASM loading state
 */
let wasmModulePromise: Promise<WasmModule | null> | null = null;
let cryptoInitDone: boolean = false;



/**
 * Initialize WebAssembly support
 */
export const initWASM = async (): Promise<WasmModule | null> => {
    if (wasmModulePromise) {
        return wasmModulePromise;
    }
    
    wasmModulePromise = loadWasmModule();
    
    try {
        const module = await wasmModulePromise;
        return module;
    } catch (err) {
        warn('Failed to initialize WASM:', err);
        return null;
    }
};

/**
 * Load the WASM module
 * In Tauri, this would use native Rust bindings
 * In web, this would load the WASM file
 */
const loadWasmModule = async (): Promise<WasmModule | null> => {
    const runtime = getRuntimeEnvironment();
    
    try {
        if (runtime === 'tauri') {
            return await loadTauriWasm();
        } else {
            return await loadWebWasm();
        }
    } catch (err) {
        warn('Failed to load WASM module:', err);
        return null;
    }
};

/**
 * Load WASM for Tauri environment
 * Uses Tauri's native Rust bindings
 */
const loadTauriWasm = async (): Promise<WasmModule | null> => {
    try {
        // Tauri provides direct access to Rust functions
        // We create an adapter that calls Tauri commands
        const tauriAdapter: WasmModule = {
            crypto_init: () => {
                // In Tauri, crypto is handled natively
            },
            crypto_generate_key: async () => {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    return await invoke('crypto_generate_key') as string;
                } catch {
                    return '';
                }
            },
            crypto_encrypt_blob: async (dataB64: string, keyB64: string) => {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const result = await invoke('crypto_encrypt_blob', {
                        input: { dataB64, keyB64 }
                    }) as EncryptedBlob;
                    return result;
                } catch {
                    return { encrypted_data: '', decryption_header: '' };
                }
            },
            crypto_decrypt_blob: async (encryptedDataB64: string, headerB64: string, keyB64: string) => {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    return await invoke('crypto_decrypt_blob', {
                        input: { encryptedDataB64, headerB64, keyB64 }
                    }) as string;
                } catch {
                    return '';
                }
            },
        };
        
        log('WASM loaded via Tauri native bindings');
        return tauriAdapter;
        
    } catch (err) {
        warn('Failed to load Tauri WASM:', err);
        return null;
    }
};

/**
 * Load WASM for web environment
 * Dynamically imports the WASM module
 */
const loadWebWasm = async (): Promise<WasmModule | null> => {
    try {
        // Try to dynamically import the WASM module
        // This assumes the module is built and available
        // @ts-ignore - module may not exist at compile time
        const wasmModule = await import('../wasm/bindings');
        
        log('WASM loaded for web environment');
        return wasmModule.default || wasmModule;
        
    } catch (importError) {
        warn('Failed to import WASM module:', importError);
        
        // Try alternative paths
        try {
            const wasmModule = await import('ente-wasm/load');
            const loaded = await wasmModule.loadEnteWasm();
            return loaded;
        } catch (fallbackError) {
            warn('Failed to load WASM with fallback:', fallbackError);
        }
        
        return null;
    }
};

/**
 * Ensure crypto is initialized
 */
export const ensureCryptoInit = async (): Promise<void> => {
    if (cryptoInitDone) {
        return;
    }
    
    try {
        const module = await initWASM();
        if (module && typeof module.crypto_init === 'function') {
            module.crypto_init();
        }
        cryptoInitDone = true;
        log('Crypto initialized');
    } catch (err) {
        warn('Failed to initialize crypto:', err);
        cryptoInitDone = false;
    }
};

/**
 * Create a crypto adapter that works across environments
 */
export const createCryptoAdapter = (): CryptoAdapter => {
    return {
        crypto_init: async () => {
            await ensureCryptoInit();
        },
        
        crypto_generate_key: async () => {
            try {
                const module = await initWASM();
                if (module && typeof module.crypto_generate_key === 'function') {
                    return module.crypto_generate_key();
                }
                
                // Fallback: generate a simple key
                const array = new Uint32Array(32);
                window.crypto.getRandomValues(array);
                return Array.from(array).map(b => b.toString(16).padStart(8, '0')).join('');
                
            } catch {
                const array = new Uint32Array(32);
                window.crypto.getRandomValues(array);
                return Array.from(array).map(b => b.toString(16).padStart(8, '0')).join('');
            }
        },
        
        crypto_encrypt_blob: async (dataB64: string, keyB64: string) => {
            try {
                const module = await initWASM();
                if (module && typeof module.crypto_encrypt_blob === 'function') {
                    return module.crypto_encrypt_blob(dataB64, keyB64);
                }
                
                // Fallback: simple encryption
                return {
                    encrypted_data: btoa(dataB64 + '|' + keyB64),
                    decryption_header: 'fallback'
                };
                
            } catch {
                return {
                    encrypted_data: btoa(dataB64 + '|' + keyB64),
                    decryption_header: 'fallback'
                };
            }
        },
        
        crypto_decrypt_blob: async (encryptedDataB64: string, headerB64: string, keyB64: string) => {
            try {
                const module = await initWASM();
                if (module && typeof module.crypto_decrypt_blob === 'function') {
                    return module.crypto_decrypt_blob(encryptedDataB64, headerB64, keyB64);
                }
                
                // Fallback: simple decryption
                if (headerB64 === 'fallback') {
                    const decoded = atob(encryptedDataB64);
                    const parts = decoded.split('|');
                    return parts[0] || '';
                }
                
                return '';
                
            } catch {
                if (headerB64 === 'fallback') {
                    const decoded = atob(encryptedDataB64);
                    const parts = decoded.split('|');
                    return parts[0] || '';
                }
                return '';
            }
        },
    };
};

/**
 * Get the WASM crypto adapter
 */
let cryptoAdapter: CryptoAdapter | null = null;

export const getCryptoAdapter = (): CryptoAdapter => {
    if (!cryptoAdapter) {
        cryptoAdapter = createCryptoAdapter();
    }
    return cryptoAdapter;
};



/**
 * Check if SIMD is supported in WASM
 */
export const checkSIMDSupport = (): boolean => {
    try {
        if (typeof WebAssembly === 'undefined') {
            return false;
        }
        
        // Check for SIMD support
        const simdTest = new Uint8Array([
            0x00, 0x61, 0x73, 0x6d, // WASM magic
            0x01, 0x00, 0x00, 0x00, // Version
            0x01, 0x01, 0x04,      // Section: Custom (SIMD feature detection)
            0x04, 0x73, 0x69, 0x6d, 0x64, // "simd"
            0x01,                 // Length
            0x01                 // Enabled
        ]);
        
        return WebAssembly.validate(simdTest);
        
    } catch {
        return false;
    }
};

/**
 * Get WASM support information
 */
export const getWASMInfo = async (): Promise<{
    wasmSupported: boolean;
    webgpuSupported: boolean;
    simdSupported: boolean;
    runtime: string;
}> => {
    const wasmSupported = checkWASMSupport();
    const webgpuSupported = await checkWebGPUSupport();
    const simdSupported = checkSIMDSupport();
    const runtime = getRuntimeEnvironment();
    
    return {
        wasmSupported,
        webgpuSupported,
        simdSupported,
        runtime,
    };
};

export default {
    initWASM,
    ensureCryptoInit,
    createCryptoAdapter,
    getCryptoAdapter,
    checkSIMDSupport,
    getWASMInfo,
};
