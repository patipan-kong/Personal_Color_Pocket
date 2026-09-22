import type { MetalRecommendation, PaletteColor } from '../domain/personalColor/types'
import { translateColorNameThai, translateMetalNoteThai } from './colors'
import { en } from './en'
import { th } from './th'
import type { Language, LocaleCopy } from './types'

export type { Language, LocaleCopy, QuizCopy, SubtypeCopy } from './types'

export const LANGUAGE_STORAGE_KEY = 'personal-color-pocket:language'
export const translations: Record<Language, LocaleCopy> = { en, th }

export function detectLanguage(browserLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'en' || saved === 'th') return saved
  } catch { /* Browsers may block local storage. */ }
  return browserLanguage.toLowerCase().startsWith('th') ? 'th' : 'en'
}

export function persistLanguage(language: Language) {
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* The switch still works for this session. */ }
}

export function getCopy(language: Language) {
  return translations[language]
}

export function colorDisplayName(language: Language, color: Pick<PaletteColor, 'name'>) {
  return language === 'th' ? translateColorNameThai(color.name) : color.name
}

export function metalDisplayNote(language: Language, metal: Pick<MetalRecommendation, 'name' | 'note'>) {
  return language === 'th' ? translateMetalNoteThai(metal.name) : metal.note
}
