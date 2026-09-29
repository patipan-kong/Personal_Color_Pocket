import { describeColor } from '../colorNames/colorNames.js'
import { checkColor } from '../personalColor/colorMatch.js'
import { normalizeHex } from '../personalColor/colorUtils.js'
import { getPalette } from '../personalColor/palettes.js'
import { subtypeOrder } from '../personalColor/seasons.js'
import type { ColorMatchResult, PaletteColor, Subtype } from '../personalColor/types.js'
import { getGarmentDefinition, getWardrobeSlot, isGarmentType, isWardrobeFormality } from './taxonomy.js'
import type { GarmentType, WardrobeFormality, WardrobeSlot } from './taxonomy.js'

export interface WardrobeRecordV1 {
  readonly id: string
  readonly garmentType: GarmentType
  readonly color: {
    readonly hex: string
    readonly canonicalColorId?: string
  }
  readonly formality: WardrobeFormality
  readonly customName?: string
}

export const WARDROBE_CUSTOM_NAME_MAX_LENGTH = 80
export const WARDROBE_ID_MAX_LENGTH = 80
export const WARDROBE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

const PALETTE_GROUPS = ['best', 'neutrals', 'accents', 'harder'] as const
const canonicalColorsById = new Map<string, PaletteColor>()
for (const subtype of subtypeOrder) {
  const palette = getPalette(subtype)
  for (const group of PALETTE_GROUPS) {
    for (const color of palette[group]) canonicalColorsById.set(color.id, color)
  }
}

export function getCanonicalWardrobeColor(id: string): PaletteColor | null {
  return canonicalColorsById.get(id) ?? null
}

export type WardrobeRecordRepair = 'normalized-hex' | 'trimmed-custom-name' | 'removed-empty-custom-name' | 'dropped-stale-canonical-color'

export type WardrobeRecordParseResult =
  | { readonly ok: true; readonly value: WardrobeRecordV1; readonly repairs: readonly WardrobeRecordRepair[] }
  | { readonly ok: false; readonly issues: readonly string[] }

const allowedRecordFields = new Set(['id', 'garmentType', 'color', 'formality', 'customName'])
const allowedColorFields = new Set(['hex', 'canonicalColorId'])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isWardrobeId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= WARDROBE_ID_MAX_LENGTH
    && WARDROBE_ID_PATTERN.test(value)
}

export function parseWardrobeRecord(value: unknown): WardrobeRecordParseResult {
  if (!isPlainRecord(value)) return { ok: false, issues: ['record must be an object'] }
  const issues: string[] = []
  const unexpectedFields = Object.keys(value).filter((field) => !allowedRecordFields.has(field))
  if (unexpectedFields.length) issues.push(`record contains unsupported fields: ${unexpectedFields.join(', ')}`)
  if (!isWardrobeId(value.id)) issues.push('id is invalid')
  if (!isGarmentType(value.garmentType)) issues.push('garmentType is invalid')
  if (!isWardrobeFormality(value.formality)) issues.push('formality is invalid')
  if (!isPlainRecord(value.color)) issues.push('color must be an object')

  let normalizedHex: string | null = null
  let canonicalColorId: string | undefined
  const repairs: WardrobeRecordRepair[] = []
  if (isPlainRecord(value.color)) {
    const unexpectedColorFields = Object.keys(value.color).filter((field) => !allowedColorFields.has(field))
    if (unexpectedColorFields.length) issues.push(`color contains unsupported fields: ${unexpectedColorFields.join(', ')}`)
    if (typeof value.color.hex !== 'string' || !(normalizedHex = normalizeHex(value.color.hex))) issues.push('color.hex is invalid')
    else if (normalizedHex !== value.color.hex) repairs.push('normalized-hex')

    if (value.color.canonicalColorId !== undefined) {
      if (typeof value.color.canonicalColorId !== 'string') issues.push('color.canonicalColorId is invalid')
      else {
        const canonical = getCanonicalWardrobeColor(value.color.canonicalColorId)
        if (canonical && normalizedHex === normalizeHex(canonical.hex)) canonicalColorId = canonical.id
        else repairs.push('dropped-stale-canonical-color')
      }
    }
  }

  let customName: string | undefined
  if (value.customName !== undefined) {
    if (typeof value.customName !== 'string') issues.push('customName is invalid')
    else {
      const trimmed = value.customName.trim()
      if (trimmed.length > WARDROBE_CUSTOM_NAME_MAX_LENGTH) issues.push(`customName must be at most ${WARDROBE_CUSTOM_NAME_MAX_LENGTH} characters`)
      else if (trimmed.length === 0) repairs.push('removed-empty-custom-name')
      else {
        customName = trimmed
        if (trimmed !== value.customName) repairs.push('trimmed-custom-name')
      }
    }
  }

  if (issues.length || !isWardrobeId(value.id) || !isGarmentType(value.garmentType) || !isWardrobeFormality(value.formality) || !normalizedHex) {
    return { ok: false, issues }
  }
  return {
    ok: true,
    value: {
      id: value.id,
      garmentType: value.garmentType,
      color: { hex: normalizedHex, ...(canonicalColorId ? { canonicalColorId } : {}) },
      formality: value.formality,
      ...(customName ? { customName } : {}),
    },
    repairs,
  }
}

export function createWardrobeId(): string {
  if (typeof crypto.randomUUID === 'function') return `wardrobe-${crypto.randomUUID()}`
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `wardrobe-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function getRecordWardrobeSlot(record: WardrobeRecordV1): WardrobeSlot {
  return getWardrobeSlot(record.garmentType)
}

export function getWardrobeColorDescription(record: WardrobeRecordV1) {
  return describeColor(record.color.hex)!
}

export function getDefaultWardrobeDisplayName(record: WardrobeRecordV1, language: 'en' | 'th'): string {
  const color = getWardrobeColorDescription(record)
  const garment = getGarmentDefinition(record.garmentType).label[language]
  return language === 'th' ? `${garment}สี${color.th}` : `${color.en} ${garment}`
}

export function getWardrobeDisplayName(record: WardrobeRecordV1, language: 'en' | 'th'): string {
  return record.customName ?? getDefaultWardrobeDisplayName(record, language)
}

export function getWardrobeCompatibility(record: WardrobeRecordV1, subtype: Subtype): ColorMatchResult {
  return checkColor(record.color.hex, subtype)!
}
