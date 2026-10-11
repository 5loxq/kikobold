import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import deTranslations from '../locales/de.json';
import enTranslations from '../locales/en.json';
import { localStorageGet } from '../services/storage/local-storage';

const resources = {
  de: { translation: deTranslations },
  en: { translation: enTranslations },
};

// Get language preference from localStorage or default to 'de' (German).
// Validate the stored value: anything else (stale key, manual edit) would
// end up as <html lang> and break screen reader pronunciation even though
// i18next falls back internally.
const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
const storedLanguage = localStorageGet('language_preference');
const savedLanguage: (typeof SUPPORTED_LANGUAGES)[number] =
  storedLanguage !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(storedLanguage)
    ? (storedLanguage as (typeof SUPPORTED_LANGUAGES)[number])
    : 'de';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false,
    },
  });

// Keep the html lang attribute in sync with the UI language (WCAG 3.1.1):
// screen readers pick their pronunciation engine from it - without this,
// the English UI would be read with German pronunciation rules.
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = savedLanguage;

export default i18n;
