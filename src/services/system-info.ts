/**
 * System Information Service
 * 
 * Provides comprehensive information about the user's system including:
 * - Browser and OS details
 * - Hardware information (CPU, GPU, Memory)
 * - Feature detection (WebGPU, WASM, etc.)
 * - Storage information
 */

import { GPUInfo, MemoryInfo, SystemInfo } from '../types/kikobold-types';
import { checkWASMSupport, checkWebGPUSupport } from './security';

// ============================================================================
// Browser Detection
// ============================================================================

interface BrowserInfo {
  name: string;
  version: string;
  userAgent: string;
}

const detectBrowser = (): BrowserInfo => {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  // Edge (modern UAs contain "Edg/", older ones "Edge" - both also contain
  // "Chrome", so this must be checked before Chrome)
  if (userAgent.includes('Edg')) {
    const versionMatch = userAgent.match(/Edg(?:e)?\/(\d+\.\d+)/);
    return {
      name: 'Edge',
      version: versionMatch ? versionMatch[1] : 'Unknown',
      userAgent,
    };
  }

  // Opera (UAs contain "Chrome" AND "OPR" - must be checked before Chrome)
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    const versionMatch = userAgent.match(/(Opera|OPR)\/(\d+\.\d+)/);
    return {
      name: 'Opera',
      version: versionMatch ? versionMatch[2] : 'Unknown',
      userAgent,
    };
  }

  // Vivaldi (UAs contain "Chrome" AND "Vivaldi" - must be checked before
  // Chrome). Note: Brave deliberately ships a Chrome-identical UA and cannot
  // be detected this way - it is reported as Chrome.
  if (userAgent.includes('Vivaldi')) {
    const versionMatch = userAgent.match(/Vivaldi\/(\d+\.\d+)/);
    return {
      name: 'Vivaldi',
      version: versionMatch ? versionMatch[1] : 'Unknown',
      userAgent,
    };
  }

  // Chrome
  if (userAgent.includes('Chrome')) {
    const versionMatch = userAgent.match(/Chrome\/(\d+\.\d+)/);
    return {
      name: 'Chrome',
      version: versionMatch ? versionMatch[1] : 'Unknown',
      userAgent,
    };
  }

  // Firefox
  if (userAgent.includes('Firefox')) {
    const versionMatch = userAgent.match(/Firefox\/(\d+\.\d+)/);
    return {
      name: 'Firefox',
      version: versionMatch ? versionMatch[1] : 'Unknown',
      userAgent,
    };
  }

  // Safari
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const versionMatch = userAgent.match(/Version\/(\d+\.\d+)/);
    return {
      name: 'Safari',
      version: versionMatch ? versionMatch[1] : 'Unknown',
      userAgent,
    };
  }

  return {
    name: 'Unknown',
    version: 'Unknown',
    userAgent,
  };
};

// ============================================================================
// OS Detection
// ============================================================================

interface OSInfo {
  name: string;
  version: string;
  architecture: string;
}

const detectOS = (): OSInfo => {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
  
  // Windows
  if (platform.includes('Win')) {
    const versionMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : 'Unknown';
    const architecture = platform.includes('64') ? 'x64' : 'x86';
    return { name: 'Windows', version, architecture };
  }

  // macOS
  if (platform.includes('Mac')) {
    const versionMatch = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    const version = versionMatch ? versionMatch[1].replace('_', '.') : 'Unknown';
    return { name: 'macOS', version, architecture: 'x64' };
  }

  // Android (its UA contains "Linux", so this must be checked before Linux)
  if (userAgent.includes('Android')) {
    const versionMatch = userAgent.match(/Android (\d+\.\d+)/);
    return { name: 'Android', version: versionMatch ? versionMatch[1] : 'Unknown', architecture: 'ARM' };
  }

  // Chrome OS (navigator.platform reports "Linux x86_64" there, so check
  // the UA's "CrOS" marker before the generic Linux check)
  if (userAgent.includes('CrOS')) {
    return { name: 'Chrome OS', version: 'Unknown', architecture: 'x64' };
  }

  // Linux
  if (platform.includes('Linux') || userAgent.includes('Linux')) {
    const architecture = platform.includes('64') ? 'x64' :
                       platform.includes('ARM') ? 'ARM' : 'x86';
    return { name: 'Linux', version: 'Unknown', architecture };
  }

  // iOS
  if (platform.includes('iPhone') || platform.includes('iPad') || platform.includes('iPod')) {
    const versionMatch = userAgent.match(/OS (\d+_\d+)/);
    const version = versionMatch ? versionMatch[1].replace('_', '.') : 'Unknown';
    return { name: 'iOS', version, architecture: 'ARM' };
  }

  return { name: 'Unknown', version: 'Unknown', architecture: 'Unknown' };
};// ============================================================================
// GPU Detection
// ============================================================================

