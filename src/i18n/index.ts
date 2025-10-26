import { createI18n } from 'vue-i18n'
import ja from './locales/ja.json'
import en from './locales/en.json'
import zh from './locales/zh.json'

export const SUPPORT_LOCALES = ['ja', 'en', 'zh'] as const
export type SupportLocale = (typeof SUPPORT_LOCALES)[number]

// Detect browser language
function getDefaultLocale(): SupportLocale {
  const locale = navigator.language.split('-')[0]
  return SUPPORT_LOCALES.includes(locale as SupportLocale) ? (locale as SupportLocale) : 'ja'
}

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || getDefaultLocale(),
  fallbackLocale: 'ja',
  globalInjection: true,
  messages: {
    ja,
    en,
    zh
  }
})

export default i18n