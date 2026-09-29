import { subtypeOrder } from '../personalColor/seasons.js'
import type { AiErrorInfo, AiUsage } from '../ai/providerCatalog.js'
import { OUTFIT_OCCASIONS, validateTodayOutfitInput } from '../todayOutfit/contract.js'
import type { OutfitOccasion, OutfitSelection, SuccessfulOutfitRecommendation, TodayOutfitInput, ValidationResult, WardrobeItem } from '../todayOutfit/contract.js'
import { OUTFIT_IMAGE_CANDIDATE_IDS } from './catalog.js'
import type { OutfitImageCandidateId } from './catalog.js'

export const OUTFIT_VISUALIZATION_MODES = ['flat-lay'] as const
export type OutfitVisualizationMode = typeof OUTFIT_VISUALIZATION_MODES[number]

export interface TodayOutfitImageSelectedItems {
  readonly top: WardrobeItem
  readonly bottom: WardrobeItem
  readonly outerwear: WardrobeItem | null
  readonly shoes: WardrobeItem
}

export interface TodayOutfitImageRequest {
  readonly subtype: TodayOutfitInput['subtype']
  readonly occasion: OutfitOccasion
  readonly selectedItems: TodayOutfitImageSelectedItems
  readonly visualizationMode: 'flat-lay'
  readonly candidate: OutfitImageCandidateId
}

export type TodayOutfitImageResult = {
  readonly status: 'success'
  readonly candidate: OutfitImageCandidateId
  readonly provider: 'gemini'
  readonly model: string
  readonly mimeType: string
  readonly imageDataUrl: string
  readonly latencyMs: number
  readonly usage: AiUsage | null
} | {
  readonly status: 'failure'
  readonly candidate: OutfitImageCandidateId
  readonly provider: 'gemini'
  readonly model: string
  readonly latencyMs: number
  readonly reason: AiErrorInfo
}

const TOP_LEVEL_FIELDS = ['subtype', 'occasion', 'selectedItems', 'visualizationMode', 'candidate'] as const
const SLOT_FIELDS = ['top', 'bottom', 'outerwear', 'shoes'] as const
const ITEM_FIELDS = ['id', 'name', 'category', 'color', 'formality'] as const
const COLOR_FIELDS = ['name', 'hex', 'canonicalColorId'] as const

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const member = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T)
const unsupported = (value: Record<string, unknown>, allowed: readonly string[], path: string, issues: string[]) => {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key))
  if (extra.length) issues.push(`${path} contains unsupported fields: ${extra.join(', ')}`)
}

export function validateTodayOutfitImageRequest(value: unknown): ValidationResult<TodayOutfitImageRequest> {
  const issues: string[] = []
  if (!isObject(value)) return { ok: false, value: null, issues: ['request must be an object'] }
  unsupported(value, TOP_LEVEL_FIELDS, 'request', issues)
  if (!member(subtypeOrder, value.subtype)) issues.push('subtype is invalid')
  if (!member(OUTFIT_OCCASIONS, value.occasion)) issues.push('occasion is invalid')
  if (value.visualizationMode !== 'flat-lay') issues.push('visualizationMode must be flat-lay')
  if (!member(OUTFIT_IMAGE_CANDIDATE_IDS, value.candidate)) issues.push('candidate is invalid')

  const rawItems: unknown[] = []
  if (!isObject(value.selectedItems)) issues.push('selectedItems must be an object')
  else {
    unsupported(value.selectedItems, SLOT_FIELDS, 'selectedItems', issues)
    for (const slot of SLOT_FIELDS) {
      const raw = value.selectedItems[slot]
      if (slot === 'outerwear' && raw === null) continue
      if (!isObject(raw)) { issues.push(`selectedItems.${slot} must be an item${slot === 'outerwear' ? ' or null' : ''}`); continue }
      unsupported(raw, ITEM_FIELDS, `selectedItems.${slot}`, issues)
      if (isObject(raw.color)) unsupported(raw.color, COLOR_FIELDS, `selectedItems.${slot}.color`, issues)
      if (raw.category !== slot) issues.push(`selectedItems.${slot}.category must be ${slot}`)
      rawItems.push(raw)
    }
  }

  if (member(subtypeOrder, value.subtype) && member(OUTFIT_OCCASIONS, value.occasion) && rawItems.length > 0) {
    const wardrobeValidation = validateTodayOutfitInput({ subtype: value.subtype, occasion: value.occasion, wardrobe: rawItems })
    issues.push(...wardrobeValidation.issues.map((issue) => `selectedItems: ${issue}`))
  }
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: value as unknown as TodayOutfitImageRequest, issues: [] }
}

function selectedItem(input: TodayOutfitInput, selection: OutfitSelection, slot: keyof TodayOutfitImageSelectedItems): WardrobeItem | null {
  const id = slot === 'top' ? selection.topId : slot === 'bottom' ? selection.bottomId : slot === 'outerwear' ? selection.outerwearId : selection.shoesId
  return id === null ? null : input.wardrobe.find((item) => item.id === id) ?? null
}

export function deriveTodayOutfitImageRequest(input: TodayOutfitInput, recommendation: SuccessfulOutfitRecommendation, candidate: OutfitImageCandidateId): TodayOutfitImageRequest {
  const request: TodayOutfitImageRequest = {
    subtype: input.subtype,
    occasion: input.occasion,
    selectedItems: {
      top: selectedItem(input, recommendation.selectedItemIds, 'top') as WardrobeItem,
      bottom: selectedItem(input, recommendation.selectedItemIds, 'bottom') as WardrobeItem,
      outerwear: selectedItem(input, recommendation.selectedItemIds, 'outerwear'),
      shoes: selectedItem(input, recommendation.selectedItemIds, 'shoes') as WardrobeItem,
    },
    visualizationMode: 'flat-lay',
    candidate,
  }
  const validated = validateTodayOutfitImageRequest(request)
  if (!validated.ok || !validated.value) throw new Error(`Cannot derive image request: ${validated.issues.join('; ')}`)
  return validated.value
}

export function outfitImageSourceKey(request: TodayOutfitImageRequest): string {
  const { candidate: _candidate, ...source } = request
  return JSON.stringify(source)
}
