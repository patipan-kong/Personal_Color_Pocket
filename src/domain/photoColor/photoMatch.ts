import { pairingSuggestions } from '../personalColor/colorMatch'
import { hexToOklab, hueDifference, oklabChroma, oklabHue } from '../personalColor/colorUtils'
import type { OKLab } from '../personalColor/colorUtils'
import { getPalette } from '../personalColor/palettes'
import type { PaletteColor, Subtype } from '../personalColor/types'
import type { PhotoColorMatch, PhotoColorSample, PhotoMatchCategory, PhotoMatchDescriptors, PhotoMatchDirection, PositivePaletteGroup } from './types'

// V1.2 photo match engine (plan §10.3, Model E "nearest relationship"). Pure: a successful
// photo sample + subtype in, qualitative guidance out. Deliberately separate from the manual
// checker's scoring: photo colors carry lighting, exposure and camera error, so this model
// is lightness-tolerant and has no score or percentage.
//
// All thresholds are V1.2 calibration constants, checked against the curated palettes and
// simulated lighting (docs/V1_2_SLICE_2_PHOTO_MATCH_ENGINE.md), NOT yet against real photos.

// Lightness weight in the match distance. Exposure moves L far more than hue or chroma, so ΔL
// counts half. Large value differences (light vs very deep) still dominate the distance.
export const PHOTO_LIGHTNESS_WEIGHT = .5
// Within this distance of a palette color, the sample reads as that color (inclusive).
export const PHOTO_CLOSE_DISTANCE = .045
// Within this distance, the sample is in that color's neighbourhood (inclusive).
export const PHOTO_RELATED_DISTANCE = .085
// Absorbs floating-point round-off, so a distance computed as T ± 1e-16 lands on the inclusive side.
export const PHOTO_THRESHOLD_EPSILON = 1e-9

// Direction explanation (plan §10.3). A difference is reported only when it exceeds these.
export const DIRECTION_LIGHTNESS_MIN = .06
export const DIRECTION_CHROMA_MIN = .03
export const DIRECTION_HUE_MIN_DEGREES = 12
// Below this OKLab chroma hue is too weak to name a direction: no hue difference and no
// warmer/cooler are reported (plan §10.3).
export const NEUTRAL_CHROMA_MAX = .04
// Hue weight in the match distance, from the less chromatic of the two colors: 0 at or below
// HUE_IGNORED_CHROMA_MAX (greys, whites, blacks: curated ones measure ≤ 0.013), ramping to 1 at
// HUE_FULL_CHROMA_MIN. Curated pale tints (Icy Blue 0.023, Icy Lilac 0.030) keep full hue weight,
// because their hue is exactly what separates "icy" from "ecru".
export const HUE_IGNORED_CHROMA_MAX = .01
export const HUE_FULL_CHROMA_MIN = .02
// Yellow-orange pole of the warm/cool axis, in OKLab hue degrees. The cool pole is opposite (250°).
export const WARM_HUE_DEGREES = 70
export const MAX_DIRECTIONS = 2

// Descriptors (plan §11.1).
export const LIGHT_VALUE_MIN = .72
export const DEEP_VALUE_MAX = .45
export const SOFT_CHROMA_MAX = .06
export const CLEAR_CHROMA_MIN = .13

interface Candidate { color: PaletteColor; distance: number }

const positiveGroups: PositivePaletteGroup[] = ['best', 'accents', 'neutrals']

// Plan §10.3 distance, sqrt((kL·ΔL)² + Δa² + Δb²), with Δa² + Δb² split into its chroma part ΔC²
// and hue part ΔH² = Δa² + Δb² − ΔC². When both colors have chroma ≥ HUE_FULL_CHROMA_MIN the hue
// weight is 1 and this is exactly the plan formula. For near-neutral samples (greys, whites,
// blacks) the hue part is damped to 0, so camera hue noise cannot move the answer: they are
// judged on lightness and chroma alone.
function photoDistance(sample: OKLab, reference: OKLab) {
  const sampleChroma = oklabChroma(sample)
  const referenceChroma = oklabChroma(reference)
  const chromaDelta = sampleChroma - referenceChroma
  const hueSquared = Math.max(0, (sample.a - reference.a) ** 2 + (sample.b - reference.b) ** 2 - chromaDelta ** 2)
  const hueWeight = Math.min(1, Math.max(0, (Math.min(sampleChroma, referenceChroma) - HUE_IGNORED_CHROMA_MAX) / (HUE_FULL_CHROMA_MIN - HUE_IGNORED_CHROMA_MAX)))
  return Math.sqrt((PHOTO_LIGHTNESS_WEIGHT * (sample.l - reference.l)) ** 2 + chromaDelta ** 2 + hueWeight ** 2 * hueSquared)
}

const within = (distance: number, threshold: number) => distance <= threshold + PHOTO_THRESHOLD_EPSILON

// Palette order breaks ties (strict <), so equal distances always resolve the same way.
function nearestIn(sample: OKLab, colors: PaletteColor[]): Candidate {
  let nearest: Candidate = { color: colors[0], distance: photoDistance(sample, hexToOklab(colors[0].hex)!) }
  colors.slice(1).forEach((color) => {
    const distance = photoDistance(sample, hexToOklab(color.hex)!)
    if (distance < nearest.distance) nearest = { color, distance }
  })
  return nearest
}

