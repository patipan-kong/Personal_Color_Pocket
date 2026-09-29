import { normalizeHex } from '../personalColor/colorUtils.js'
import { getPalette } from '../personalColor/palettes.js'
import { subtypeOrder } from '../personalColor/seasons.js'
import type { Subtype } from '../personalColor/types.js'

export const WARDROBE_CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes'] as const
export type WardrobeCategory = typeof WARDROBE_CATEGORIES[number]

export const ITEM_FORMALITIES = ['casual', 'smart-casual', 'formal'] as const
export type ItemFormality = typeof ITEM_FORMALITIES[number]

export const OUTFIT_OCCASIONS = ['casual', 'casual-dinner', 'work', 'smart-casual', 'date', 'formal', 'wedding-guest'] as const
export type OutfitOccasion = typeof OUTFIT_OCCASIONS[number]

export interface WardrobeColor {
  readonly name: string
  readonly hex: string
  // Optional identity into palettes.ts. When present, validation proves that id+hex match the
  // selected subtype; the model never supplies or corrects it.
  readonly canonicalColorId?: string
}

export interface WardrobeItem {
  readonly id: string
  readonly name: string
  readonly category: WardrobeCategory
  readonly color: WardrobeColor
  readonly formality: ItemFormality
}

export interface TodayOutfitInput {
  readonly subtype: Subtype
  readonly occasion: OutfitOccasion
  readonly occasionContext?: string
  readonly wardrobe: readonly WardrobeItem[]
}

export interface OutfitSelection {
  readonly topId: string
  readonly bottomId: string
  readonly outerwearId: string | null
  readonly shoesId: string
}

export interface SuccessfulOutfitRecommendation {
  readonly status: 'success'
  readonly selectedItemIds: OutfitSelection
  readonly alternative: OutfitSelection | null
  readonly reasoning: string
  readonly personalColorNotes: string
  readonly confidence: 'low' | 'medium' | 'high'
}

export type OutfitRecommendation = SuccessfulOutfitRecommendation
  | { readonly status: 'uncertain'; readonly reason: string }
  | { readonly status: 'failure'; readonly reason: string }

export interface ValidationResult<T> {
  readonly ok: boolean
  readonly value: T | null
  readonly issues: readonly string[]
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const text = (value: unknown, max = 500) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const member = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T)

export function validateTodayOutfitInput(value: unknown): ValidationResult<TodayOutfitInput> {
  const issues: string[] = []
  if (!value || typeof value !== 'object') return { ok: false, value: null, issues: ['input must be an object'] }
  const input = value as Record<string, unknown>
  if (!member(subtypeOrder, input.subtype)) issues.push('subtype is invalid')
  if (!member(OUTFIT_OCCASIONS, input.occasion)) issues.push('occasion is invalid')
  if (input.occasionContext !== undefined && (typeof input.occasionContext !== 'string' || input.occasionContext.length > 300)) issues.push('occasionContext must be at most 300 characters')
  if (!Array.isArray(input.wardrobe) || input.wardrobe.length < 1 || input.wardrobe.length > 50) {
    issues.push('wardrobe must contain 1–50 items')
  } else {
    const ids = new Set<string>()
    input.wardrobe.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object') { issues.push(`wardrobe[${index}] must be an object`); return }
      const item = raw as Record<string, unknown>
      if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) issues.push(`wardrobe[${index}].id is invalid`)
      else if (ids.has(item.id)) issues.push(`wardrobe id ${item.id} is duplicated`)
      else ids.add(item.id)
      if (!text(item.name, 100)) issues.push(`wardrobe[${index}].name is invalid`)
      if (!member(WARDROBE_CATEGORIES, item.category)) issues.push(`wardrobe[${index}].category is invalid`)
      if (!member(ITEM_FORMALITIES, item.formality)) issues.push(`wardrobe[${index}].formality is invalid`)
      if (!item.color || typeof item.color !== 'object') issues.push(`wardrobe[${index}].color is invalid`)
      else {
        const color = item.color as Record<string, unknown>
        if (!text(color.name, 80)) issues.push(`wardrobe[${index}].color.name is invalid`)
        if (typeof color.hex !== 'string' || !normalizeHex(color.hex)) issues.push(`wardrobe[${index}].color.hex is invalid`)
        if (color.canonicalColorId !== undefined && (typeof color.canonicalColorId !== 'string' || !ID_PATTERN.test(color.canonicalColorId))) issues.push(`wardrobe[${index}].color.canonicalColorId is invalid`)
        if (typeof color.canonicalColorId === 'string' && member(subtypeOrder, input.subtype)) {
          const palette = getPalette(input.subtype)
          const canonical = [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder].find((candidate) => candidate.id === color.canonicalColorId)
          if (!canonical || normalizeHex(canonical.hex) !== normalizeHex(String(color.hex))) issues.push(`wardrobe[${index}].color canonical identity does not match ${input.subtype}`)
        }
      }
    })
  }
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: input as unknown as TodayOutfitInput, issues: [] }
}

