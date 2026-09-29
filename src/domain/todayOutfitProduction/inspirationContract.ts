import { subtypeOrder } from '../personalColor/seasons.js'
import type { Subtype } from '../personalColor/types.js'
import { getCanonicalWardrobeColor } from '../wardrobe/wardrobe.js'
import { getWardrobeSlot, isGarmentAllowedForGender, isGarmentType, isProfileGender } from '../wardrobe/taxonomy.js'
import type { GarmentType, ProfileGender, WardrobeSlot } from '../wardrobe/taxonomy.js'
import { isBasicWardrobeColorId } from '../wardrobe/colors.js'
import type { BasicWardrobeColorId } from '../wardrobe/colors.js'
import { TODAY_OCCASIONS } from './todayInputs.js'
import type { TodayOccasion } from './todayInputs.js'
import { validateOutfitLuckyPreferences } from './contract.js'
import type { ContractValidation, OwnedLuckyPreference } from './contract.js'

export const INSPIRATION_OUTFIT_REQUEST_VERSION = 1 as const

export type InspirationColor =
  | { readonly kind: 'canonical'; readonly canonicalColorId: string }
  | { readonly kind: 'generic'; readonly colorId: BasicWardrobeColorId }

export interface InspirationPiece {
  readonly garmentType: GarmentType
  readonly color: InspirationColor
}

// Structured identity for a conceptual Look. It contains no provider prose and
// deliberately keeps the authoritative color identity (canonical or generic).
export interface InspirationOutfitSignature {
  readonly kind: 'separates' | 'one-piece'
  readonly pieces: readonly InspirationPiece[]
}

export type InspirationOutfit =
  | { readonly kind: 'separates'; readonly top: InspirationPiece; readonly bottom: InspirationPiece; readonly outerwear: InspirationPiece | null; readonly shoes: InspirationPiece }
  | { readonly kind: 'one-piece'; readonly onePiece: InspirationPiece; readonly outerwear: InspirationPiece | null; readonly shoes: InspirationPiece }

export interface InspirationOutfitRequest {
  readonly version: typeof INSPIRATION_OUTFIT_REQUEST_VERSION
  readonly subtype: Subtype | null
  readonly occasion: TodayOccasion
  // Explicit selected profile gender (null = none selected). The server derives the allowed garment
  // taxonomy from it; a client-supplied garment list is never accepted.
  readonly gender: ProfileGender | null
  readonly canonicalColorIds: readonly string[]
  readonly genericColorIds: readonly BasicWardrobeColorId[]
  readonly luckyPreferences: readonly OwnedLuckyPreference[]
  /** At most two earlier Looks are sent for V1 generation N. */
  readonly exclusions?: readonly InspirationOutfitSignature[]
}

export interface InspirationOutfitRecommendation { readonly outfit: InspirationOutfit }
export type InspirationRecommendationSource = 'ai' | 'deterministic-fallback'
export interface InspirationRecommendationResult {
  readonly source: InspirationRecommendationSource
  readonly recommendation: InspirationOutfitRecommendation
}

const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const member = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T)
const exactFields = (value: Record<string, unknown>, allowed: readonly string[], path: string, issues: string[]) => {
  const extra = Object.keys(value).filter((field) => !allowed.includes(field))
  if (extra.length) issues.push(`${path} contains unsupported fields: ${extra.join(', ')}`)
}

