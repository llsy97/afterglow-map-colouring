import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ko from './ko.json'
import en from './en.json'
import type { Locale } from '../types'

export function detectLocale(): Locale {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase()
  return lang.startsWith('ko') ? 'ko' : 'en'
}

export function initI18n(locale: Locale) {
  i18n.use(initReactI18next).init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
  return i18n
}

export default i18n
