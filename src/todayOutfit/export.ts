import { AI_CANDIDATES } from '../domain/ai/providerCatalog'
import type { AiCandidateId, AiUsage } from '../domain/ai/providerCatalog'
import type { OutfitRecommendation, TodayOutfitInput } from '../domain/todayOutfit/contract'

export const REVIEW_VERDICTS = ['good', 'acceptable', 'poor'] as const
export type ReviewVerdict = typeof REVIEW_VERDICTS[number]
export interface OutfitPoReview {
  outfitQuality: ReviewVerdict | ''
  personalColorReasoning: ReviewVerdict | ''
  occasionFit: ReviewVerdict | ''
  constraintCompliance: 'pass' | 'fail' | ''
  comparison: 'ai-better' | 'baseline-better' | 'roughly-equal' | ''
  note: string
}
export const EMPTY_OUTFIT_REVIEW: OutfitPoReview = { outfitQuality: '', personalColorReasoning: '', occasionFit: '', constraintCompliance: '', comparison: '', note: '' }

export interface OutfitLabRun {
  id: string
  caseId: string
  input: TodayOutfitInput
  candidateId: AiCandidateId
  latencyMs: number
  result: OutfitRecommendation | null
  error: unknown
  validation: { valid: boolean; issues: readonly string[] }
  baseline: OutfitRecommendation
  usage: AiUsage | null
  review: OutfitPoReview
  timestamp: string
}

export function buildOutfitLabExport(runs: readonly OutfitLabRun[]) {
  return {
    exportedAt: new Date().toISOString(),
    runs: runs.map((run) => ({
      caseId: run.caseId,
      inputSubtype: run.input.subtype,
      occasion: { value: run.input.occasion, context: run.input.occasionContext ?? null },
      wardrobe: run.input.wardrobe,
      candidate: { id: run.candidateId, provider: AI_CANDIDATES[run.candidateId].provider, model: AI_CANDIDATES[run.candidateId].model },
      latencyMs: run.latencyMs,
      structuredResult: run.result,
      error: run.error,
      validationStatus: run.validation,
      deterministicBaselineResult: run.baseline,
      usage: run.usage,
      poReview: run.review,
      timestamp: run.timestamp,
    })),
  }
}

export function downloadOutfitLabExport(runs: readonly OutfitLabRun[]) {
  const blob = new Blob([JSON.stringify(buildOutfitLabExport(runs), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `today-outfit-lab-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
