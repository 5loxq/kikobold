import React from 'react';
import { useTranslation } from 'react-i18next';
import { secureLocalStorage } from '../../services/security';

export const LanguageSwitcher: React.FC<{ isCollapsed?: boolean }> = ({ isCollapsed = false }) => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang: string): void => {
    i18n.changeLanguage(lang);
    secureLocalStorage.setItem('language_preference', lang);
  };

  return (
    <div className="flex gap-1">
      {!isCollapsed && <span className="text-xs text-zinc-500 mr-auto mt-1">Language</span>}
      <button
        onClick={() => handleLanguageChange('de')}
        className={`px-2 py-1 rounded text-sm transition-colors ${
          i18n.language === 'de'
            ? 'bg-blue-600 text-white'
            : 'hover:bg-gray-800 text-gray-300'
        }`}
        title="Deutsch"
      >
        🇩🇪 {!isCollapsed && 'DE'}
      </button>
      <button
        onClick={() => handleLanguageChange('en')}
        className={`px-2 py-1 rounded text-sm transition-colors ${
          i18n.language === 'en'
            ? 'bg-blue-600 text-white'
            : 'hover:bg-gray-800 text-gray-300'
        }`}
        title="English"
      >
        🇬🇧 {!isCollapsed && 'EN'}
      </button>
    </div>
  );
};
