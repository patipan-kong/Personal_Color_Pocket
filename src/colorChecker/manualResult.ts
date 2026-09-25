import type { ColorMatchResult, MatchRating } from '../domain/personalColor/types'
import { getPlacementGuide } from '../domain/photoColor/placement'
import type { PlacementIntent } from '../domain/photoColor/placement'
import type { Suitability } from '../domain/photoColor/suitability'
import type { LocaleCopy } from '../i18n'
import type { PresentationPreference } from '../services/presentationPreference'
import type { ColorResultView } from './resultView'

// V1.2 Slice 5d: manual checkColor() result → the shared Color Checker result.
// A fixed relabelling of the rating checkColor ALREADY decided. The score is not read here, so
// no new cut-off can hide in this file. The manual engine has four ratings, so it uses four of the
// five shared levels; it has no "outside" rating and none is invented.
//   Great Match → strong       V1.1 reason: "close to {Best}, one of your strongest palette colors"
//   Good Match  → good         V1.1 reason: "similar color quality … should feel harmonious"
//   Wearable    → conditional  V1.1 reason: "a little outside your core palette … pairing … balance"
//   Tricky      → weak         V1.1 reason: "… may feel less effortless near your face"
const SUITABILITY: Record<MatchRating, Suitability> = {
  'Great Match': 'strong',
  'Good Match': 'good',
  Wearable: 'conditional',
  Tricky: 'weak',
}

// Where the colour belongs, from the same shared placement table the photo checker uses.
const PLACEMENT: Record<MatchRating, PlacementIntent> = {
  'Great Match': 'face',
  'Good Match': 'harmonious',
  Wearable: 'second-color',
  Tricky: 'below-face',
}

export function getManualSuitability(rating: MatchRating): Suitability {
  const suitability = SUITABILITY[rating]
  if (!suitability) throw new RangeError(`Unknown manual match rating: ${String(rating)}`)
  return suitability
}

export function toManualResultView(match: ColorMatchResult, copy: LocaleCopy, presentation: PresentationPreference): ColorResultView {
  const { rating } = match
  return {
    hex: match.normalizedHex,
    sampleLabel: copy.checker.sampleLabel,
    suitability: getManualSuitability(rating),
    category: { key: rating.toLowerCase().replace(' ', '-'), label: copy.ratings[rating] },
    // The reason names no colour: reason.referenceColor is the nearest Best colour even when an
    // Accent or Neutral decided the rating, and for Tricky a Harder colour that can be far away.
    why: copy.checker.why[rating],
    // closestColors are the two nearest Best colours, nearest first. Labelled as exactly that, with
    // no group: the manual engine does not say which palette group is actually closest.
    reference: { kind: 'nearestBest', color: match.closestColors[0], group: null },
    note: null,
    placement: getPlacementGuide(PLACEMENT[rating], presentation),
    pairWith: match.pairWith,
    details: [],
    warnings: [],
    info: null,
    caveat: null,
    aiAdvisory: [],
    sourceLabel: null,
  }
}
