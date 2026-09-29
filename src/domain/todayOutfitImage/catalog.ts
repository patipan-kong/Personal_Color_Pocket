export const OUTFIT_IMAGE_CANDIDATE_IDS = ['gemini-image-lite', 'gemini-image-standard'] as const
export type OutfitImageCandidateId = typeof OUTFIT_IMAGE_CANDIDATE_IDS[number]

export interface OutfitImageCandidateConfig {
  readonly provider: 'gemini'
  readonly model: string
  readonly label: string
}

// Verified against Google's Gemini image-generation documentation on 2026-09-27.
// Keep provider model IDs here so the domain and Lab use stable app-owned candidate IDs.
export const OUTFIT_IMAGE_CANDIDATES: Readonly<Record<OutfitImageCandidateId, OutfitImageCandidateConfig>> = Object.freeze({
  'gemini-image-lite': { provider: 'gemini', model: 'gemini-3.1-flash-lite-image', label: 'Gemini Image Lite' },
  'gemini-image-standard': { provider: 'gemini', model: 'gemini-3.1-flash-image', label: 'Gemini Image Standard' },
})
