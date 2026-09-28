import { getPalette } from '../personalColor/palettes.js'
import type { Subtype } from '../personalColor/types.js'
import { BASIC_WARDROBE_COLORS } from '../wardrobe/colors.js'
import { GARMENT_TYPES } from '../wardrobe/taxonomy.js'
import type { LuckyGoal } from '../luckyColor/types.js'
import type { TodayOccasion } from './todayInputs.js'
import { resolveOwnedLuckyPreferences } from './request.js'
import { INSPIRATION_OUTFIT_REQUEST_VERSION, validateInspirationOutfitRequest } from './inspirationContract.js'
import type { InspirationOutfitRequest } from './inspirationContract.js'

export interface BuildInspirationOutfitRequestInput {
  readonly date: Date
  readonly goals: readonly LuckyGoal[]
  readonly subtype?: Subtype
  readonly occasion: TodayOccasion
}

export function canonicalInspirationColorIds(subtype: Subtype): readonly string[] {
  const palette = getPalette(subtype)
  return [...palette.best, ...palette.neutrals, ...palette.accents].map((color) => color.id)
}

export function buildInspirationOutfitRequest(input: BuildInspirationOutfitRequestInput): InspirationOutfitRequest {
  const request: InspirationOutfitRequest = {
    version: INSPIRATION_OUTFIT_REQUEST_VERSION,
    subtype: input.subtype ?? null,
    occasion: input.occasion,
    allowedGarmentTypes: GARMENT_TYPES,
    canonicalColorIds: input.subtype ? canonicalInspirationColorIds(input.subtype) : [],
    genericColorIds: BASIC_WARDROBE_COLORS.map((color) => color.id),
    luckyPreferences: resolveOwnedLuckyPreferences(input.date, input.goals, input.subtype),
  }
  const validated = validateInspirationOutfitRequest(request)
  if (!validated.ok || !validated.value) throw new RangeError(`Invalid inspiration outfit request: ${validated.issues.join('; ')}`)
  return validated.value
}

export function fingerprintInspirationOutfitRequest(request: InspirationOutfitRequest): string {
  return JSON.stringify(request)
}
