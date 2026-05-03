import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initOfflineSupport } from './services/offline';
import { initModelCache } from './services/models/model-downloader';
import { log } from './services/logging';

// Initialize services before rendering the app
const initializeServices = async () => {
    try {
        // Initialize offline support (service worker, etc.)
        await initOfflineSupport();
        
        // Initialize model cache
        await initModelCache();
        
        log('✓ All services initialized successfully');
    } catch (error) {
        console.error('✗ Failed to initialize services:', error);
    }
};

// Initialize services and then render the app
initializeServices().then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
});
