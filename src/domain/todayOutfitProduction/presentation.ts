import type { LuckyColorFamily } from '../luckyColor/types.js'
import type { Subtype } from '../personalColor/types.js'
import type { TodayOccasion } from './todayInputs.js'
import type { OwnedOutfitRecommendation, OwnedOutfitRequest } from './contract.js'

export type OwnedPersonalColorEmphasis = 'brightening' | 'balancing'

export interface OwnedOutfitPresentationFacts {
  readonly occasion: TodayOccasion
  readonly personalColor: {
    readonly subtype: Subtype
    readonly emphasis: OwnedPersonalColorEmphasis
  } | null
  readonly luckyColor: {
    readonly requestedFamilies: readonly LuckyColorFamily[]
    readonly matchedFamilies: readonly LuckyColorFamily[]
  } | null
}

function selectedIds(recommendation: OwnedOutfitRecommendation): readonly string[] {
  const selection = recommendation.selection
  return selection.kind === 'separates'
    ? [selection.topId, selection.bottomId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
    : [selection.onePieceId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
}

/**
 * Converts validated recommendation facts into the small semantic surface used by the UI.
 * Provider-authored prose remains part of the server contract, but never crosses this
 * app-owned presentation boundary verbatim.
 */
export function buildOwnedOutfitPresentationFacts(
  request: OwnedOutfitRequest,
  recommendation: OwnedOutfitRecommendation,
): OwnedOutfitPresentationFacts {
  const selected = new Set(selectedIds(recommendation))
  const selectedFacts = request.wardrobe.filter((item) => selected.has(item.id))
  const nearFaceScores = selectedFacts
    .filter((item) => item.slot === 'top' || item.slot === 'one-piece' || item.slot === 'outerwear')
    .flatMap((item) => item.personalColorCompatibility ? [item.personalColorCompatibility.score] : [])
  const requestedFamilies = request.luckyPreferences.map((preference) => preference.family)
  const matchedFamilies = requestedFamilies.filter((family) => selectedFacts.some((item) => item.luckyFamilyMatches.includes(family)))

  return {
    occasion: request.occasion,
    personalColor: request.subtype
      ? {
          subtype: request.subtype,
          emphasis: Math.max(...nearFaceScores, 0) >= 0.75 ? 'brightening' : 'balancing',
        }
      : null,
    luckyColor: requestedFamilies.length ? { requestedFamilies, matchedFamilies } : null,
  }
}
