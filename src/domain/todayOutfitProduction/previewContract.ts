import type { AiErrorKind } from '../ai/providerCatalog.js'
import { normalizeHex } from '../personalColor/colorUtils.js'
import { getWardrobeSlot, isGarmentType } from '../wardrobe/taxonomy.js'
import type { GarmentType, WardrobeSlot } from '../wardrobe/taxonomy.js'
import type { ContractValidation } from './contract.js'
import { isAllowedPreviewVisualDescription } from './previewVisualSemantics.js'
import type { PreviewVisualDescription } from './previewVisualSemantics.js'

export const OUTFIT_PREVIEW_VERSION = 1 as const
export const OUTFIT_PREVIEW_MODE = 'flat-lay' as const
export const PREVIEW_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type PreviewImageMimeType = typeof PREVIEW_IMAGE_MIME_TYPES[number]
export const OUTFIT_PREVIEW_ERROR_KINDS: readonly AiErrorKind[] = [
  'not-configured', 'unsupported', 'auth', 'rate-limited', 'bad-request', 'provider-error',
  'timeout', 'malformed-response', 'network', 'internal',
]

export interface PreviewPiece {
  readonly garmentType: GarmentType
  readonly color: { readonly hex: string }
  /** App-owned rendering hint only; semantic garmentType remains authoritative. */
  readonly visualDescription?: PreviewVisualDescription
}

export type PreviewOutfit =
  | {
      readonly kind: 'separates'
      readonly top: PreviewPiece
      readonly bottom: PreviewPiece
      readonly outerwear: PreviewPiece | null
      readonly shoes: PreviewPiece
    }
  | {
      readonly kind: 'one-piece'
      readonly onePiece: PreviewPiece
      readonly outerwear: PreviewPiece | null
      readonly shoes: PreviewPiece
    }

export interface OutfitPreviewInput {
  readonly version: typeof OUTFIT_PREVIEW_VERSION
  readonly mode: typeof OUTFIT_PREVIEW_MODE
  readonly outfit: PreviewOutfit
}

export type OutfitPreviewApiResponse =
  | { readonly ok: true; readonly result: { readonly mimeType: PreviewImageMimeType; readonly imageDataUrl: string } }
  | { readonly ok: false; readonly error: { readonly kind: AiErrorKind; readonly message: string } }

const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactFields = (value: Record<string, unknown>, allowed: readonly string[], path: string, issues: string[]) => {
  const extra = Object.keys(value).filter((field) => !allowed.includes(field))
  if (extra.length) issues.push(`${path} contains unsupported fields: ${extra.join(', ')}`)
}

function validatePiece(value: unknown, slot: WardrobeSlot, path: string, issues: string[]): value is PreviewPiece {
  if (!plain(value)) { issues.push(`${path} must be an object`); return false }
  exactFields(value, ['garmentType', 'color', 'visualDescription'], path, issues)
  if (!isGarmentType(value.garmentType)) issues.push(`${path}.garmentType is invalid`)
  else {
    if (getWardrobeSlot(value.garmentType) !== slot) issues.push(`${path}.garmentType does not belong to ${slot}`)
    if (value.visualDescription !== undefined && !isAllowedPreviewVisualDescription(value.garmentType, value.visualDescription)) issues.push(`${path}.visualDescription is invalid for garmentType`)
  }
  if (!plain(value.color)) issues.push(`${path}.color must be an object`)
  else {
    exactFields(value.color, ['hex'], `${path}.color`, issues)
    if (typeof value.color.hex !== 'string' || normalizeHex(value.color.hex) !== value.color.hex) issues.push(`${path}.color.hex must be normalized`)
  }
  return true
}

export function validateOutfitPreviewInput(value: unknown): ContractValidation<OutfitPreviewInput> {
  const issues: string[] = []
  if (!plain(value)) return { ok: false, value: null, issues: ['request must be an object'] }
  exactFields(value, ['version', 'mode', 'outfit'], 'request', issues)
  if (value.version !== OUTFIT_PREVIEW_VERSION) issues.push('version is invalid')
  if (value.mode !== OUTFIT_PREVIEW_MODE) issues.push('mode must be flat-lay')
  if (!plain(value.outfit)) issues.push('outfit must be an object')
  else if (value.outfit.kind === 'separates') {
    exactFields(value.outfit, ['kind', 'top', 'bottom', 'outerwear', 'shoes'], 'outfit', issues)
    validatePiece(value.outfit.top, 'top', 'outfit.top', issues)
    validatePiece(value.outfit.bottom, 'bottom', 'outfit.bottom', issues)
    if (value.outfit.outerwear !== null) validatePiece(value.outfit.outerwear, 'outerwear', 'outfit.outerwear', issues)
    validatePiece(value.outfit.shoes, 'shoes', 'outfit.shoes', issues)
  } else if (value.outfit.kind === 'one-piece') {
    exactFields(value.outfit, ['kind', 'onePiece', 'outerwear', 'shoes'], 'outfit', issues)
    validatePiece(value.outfit.onePiece, 'one-piece', 'outfit.onePiece', issues)
    if (value.outfit.outerwear !== null) validatePiece(value.outfit.outerwear, 'outerwear', 'outfit.outerwear', issues)
    validatePiece(value.outfit.shoes, 'shoes', 'outfit.shoes', issues)
  } else issues.push('outfit.kind must be separates or one-piece')
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: value as unknown as OutfitPreviewInput, issues: [] }
}

export function isPreviewImageMimeType(value: unknown): value is PreviewImageMimeType {
  return typeof value === 'string' && (PREVIEW_IMAGE_MIME_TYPES as readonly string[]).includes(value)
}