// Plan §10.3, with one clarification: a positive color only wins "close" when it is at least
// as near as the nearest Harder color, so a sample sitting on a Harder color is never called
// near-face just because a positive color is also within PHOTO_CLOSE_DISTANCE.
function categorize(positive: Candidate & { group: PositivePaletteGroup }, harder: Candidate): PhotoMatchCategory {
  if (within(positive.distance, PHOTO_CLOSE_DISTANCE) && positive.distance <= harder.distance) {
    return positive.group === 'neutrals' ? 'neutral-base' : 'near-face'
  }
  if (within(harder.distance, PHOTO_RELATED_DISTANCE) && harder.distance < positive.distance) return 'away-from-face'
  if (within(positive.distance, PHOTO_RELATED_DISTANCE)) return 'related'
  return 'outside'
}

// Distance of a hue from the warm pole, 0–180°. Smaller is warmer.
const warmPoleDistance = (hue: number) => Math.abs(hueDifference(WARM_HUE_DEGREES, hue))

function directionsFrom(sample: OKLab, reference: OKLab): { difference: PhotoColorMatch['difference']; direction: PhotoMatchDirection[] } {
  const sampleChroma = oklabChroma(sample)
  const referenceChroma = oklabChroma(reference)
  const chromatic = sampleChroma >= NEUTRAL_CHROMA_MAX && referenceChroma >= NEUTRAL_CHROMA_MAX
  const lightness = sample.l - reference.l
  const chroma = sampleChroma - referenceChroma
  const hue = chromatic ? hueDifference(oklabHue(reference), oklabHue(sample)) : null

  // Each axis is compared in units of its own threshold; ties keep L, chroma, temperature order.
  const candidates: { direction: PhotoMatchDirection; size: number }[] = [
    { direction: lightness > 0 ? 'lighter' : 'deeper', size: Math.abs(lightness) / DIRECTION_LIGHTNESS_MIN },
    { direction: chroma > 0 ? 'brighter' : 'muted', size: Math.abs(chroma) / DIRECTION_CHROMA_MIN },
  ]
  if (chromatic) {
    // Positive when the sample's hue is closer to the warm pole than the reference's.
    const warmer = warmPoleDistance(oklabHue(reference)) - warmPoleDistance(oklabHue(sample))
    candidates.push({ direction: warmer > 0 ? 'warmer' : 'cooler', size: Math.abs(warmer) / DIRECTION_HUE_MIN_DEGREES })
  }
  const direction = candidates
    .filter(({ size }) => size > 1)
    .sort((first, second) => second.size - first.size)
    .slice(0, MAX_DIRECTIONS)
    .map(({ direction }) => direction)
  return { difference: { lightness, chroma, hue }, direction }
}

function describe(color: OKLab): PhotoMatchDescriptors {
  const chroma = oklabChroma(color)
  return {
    value: color.l >= LIGHT_VALUE_MIN ? 'light' : color.l <= DEEP_VALUE_MAX ? 'deep' : 'medium',
    clarity: chroma < SOFT_CHROMA_MAX ? 'soft' : chroma > CLEAR_CHROMA_MIN ? 'clear' : 'moderate',
  }
}

// Only a successful sample can be matched. Unavailable samples are excluded by the type, and
// rejected at runtime as a programming error.
export function matchPhotoColor(sample: PhotoColorSample, subtype: Subtype): PhotoColorMatch {
  if (sample?.kind !== 'color') throw new TypeError('matchPhotoColor needs a successful photo sample')
  const { oklab, hex } = sample
  if (![oklab.l, oklab.a, oklab.b].every(Number.isFinite)) throw new RangeError('Photo sample OKLab must be finite')

  // Metals are excluded: photographed metal is specular and unreliable (plan §10.3).
  const palette = getPalette(subtype)
  const byGroup = Object.fromEntries(positiveGroups.map((group) => [group, nearestIn(oklab, palette[group])])) as Record<PositivePaletteGroup, Candidate>
  const positiveGroup = positiveGroups.reduce((best, group) => byGroup[group].distance < byGroup[best].distance ? group : best)
  const positive = { ...byGroup[positiveGroup], group: positiveGroup }
  const harder = nearestIn(oklab, palette.harder)
  const category = categorize(positive, harder)
  const { difference, direction } = directionsFrom(oklab, hexToOklab(positive.color.hex)!)

  return {
    subtype,
    hex,
    oklab,
    category,
    nearest: { color: positive.color, group: positive.group, distance: positive.distance },
    resembles: within(harder.distance, PHOTO_RELATED_DISTANCE) ? { color: harder.color, distance: harder.distance } : null,
    closest: { best: byGroup.best.color, accents: byGroup.accents.color, neutrals: byGroup.neutrals.color },
    difference,
    direction: category === 'near-face' || category === 'neutral-base' ? [] : direction,
    descriptors: describe(oklab),
    pairWith: pairingSuggestions(hex, subtype),
    warnings: [...sample.diagnostics.flags],
  }
}