interface GPUAdapterInfoStub {
  vendor?: string;
  device?: { description?: string; memory?: { totalBytes?: number } };
}

interface GPUAdapterStub {
  name?: string;
  requestAdapterInfo?: () => Promise<GPUAdapterInfoStub>;
}

const detectGPU = async (): Promise<GPUInfo> => {
  try {
    // Check if WebGPU is available
    const webgpuAvailable = await checkWebGPUSupport();
    
    if (webgpuAvailable && 'gpu' in navigator) {
      try {
        const adapter = await (navigator as Navigator & { gpu: { requestAdapter: () => Promise<GPUAdapterStub | null> } }).gpu.requestAdapter();
        if (adapter) {
          const info = await adapter.requestAdapterInfo?.();
          return {
            name: info?.device?.description ?? adapter.name ?? 'Unknown GPU',
            vendor: info?.vendor ?? 'Unknown',
            memoryMB: info?.device?.memory?.totalBytes ? 
                      Math.round(info.device.memory.totalBytes / (1024 * 1024)) : 0,
            webgpuSupport: true,
            canUseForInference: true,
          };
        }
      } catch {
        // Fallback for browsers that don't support requestAdapterInfo
      }
      
      return {
        name: 'WebGPU-compatible GPU',
        vendor: 'Unknown',
        memoryMB: 0,
        webgpuSupport: true,
        canUseForInference: true,
      };
    }
    
    return {
      name: 'No GPU detected',
      vendor: 'None',
      memoryMB: 0,
      webgpuSupport: false,
      canUseForInference: false,
    };
  } catch {
    return {
      name: 'GPU detection failed',
      vendor: 'Unknown',
      memoryMB: 0,
      webgpuSupport: false,
      canUseForInference: false,
    };
  }
};

// ============================================================================
// Memory Detection
// ============================================================================

const detectMemory = async (): Promise<MemoryInfo> => {
  try {
    // navigator.deviceMemory reports the real device RAM (capped at 8 GB
    // by the spec). performance.memory.jsHeapSizeLimit is NOT the device
    // RAM - it is the JS heap cap (~4 GB in Chrome) and would understate
    // every desktop; it is only used for the "used" figure.
    const deviceMemoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const perf = typeof window !== 'undefined' && 'performance' in window
      ? (window.performance as Performance & { memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number } })
      : undefined;
    if (typeof deviceMemoryGB === 'number' && deviceMemoryGB > 0) {
      const totalMB = Math.round(deviceMemoryGB * 1024);
      const usedMB = perf?.memory
        ? Math.round(perf.memory.usedJSHeapSize / (1024 * 1024))
        : 0;
      const availableMB = Math.max(0, totalMB - usedMB);
      
      return {
        totalMB,
        availableMB,
        usedMB,
        usagePercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
      };
    }
    
    // Fallback: estimate based on device type
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Mobile devices typically have 2-4GB RAM
      return {
        totalMB: 4096,
        availableMB: 2048,
        usedMB: 2048,
        usagePercent: 50,
      };
    }
    
    // Desktop: assume 8GB minimum
    return {
      totalMB: 8192,
      availableMB: 4096,
      usedMB: 4096,
      usagePercent: 50,
    };
  } catch {
    return {
      totalMB: 0,
      availableMB: 0,
      usedMB: 0,
      usagePercent: 0,
    };
  }
};

// ============================================================================
// CPU Detection
// ============================================================================

interface CPUInfo {
  cores: number;
  name: string;
}

const detectCPU = (): CPUInfo => {
  try {
    // Use navigator.hardwareConcurrency if available
    if (typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator) {
      const cores = navigator.hardwareConcurrency || 1;
      
      // Try to get CPU name from userAgent (limited info)
      const userAgent = navigator.userAgent;
      let name = 'Unknown';
      
      if (userAgent.includes('Intel')) {
        name = 'Intel';
      } else if (userAgent.includes('AMD')) {
        name = 'AMD';
      } else if (userAgent.includes('Apple')) {
        name = 'Apple Silicon';
      } else if (userAgent.includes('ARM')) {
        name = 'ARM';
      }
      
      return { cores, name };
    }
    
    return { cores: 1, name: 'Unknown' };
  } catch {
    return { cores: 1, name: 'Unknown' };
  }
};

// ============================================================================
// Feature Detection
// ============================================================================

interface FeatureInfo {
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
}

const detectFeatures = async (): Promise<FeatureInfo> => {
  const webgpu = await checkWebGPUSupport();
  const wasm = checkWASMSupport();
  
  return {
    webgpu,
    wasm,
    webAssembly: 'WebAssembly' in window,
    serviceWorker: 'serviceWorker' in navigator,
    indexedDB: 'indexedDB' in window,
    cacheAPI: 'caches' in window,
    offline: 'onLine' in navigator,
    webWorkers: 'Worker' in window,
    sharedWorkers: 'SharedWorker' in window,
    broadcastChannel: 'BroadcastChannel' in window,
    fileSystemAccess: 'showSaveFilePicker' in window,
    clipboard: 'clipboard' in navigator,
  };
};

