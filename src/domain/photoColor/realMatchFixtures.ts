import { hexToRgb } from '../personalColor/colorUtils'
import { getPalette } from '../personalColor/palettes'
import { subtypeOrder } from '../personalColor/seasons'
import type { Subtype } from '../personalColor/types'
import { inspectPhotoPoint } from './inspect'
import type { PhotoMatchCategory, PhotoPointMatched, PixelSource } from './types'

// TEST-ONLY helpers (imported by *.test.ts(x) files, and -- as of Slice 0.4B -- by
// aiLab/AdvisoryPreview.tsx, a dev-only, DEV+query-param-gated screen never reachable in a
// production build or normal navigation; see that file). Never imported by a production-facing
// screen. They produce REAL photo results: a solid image of an existing palette colour goes
// through the unchanged sampler + matcher via inspectPhotoPoint. No category is ever constructed
// by hand.

export function solidImage(hex: string, width = 24, height = 24): PixelSource {
  const { r, g, b } = hexToRgb(hex)!
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set([r, g, b, 255], index)
  return { width, height, data }
}

export function inspectHex(hex: string, subtype: Subtype): PhotoPointMatched {
  const image = solidImage(hex)
  const inspection = inspectPhotoPoint(image, { x: image.width / 2, y: image.height / 2 }, subtype)
  if (inspection.kind !== 'matched') throw new Error(`expected a colour for ${hex}`)
  return inspection
}

// Every curated colour in the app (all subtypes; Best, Accents, Neutrals, Harder), in a fixed order.
export const CURATED_HEXES: string[] = [...new Set(subtypeOrder.flatMap((subtype) => {
  const palette = getPalette(subtype)
  return [...palette.best, ...palette.accents, ...palette.neutrals, ...palette.harder].map((color) => color.hex.toUpperCase())
}))]

// The first curated colour whose real photo match for `subtype` lands in `category`, or null.
export function realMatchFor(subtype: Subtype, category: PhotoMatchCategory, where: (matched: PhotoPointMatched) => boolean = () => true): PhotoPointMatched | null {
  for (const hex of CURATED_HEXES) {
    const matched = inspectHex(hex, subtype)
    if (matched.match.category === category && where(matched)) return matched
  }
  return null
}
