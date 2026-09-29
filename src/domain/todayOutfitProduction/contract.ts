import { LUCKY_COLOR_FAMILIES } from '../luckyColor/types.js'
import type { LuckyColorFamily } from '../luckyColor/types.js'
import { normalizeHex } from '../personalColor/colorUtils.js'
import { subtypeOrder } from '../personalColor/seasons.js'
import type { MatchRating, Subtype } from '../personalColor/types.js'
import { getWardrobeSlot, isGarmentType, isWardrobeFormality, WARDROBE_SLOTS } from '../wardrobe/taxonomy.js'
import type { GarmentType, WardrobeFormality, WardrobeSlot } from '../wardrobe/taxonomy.js'
import { TODAY_OCCASIONS } from './todayInputs.js'
import type { TodayOccasion } from './todayInputs.js'

export const OWNED_OUTFIT_REQUEST_VERSION = 1 as const
export const OWNED_OUTFIT_LANGUAGES = ['en', 'th'] as const
export type OwnedOutfitLanguage = typeof OWNED_OUTFIT_LANGUAGES[number]

export const LUCKY_PREFERENCE_SUITABILITIES = ['near-face', 'main-piece', 'below-face', 'accessory'] as const
export type LuckyPreferenceSuitability = typeof LUCKY_PREFERENCE_SUITABILITIES[number]

export interface OwnedWardrobeFact {
  readonly id: string
  readonly slot: WardrobeSlot
  readonly garmentType: GarmentType
  readonly hex: string
  readonly formality: WardrobeFormality
  readonly personalColorCompatibility: { readonly rating: MatchRating; readonly score: number } | null
  readonly luckyFamilyMatches: readonly LuckyColorFamily[]
}

export interface OwnedLuckyPreference {
  readonly family: LuckyColorFamily
  readonly hex: string | null
  readonly suitability: LuckyPreferenceSuitability
  readonly priority: 'soft'
}

// A structured, provider-independent identity used only to avoid repeating a
// previously generated Owned Look in the current session.
export type OwnedOutfitSignature =
  | { readonly kind: 'separates'; readonly itemIds: readonly string[] }
  | { readonly kind: 'one-piece'; readonly itemIds: readonly string[] }

export interface OwnedOutfitRequest {
  readonly version: typeof OWNED_OUTFIT_REQUEST_VERSION
  readonly language: OwnedOutfitLanguage
  readonly subtype: Subtype | null
  readonly occasion: TodayOccasion
  readonly wardrobe: readonly OwnedWardrobeFact[]
  readonly luckyPreferences: readonly OwnedLuckyPreference[]
  /** At most two earlier Looks are sent for V1 generation N. */
  readonly exclusions?: readonly OwnedOutfitSignature[]
}

export type OwnedOutfitSelection =
  | { readonly kind: 'separates'; readonly topId: string; readonly bottomId: string; readonly outerwearId: string | null; readonly shoesId: string }
  | { readonly kind: 'one-piece'; readonly onePieceId: string; readonly outerwearId: string | null; readonly shoesId: string }

export interface OwnedOutfitReasoning {
  readonly occasion: string
  readonly personalColor: string | null
  readonly luckyColor: string | null
}

export interface OwnedOutfitRecommendation {
  readonly selection: OwnedOutfitSelection
  readonly reasoning: OwnedOutfitReasoning
}

export type OwnedRecommendationSource = 'ai' | 'deterministic-fallback'
export interface OwnedRecommendationResult {
  readonly source: OwnedRecommendationSource
  readonly recommendation: OwnedOutfitRecommendation
}

export interface ContractValidation<T> {
  readonly ok: boolean
  readonly value: T | null
  readonly issues: readonly string[]
}

const MATCH_RATINGS: readonly MatchRating[] = ['Great Match', 'Good Match', 'Wearable', 'Tricky']
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/
const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const member = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T)
const exactFields = (value: Record<string, unknown>, allowed: readonly string[], path: string, issues: string[]) => {
  const extra = Object.keys(value).filter((field) => !allowed.includes(field))
  if (extra.length) issues.push(`${path} contains unsupported fields: ${extra.join(', ')}`)
}
const conciseText = (value: unknown, max = 500) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

