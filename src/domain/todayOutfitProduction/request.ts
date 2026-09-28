import { adaptLuckyColorToSubtype } from '../luckyColor/adaptation.js'
import { luckyFamiliesForHex } from '../luckyColor/adaptation.js'
import { getLuckyColorForDate } from '../luckyColor/luckyColor.js'
import { LUCKY_COLOR_FAMILIES } from '../luckyColor/types.js'
import type { LuckyColorFamily, LuckyGoal } from '../luckyColor/types.js'
import { getWardrobeCompatibility, getRecordWardrobeSlot } from '../wardrobe/wardrobe.js'
import type { WardrobeRecordV1 } from '../wardrobe/wardrobe.js'
import type { Subtype } from '../personalColor/types.js'
import type { TodayOccasion } from './todayInputs.js'
import { OWNED_OUTFIT_REQUEST_VERSION, validateOwnedOutfitRequest } from './contract.js'
import type { OwnedLuckyPreference, OwnedOutfitLanguage, OwnedOutfitRequest } from './contract.js'

export interface BuildOwnedOutfitRequestInput {
  readonly date: Date
  readonly goals: readonly LuckyGoal[]
  readonly language: OwnedOutfitLanguage
  readonly subtype?: Subtype
  readonly occasion: TodayOccasion
  readonly wardrobe: readonly WardrobeRecordV1[]
}

export function resolveOwnedLuckyPreferences(date: Date, goals: readonly LuckyGoal[], subtype?: Subtype): readonly OwnedLuckyPreference[] {
  if (goals.length === 0) return []
  const families = new Set<LuckyColorFamily>()
  for (const goal of goals) {
    const rule = getLuckyColorForDate(date, goal)
    for (const family of rule.colorFamilies) families.add(family)
  }
  return [...families]
    .sort((left, right) => LUCKY_COLOR_FAMILIES.indexOf(left) - LUCKY_COLOR_FAMILIES.indexOf(right))
    .map((family) => {
      const adaptation = subtype ? adaptLuckyColorToSubtype(family, subtype) : null
      return {
        family,
        hex: adaptation?.selectedColor?.hex ?? null,
        suitability: adaptation?.suitability ?? 'accessory',
        priority: 'soft' as const,
      }
    })
}

export function buildOwnedOutfitRequest(input: BuildOwnedOutfitRequestInput): OwnedOutfitRequest {
  const luckyPreferences = resolveOwnedLuckyPreferences(input.date, input.goals, input.subtype)
  const requestedFamilies = new Set(luckyPreferences.map((preference) => preference.family))
  const request: OwnedOutfitRequest = {
    version: OWNED_OUTFIT_REQUEST_VERSION,
    language: input.language,
    subtype: input.subtype ?? null,
    occasion: input.occasion,
    wardrobe: input.wardrobe.map((item) => {
      const compatibility = input.subtype ? getWardrobeCompatibility(item, input.subtype) : null
      return {
        id: item.id,
        slot: getRecordWardrobeSlot(item),
        garmentType: item.garmentType,
        hex: item.color.hex,
        formality: item.formality,
        personalColorCompatibility: compatibility ? { rating: compatibility.rating, score: Number(compatibility.score.toFixed(4)) } : null,
        luckyFamilyMatches: luckyFamiliesForHex(item.color.hex).filter((family) => requestedFamilies.has(family)),
      }
    }),
    luckyPreferences,
  }
  const validated = validateOwnedOutfitRequest(request)
  if (!validated.ok || !validated.value) throw new RangeError(`Invalid owned outfit request: ${validated.issues.join('; ')}`)
  return validated.value
}

export function fingerprintOwnedOutfitRequest(request: OwnedOutfitRequest): string {
  // Language changes only presentation now; every selection-affecting fact remains in the fingerprint.
  const { language: _presentationLanguage, ...selectionContext } = request
  return JSON.stringify(selectionContext)
}
