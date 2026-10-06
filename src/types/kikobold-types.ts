/**
 * Type-Definitionen fuer KI Kobold
 */

// ============================================================================
// System Information Types
// ============================================================================

export interface SystemInfo {
  browser: {
    name: string;
    version: string;
    userAgent: string;
  };
  os: {
    name: string;
    version: string;
    architecture: string;
  };
  hardware: {
    cpu: {
      cores: number;
      name: string;
    };
    gpu: GPUInfo;
    memory: MemoryInfo;
  };
  features: {
    webgpu: boolean;
    wasm: boolean;
    webAssembly: boolean;
    serviceWorker: boolean;
    indexedDB: boolean;
    cacheAPI: boolean;
    offline: boolean;
    webWorkers: boolean;
    sharedWorkers: boolean;
    broadcastChannel: boolean;
    fileSystemAccess: boolean;
    clipboard: boolean;
  };
  storage: {
    indexedDB: boolean;
    localStorage: boolean;
    sessionStorage: boolean;
    cacheAPI: boolean;
    maxStorageMB: number;
    usedStorageMB: number;
  };
}

export interface GPUInfo {
  name: string;
  vendor: string;
  memoryMB: number;
  webgpuSupport: boolean;
  canUseForInference: boolean;
}

export interface MemoryInfo {
  totalMB: number;
  availableMB: number;
  usedMB: number;
  usagePercent: number;
}

// ============================================================================
// Theme and Customization Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSettings {
  mode: ThemeMode;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  borderRadius?: number;
  fontFamily?: string;
  fontSize?: number;
}

export interface CustomizationSettings {
  theme: ThemeSettings;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  animationEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

