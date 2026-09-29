import type { GarmentType } from '../wardrobe/taxonomy.js'
import type { InspirationColor, InspirationOutfitRecommendation, InspirationOutfitSignature } from './inspirationContract.js'
import type { OwnedOutfitRecommendation, OwnedOutfitSignature } from './contract.js'

/**
 * A comparison-safe identity for a generated Today Look.
 *
 * Provider prose and localized reasoning are deliberately absent. Owned looks are
 * identified by the wardrobe IDs they consume; Inspiration looks are identified by
 * their structured garment and app-owned color identities.
 */
export type TodayOutfitSignature =
  | ({ readonly mode: 'owned' } & OwnedOutfitSignature)
  | ({ readonly mode: 'inspiration' } & InspirationOutfitSignature)

function ownedItemIds(recommendation: OwnedOutfitRecommendation): readonly string[] {
  const selection = recommendation.selection
  return selection.kind === 'separates'
    ? [selection.topId, selection.bottomId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
    : [selection.onePieceId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
}

export function createOwnedOutfitSignature(recommendation: OwnedOutfitRecommendation): OwnedOutfitSignature {
  return {
    kind: recommendation.selection.kind,
    itemIds: ownedItemIds(recommendation),
  }
}

function inspirationSignaturePieces(recommendation: InspirationOutfitRecommendation): InspirationOutfitSignature['pieces'] {
  const outfit = recommendation.outfit
  const pieces = outfit.kind === 'separates'
    ? [outfit.top, outfit.bottom, ...(outfit.outerwear ? [outfit.outerwear] : []), outfit.shoes]
    : [outfit.onePiece, ...(outfit.outerwear ? [outfit.outerwear] : []), outfit.shoes]
  return pieces.map((piece): { readonly garmentType: GarmentType; readonly color: InspirationColor } => ({
    garmentType: piece.garmentType,
    color: piece.color,
  }))
}

export function createInspirationOutfitSignature(recommendation: InspirationOutfitRecommendation): InspirationOutfitSignature {
  return {
    kind: recommendation.outfit.kind,
    pieces: inspirationSignaturePieces(recommendation),
  }
}

export function createTodayOutfitSignature(
  mode: 'owned',
  recommendation: OwnedOutfitRecommendation,
): TodayOutfitSignature
export function createTodayOutfitSignature(
  mode: 'inspiration',
  recommendation: InspirationOutfitRecommendation,
): TodayOutfitSignature
export function createTodayOutfitSignature(
  mode: TodayOutfitSignature['mode'],
  recommendation: OwnedOutfitRecommendation | InspirationOutfitRecommendation,
): TodayOutfitSignature {
  return mode === 'owned'
    ? { mode, ...createOwnedOutfitSignature(recommendation as OwnedOutfitRecommendation) }
    : { mode, ...createInspirationOutfitSignature(recommendation as InspirationOutfitRecommendation) }
}

export function outfitSignatureKey(signature: TodayOutfitSignature | OwnedOutfitSignature | InspirationOutfitSignature): string {
  if ('mode' in signature) {
    const { mode: _mode, ...withoutMode } = signature
    return JSON.stringify(withoutMode)
  }
  return JSON.stringify(signature)
}

export function isOutfitSignatureExcluded(
  signature: OwnedOutfitSignature | InspirationOutfitSignature,
  exclusions: readonly (OwnedOutfitSignature | InspirationOutfitSignature)[] | undefined,
): boolean {
  if (!exclusions?.length) return false
  const key = outfitSignatureKey(signature)
  return exclusions.some((exclusion) => outfitSignatureKey(exclusion) === key)
}
