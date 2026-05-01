import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import deTranslations from '../locales/de.json';
import enTranslations from '../locales/en.json';
import { secureLocalStorage } from '../services/security';

const resources = {
  de: { translation: deTranslations },
  en: { translation: enTranslations },
};

// Get language preference from localStorage or default to 'de' (German)
const savedLanguage = secureLocalStorage.getItem('language_preference') || 'de';

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

export default i18n;
