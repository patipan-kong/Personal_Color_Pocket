import { describeColor } from '../colorNames/colorNames'
import type { ColorFamily, ColorName } from '../colorNames/colorNames'
import { getPalette } from '../personalColor/palettes'
import { subtypeOrder } from '../personalColor/seasons'
import type { PaletteColor, Subtype } from '../personalColor/types'
import { LUCKY_COLOR_FAMILIES } from './types'
import type { LuckyColorFamily } from './types'

// V1.3 Slice 2 adapts a source-domain lucky family to an existing, curated Personal Color
// swatch. It never changes the lucky family, palette data, V1.2 names, or colour coordinates.

export const LUCKY_COLOR_PALETTE_CATEGORIES = ['best', 'accents', 'neutrals', 'harder'] as const
export type LuckyColorPaletteCategory = typeof LUCKY_COLOR_PALETTE_CATEGORIES[number]

export const LUCKY_COLOR_SUITABILITIES = ['near-face', 'main-piece', 'below-face', 'accessory'] as const
export type LuckyColorSuitability = typeof LUCKY_COLOR_SUITABILITIES[number]

export interface LuckyColorCandidate {
  readonly id: string
  readonly hex: string
  readonly paletteName: string
  readonly paletteCategory: LuckyColorPaletteCategory
  readonly name: ColorName
  readonly luckyFamilies: readonly LuckyColorFamily[]
}

export interface LuckyColorAdaptation {
  readonly luckyFamily: LuckyColorFamily
  readonly subtype: Subtype
  readonly suitability: LuckyColorSuitability
  // Null means that the curated palette has no honest expression of the requested family.
  // Slice 3 should render the retained lucky family as a generic accessory concept, not invent HEX.
  readonly selectedColor: LuckyColorCandidate | null
  readonly alternatives: readonly LuckyColorCandidate[]
}

// This deliberately maps V1.2's structured classification, not palette display names or locale
// strings. Brown-family colours remain unassigned: treating brown, beige, or taupe as one of the
// Thai source families would silently substitute a family rather than adapt it.
const LUCKY_FAMILIES_BY_COLOR_FAMILY: Readonly<Record<ColorFamily, readonly LuckyColorFamily[]>> = Object.freeze({
  white: ['white'], 'off-white': ['white'], cream: ['white'],
  beige: [], taupe: [], brown: [],
  gray: ['gray'], 'blue-gray': ['gray'], charcoal: ['gray'], black: ['black'],
  red: ['red'], burgundy: ['red'], coral: ['red', 'orange'], orange: ['orange'], peach: ['orange'],
  yellow: ['yellow'], mustard: ['yellow'], olive: ['green'], green: ['green'], mint: ['green'],
  teal: ['green', 'blue'], blue: ['blue'], navy: ['blue'], purple: ['purple'], lavender: ['purple'], pink: ['pink'],
})

const CATEGORY_SUITABILITY: Readonly<Record<LuckyColorPaletteCategory, LuckyColorSuitability>> = Object.freeze({
  best: 'near-face',
  accents: 'main-piece',
  neutrals: 'main-piece',
  harder: 'below-face',
})

function invalidInput(kind: string, value: unknown): never {
  throw new RangeError(`Unknown lucky-color ${kind}: ${String(value)}`)
}

function isLuckyFamily(value: unknown): value is LuckyColorFamily {
  return typeof value === 'string' && LUCKY_COLOR_FAMILIES.includes(value as LuckyColorFamily)
}

function isSubtype(value: unknown): value is Subtype {
  return typeof value === 'string' && subtypeOrder.includes(value as Subtype)
}

// An explicit answer for every V1.2 naming family. Coral and teal bridge adjacent source families;
// the remaining border terms have one primary reading to keep the lucky-family claim recognisable.
export function luckyFamiliesForColorName(name: Pick<ColorName, 'family'>): readonly LuckyColorFamily[] {
  return LUCKY_FAMILIES_BY_COLOR_FAMILY[name.family]
}

export function luckyFamiliesForHex(hex: string): readonly LuckyColorFamily[] {
  const name = describeColor(hex)
  if (!name) throw new RangeError(`Invalid color HEX: ${String(hex)}`)
  return luckyFamiliesForColorName(name)
}

function candidate(color: PaletteColor, paletteCategory: LuckyColorPaletteCategory): LuckyColorCandidate {
  const name = describeColor(color.hex)
  if (!name) throw new RangeError(`Invalid curated palette HEX: ${color.hex}`)
  return Object.freeze({
    id: color.id,
    hex: color.hex,
    paletteName: color.name,
    paletteCategory,
    name,
    luckyFamilies: Object.freeze([...luckyFamiliesForColorName(name)]),
  })
}

function candidatesFor(subtype: Subtype, luckyFamily: LuckyColorFamily): LuckyColorCandidate[] {
  const palette = getPalette(subtype)
  const candidates: LuckyColorCandidate[] = []
  for (const paletteCategory of LUCKY_COLOR_PALETTE_CATEGORIES) {
    for (const color of palette[paletteCategory]) {
      const item = candidate(color, paletteCategory)
      if (item.luckyFamilies.includes(luckyFamily)) candidates.push(item)
    }
  }
  // Category priority is the adaptation ladder. Palette order is deliberately retained within a
  // category because palettes.ts is a curated ordered list; id gives a stable fallback if that ever changes.
  return candidates.sort((left, right) =>
    LUCKY_COLOR_PALETTE_CATEGORIES.indexOf(left.paletteCategory) - LUCKY_COLOR_PALETTE_CATEGORIES.indexOf(right.paletteCategory)
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  )
}

export function adaptLuckyColorToSubtype(family: LuckyColorFamily, subtype: Subtype): LuckyColorAdaptation {
  if (!isLuckyFamily(family)) invalidInput('family', family)
  if (!isSubtype(subtype)) invalidInput('subtype', subtype)

  const alternatives = candidatesFor(subtype, family)
  const selectedColor = alternatives[0] ?? null
  return Object.freeze({
    luckyFamily: family,
    subtype,
    suitability: selectedColor ? CATEGORY_SUITABILITY[selectedColor.paletteCategory] : 'accessory',
    selectedColor,
    alternatives: Object.freeze(alternatives),
  })
}
