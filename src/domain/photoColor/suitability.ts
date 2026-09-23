import type { PhotoMatchCategory } from './types'

// V1.2 Slice 5c: the verdict shown first on the photo result ("is this colour good for me?").
// A fixed 1:1 relabelling of the category the photo match engine already decided. Nothing is
// calculated here: no distance, no threshold, no score. Not ordered numerically.
// strong       near-face       "Excellent for your Personal Color"
// good         neutral-base    "This color works well for your Personal Color"
// conditional  related         "Wearable, but not one of your strongest colors"
// weak         away-from-face  "Not ideal near your face"
// outside      outside         "This color is not recommended for your Personal Color"
export type Suitability = 'strong' | 'good' | 'conditional' | 'weak' | 'outside'

// The three readings a user should get at a glance.
export type SuitabilityTone = 'positive' | 'middle' | 'negative'

const SUITABILITY: Record<PhotoMatchCategory, Suitability> = {
  'near-face': 'strong',
  'neutral-base': 'good',
  related: 'conditional',
  'away-from-face': 'weak',
  outside: 'outside',
}

const TONE: Record<Suitability, SuitabilityTone> = {
  strong: 'positive',
  good: 'positive',
  conditional: 'middle',
  weak: 'negative',
  outside: 'negative',
}

export function getSuitability(category: PhotoMatchCategory): Suitability {
  const suitability = SUITABILITY[category]
  if (!suitability) throw new RangeError(`Unknown photo match category: ${String(category)}`)
  return suitability
}

export function suitabilityTone(suitability: Suitability): SuitabilityTone {
  return TONE[suitability]
}
