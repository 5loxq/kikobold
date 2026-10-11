/**
 * Mobile device detection shared by the model load paths and UI hints.
 *
 * Two signals are combined:
 * - the user agent (phones/tablets identify as Mobi/Android/iPhone/iPad/iPod)
 * - a coarse pointer (catches iPads that report a desktop UA)
 *
 * Both only steer hints and resource settings (smaller context, wake lock,
 * warnings) - a wrong guess must never break the load itself.
 */
export const isMobileLike = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
};

/**
 * iOS device detection. Every browser on iOS (Safari, Chrome, Firefox,
 * Edge...) is required to use Apple's WebKit engine, so the UA-based check
 * covers them all. iPadOS 13+ reports a desktop Mac UA - the touch check
 * catches it (a Mac never has touch points, an iPad always has).
 */
export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true;
  }
  const platform = (navigator as Navigator & { platform?: string }).platform ?? '';
  const maxTouchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  return /MacIntel/i.test(platform) && maxTouchPoints > 1;
};

/**
 * Device RAM in GB as reported by the browser, if it reports it at all.
 * Chrome on Android does (rounded to powers of two, capped at 8);
 * Safari/Firefox do not - callers must treat undefined as "unknown".
 */
export const getDeviceMemoryGB = (): number | undefined => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === 'number' && memory > 0 ? memory : undefined;
};
