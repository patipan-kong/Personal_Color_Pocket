import { oklabChroma } from '../personalColor/colorUtils'
import type { OKLab } from '../personalColor/colorUtils'
import { LIGHT_VALUE_MIN, NEUTRAL_CHROMA_MAX } from './photoMatch'
import type { PhotoColorMatch } from './types'

// V1.2 Slice 5f: presentation-only lighting guidance (docs/V1_2_SLICE_5F_PHOTO_LIGHTING_GUIDANCE.md).
// NOT a detector: it never looks at the photo, only at the colour the sampler already returned, and
// it never changes the sample, the match or the verdict. It says when a lighting note is worth
// showing, because light near-neutral colours are the ones that shade, exposure and colour casts
// shift most visibly (Slice 5e: a white garment in open shade samples as a light blue-grey).
//
// Both boundaries are existing photo-match constants, reused unchanged:
//   light         OKLab L ≥ LIGHT_VALUE_MIN     (the "Light" value descriptor)
//   near-neutral  OKLab chroma < NEUTRAL_CHROMA_MAX (too little chroma to name a hue direction)
export function isLightNearNeutral(oklab: OKLab): boolean {
  return oklab.l >= LIGHT_VALUE_MIN && oklabChroma(oklab) < NEUTRAL_CHROMA_MAX
}

export type PhotoLightingGuidance = { kind: 'light-near-neutral' }

// Priority: an explicit sampler warning (mixed / highlight / shadow) already tells the user to try
// an evenly lit or more even spot, so the lighting note is shown only when there is none.
export function getPhotoLightingGuidance(match: Pick<PhotoColorMatch, 'oklab' | 'warnings'>): PhotoLightingGuidance | null {
  if (match.warnings.length) return null
  return isLightNearNeutral(match.oklab) ? { kind: 'light-near-neutral' } : null
}
