import type { AiCandidateId, AiUsage } from '../domain/aiColorLab/contract'

// V2.0 Slice 0.2 (plan §13): official STANDARD-tier, USD, per-1M-token pricing for each
// candidate model, recorded with its source and the date it was read so a stale number is never
// silently trusted. This is PROJECTED/ESTIMATED cost from provider-reported token usage, never
// an actual bill (plan §13: "Do not imply that projected cost was actually billed" -- some
// provider dashboards show projected cost even for accounts not enrolled in billing).
export interface CandidatePricing {
  inputPerMillionUsd: number
  outputPerMillionUsd: number
  source: string
  asOf: string
}

export const CANDIDATE_PRICING: Record<AiCandidateId, CandidatePricing> = {
  'gemini-flash': { inputPerMillionUsd: 1.50, outputPerMillionUsd: 9.00, source: 'https://ai.google.dev/gemini-api/docs/pricing', asOf: '2026-09-25' },
  'gemini-flash-lite': { inputPerMillionUsd: 0.30, outputPerMillionUsd: 2.50, source: 'https://ai.google.dev/gemini-api/docs/pricing', asOf: '2026-09-25' },
  openai: { inputPerMillionUsd: 0.25, outputPerMillionUsd: 2.00, source: 'https://developers.openai.com/api/docs/pricing', asOf: '2026-09-25' },
  groq: { inputPerMillionUsd: 0.80, outputPerMillionUsd: 4.00, source: 'https://console.groq.com/docs/models', asOf: '2026-09-25' },
}

// Returns null (never a fabricated number) whenever the provider did not report BOTH input and
// output token counts for this call (plan §13: "If reliable cost calculation is impossible for
// a candidate: show Cost unavailable rather than inventing a number").
export function estimateCostUsd(candidateId: AiCandidateId, usage: AiUsage | null): number | null {
  if (!usage || usage.inputTokens === null || usage.outputTokens === null) return null
  const pricing = CANDIDATE_PRICING[candidateId]
  return (usage.inputTokens / 1_000_000) * pricing.inputPerMillionUsd + (usage.outputTokens / 1_000_000) * pricing.outputPerMillionUsd
}
