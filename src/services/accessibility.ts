// Accessibility settings -> CSS classes on the html element.
// The classes are defined in index.css (text scaling, readable text,
// reduced motion) and scale the whole rem-based UI.

import type { AppSettings, TextScale } from './settings';

const TEXT_SCALE_CLASSES = ['text-scale-small', 'text-scale-standard', 'text-scale-large', 'text-scale-xlarge'];

/** The four text size levels - shared by the settings page and the chat control */
export const TEXT_SCALES: Array<{ value: TextScale; icon: string; labelKey: string }> = [
  { value: 'small', icon: 'A⁻', labelKey: 'settings.textSmall' },
  { value: 'standard', icon: 'A', labelKey: 'settings.textStandard' },
  { value: 'large', icon: 'A⁺', labelKey: 'settings.textLarge' },
  { value: 'xlarge', icon: 'A⁺⁺', labelKey: 'settings.textXLarge' },
];

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
  html.classList.toggle('high-contrast', settings.highContrast);
  html.classList.toggle('readable-font', settings.readableFont);
};