// ============================================================================
// Storage Detection
// ============================================================================

interface StorageInfo {
  indexedDB: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  cacheAPI: boolean;
  maxStorageMB: number;
  usedStorageMB: number;
}

const detectStorage = async (): Promise<StorageInfo> => {
  try {
    const hasIndexedDB = 'indexedDB' in window;
    const hasLocalStorage = 'localStorage' in window;
    const hasSessionStorage = 'sessionStorage' in window;
    const hasCacheAPI = 'caches' in window;
    
    // Estimate storage usage
    let usedStorageMB = 0;
    let maxStorageMB = 0;
    
    // Try to get quota information
    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        usedStorageMB = Math.round((estimate.usage ?? 0) / (1024 * 1024));
        maxStorageMB = Math.round((estimate.quota ?? 5120 * 1024 * 1024) / (1024 * 1024));
      } catch {
        // Fallback estimates
        usedStorageMB = 0;
        maxStorageMB = 5120; // 5GB default quota
      }
    } else {
      // Fallback: assume 5GB quota
      maxStorageMB = 5120;
      
      // Try to estimate used storage from localStorage
      if (typeof localStorage !== 'undefined') {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            if (value) {
              totalSize += key.length + value.length;
            }
          }
        }
        usedStorageMB = Math.round(totalSize / (1024 * 1024));
      }
    }
    
    return {
      indexedDB: hasIndexedDB,
      localStorage: hasLocalStorage,
      sessionStorage: hasSessionStorage,
      cacheAPI: hasCacheAPI,
      maxStorageMB,
      usedStorageMB,
    };
  } catch {
    return {
      indexedDB: false,
      localStorage: false,
      sessionStorage: false,
      cacheAPI: false,
      maxStorageMB: 0,
      usedStorageMB: 0,
    };
  }
};

// ============================================================================
// System Information Service
// ============================================================================

let cachedSystemInfo: SystemInfo | null = null;
let infoPromise: Promise<SystemInfo> | null = null;

/**
 * Get comprehensive system information
 */
export const getSystemInfo = async (): Promise<SystemInfo> => {
  // Return cached info if available
  if (cachedSystemInfo) {
    return cachedSystemInfo;
  }
  
  // Return existing promise if in progress
  if (infoPromise) {
    return infoPromise;
  }
  
  infoPromise = (async (): Promise<SystemInfo> => {
    const [browser, os, gpu, memory, cpu, features, storage] = await Promise.all([
      Promise.resolve(detectBrowser()),
      Promise.resolve(detectOS()),
      detectGPU(),
      detectMemory(),
      Promise.resolve(detectCPU()),
      detectFeatures(),
      detectStorage(),
    ]);
    
    const systemInfo: SystemInfo = {
      browser,
      os,
      hardware: {
        cpu,
        gpu,
        memory,
      },
      features,
      storage,
    };
    
    cachedSystemInfo = systemInfo;
    
    return systemInfo;
  })().finally(() => {
    // Reset even on failure: a rejected promise must not stay cached,
    // otherwise every later call rejects forever.
    infoPromise = null;
  });
  
  return infoPromise;
};

/**
 * Get GPU information
 */
export const getGPUInfo = async (): Promise<GPUInfo> => {
  const systemInfo = await getSystemInfo();
  return systemInfo.hardware.gpu;
};

/**
 * Get memory information
 */
export const getMemoryInfo = async (): Promise<MemoryInfo> => {
  const systemInfo = await getSystemInfo();
  return systemInfo.hardware.memory;
};

/**
 * Check if WebGPU is available
 */
export const isWebGPUAvailable = async (): Promise<boolean> => {
  const systemInfo = await getSystemInfo();
  return systemInfo.features.webgpu;
};

/**
 * Check if WASM is available
 */
export const isWASMAvailable = async (): Promise<boolean> => {
  const systemInfo = await getSystemInfo();
  return systemInfo.features.wasm;
};

/**
 * Check if offline mode is supported
 */
export const isOfflineSupported = async (): Promise<boolean> => {
  const systemInfo = await getSystemInfo();
  return systemInfo.features.offline;
};

/**
 * Check if the browser is online
 */
export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

/**
 * Get browser name
 */
export const getBrowserName = (): string => {
  return detectBrowser().name;
};

/**
 * Get OS name
 */
export const getOSName = (): string => {
  return detectOS().name;
};

/**
 * Check if running on mobile device
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') {return false;}
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Check if running on desktop
 */
