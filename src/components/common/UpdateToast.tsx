/**
 * "New version available" toast.
 *
 * The service worker deploys roll out immediately, but long-lived tabs
 * never notice. On mount (and every 30 min) we check for a waiting worker;
 * if one exists, we offer a one-click reload. Reloading swaps the tab to
 * the fresh assets without losing anything (chats live in IndexedDB).
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    checkForUpdates,
    getServiceWorkerRegistration,
    skipWaiting,
} from '../../services/offline/sw-registration';

export const UpdateToast: React.FC = () => {
    const { t } = useTranslation();
    const [updateReady, setUpdateReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const watchWaiting = (reg: ServiceWorkerRegistration | null): void => {
            if (reg?.waiting && reg.active && reg.waiting !== reg.active) {
                setUpdateReady(true);
            }
        };

        // Initial check: a waiting worker may already exist
        checkForUpdates().then((found) => {
            if (!cancelled && found) { setUpdateReady(true); }
        }).catch(() => undefined);
        watchWaiting(getServiceWorkerRegistration());

        // New installs arriving later + periodic re-check
        const onUpdateFound = (): void => {
            watchWaiting(getServiceWorkerRegistration());
        };
        navigator.serviceWorker?.addEventListener('updatefound', onUpdateFound);
        const interval = window.setInterval(() => {
            checkForUpdates().then((found) => {
                if (!cancelled && found) { setUpdateReady(true); }
            }).catch(() => undefined);
        }, 30 * 60 * 1000);

        return (): void => {
            cancelled = true;
            navigator.serviceWorker?.removeEventListener('updatefound', onUpdateFound);
            window.clearInterval(interval);
        };
    }, []);

    if (!updateReady) {
        return null;
    }

    const handleReload = async (): Promise<void> => {
        await skipWaiting().catch(() => undefined);
        window.location.reload();
    };

    return (
        <div
            role="status"
            className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl px-4 py-3 shadow-2xl border border-zinc-700"
        >
            <span className="text-sm">🆕 {t('update.available')}</span>
            <button
                onClick={() => void handleReload()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold transition-colors"
            >
                {t('update.reload')}
            </button>
            <button
                onClick={() => setUpdateReady(false)}
                aria-label={t('common.close')}
                className="text-zinc-400 hover:text-white text-sm px-1"
            >
                ✕
            </button>
        </div>
    );
};

export default UpdateToast;
