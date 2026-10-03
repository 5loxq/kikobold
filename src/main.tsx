import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'katex/dist/katex.min.css'
import { initOfflineSupport } from './services/offline';
import { initModelCache } from './services/models/model-downloader';
import { initThemeService } from './services/theme';
import { initModelConfigService } from './services/model-config';
import { getSystemInfo } from './services/system-info';
import { info, log } from './services/logging';

// Initialize services before rendering the app
const initializeServices = async (): Promise<void> => {
    try {
        // Initialize offline support (service worker, etc.)
        await initOfflineSupport();
        log('✓ Offline support initialized');
        
        // Initialize model cache
        await initModelCache();
        log('✓ Model cache initialized');
        
        // Initialize theme service
        await initThemeService();
        log('✓ Theme service initialized');
        
        // Initialize model configuration service
        await initModelConfigService();
        log('✓ Model configuration service initialized');
        
        // Pre-load system information
        const systemInfo = await getSystemInfo();
        info(`System: ${systemInfo.browser.name} ${systemInfo.browser.version} on ${systemInfo.os.name}`);
        info(`WebGPU: ${systemInfo.features.webgpu ? '✓ Available' : '✗ Not available'}`);
        info(`WASM: ${systemInfo.features.wasm ? '✓ Available' : '✗ Not available'}`);
        log('✓ System information loaded');
        
        log('✓ All services initialized successfully');
    } catch (error) {
        console.error('✗ Failed to initialize services:', error);
    }
};

// Initialize services and then render the app
initializeServices().then(() => {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
});
