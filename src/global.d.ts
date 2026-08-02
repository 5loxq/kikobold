// Global type declarations for external modules that are loaded dynamically
// These modules are only available at runtime, not at compile time

// Tauri API modules - loaded dynamically, types not needed for compilation
declare module '@tauri-apps/api/core' {
    export function invoke(command: string, args?: any): Promise<any>;
    export function convertFileSrc(filePath: string): string;
}

declare module '@tauri-apps/api/path' {
    export function resolve(path: string): Promise<string>;
    export function join(...paths: string[]): Promise<string>;
    export function dirname(path: string): Promise<string>;
    export function basename(path: string): Promise<string>;
}

declare module '@tauri-apps/plugin-fs' {
    export function readFile(path: string): Promise<Uint8Array>;
    export function writeFile(path: string, contents: Uint8Array): Promise<void>;
    export function readTextFile(path: string): Promise<string>;
    export function writeTextFile(path: string, contents: string): Promise<void>;
    export function exists(path: string): Promise<boolean>;
    export function createDir(path: string): Promise<void>;
    export function removeFile(path: string): Promise<void>;
    export function readDir(path: string): Promise<{ path: string; name: string }[]>;
    
    export const BaseDirectory: {
        App: string;
        AppConfig: string;
        AppData: string;
        AppLocalData: string;
        AppLogs: string;
        AppCache: string;
        Audio: string;
        Cache: string;
        Config: string;
        Data: string;
        Desktop: string;
        Document: string;
        Download: string;
        Exec: string;
        Font: string;
        LocalData: string;
        Picture: string;
        Public: string;
        Resource: string;
        Runtime: string;
        Temp: string;
        Template: string;
        User: string;
        Video: string;
    };
}

declare module '@tauri-apps/plugin-updater' {
    export interface Update {
        version: string;
        available: boolean;
        body?: string;
        date?: Date;
        url?: string;
    }
    
    export interface InstallUpdateOptions {
        onProgress?: (progress: number) => void;
    }
    
    export function checkUpdate(): Promise<Update | null>;
    export function installUpdate(options?: InstallUpdateOptions): Promise<void>;
}

// WASM module for ente-wasm
declare module 'ente-wasm/load' {
    export function loadEnteWasm(): Promise<WebAssembly.Module>;
    export function initWasm(module: WebAssembly.Module): Promise<void>;
}

// Global types for WebGPU and other browser APIs
declare global {
    interface Navigator {
        gpu?: {
            requestAdapter(): Promise<unknown>;
        };
        deviceMemory?: number;
    }
    
    interface Window {
        WebAssembly: typeof WebAssembly;
    }
    
    interface Process {
        env: Record<string, string>;
        cwd: () => string;
        platform: string;
        version: string;
    }
    
    var process: Process;
}

// Error stack trace support
declare global {
    interface ErrorConstructor {
        captureStackTrace(error: Error, constructorOpt?: Function): void;
    }
}

// Legacy @xenova/transformers module stubs (no longer used, replaced by WebLLM)
declare module '@xenova/transformers' {
    export const pipeline: any;
    export const env: any;
    export const AutoTokenizer: any;
    export type TextGenerationPipeline = any;
}

// Stub module for build compatibility
declare module '@xenova-transformers-stub' {
    export const pipeline: any;
    export const env: { 
        useCPU: boolean;
        useWebGPU: boolean;
        localModelPath: string;
        remoteHost: string;
        allowedRemoteHosts: string[];
    };
    export const AutoTokenizer: any;
    export type TextGenerationPipeline = any;
}

// WebLLM types
declare module '@mlc-ai/web-llm' {
    export interface MLCEngineInterface {
        chat: {
            completions: {
                create: (options: any) => Promise<any>;
            };
        };
        getCurrentModelId: () => string | null;
        reload: (modelId: string) => Promise<void>;
    }

    export interface AppConfig {
        model_list?: Array<{
            model_id: string;
            model: string;
            model_lib?: string;
            integrity?: any;
        }>;
        cacheBackend?: 'cache' | 'indexeddb' | 'opfs' | 'cross-origin';
    }

    export interface EngineConfig {
        appConfig?: AppConfig;
        initProgressCallback?: (progress: { text?: string; progress: number }) => void;
    }

    export function CreateMLCEngine(
        modelId: string,
        config?: EngineConfig
    ): Promise<MLCEngineInterface>;

    export const prebuiltAppConfig: AppConfig;

    export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'silent'): void;
}