function validateWardrobeFact(value: unknown, index: number, ids: Set<string>, issues: string[]): value is OwnedWardrobeFact {
  const path = `wardrobe[${index}]`
  if (!plain(value)) { issues.push(`${path} must be an object`); return false }
  exactFields(value, ['id', 'slot', 'garmentType', 'hex', 'formality', 'personalColorCompatibility', 'luckyFamilyMatches'], path, issues)
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) issues.push(`${path}.id is invalid`)
  else if (ids.has(value.id)) issues.push(`${path}.id is duplicated`)
  else ids.add(value.id)
  if (!member(WARDROBE_SLOTS, value.slot)) issues.push(`${path}.slot is invalid`)
  if (!isGarmentType(value.garmentType)) issues.push(`${path}.garmentType is invalid`)
  else if (member(WARDROBE_SLOTS, value.slot) && getWardrobeSlot(value.garmentType) !== value.slot) issues.push(`${path}.slot does not match garmentType`)
  if (typeof value.hex !== 'string' || normalizeHex(value.hex) !== value.hex) issues.push(`${path}.hex must be normalized`)
  if (!isWardrobeFormality(value.formality)) issues.push(`${path}.formality is invalid`)
  if (value.personalColorCompatibility !== null) {
    if (!plain(value.personalColorCompatibility)) issues.push(`${path}.personalColorCompatibility is invalid`)
    else {
      exactFields(value.personalColorCompatibility, ['rating', 'score'], `${path}.personalColorCompatibility`, issues)
      if (!member(MATCH_RATINGS, value.personalColorCompatibility.rating)) issues.push(`${path}.personalColorCompatibility.rating is invalid`)
      if (typeof value.personalColorCompatibility.score !== 'number' || !Number.isFinite(value.personalColorCompatibility.score) || value.personalColorCompatibility.score < 0 || value.personalColorCompatibility.score > 1) issues.push(`${path}.personalColorCompatibility.score is invalid`)
    }
  }
  if (!Array.isArray(value.luckyFamilyMatches) || value.luckyFamilyMatches.some((family) => !member(LUCKY_COLOR_FAMILIES, family)) || new Set(value.luckyFamilyMatches).size !== value.luckyFamilyMatches.length) issues.push(`${path}.luckyFamilyMatches is invalid`)
  return true
}

function validateLuckyPreference(value: unknown, index: number, issues: string[]): value is OwnedLuckyPreference {
  const path = `luckyPreferences[${index}]`
  if (!plain(value)) { issues.push(`${path} must be an object`); return false }
  exactFields(value, ['family', 'hex', 'suitability', 'priority'], path, issues)
  if (!member(LUCKY_COLOR_FAMILIES, value.family)) issues.push(`${path}.family is invalid`)
  if (value.hex !== null && (typeof value.hex !== 'string' || normalizeHex(value.hex) !== value.hex)) issues.push(`${path}.hex is invalid`)
  if (!member(LUCKY_PREFERENCE_SUITABILITIES, value.suitability)) issues.push(`${path}.suitability is invalid`)
  if (value.priority !== 'soft') issues.push(`${path}.priority must be soft`)
  return true
}

export function validateOutfitLuckyPreferences(value: unknown, issues: string[]): value is readonly OwnedLuckyPreference[] {
  if (!Array.isArray(value) || value.length > 2) { issues.push('luckyPreferences must contain 0–2 items'); return false }
  const families = new Set<string>()
  value.forEach((preference, index) => {
    validateLuckyPreference(preference, index, issues)
    if (plain(preference) && typeof preference.family === 'string') {
      if (families.has(preference.family)) issues.push('luckyPreferences contains duplicate families')
      families.add(preference.family)
    }
  })
  return true
}