function validateSelection(selection: unknown, input: TodayOutfitInput, path: string, issues: string[]): selection is OutfitSelection {
  if (!selection || typeof selection !== 'object') { issues.push(`${path} must be an object`); return false }
  const value = selection as Record<string, unknown>
  const expected = { topId: 'top', bottomId: 'bottom', outerwearId: 'outerwear', shoesId: 'shoes' } as const
  const extra = Object.keys(value).filter((key) => !(key in expected))
  if (extra.length) issues.push(`${path} contains unsupported fields: ${extra.join(', ')}`)
  const selected: string[] = []
  for (const [field, category] of Object.entries(expected)) {
    const id = value[field]
    if (field === 'outerwearId' && id === null) continue
    if (typeof id !== 'string') { issues.push(`${path}.${field} must be a wardrobe ID${field === 'outerwearId' ? ' or null' : ''}`); continue }
    const item = input.wardrobe.find((candidate) => candidate.id === id)
    if (!item) issues.push(`${path}.${field} invents unknown item ID ${id}`)
    else if (item.category !== category) issues.push(`${path}.${field} selects ${item.category}, expected ${category}`)
    selected.push(id)
  }
  if (new Set(selected).size !== selected.length) issues.push(`${path} assigns one item to multiple incompatible slots`)
  return issues.length === 0
}

export function validateOutfitRecommendation(value: unknown, input: TodayOutfitInput): ValidationResult<OutfitRecommendation> {
  const issues: string[] = []
  if (!value || typeof value !== 'object') return { ok: false, value: null, issues: ['recommendation must be an object'] }
  const result = value as Record<string, unknown>
  if (result.status === 'failure' || result.status === 'uncertain') {
    const extra = Object.keys(result).filter((key) => !['status', 'reason'].includes(key))
    if (extra.length) issues.push(`${result.status} result contains unsupported fields: ${extra.join(', ')}`)
    if (!text(result.reason, 600)) issues.push(`${result.status} result requires a concise reason`)
  } else if (result.status === 'success') {
    const extra = Object.keys(result).filter((key) => !['status', 'selectedItemIds', 'alternative', 'reasoning', 'personalColorNotes', 'confidence'].includes(key))
    if (extra.length) issues.push(`success result contains unsupported fields: ${extra.join(', ')}`)
    validateSelection(result.selectedItemIds, input, 'selectedItemIds', issues)
    if (result.alternative !== null) validateSelection(result.alternative, input, 'alternative', issues)
    if (result.alternative && result.selectedItemIds && typeof result.alternative === 'object' && typeof result.selectedItemIds === 'object') {
      const alternative = result.alternative as Record<string, unknown>
      const primary = result.selectedItemIds as Record<string, unknown>
      if (['topId', 'bottomId', 'outerwearId', 'shoesId'].every((key) => alternative[key] === primary[key])) issues.push('alternative must differ from the primary outfit')
    }
    if (!text(result.reasoning, 1200)) issues.push('reasoning is invalid')
    if (!text(result.personalColorNotes, 1200)) issues.push('personalColorNotes is invalid')
    if (!member(['low', 'medium', 'high'] as const, result.confidence)) issues.push('confidence is invalid')
  } else issues.push('status must be success, uncertain, or failure')
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: value as OutfitRecommendation, issues: [] }
}
