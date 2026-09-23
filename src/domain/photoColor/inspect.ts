import type { Subtype } from '../personalColor/types'
import { displayToImage, sampleRadiusFor } from './coordinates'
import { matchPhotoColor } from './photoMatch'
import { samplePhotoRegion } from './sampling'
import type { DisplayTap, ImagePoint, PhotoPointInspection, PhotoTapInspection, PixelSource } from './types'

// V1.2 photo checker glue (Slice 4). Pure: prepared pixels + a point + the user's EXISTING
// subtype in, sample + match out. It adds no color logic of its own: sampling, thresholds,
// warnings and categories all come unchanged from samplePhotoRegion and matchPhotoColor.
// The subtype is used as given, never inferred or re-scored.

// A point already in working-image coordinates (e.g. a keyboard-moved marker).
export function inspectPhotoPoint(image: PixelSource, point: ImagePoint, subtype: Subtype): PhotoPointInspection {
  const radius = sampleRadiusFor(image)
  const sample = samplePhotoRegion(image, point, { radius })
  if (sample.kind === 'unavailable') return { kind: 'unavailable', point, radius, reason: sample.reason }
  return { kind: 'matched', point, radius, sample, match: matchPhotoColor(sample, subtype) }
}

// A pointer tap in display coordinates. Taps in the letterbox are a normal outcome, not an error.
export function inspectPhotoTap(image: PixelSource, tap: DisplayTap, subtype: Subtype): PhotoTapInspection {
  const mapped = displayToImage(tap.point, tap.imageRect, image)
  if (mapped.kind === 'outside-displayed-image') return mapped
  return inspectPhotoPoint(image, mapped.point, subtype)
}
