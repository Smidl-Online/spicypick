import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';
import cs from './cs.json';

const deviceLang = getLocales()[0]?.languageCode || 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, cs: { translation: cs } },
  lng: ['en', 'cs'].includes(deviceLang) ? deviceLang : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
