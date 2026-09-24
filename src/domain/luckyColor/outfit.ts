import { adaptLuckyColorToSubtype } from './adaptation'
import type { LuckyColorAdaptation, LuckyColorCandidate, LuckyColorPaletteCategory, LuckyColorSuitability } from './adaptation'
import { describeColor } from '../colorNames/colorNames'
import { getPalette } from '../personalColor/palettes'
import type { PaletteColor, Subtype } from '../personalColor/types'
import { LUCKY_COLOR_FAMILIES } from './types'
import type { LuckyColorFamily, LuckyColorRule } from './types'

// V1.3 Slice 3 composes an outfit from the already-resolved lucky family and (when supplied)
// Slice 2's adaptation. It has no date, locale, presentation, persistence, or colour-science input.

export const LUCKY_OUTFIT_ROLES = ['top', 'bottom', 'shoes', 'accessory'] as const
export type LuckyOutfitRole = typeof LUCKY_OUTFIT_ROLES[number]

export const LUCKY_OUTFIT_COLOR_ROLES = ['lucky', 'supporting-neutral', 'supporting-personal-color'] as const
export type LuckyOutfitColorRole = typeof LUCKY_OUTFIT_COLOR_ROLES[number]

export const LUCKY_OUTFIT_STRATEGIES = ['lucky-top', 'lucky-main', 'lucky-bottom', 'lucky-accessory'] as const
export type LuckyOutfitStrategy = typeof LUCKY_OUTFIT_STRATEGIES[number]

export const LUCKY_OUTFIT_PLACEMENTS = ['top', 'main-piece', 'below-face', 'accessory'] as const
export type LuckyOutfitPlacement = typeof LUCKY_OUTFIT_PLACEMENTS[number]

export type LuckyOutfitColor =
  | { readonly kind: 'palette'; readonly id: string; readonly hex: string; readonly paletteName: string; readonly paletteCategory: LuckyColorPaletteCategory; readonly name: LuckyColorCandidate['name'] }
  | { readonly kind: 'semantic'; readonly token: 'lucky-family' | 'light-neutral' | 'neutral'; readonly luckyFamily?: LuckyColorFamily }

export interface LuckyOutfitPiece {
  readonly role: LuckyOutfitRole
  readonly colorRole: LuckyOutfitColorRole
  readonly color: LuckyOutfitColor
}

export interface LuckyOutfitRecommendation {
  readonly mode: 'personalized' | 'general'
  readonly luckyFamily: LuckyColorFamily
  readonly strategy: LuckyOutfitStrategy
  readonly luckyPlacement: LuckyOutfitPlacement
  readonly luckyRule: LuckyColorRule | null
  readonly adaptation: LuckyColorAdaptation | null
  readonly pieces: readonly LuckyOutfitPiece[]
}

function invalidInput(kind: string, value: unknown): never {
  throw new RangeError(`Unknown lucky-color outfit ${kind}: ${String(value)}`)
}

function isLuckyFamily(value: unknown): value is LuckyColorFamily {
  return typeof value === 'string' && LUCKY_COLOR_FAMILIES.includes(value as LuckyColorFamily)
}

function placementForSuitability(suitability: LuckyColorSuitability): LuckyOutfitPlacement {
  return suitability === 'near-face' ? 'top' : suitability
}

function paletteColor(color: PaletteColor | null, category: LuckyColorPaletteCategory, adaptation?: LuckyColorCandidate): LuckyOutfitColor {
  if (adaptation) return Object.freeze({
    kind: 'palette', id: adaptation.id, hex: adaptation.hex, paletteName: adaptation.paletteName,
    paletteCategory: adaptation.paletteCategory, name: adaptation.name,
  })
  if (!color) throw new RangeError('Missing curated palette color')
  const name = describeColor(color.hex)
  if (!name) throw new RangeError(`Invalid curated palette HEX: ${color.hex}`)
  return Object.freeze({ kind: 'palette', id: color.id, hex: color.hex, paletteName: color.name, paletteCategory: category, name })
}

function semanticColor(token: 'lucky-family' | 'light-neutral' | 'neutral', luckyFamily?: LuckyColorFamily): LuckyOutfitColor {
  return Object.freeze(token === 'lucky-family' ? { kind: 'semantic', token, luckyFamily } : { kind: 'semantic', token })
}

