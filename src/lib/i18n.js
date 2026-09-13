import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Only the fallback locale (Italian) is bundled into the entry chunk —
// every other locale is loaded on demand the first time it's selected.
// The LanguageSwitcher is currently disabled (locales table empty) so in
// practice this saves ~20 KB of JSON parsing on every cold start.
import it from '../../locales/it.json'

// Map of supported locales → dynamic loader. Vite turns these into
// separate async chunks under /assets/.
const localeLoaders = {
  en: () => import('../../locales/en.json'),
  fr: () => import('../../locales/fr.json'),
  es: () => import('../../locales/es.json'),
  de: () => import('../../locales/de.json'),
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
    },
    fallbackLng: 'it',
    supportedLngs: ['it', 'en', 'fr', 'es', 'de'],
    partialBundledLanguages: true,
    interpolation: {
      escapeValue: false,
    },
    // `navigator` è fuori dall'ordine di proposito, finché il
    // LanguageSwitcher resta disattivato.
    //
    // Il sito è scritto in italiano quasi ovunque nel markup; le stringhe che
    // passano da i18n sono una minoranza. Con il rilevamento dalla lingua del
    // browser, un torinese col telefono in inglese si ritrovava "Nearby
    // restaurants", "Search restaurants…" e "Original content in Italian" in
    // mezzo a una pagina per il resto tutta italiana — e senza selettore non
    // aveva modo di tornare indietro. Meglio una lingua sola e coerente.
    //
    // Chi ha già una scelta salvata in localStorage la mantiene: quando il
    // selettore tornerà attivo basterà rimettere 'navigator' qui sotto.
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'chiamamibi_lang',
    },
  })

async function ensureLocaleLoaded(lng) {
  if (!lng) return
  const base = lng.slice(0, 2).toLowerCase()
  if (base === 'it' || i18n.hasResourceBundle(base, 'translation')) return
  const loader = localeLoaders[base]
  if (!loader) return
  try {
    const mod = await loader()
    i18n.addResourceBundle(base, 'translation', mod.default || mod, true, true)
  } catch {
    /* fall back to Italian silently */
  }
}

// Load the detected locale (if non-Italian) once the bundle is ready.
ensureLocaleLoaded(i18n.language)
i18n.on('languageChanged', ensureLocaleLoaded)

export default i18n
