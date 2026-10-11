// Global type declarations for external modules that are loaded dynamically
// These modules are only available at runtime, not at compile time

// CSS modules (static and dynamic imports, e.g. the lazily loaded KaTeX CSS)
declare module '*.css';

// Vite build-time environment (replaced at compile time, no runtime object)
interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Tauri API modules - loaded dynamically, types not needed for compilation
declare module '@tauri-apps/api/core' {
    export function invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
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

// Global types for WebGPU and other browser APIs
declare global {
    interface Navigator {
        gpu?: {
            requestAdapter(): Promise<unknown>;
        };
        deviceMemory?: number;
    }

    interface Process {
        env: Record<string, string>;
        cwd: () => string;
        platform: string;
        version: string;
    }
    
    let process: Process;
}

// Error stack trace support
declare global {
    interface ErrorConstructor {
        captureStackTrace(error: Error, constructorOpt?: (...args: unknown[]) => unknown): void;
    }
}

// Legacy @xenova/transformers module stubs (no longer used, replaced by WebLLM)
declare module '@xenova/transformers' {
    export const pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<(text: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>>;
    export const env: Record<string, unknown>;
    export const AutoTokenizer: Record<string, unknown>;
    export type TextGenerationPipeline = (text: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

// Stub module for build compatibility
declare module '@xenova-transformers-stub' {
    export const pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<(text: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>>;
    export const env: { 
        useCPU: boolean;
        useWebGPU: boolean;
        localModelPath: string;
        remoteHost: string;
        allowedRemoteHosts: string[];
    };
    export const AutoTokenizer: Record<string, unknown>;
    export type TextGenerationPipeline = (text: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}
