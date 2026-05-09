"use client"

import { useEffect } from "react"
import {
  getStoredLanguage,
  isSupportedLanguage,
  LANGUAGE_CHANGE_EVENT,
} from "@/lib/theme-storage"

export function AppPreferenceSync() {
  useEffect(() => {
    const applyLanguage = (language: string) => {
      if (typeof document === "undefined") return
      if (!isSupportedLanguage(language)) return
      document.documentElement.lang = language
    }

    const applyStoredLanguage = () => {
      applyLanguage(getStoredLanguage())
    }

    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      applyLanguage(customEvent.detail || getStoredLanguage())
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key) {
        applyLanguage(event.newValue || "")
        return
      }
      applyStoredLanguage()
    }

    applyStoredLanguage()
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange as EventListener)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener(
        LANGUAGE_CHANGE_EVENT,
        handleLanguageChange as EventListener
      )
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  return null
}

