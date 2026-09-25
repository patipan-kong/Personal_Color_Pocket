import type { AiProviderId, AiSuitabilityVerdict } from '../domain/aiColorLab/contract'

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  groq: 'Groq',
  deepseek: 'DeepSeek',
}

// 'more_considered' keeps the app's own canonical term (see contract.ts) -- shown to the PO
// exactly as the rest of the app names it, never as "Harder" (i18n/en.ts palette.sections.harder.title).
export const SUITABILITY_LABELS: Record<AiSuitabilityVerdict, string> = {
  recommended: 'Recommended',
  workable: 'Workable',
  more_considered: 'More Considered',
  uncertain: 'Uncertain',
}