function selectSupports(subtype: Subtype, excludedHex: string | null) {
  const palette = getPalette(subtype)
  const usable = (colors: PaletteColor[]) => colors.filter((color) => color.hex !== excludedHex)
  const best = usable(palette.best)[0]
  const bottomNeutral = usable(palette.neutrals)[1] ?? usable(palette.neutrals)[0]
  const shoeNeutral = usable(palette.neutrals).find((color) => color.id !== bottomNeutral?.id) ?? bottomNeutral
  if (!best || !bottomNeutral || !shoeNeutral) throw new RangeError(`Incomplete curated palette for ${subtype}`)
  return { best, bottomNeutral, shoeNeutral }
}

function personalizedPiece(role: LuckyOutfitRole, colorRole: LuckyOutfitColorRole, color: PaletteColor | null, category: LuckyColorPaletteCategory, adaptation?: LuckyColorCandidate): LuckyOutfitPiece {
  return Object.freeze({ role, colorRole, color: paletteColor(color, category, adaptation) })
}

function personalizedRecommendation(family: LuckyColorFamily, subtype: Subtype): LuckyOutfitRecommendation {
  const adaptation = adaptLuckyColorToSubtype(family, subtype)
  const selected = adaptation.selectedColor
  const supports = selectSupports(subtype, selected?.hex ?? null)
  let strategy: LuckyOutfitStrategy
  let pieces: LuckyOutfitPiece[]

  if (adaptation.suitability === 'near-face') {
    if (!selected) throw new RangeError('Near-face lucky adaptation requires a selected color')
    strategy = 'lucky-top'
    pieces = [
      personalizedPiece('top', 'lucky', null, selected.paletteCategory, selected),
      personalizedPiece('bottom', 'supporting-neutral', supports.bottomNeutral, 'neutrals'),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
    ]
  } else if (adaptation.suitability === 'main-piece') {
    if (!selected) throw new RangeError('Main-piece lucky adaptation requires a selected color')
    strategy = 'lucky-main'
    pieces = [
      personalizedPiece('top', 'supporting-personal-color', supports.best, 'best'),
      personalizedPiece('bottom', 'lucky', null, selected.paletteCategory, selected),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
    ]
  } else if (adaptation.suitability === 'below-face') {
    if (!selected) throw new RangeError('Below-face lucky adaptation requires a selected color')
    strategy = 'lucky-bottom'
    pieces = [
      personalizedPiece('top', 'supporting-personal-color', supports.best, 'best'),
      personalizedPiece('bottom', 'lucky', null, selected.paletteCategory, selected),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
    ]
  } else {
    strategy = 'lucky-accessory'
    pieces = [
      personalizedPiece('top', 'supporting-personal-color', supports.best, 'best'),
      personalizedPiece('bottom', 'supporting-neutral', supports.bottomNeutral, 'neutrals'),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
      Object.freeze({ role: 'accessory', colorRole: 'lucky', color: semanticColor('lucky-family', family) }),
    ]
  }

  return Object.freeze({
    mode: 'personalized', luckyFamily: family, strategy, luckyPlacement: placementForSuitability(adaptation.suitability),
    luckyRule: null, adaptation, pieces: Object.freeze(pieces),
  })
}

// Lower-level entry point for composition after a family is already resolved. It is also the honest
// general-mode API: it returns semantic broad colours, never a fabricated exact shade.
export function recommendLuckyFamilyOutfit(family: LuckyColorFamily, subtype?: Subtype): LuckyOutfitRecommendation {
  if (!isLuckyFamily(family)) invalidInput('family', family)
  if (subtype !== undefined) return personalizedRecommendation(family, subtype)
  return Object.freeze({
    mode: 'general', luckyFamily: family, strategy: 'lucky-top', luckyPlacement: 'top', luckyRule: null, adaptation: null,
    pieces: Object.freeze([
      Object.freeze({ role: 'top', colorRole: 'lucky', color: semanticColor('lucky-family', family) }),
      Object.freeze({ role: 'bottom', colorRole: 'supporting-neutral', color: semanticColor('light-neutral') }),
      Object.freeze({ role: 'shoes', colorRole: 'supporting-neutral', color: semanticColor('neutral') }),
    ]),
  })
}

// Slice 4 should use this entry point after resolving an actual positive Slice 1 rule. It preserves
// the canonical rule object for provenance without asking the outfit engine to reinterpret it.
export function recommendLuckyRuleOutfit(rule: LuckyColorRule, subtype?: Subtype): LuckyOutfitRecommendation {
  if (!rule || rule.goal === null || rule.traditionalCategory === 'kalakini' || rule.colorFamilies.length !== 1) invalidInput('positive rule', rule)
  const family = rule.colorFamilies[0]
  if (!isLuckyFamily(family)) invalidInput('rule family', family)
  const recommendation = recommendLuckyFamilyOutfit(family, subtype)
  return Object.freeze({ ...recommendation, luckyRule: rule })
}
