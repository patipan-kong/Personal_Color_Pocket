import { subtypeOrder } from '../personalColor/seasons.js'
import type { Subtype } from '../personalColor/types.js'
import { getCanonicalWardrobeColor } from '../wardrobe/wardrobe.js'
import { GARMENT_TYPES, getWardrobeSlot, isGarmentType } from '../wardrobe/taxonomy.js'
import type { GarmentType, WardrobeSlot } from '../wardrobe/taxonomy.js'
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

export type InspirationOutfit =
  | { readonly kind: 'separates'; readonly top: InspirationPiece; readonly bottom: InspirationPiece; readonly outerwear: InspirationPiece | null; readonly shoes: InspirationPiece }
  | { readonly kind: 'one-piece'; readonly onePiece: InspirationPiece; readonly outerwear: InspirationPiece | null; readonly shoes: InspirationPiece }

export interface InspirationOutfitRequest {
  readonly version: typeof INSPIRATION_OUTFIT_REQUEST_VERSION
  readonly subtype: Subtype | null
  readonly occasion: TodayOccasion
  readonly allowedGarmentTypes: readonly GarmentType[]
  readonly canonicalColorIds: readonly string[]
  readonly genericColorIds: readonly BasicWardrobeColorId[]
  readonly luckyPreferences: readonly OwnedLuckyPreference[]
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
  exactFields(value, ['version', 'subtype', 'occasion', 'allowedGarmentTypes', 'canonicalColorIds', 'genericColorIds', 'luckyPreferences'], 'request', issues)
  if (value.version !== INSPIRATION_OUTFIT_REQUEST_VERSION) issues.push('version is invalid')
  if (value.subtype !== null && !member(subtypeOrder, value.subtype)) issues.push('subtype is invalid')
  if (!member(TODAY_OCCASIONS, value.occasion)) issues.push('occasion is invalid')
  if (!Array.isArray(value.allowedGarmentTypes) || value.allowedGarmentTypes.length !== GARMENT_TYPES.length || value.allowedGarmentTypes.some((item) => !isGarmentType(item)) || new Set(value.allowedGarmentTypes).size !== value.allowedGarmentTypes.length) issues.push('allowedGarmentTypes is invalid')
  if (!Array.isArray(value.genericColorIds) || value.genericColorIds.length < 1 || value.genericColorIds.some((id) => !isBasicWardrobeColorId(id)) || new Set(value.genericColorIds).size !== value.genericColorIds.length) issues.push('genericColorIds is invalid')
  if (!Array.isArray(value.canonicalColorIds) || value.canonicalColorIds.some((id) => typeof id !== 'string') || new Set(value.canonicalColorIds).size !== value.canonicalColorIds.length) issues.push('canonicalColorIds is invalid')
  else if (value.subtype === null && value.canonicalColorIds.length) issues.push('canonicalColorIds must be empty without subtype')
  else if (typeof value.subtype === 'string' && value.canonicalColorIds.length === 0) issues.push('canonicalColorIds are required with subtype')
  else if (typeof value.subtype === 'string' && value.canonicalColorIds.some((id) => !id.startsWith(`${value.subtype}-`) || !getCanonicalWardrobeColor(id))) issues.push('canonicalColorIds must belong to subtype')
  validateOutfitLuckyPreferences(value.luckyPreferences, issues)
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
  if (!isGarmentType(value.garmentType) || !input.allowedGarmentTypes.includes(value.garmentType)) issues.push(`${path}.garmentType is invalid`)
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