function validateOwnedOutfitSignature(value: unknown, index: number, wardrobe: readonly OwnedWardrobeFact[], issues: string[]): value is OwnedOutfitSignature {
  const path = `exclusions[${index}]`
  if (!plain(value)) { issues.push(`${path} must be an object`); return false }
  exactFields(value, ['kind', 'itemIds'], path, issues)
  if (value.kind !== 'separates' && value.kind !== 'one-piece') issues.push(`${path}.kind is invalid`)
  if (!Array.isArray(value.itemIds)) {
    issues.push(`${path}.itemIds must be an array`)
    return false
  }
  const expectedLength = value.kind === 'separates' ? [3, 4] : [2, 3]
  if (!expectedLength.includes(value.itemIds.length)) issues.push(`${path}.itemIds has the wrong number of items`)
  const ids = value.itemIds.filter((id): id is string => typeof id === 'string')
  if (ids.length !== value.itemIds.length || ids.some((id) => !ID_PATTERN.test(id))) issues.push(`${path}.itemIds contains invalid IDs`)
  if (new Set(ids).size !== ids.length) issues.push(`${path}.itemIds contains duplicates`)
  const selected = ids.map((id) => wardrobe.find((item) => item.id === id)).filter((item): item is OwnedWardrobeFact => Boolean(item))
  if (selected.length !== ids.length) issues.push(`${path}.itemIds references unknown wardrobe IDs`)
  const slotCounts = selected.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.slot]: (counts[item.slot] ?? 0) + 1 }), {})
  if (value.kind === 'separates') {
    const validShape = slotCounts.top === 1 && slotCounts.bottom === 1 && slotCounts.shoes === 1
      && (ids.length === 3 ? !slotCounts.outerwear : ids.length === 4 && slotCounts.outerwear === 1)
    if (!validShape || Object.keys(slotCounts).some((slot) => !['top', 'bottom', 'outerwear', 'shoes'].includes(slot))) issues.push(`${path} does not describe a valid separates outfit`)
  } else if (value.kind === 'one-piece') {
    const validShape = slotCounts['one-piece'] === 1 && slotCounts.shoes === 1
      && (ids.length === 2 ? !slotCounts.outerwear : ids.length === 3 && slotCounts.outerwear === 1)
    if (!validShape || Object.keys(slotCounts).some((slot) => !['one-piece', 'outerwear', 'shoes'].includes(slot))) issues.push(`${path} does not describe a valid one-piece outfit`)
  }
  return true
}

function validateOwnedOutfitExclusions(value: unknown, wardrobe: readonly OwnedWardrobeFact[], issues: string[]): value is readonly OwnedOutfitSignature[] {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > 2) { issues.push('exclusions must contain 0–2 items'); return false }
  value.forEach((signature, index) => validateOwnedOutfitSignature(signature, index, wardrobe, issues))
  return true
}

export function validateOwnedOutfitRequest(value: unknown): ContractValidation<OwnedOutfitRequest> {
  const issues: string[] = []
  if (!plain(value)) return { ok: false, value: null, issues: ['request must be an object'] }
  exactFields(value, ['version', 'language', 'subtype', 'occasion', 'wardrobe', 'luckyPreferences', 'exclusions'], 'request', issues)
  if (value.version !== OWNED_OUTFIT_REQUEST_VERSION) issues.push('version is invalid')
  if (!member(OWNED_OUTFIT_LANGUAGES, value.language)) issues.push('language is invalid')
  if (value.subtype !== null && !member(subtypeOrder, value.subtype)) issues.push('subtype is invalid')
  if (!member(TODAY_OCCASIONS, value.occasion)) issues.push('occasion is invalid')
  const ids = new Set<string>()
  if (!Array.isArray(value.wardrobe) || value.wardrobe.length < 1 || value.wardrobe.length > 250) issues.push('wardrobe must contain 1–250 items')
  else {
    value.wardrobe.forEach((item, index) => validateWardrobeFact(item, index, ids, issues))
    const slots = new Set(value.wardrobe.flatMap((item) => plain(item) && member(WARDROBE_SLOTS, item.slot) ? [item.slot] : []))
    if (!slots.has('shoes') || !(slots.has('one-piece') || (slots.has('top') && slots.has('bottom')))) issues.push('wardrobe is not recommendation-ready')
  }
  validateOutfitLuckyPreferences(value.luckyPreferences, issues)
  if (Array.isArray(value.wardrobe)) {
    if (value.subtype === null && value.wardrobe.some((item) => plain(item) && item.personalColorCompatibility !== null)) issues.push('personalColorCompatibility must be null without subtype')
    if (value.subtype !== null && value.wardrobe.some((item) => plain(item) && item.personalColorCompatibility === null)) issues.push('personalColorCompatibility is required with subtype')
    if (Array.isArray(value.luckyPreferences)) {
      const requested = new Set(value.luckyPreferences.flatMap((preference) => plain(preference) && typeof preference.family === 'string' ? [preference.family] : []))
      if (value.wardrobe.some((item) => plain(item) && Array.isArray(item.luckyFamilyMatches) && item.luckyFamilyMatches.some((family) => !requested.has(String(family))))) issues.push('luckyFamilyMatches must reference current Lucky preferences')
    }
  }
  if (Array.isArray(value.wardrobe)) validateOwnedOutfitExclusions(value.exclusions, value.wardrobe as readonly OwnedWardrobeFact[], issues)
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: value as unknown as OwnedOutfitRequest, issues: [] }
}

