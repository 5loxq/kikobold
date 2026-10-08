import { useEffect, useState } from 'react';

/**
 * Reactive online/offline status: re-renders whenever the browser goes
 * online or offline, with the correct initial value from navigator.onLine.
 * (The service worker's listener-based detection does not reach React
 * components on its own - this hook closes that gap.)
 */
export const useOfflineStatus = (): boolean => {
  const [offline, setOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const goOnline = (): void => setOffline(false);
    const goOffline = (): void => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return (): void => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return offline;
};
