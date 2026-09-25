import type { AiColorAnalysisRequest } from '../../src/domain/aiColorLab/contract'

// Defense in depth on OUR OWN request body (not the provider's response -- see validate.ts for
// that). This is our own frontend's payload, but a malformed/oversized one should fail as a
// normal 400, never reach an adapter or a provider call.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export function validateAnalysisRequest(body: unknown): AiColorAnalysisRequest | null {
  if (!isRecord(body)) return null
  const { imageDataUrl, sample, subtype } = body
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) return null
  if (!isRecord(sample)) return null
  if (typeof sample.hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(sample.hex)) return null
  if (!isRecord(sample.rgb) || typeof sample.rgb.r !== 'number' || typeof sample.rgb.g !== 'number' || typeof sample.rgb.b !== 'number') return null
  if (typeof sample.oklabL !== 'number') return null
  if (sample.colorName !== null && typeof sample.colorName !== 'string') return null
  if (!Array.isArray(sample.flags) || !sample.flags.every((flag) => typeof flag === 'string')) return null

  if (subtype !== null) {
    if (!isRecord(subtype)) return null
    if (typeof subtype.subtype !== 'string' || typeof subtype.season !== 'string' || typeof subtype.label !== 'string') return null
  }

  return body as unknown as AiColorAnalysisRequest
}
