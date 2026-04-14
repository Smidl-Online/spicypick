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
import zh from './zh.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'cs', name: 'Čeština' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
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

const resources = {
  en: { translation: en },
  cs: { translation: cs },
  de: { translation: de },
  es: { translation: es },
  pt: { translation: pt },
  fr: { translation: fr },
  ja: { translation: ja },
  zh: { translation: zh },
};

async function initI18n() {
  const saved = await getSavedLocale();
  const lng = saved && supportedCodes.includes(saved)
    ? saved
    : supportedCodes.includes(deviceLang) ? deviceLang : 'en';

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export const i18nReady = initI18n();

export default i18n;