export function validateInspirationOutfitRequest(value: unknown): ContractValidation<InspirationOutfitRequest> {
  const issues: string[] = []
  if (!plain(value)) return { ok: false, value: null, issues: ['request must be an object'] }
  exactFields(value, ['version', 'subtype', 'occasion', 'gender', 'canonicalColorIds', 'genericColorIds', 'luckyPreferences', 'exclusions'], 'request', issues)
  if (value.version !== INSPIRATION_OUTFIT_REQUEST_VERSION) issues.push('version is invalid')
  if (value.subtype !== null && !member(subtypeOrder, value.subtype)) issues.push('subtype is invalid')
  if (!member(TODAY_OCCASIONS, value.occasion)) issues.push('occasion is invalid')
  if (value.gender !== null && !isProfileGender(value.gender)) issues.push('gender is invalid')
  if (!Array.isArray(value.genericColorIds) || value.genericColorIds.length < 1 || value.genericColorIds.some((id) => !isBasicWardrobeColorId(id)) || new Set(value.genericColorIds).size !== value.genericColorIds.length) issues.push('genericColorIds is invalid')
  if (!Array.isArray(value.canonicalColorIds) || value.canonicalColorIds.some((id) => typeof id !== 'string') || new Set(value.canonicalColorIds).size !== value.canonicalColorIds.length) issues.push('canonicalColorIds is invalid')
  else if (value.subtype === null && value.canonicalColorIds.length) issues.push('canonicalColorIds must be empty without subtype')
  else if (typeof value.subtype === 'string' && value.canonicalColorIds.length === 0) issues.push('canonicalColorIds are required with subtype')
  else if (typeof value.subtype === 'string' && value.canonicalColorIds.some((id) => !id.startsWith(`${value.subtype}-`) || !getCanonicalWardrobeColor(id))) issues.push('canonicalColorIds must belong to subtype')
  validateOutfitLuckyPreferences(value.luckyPreferences, issues)
  validateInspirationOutfitExclusions(value.exclusions, value as unknown as InspirationOutfitRequest, issues)
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: value as unknown as InspirationOutfitRequest, issues: [] }
}

function validateColor(value: unknown, input: InspirationOutfitRequest, path: string, issues: string[]): value is InspirationColor {
  if (!plain(value)) { issues.push(`${path} must be an object`); return false }
  if (value.kind === 'canonical') {
    exactFields(value, ['kind', 'canonicalColorId'], path, issues)
    if (typeof value.canonicalColorId !== 'string' || !input.canonicalColorIds.includes(value.canonicalColorId)) issues.push(`${path}.canonicalColorId is not allowed`)
  } else if (value.kind === 'generic') {
    exactFields(value, ['kind', 'colorId'], path, issues)
    if (!isBasicWardrobeColorId(value.colorId) || !input.genericColorIds.includes(value.colorId)) issues.push(`${path}.colorId is not allowed`)
  } else issues.push(`${path}.kind is invalid`)
  return true
}

function validatePiece(value: unknown, input: InspirationOutfitRequest, slot: WardrobeSlot, path: string, issues: string[]): value is InspirationPiece {
  if (!plain(value)) { issues.push(`${path} must be an object`); return false }
  exactFields(value, ['garmentType', 'color'], path, issues)
  if (!isGarmentType(value.garmentType) || !isGarmentAllowedForGender(value.garmentType, input.gender)) issues.push(`${path}.garmentType is invalid`)
  else if (getWardrobeSlot(value.garmentType) !== slot) issues.push(`${path}.garmentType does not belong to ${slot}`)
  validateColor(value.color, input, `${path}.color`, issues)
  return true
}

