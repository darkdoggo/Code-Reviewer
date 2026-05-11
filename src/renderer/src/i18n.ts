import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import commonEn from './locales/en/common.json'
import pagesEn from './locales/en/pages.json'
import settingsEn from './locales/en/settings.json'
import reviewEn from './locales/en/review.json'
import errorsEn from './locales/en/errors.json'

import commonZh from './locales/zh/common.json'
import pagesZh from './locales/zh/pages.json'
import settingsZh from './locales/zh/settings.json'
import reviewZh from './locales/zh/review.json'
import errorsZh from './locales/zh/errors.json'

// Detect system language
const detectedLang = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        pages: pagesEn,
        settings: settingsEn,
        review: reviewEn,
        errors: errorsEn,
      },
      zh: {
        common: commonZh,
        pages: pagesZh,
        settings: settingsZh,
        review: reviewZh,
        errors: errorsZh,
      },
    },
    lng: detectedLang,
    fallbackLng: 'en',
    ns: ['common', 'pages', 'settings', 'review', 'errors'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
