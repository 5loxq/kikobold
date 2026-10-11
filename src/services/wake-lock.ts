import { log, warn } from './logging';

/**
 * Screen Wake Lock for long-running browser work.
 *
 * Mobile browsers (especially iOS Safari) suspend the page when the screen
 * locks or the tab goes to the background. A model download or the in-memory
 * model preparation then freezes mid-way - the UI stays at "preparing"
 * forever. The Wake Lock API (Safari 16.4+, Chrome/Edge) keeps the screen on
 * while a model loads or a generation runs.
 *
 * The lock is reference-counted: nested sections (e.g. a model load that
 * falls back to another model and loads that one) can each request/release
 * it, and the screen stays awake until the last one finishes. Everything is
 * best-effort - unsupported browsers simply run without a lock.
 */

type SentinelLike = { release: () => Promise<void>; released: boolean };

let sentinel: SentinelLike | null = null;
let refCount = 0;
let visibilityListener: ((() => void) | null) = null;

const acquire = async (): Promise<void> => {
  const nav = navigator as Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<SentinelLike> };
  };
  if (!nav.wakeLock) {
    return;
  }
  try {
    sentinel = await nav.wakeLock.request('screen');
    log('Wake lock acquired');
  } catch (err) {
    // Common on iOS when the page is not visible/active - the work continues
    // without a lock, this is not an error worth surfacing.
    warn('Wake lock request failed:', err);
  }
};

const release = async (): Promise<void> => {
  const current = sentinel;
  sentinel = null;
  if (current && !current.released) {
    try {
      await current.release();
      log('Wake lock released');
    } catch (err) {
      warn('Wake lock release failed:', err);
    }
  }
};

/**
 * Keep the screen awake while a long-running section is active (model
 * download, model preparation, generation). Safe to nest: the lock is held
 * until every requestWakeLock() got its matching releaseWakeLock().
 */
export const requestWakeLock = async (): Promise<void> => {
  refCount++;
  if (refCount === 1) {
    await acquire();

    // The browser releases the lock when the page is hidden; grab it again
    // as soon as the user returns to the tab.
    visibilityListener = (): void => {
      if (document.visibilityState === 'visible' && refCount > 0 && !sentinel) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', visibilityListener);
  }
};

/** Release one requestWakeLock() reference. */
export const releaseWakeLock = async (): Promise<void> => {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) {
    if (visibilityListener) {
      document.removeEventListener('visibilitychange', visibilityListener);
      visibilityListener = null;
    }
    await release();
  }
};