export function validateInspirationOutfitRecommendation(value: unknown, input: InspirationOutfitRequest): ContractValidation<InspirationOutfitRecommendation> {
  const issues: string[] = []
  if (!plain(value)) return { ok: false, value: null, issues: ['recommendation must be an object'] }
  exactFields(value, ['outfit'], 'recommendation', issues)
  if (!plain(value.outfit)) issues.push('outfit must be an object')
  else if (value.outfit.kind === 'separates') {
    exactFields(value.outfit, ['kind', 'top', 'bottom', 'outerwear', 'shoes'], 'outfit', issues)
    validatePiece(value.outfit.top, input, 'top', 'outfit.top', issues)
    validatePiece(value.outfit.bottom, input, 'bottom', 'outfit.bottom', issues)
    if (value.outfit.outerwear !== null) validatePiece(value.outfit.outerwear, input, 'outerwear', 'outfit.outerwear', issues)
    validatePiece(value.outfit.shoes, input, 'shoes', 'outfit.shoes', issues)
  } else if (value.outfit.kind === 'one-piece') {
    exactFields(value.outfit, ['kind', 'onePiece', 'outerwear', 'shoes'], 'outfit', issues)
    validatePiece(value.outfit.onePiece, input, 'one-piece', 'outfit.onePiece', issues)
    if (value.outfit.outerwear !== null) validatePiece(value.outfit.outerwear, input, 'outerwear', 'outfit.outerwear', issues)
    validatePiece(value.outfit.shoes, input, 'shoes', 'outfit.shoes', issues)
  } else issues.push('outfit.kind must be separates or one-piece')
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: value as unknown as InspirationOutfitRecommendation, issues: [] }
}

function validateInspirationSignaturePiece(value: unknown, input: InspirationOutfitRequest, path: string, issues: string[]): value is InspirationPiece {
  if (!plain(value)) { issues.push(`${path} must be an object`); return false }
  exactFields(value, ['garmentType', 'color'], path, issues)
  if (!isGarmentType(value.garmentType) || !isGarmentAllowedForGender(value.garmentType, input.gender)) issues.push(`${path}.garmentType is invalid`)
  validateColor(value.color, input, `${path}.color`, issues)
  return true
}

function validateInspirationOutfitExclusions(value: unknown, input: InspirationOutfitRequest, issues: string[]): value is readonly InspirationOutfitSignature[] {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > 2) { issues.push('exclusions must contain 0–2 items'); return false }
  value.forEach((signature, index) => {
    const path = `exclusions[${index}]`
    if (!plain(signature)) { issues.push(`${path} must be an object`); return }
    exactFields(signature, ['kind', 'pieces'], path, issues)
    if (signature.kind !== 'separates' && signature.kind !== 'one-piece') issues.push(`${path}.kind is invalid`)
    if (!Array.isArray(signature.pieces)) { issues.push(`${path}.pieces must be an array`); return }
    const expectedLength = signature.kind === 'separates' ? [3, 4] : [2, 3]
    if (!expectedLength.includes(signature.pieces.length)) issues.push(`${path}.pieces has the wrong number of items`)
    signature.pieces.forEach((piece, pieceIndex) => validateInspirationSignaturePiece(piece, input, `${path}.pieces[${pieceIndex}]`, issues))
    const slots = signature.pieces.filter(plain).map((piece) => isGarmentType(piece.garmentType) ? getWardrobeSlot(piece.garmentType) : null).filter((slot): slot is WardrobeSlot => Boolean(slot))
    const slotCounts = slots.reduce<Record<string, number>>((counts, slot) => ({ ...counts, [slot]: (counts[slot] ?? 0) + 1 }), {})
    if (signature.kind === 'separates') {
      const validShape = slotCounts.top === 1 && slotCounts.bottom === 1 && slotCounts.shoes === 1
        && (signature.pieces.length === 3 ? !slotCounts.outerwear : signature.pieces.length === 4 && slotCounts.outerwear === 1)
      if (!validShape || slots.some((slot) => !['top', 'bottom', 'outerwear', 'shoes'].includes(slot))) issues.push(`${path} does not describe a valid separates outfit`)
    } else if (signature.kind === 'one-piece') {
      const validShape = slotCounts['one-piece'] === 1 && slotCounts.shoes === 1
        && (signature.pieces.length === 2 ? !slotCounts.outerwear : signature.pieces.length === 3 && slotCounts.outerwear === 1)
      if (!validShape || slots.some((slot) => !['one-piece', 'outerwear', 'shoes'].includes(slot))) issues.push(`${path} does not describe a valid one-piece outfit`)
    }
  })
  return true
}
