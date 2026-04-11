import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import cs from './cs.json';
import de from './de.json';
import es from './es.json';
import pt from './pt.json';
import fr from './fr.json';
import ja from './ja.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'cs', name: 'Čeština' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'ja', name: '日本語' },
];

const supportedCodes = SUPPORTED_LANGUAGES.map((l) => l.code);
const deviceLang = getLocales()[0]?.languageCode || 'en';

const LOCALE_STORAGE_KEY = 'spicypick_locale';

export async function getSavedLocale(): Promise<string | null> {
  return AsyncStorage.getItem(LOCALE_STORAGE_KEY);
}

export async function saveLocale(code: string): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, code);
}

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
  lng: supportedCodes.includes(deviceLang) ? deviceLang : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

getSavedLocale().then((saved) => {
  if (saved && supportedCodes.includes(saved)) {
    i18n.changeLanguage(saved);
  }
});

export default i18n;
