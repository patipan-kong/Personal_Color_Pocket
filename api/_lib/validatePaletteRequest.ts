import type { AiPaletteSelectionRequest } from '../../src/domain/aiColorLab/paletteContract'
import { subtypeOrder } from '../../src/domain/personalColor/seasons'

// Defense in depth on OUR OWN request body (mirrors api/_lib/validateRequest.ts's philosophy for
// the free-form task) -- a malformed/oversized one should fail as a normal 400, never reach the
// provider adapter.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const MAX_PALETTE_SIZE = 64 // generous headroom over the largest real palette (~22 colors, plan §B)

export function validatePaletteSelectionRequest(body: unknown): AiPaletteSelectionRequest | null {
  if (!isRecord(body)) return null
  const { imageDataUrl, subtype, palette } = body
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) return null
  if (typeof subtype !== 'string' || !(subtypeOrder as readonly string[]).includes(subtype)) return null
  if (!Array.isArray(palette) || palette.length === 0 || palette.length > MAX_PALETTE_SIZE) return null

  const seen = new Set<string>()
  for (const candidate of palette) {
    if (!isRecord(candidate)) return null
    if (typeof candidate.colorId !== 'string' || candidate.colorId.length === 0 || candidate.colorId.length > 80) return null
    if (typeof candidate.name !== 'string' || candidate.name.length === 0 || candidate.name.length > 80) return null
    if (typeof candidate.hex !== 'string' || !HEX_RE.test(candidate.hex)) return null
    // A request offering two candidates under the same colorId could never resolve unambiguously
    // (plan §B: "The AI selection must resolve unambiguously for the active subtype") -- reject
    // rather than silently keep the first or last.
    if (seen.has(candidate.colorId)) return null
    seen.add(candidate.colorId)
  }

  return body as unknown as AiPaletteSelectionRequest
}
