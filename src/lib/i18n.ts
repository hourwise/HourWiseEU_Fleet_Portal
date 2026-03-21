import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import portal-specific translation files from src/locales
import bg from '../locales/bg.json';
import cs from '../locales/cs.json'; // Renamed from cz.json
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import hu from '../locales/hu.json';
import it from '../locales/it.json';
import lv from '../locales/lv.json';
import nl from '../locales/nl.json';
import pl from '../locales/pl.json';
import pt from '../locales/pt.json';
import ro from '../locales/ro.json';
import sk from '../locales/sk.json';
import tr from '../locales/tr.json';
import uk from '../locales/uk.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      bg: { translation: bg },
      cs: { translation: cs },
      de: { translation: de },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      hu: { translation: hu },
      it: { translation: it },
      lv: { translation: lv },
      nl: { translation: nl },
      pl: { translation: pl },
      pt: { translation: pt },
      ro: { translation: ro },
      sk: { translation: sk },
      tr: { translation: tr },
      uk: { translation: uk }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    },
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator'],
      caches: ['localStorage', 'cookie']
    }
  });

export default i18n;
