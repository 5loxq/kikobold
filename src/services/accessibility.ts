// Accessibility settings -> CSS classes on the html element.
// The classes are defined in index.css (text scaling, readable text,
// reduced motion) and scale the whole rem-based UI.

import type { AppSettings } from './settings';

const TEXT_SCALE_CLASSES = ['text-scale-small', 'text-scale-standard', 'text-scale-large', 'text-scale-xlarge'];

/** Apply the accessibility-related settings to the document element. */
export const applyAccessibilityClasses = (settings: AppSettings): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const html = document.documentElement;

  html.classList.remove(...TEXT_SCALE_CLASSES);
  if (settings.textScale !== 'standard') {
    html.classList.add(`text-scale-${settings.textScale}`);
  }

  html.classList.toggle('readable-text', settings.readableText);
  html.classList.toggle('reduce-motion', settings.reduceMotion);
};
