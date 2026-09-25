import type { AiPaletteCandidate, AiPaletteSelectionRequest } from '../domain/aiColorLab/paletteContract'
import { getPalette } from '../domain/personalColor/palettes'
import type { Subtype } from '../domain/personalColor/types'
import type { ImagePoint, PixelSource } from '../domain/photoColor/types'
import { encodeAnnotatedImageForAiLab } from './imageEncode'

// V2.0 Slice 0.5C. Reuses buildRequest.ts's marker-burn approach unchanged (imageEncode.ts) --
// only the payload SHAPE differs from the free-form task's buildAiColorRequest.

const GROUPS = ['best', 'neutrals', 'accents', 'harder'] as const

// Every selectable garment color for this subtype, id/name/hex ONLY (plan §H): no group label,
// no suitability. Metals are jewelry recommendations, not garment colors, so they are excluded.
export function buildPaletteCandidates(subtype: Subtype): AiPaletteCandidate[] {
  const palette = getPalette(subtype)
  return GROUPS.flatMap((group) => palette[group].map((color) => ({ colorId: color.id, name: color.name, hex: color.hex })))
}

// Strategy A -- independent vision fallback (plan §D, paletteContract.ts): deliberately does NOT
// include the deterministic sample's hex/rgb/flags in the request sent to AI.
export function buildPaletteSelectionRequest(image: PixelSource, point: ImagePoint, sampleRadius: number, subtype: Subtype): AiPaletteSelectionRequest {
  return {
    imageDataUrl: encodeAnnotatedImageForAiLab(image, point, sampleRadius),
    subtype,
    palette: buildPaletteCandidates(subtype),
  }
}
