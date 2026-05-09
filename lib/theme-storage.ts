export type AppLanguage = "zh-CN" | "en-US"

export const LANGUAGE_STORAGE_KEY = "manyu-language"
export const LANGUAGE_CHANGE_EVENT = "manyu-language-change"

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  "zh-CN": "\u7b80\u4f53\u4e2d\u6587",
  "en-US": "English",
}

export function isSupportedLanguage(value: string): value is AppLanguage {
  return value === "zh-CN" || value === "en-US"
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return "zh-CN"
  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (value && isSupportedLanguage(value)) return value
  return "zh-CN"
}

export function setStoredLanguage(language: AppLanguage) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  window.dispatchEvent(new CustomEvent<AppLanguage>(LANGUAGE_CHANGE_EVENT, { detail: language }))
}
