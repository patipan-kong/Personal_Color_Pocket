import { OUTFIT_IMAGE_CANDIDATES } from '../domain/todayOutfitImage/catalog'
import type { TodayOutfitImageRequest, TodayOutfitImageResult } from '../domain/todayOutfitImage/contract'

export const IMAGE_REVIEW_VERDICTS = ['good', 'acceptable', 'poor'] as const
export type ImageReviewVerdict = typeof IMAGE_REVIEW_VERDICTS[number]

export interface OutfitImagePoReview {
  visualQuality: ImageReviewVerdict | ''
  garmentFidelity: ImageReviewVerdict | ''
  colorFidelity: ImageReviewVerdict | ''
  outfitReadability: ImageReviewVerdict | ''
  constraintCompliance: 'pass' | 'fail' | ''
  wouldHelp: 'yes' | 'maybe' | 'no' | ''
  note: string
}

export const EMPTY_OUTFIT_IMAGE_REVIEW: OutfitImagePoReview = {
  visualQuality: '', garmentFidelity: '', colorFidelity: '', outfitReadability: '', constraintCompliance: '', wouldHelp: '', note: '',
}

export interface OutfitImageLabRun {
  readonly id: string
  readonly sourceKey: string
  readonly caseId: string
  readonly request: TodayOutfitImageRequest
  readonly result: TodayOutfitImageResult
  readonly review: OutfitImagePoReview
  readonly timestamp: string
}

export function buildOutfitImageLabExport(runs: readonly OutfitImageLabRun[]) {
  return {
    exportedAt: new Date().toISOString(),
    runs: runs.map((run) => {
      const config = OUTFIT_IMAGE_CANDIDATES[run.request.candidate]
      return {
        sourceTodayOutfitCaseId: run.caseId,
        subtype: run.request.subtype,
        occasion: run.request.occasion,
        selectedItems: run.request.selectedItems,
        visualizationMode: run.request.visualizationMode,
        candidate: { id: run.request.candidate, provider: config.provider, model: run.result.model },
        latencyMs: run.result.latencyMs,
        usage: run.result.status === 'success' ? run.result.usage : null,
        normalizedStatus: run.result.status,
        error: run.result.status === 'failure' ? run.result.reason : null,
        image: run.result.status === 'success' ? { mimeType: run.result.mimeType, generated: true } : { mimeType: null, generated: false },
        poReview: run.review,
        timestamp: run.timestamp,
      }
    }),
  }
}

export function downloadOutfitImageLabExport(runs: readonly OutfitImageLabRun[]) {
  const blob = new Blob([JSON.stringify(buildOutfitImageLabExport(runs), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `today-outfit-image-lab-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
