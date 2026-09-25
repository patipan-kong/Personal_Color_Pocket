import type { ColorName } from '../domain/colorNames/colorNames'
import { describeColor } from '../domain/colorNames/colorNames'
import { sampleRadiusFor } from '../domain/photoColor/coordinates'
import { matchPhotoColor } from '../domain/photoColor/photoMatch'
import { samplePhotoRegion } from '../domain/photoColor/sampling'
import type { ImagePoint, PhotoColorMatch, PhotoSampleResult, PixelSource } from '../domain/photoColor/types'
import type { Subtype } from '../domain/personalColor/types'

// V2.0 AI Color Lab (Slice 0, plan §13, §27): the deterministic baseline shown above the AI
// cards. Composes the SAME pure engine functions the production Photo Checker uses
// (samplePhotoRegion, matchPhotoColor, describeColor) -- none of them are modified, and no new
// color logic is added here. The only difference from photoColor/inspect.ts is that `subtype`
// is optional: `match` is null when no valid saved profile exists, rather than inventing one.
export interface DeterministicBaseline {
  point: ImagePoint
  radius: number
  sample: PhotoSampleResult
  match: PhotoColorMatch | null
  colorName: ColorName | null
}

export function computeDeterministicBaseline(image: PixelSource, point: ImagePoint, subtype: Subtype | null): DeterministicBaseline {
  const radius = sampleRadiusFor(image)
  const sample = samplePhotoRegion(image, point, { radius })
  if (sample.kind === 'unavailable') return { point, radius, sample, match: null, colorName: null }
  return {
    point,
    radius,
    sample,
    match: subtype ? matchPhotoColor(sample, subtype) : null,
    colorName: describeColor(sample.hex),
  }
}