function validateSelectedId(input: OwnedOutfitRequest, value: unknown, slot: WardrobeSlot, path: string, issues: string[]): string | null {
  if (typeof value !== 'string') { issues.push(`${path} must be a wardrobe ID`); return null }
  const item = input.wardrobe.find((candidate) => candidate.id === value)
  if (!item) issues.push(`${path} invents an unknown wardrobe ID`)
  else if (item.slot !== slot) issues.push(`${path} selects ${item.slot}, expected ${slot}`)
  return value
}

function validateOuterwear(input: OwnedOutfitRequest, value: unknown, path: string, issues: string[]): string | null {
  if (value === null) return null
  return validateSelectedId(input, value, 'outerwear', path, issues)
}

function validateSelection(value: unknown, input: OwnedOutfitRequest, issues: string[]): value is OwnedOutfitSelection {
  if (!plain(value)) { issues.push('selection must be an object'); return false }
  const selected: Array<string | null> = []
  if (value.kind === 'separates') {
    exactFields(value, ['kind', 'topId', 'bottomId', 'outerwearId', 'shoesId'], 'selection', issues)
    selected.push(validateSelectedId(input, value.topId, 'top', 'selection.topId', issues))
    selected.push(validateSelectedId(input, value.bottomId, 'bottom', 'selection.bottomId', issues))
    selected.push(validateOuterwear(input, value.outerwearId, 'selection.outerwearId', issues))
    selected.push(validateSelectedId(input, value.shoesId, 'shoes', 'selection.shoesId', issues))
  } else if (value.kind === 'one-piece') {
    exactFields(value, ['kind', 'onePieceId', 'outerwearId', 'shoesId'], 'selection', issues)
    selected.push(validateSelectedId(input, value.onePieceId, 'one-piece', 'selection.onePieceId', issues))
    selected.push(validateOuterwear(input, value.outerwearId, 'selection.outerwearId', issues))
    selected.push(validateSelectedId(input, value.shoesId, 'shoes', 'selection.shoesId', issues))
  } else issues.push('selection.kind must be separates or one-piece')
  const ids = selected.filter((id): id is string => typeof id === 'string')
  if (new Set(ids).size !== ids.length) issues.push('selection assigns one item to multiple slots')
  return issues.length === 0
}

export function validateOwnedOutfitRecommendation(value: unknown, input: OwnedOutfitRequest): ContractValidation<OwnedOutfitRecommendation> {
  const issues: string[] = []
  if (!plain(value)) return { ok: false, value: null, issues: ['recommendation must be an object'] }
  exactFields(value, ['selection', 'reasoning'], 'recommendation', issues)
  validateSelection(value.selection, input, issues)
  if (!plain(value.reasoning)) issues.push('reasoning must be an object')
  else {
    exactFields(value.reasoning, ['occasion', 'personalColor', 'luckyColor'], 'reasoning', issues)
    if (!conciseText(value.reasoning.occasion)) issues.push('reasoning.occasion is invalid')
    if (value.reasoning.personalColor !== null && !conciseText(value.reasoning.personalColor)) issues.push('reasoning.personalColor is invalid')
    if (value.reasoning.luckyColor !== null && !conciseText(value.reasoning.luckyColor)) issues.push('reasoning.luckyColor is invalid')
    if (input.subtype === null && value.reasoning.personalColor !== null) issues.push('reasoning.personalColor must be null without subtype')
    if (input.luckyPreferences.length === 0 && value.reasoning.luckyColor !== null) issues.push('reasoning.luckyColor must be null without Lucky preferences')
  }
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: value as unknown as OwnedOutfitRecommendation, issues: [] }
}