export const isDesktopDevice = (): boolean => {
  return !isMobileDevice();
};

/**
 * Get device type
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (typeof navigator === 'undefined') {return 'desktop';}
  
  const userAgent = navigator.userAgent;
  
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) {
    return 'tablet';
  }
  
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) {
    return 'mobile';
  }
  
  return 'desktop';
};

/**
 * Refresh system information (clear cache)
 */
export const refreshSystemInfo = async (): Promise<SystemInfo> => {
  cachedSystemInfo = null;
  infoPromise = null;
  return getSystemInfo();
};

/**
 * Get a summary of system capabilities for display
 */
export const getSystemSummary = async (): Promise<{
  browser: string;
  os: string;
  gpu: string;
  memory: string;
  webgpu: boolean;
  wasm: boolean;
  storage: string;
}> => {
  const systemInfo = await getSystemInfo();
  
  return {
    browser: `${systemInfo.browser.name} ${systemInfo.browser.version}`,
    os: `${systemInfo.os.name} ${systemInfo.os.version}`,
    gpu: systemInfo.hardware.gpu.name,
    memory: `${systemInfo.hardware.memory.totalMB} MB`,
    webgpu: systemInfo.features.webgpu,
    wasm: systemInfo.features.wasm,
    storage: `${systemInfo.storage.usedStorageMB} MB / ${systemInfo.storage.maxStorageMB} MB`,
  };
};

/**
 * Check if the system meets minimum requirements for LLM inference
 */
export const checkMinimumRequirements = async (): Promise<{
  meetsRequirements: boolean;
  missingFeatures: string[];
  warnings: string[];
}> => {
  const systemInfo = await getSystemInfo();
  const missingFeatures: string[] = [];
  const warnings: string[] = [];
  
  // Check required features
  if (!systemInfo.features.webgpu && !systemInfo.features.wasm) {
    missingFeatures.push('WebGPU or WebAssembly');
  }
  
  if (!systemInfo.features.indexedDB && !systemInfo.features.cacheAPI) {
    missingFeatures.push('Storage (IndexedDB or Cache API)');
  }
  
  // Check memory
  if (systemInfo.hardware.memory.totalMB < 2048) {
    warnings.push('Low memory (less than 2GB) - larger models may not work');
  }
  
  // Check GPU
  if (!systemInfo.hardware.gpu.webgpuSupport) {
    warnings.push('WebGPU not available - inference will be slower');
  }
  
  // Check if mobile
  if (isMobileDevice()) {
    warnings.push('Mobile device - performance may be limited');
  }
  
  return {
    meetsRequirements: missingFeatures.length === 0,
    missingFeatures,
    warnings,
  };
};

/**
 * Get performance recommendations based on system info
 */
export const getPerformanceRecommendations = async (): Promise<string[]> => {
  const systemInfo = await getSystemInfo();
  const recommendations: string[] = [];
  
  // GPU recommendations
  if (!systemInfo.features.webgpu) {
    recommendations.push('WebGPU is not supported. Consider using Chrome 126+ or Edge 126+ for GPU acceleration.');
  }
  
  // Memory recommendations
  if (systemInfo.hardware.memory.totalMB < 4096) {
    recommendations.push('Your device has limited memory. Use smaller models (under 2B parameters) for best performance.');
  } else if (systemInfo.hardware.memory.totalMB < 8192) {
    recommendations.push('Your device has moderate memory. Models up to 7B parameters should work well.');
  } else {
    recommendations.push('Your device has plenty of memory. You can use larger models (up to 13B parameters).');
  }
  
  // Storage recommendations
  if (systemInfo.storage.usedStorageMB > systemInfo.storage.maxStorageMB * 0.8) {
    recommendations.push('Your browser storage is nearly full. Clear cached data to free up space.');
  }
  
  // Mobile recommendations
  if (isMobileDevice()) {
    recommendations.push('You are on a mobile device. Use smaller models and reduce maxTokens for better performance.');
  }
  
  // Browser recommendations
  if (systemInfo.browser.name === 'Firefox') {
    recommendations.push('Firefox has experimental WebGPU support. Enable it in about:config for better performance.');
  }
  
  if (systemInfo.browser.name === 'Safari') {
    recommendations.push('Safari has limited WebGPU support. Consider using Chrome or Edge for full functionality.');
  }
  
  return recommendations;
};

export default {
  getSystemInfo,
  getGPUInfo,
  getMemoryInfo,
  isWebGPUAvailable,
  isWASMAvailable,
  isOfflineSupported,
  isOnline,
  getBrowserName,
  getOSName,
  isMobileDevice,
  isDesktopDevice,
  getDeviceType,
  refreshSystemInfo,
  getSystemSummary,
  checkMinimumRequirements,
  getPerformanceRecommendations,
};
