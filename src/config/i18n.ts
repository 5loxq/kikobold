import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import deTranslations from '../locales/de.json';
import enTranslations from '../locales/en.json';
import { localStorageGet } from '../services/storage/local-storage';

const resources = {
  de: { translation: deTranslations },
  en: { translation: enTranslations },
};

// Get language preference from localStorage or default to 'de' (German)
const savedLanguage = localStorageGet('language_preference') ?? 'de';

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
