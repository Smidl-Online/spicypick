import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';
import cs from './cs.json';
import de from './de.json';
import es from './es.json';
import pt from './pt.json';
import fr from './fr.json';
import ja from './ja.json';

const supportedLangs = ['en', 'cs', 'de', 'es', 'pt', 'fr', 'ja'];
const deviceLang = getLocales()[0]?.languageCode || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cs: { translation: cs },
    de: { translation: de },
    es: { translation: es },
    pt: { translation: pt },
    fr: { translation: fr },
    ja: { translation: ja },
  },
  lng: supportedLangs.includes(deviceLang) ? deviceLang : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'cs', name: 'Čeština' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'ja', name: '日本語' },
];

export default i18n;
