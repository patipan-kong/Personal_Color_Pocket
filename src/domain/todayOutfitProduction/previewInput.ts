import { normalizeHex } from '../personalColor/colorUtils.js'
import type { WardrobeSlot } from '../wardrobe/taxonomy.js'
import { validateOwnedOutfitRecommendation, validateOwnedOutfitRequest } from './contract.js'
import type { ContractValidation, OwnedOutfitRecommendation, OwnedOutfitRequest, OwnedWardrobeFact } from './contract.js'
import { resolveInspirationColor } from './inspirationColors.js'
import { validateInspirationOutfitRecommendation, validateInspirationOutfitRequest } from './inspirationContract.js'
import type { InspirationOutfitRecommendation, InspirationOutfitRequest, InspirationPiece } from './inspirationContract.js'
import { validateOutfitPreviewInput } from './previewContract.js'
import type { OutfitPreviewInput, PreviewPiece } from './previewContract.js'
import { resolveInspirationPreviewVisualDescription } from './previewVisualSemantics.js'

const failure = (issues: readonly string[]): ContractValidation<OutfitPreviewInput> => ({ ok: false, value: null, issues })

function ownedPiece(request: OwnedOutfitRequest, id: string, slot: WardrobeSlot): PreviewPiece | null {
  const fact: OwnedWardrobeFact | undefined = request.wardrobe.find((item) => item.id === id)
  if (!fact || fact.slot !== slot) return null
  const hex = normalizeHex(fact.hex)
  return hex ? { garmentType: fact.garmentType, color: { hex } } : null
}

function inspirationPiece(piece: InspirationPiece, request: InspirationOutfitRequest): PreviewPiece | null {
  const color = resolveInspirationColor(piece.color, request)
  const hex = color ? normalizeHex(color.hex) : null
  if (!hex) return null
  const visualDescription = resolveInspirationPreviewVisualDescription(piece.garmentType, request.gender)
  return { garmentType: piece.garmentType, color: { hex }, ...(visualDescription ? { visualDescription } : {}) }
}

function validateMapped(value: OutfitPreviewInput, label: string): ContractValidation<OutfitPreviewInput> {
  const validated = validateOutfitPreviewInput(value)
  return validated.ok ? validated : failure(validated.issues.map((issue) => `${label}: ${issue}`))
}

export function mapOwnedRecommendationToPreviewInput(
  recommendation: OwnedOutfitRecommendation,
  request: OwnedOutfitRequest,
): ContractValidation<OutfitPreviewInput> {
  const requestValidation = validateOwnedOutfitRequest(request)
  if (!requestValidation.ok || !requestValidation.value) return failure(requestValidation.issues.map((issue) => `owned request: ${issue}`))
  const recommendationValidation = validateOwnedOutfitRecommendation(recommendation, requestValidation.value)
  if (!recommendationValidation.ok || !recommendationValidation.value) return failure(recommendationValidation.issues.map((issue) => `owned recommendation: ${issue}`))
  const selection = recommendationValidation.value.selection
  const outerwear = selection.outerwearId === null ? null : ownedPiece(requestValidation.value, selection.outerwearId, 'outerwear')
  const shoes = ownedPiece(requestValidation.value, selection.shoesId, 'shoes')
  if ((selection.outerwearId !== null && !outerwear) || !shoes) return failure(['owned recommendation could not resolve selected facts'])
  if (selection.kind === 'separates') {
    const top = ownedPiece(requestValidation.value, selection.topId, 'top')
    const bottom = ownedPiece(requestValidation.value, selection.bottomId, 'bottom')
    if (!top || !bottom) return failure(['owned recommendation could not resolve selected facts'])
    return validateMapped({ version: 1, mode: 'flat-lay', outfit: { kind: 'separates', top, bottom, outerwear, shoes } }, 'owned preview')
  }
  const onePiece = ownedPiece(requestValidation.value, selection.onePieceId, 'one-piece')
  if (!onePiece) return failure(['owned recommendation could not resolve selected facts'])
  return validateMapped({ version: 1, mode: 'flat-lay', outfit: { kind: 'one-piece', onePiece, outerwear, shoes } }, 'owned preview')
}

export function mapInspirationRecommendationToPreviewInput(
  recommendation: InspirationOutfitRecommendation,
  request: InspirationOutfitRequest,
): ContractValidation<OutfitPreviewInput> {
  const requestValidation = validateInspirationOutfitRequest(request)
  if (!requestValidation.ok || !requestValidation.value) return failure(requestValidation.issues.map((issue) => `inspiration request: ${issue}`))
  const recommendationValidation = validateInspirationOutfitRecommendation(recommendation, requestValidation.value)
  if (!recommendationValidation.ok || !recommendationValidation.value) return failure(recommendationValidation.issues.map((issue) => `inspiration recommendation: ${issue}`))
  const outfit = recommendationValidation.value.outfit
  const outerwear = outfit.outerwear === null ? null : inspirationPiece(outfit.outerwear, requestValidation.value)
  const shoes = inspirationPiece(outfit.shoes, requestValidation.value)
  if ((outfit.outerwear !== null && !outerwear) || !shoes) return failure(['inspiration recommendation contains an unresolved color'])
  if (outfit.kind === 'separates') {
    const top = inspirationPiece(outfit.top, requestValidation.value)
    const bottom = inspirationPiece(outfit.bottom, requestValidation.value)
    if (!top || !bottom) return failure(['inspiration recommendation contains an unresolved color'])
    return validateMapped({ version: 1, mode: 'flat-lay', outfit: { kind: 'separates', top, bottom, outerwear, shoes } }, 'inspiration preview')
  }
  const onePiece = inspirationPiece(outfit.onePiece, requestValidation.value)
  if (!onePiece) return failure(['inspiration recommendation contains an unresolved color'])
  return validateMapped({ version: 1, mode: 'flat-lay', outfit: { kind: 'one-piece', onePiece, outerwear, shoes } }, 'inspiration preview')
}
