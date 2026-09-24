import type { Language } from '../../i18n'
import type { LearnCopy } from '../types'
import { learnEn } from './en'
import { learnTh } from './th'

export const learnTranslations: Readonly<Record<Language, LearnCopy>> = { en: learnEn, th: learnTh }
