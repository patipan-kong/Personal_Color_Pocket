import { luckyFamiliesForHex } from '../luckyColor/adaptation.js'
import type { LuckyColorFamily } from '../luckyColor/types.js'
import type { Subtype } from '../personalColor/types.js'
import { getWardrobeSlot } from '../wardrobe/taxonomy.js'
import type { TodayOccasion } from './todayInputs.js'
import { resolveInspirationColor } from './inspirationColors.js'
import type { InspirationOutfitRecommendation, InspirationOutfitRequest, InspirationPiece } from './inspirationContract.js'

export interface InspirationOutfitPresentationFacts {
  readonly occasion: TodayOccasion
  readonly personalColor: { readonly subtype: Subtype; readonly emphasis: 'brightening' | 'balancing' } | null
  readonly luckyColor: { readonly requestedFamilies: readonly LuckyColorFamily[]; readonly matchedFamilies: readonly LuckyColorFamily[] } | null
}

export function inspirationPieces(recommendation: InspirationOutfitRecommendation): readonly InspirationPiece[] {
  const outfit = recommendation.outfit
  return outfit.kind === 'separates'
    ? [outfit.top, outfit.bottom, ...(outfit.outerwear ? [outfit.outerwear] : []), outfit.shoes]
    : [outfit.onePiece, ...(outfit.outerwear ? [outfit.outerwear] : []), outfit.shoes]
}

export function buildInspirationOutfitPresentationFacts(request: InspirationOutfitRequest, recommendation: InspirationOutfitRecommendation): InspirationOutfitPresentationFacts {
  const pieces = inspirationPieces(recommendation)
  const selectedFamilies = new Set(pieces.flatMap((piece) => {
    const color = resolveInspirationColor(piece.color, request)
    return color ? luckyFamiliesForHex(color.hex) : []
  }))
  const requestedFamilies = request.luckyPreferences.map((preference) => preference.family)
  return {
    occasion: request.occasion,
    personalColor: request.subtype ? {
      subtype: request.subtype,
      emphasis: pieces.some((piece) => ['top', 'one-piece', 'outerwear'].includes(getWardrobeSlot(piece.garmentType)) && piece.color.kind === 'canonical') ? 'brightening' : 'balancing',
    } : null,
    luckyColor: requestedFamilies.length ? { requestedFamilies, matchedFamilies: requestedFamilies.filter((family) => selectedFamilies.has(family)) } : null,
  }
}
