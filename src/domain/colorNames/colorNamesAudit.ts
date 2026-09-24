import { palettes } from '../personalColor/palettes'
import { hexToOklab, hexToRgb, oklabChroma, rgbToHex } from '../personalColor/colorUtils'
import type { Subtype } from '../personalColor/types'
import { describeColor } from './colorNames'
import type { ColorGroup, ColorName } from './colorNames'

// V1.2 Slice 7, development only: the evidence behind the colour-name taxonomy. Imported by tests
// (and the Slice 7 record), never by the app, so it is not part of the production bundle.

export const PALETTE_CATEGORIES = ['best', 'neutrals', 'accents', 'harder'] as const
export type PaletteCategory = typeof PALETTE_CATEGORIES[number]

export interface PaletteNameRow {
  hex: string
  paletteName: string
  // Every subtype / category the HEX appears in.
  where: { subtype: Subtype; category: PaletteCategory }[]
  name: ColorName
}

// Every unique palette HEX across all 12 subtypes and all four colour categories (metals excluded).
export function paletteNameRows(): PaletteNameRow[] {
  const rows = new Map<string, PaletteNameRow>()
  for (const [subtype, palette] of Object.entries(palettes) as [Subtype, (typeof palettes)[Subtype]][]) {
    for (const category of PALETTE_CATEGORIES) {
      for (const color of palette[category]) {
        const row = rows.get(color.hex) ?? { hex: color.hex, paletteName: color.name, where: [], name: describeColor(color.hex)! }
        row.where.push({ subtype, category })
        rows.set(color.hex, row)
      }
    }
  }
  return [...rows.values()]
}

// A deterministic RGB lattice (every `step` levels per channel, always including 0 and 255), plus
// the full neutral axis and near-neutral greys: small offsets around every 8th grey level.
export function syntheticCorpus(step = 15): string[] {
  const levels: number[] = []
  for (let value = 0; value < 255; value += step) levels.push(value)
  levels.push(255)
  const hexes = new Set<string>()
  for (const r of levels) for (const g of levels) for (const b of levels) hexes.add(rgbToHex({ r, g, b }))
  for (let v = 0; v <= 255; v += 1) hexes.add(rgbToHex({ r: v, g: v, b: v }))
  for (let v = 8; v <= 248; v += 8) {
    for (const [dr, dg, db] of [[3, 0, 0], [0, 3, 0], [0, 0, 3], [-3, 0, 3], [3, 0, -3], [2, 2, -4], [-4, 2, 2], [4, 4, 0], [0, 4, 4], [4, 0, 4]]) {
      hexes.add(rgbToHex({ r: v + dr, g: v + dg, b: v + db }))
    }
  }
  return [...hexes]
}

// All RGB neighbours at ±delta on any combination of channels (up to 26), clamped to 0–255.
export function rgbNeighbours(hex: string, delta: number): string[] {
  const rgb = hexToRgb(hex)!
  const out = new Set<string>()
  for (const dr of [-delta, 0, delta]) for (const dg of [-delta, 0, delta]) for (const db of [-delta, 0, delta]) {
    if (!dr && !dg && !db) continue
    out.add(rgbToHex({ r: rgb.r + dr, g: rgb.g + dg, b: rgb.b + db }))
  }
  out.delete(hex)
  return [...out]
}

// Groups that border each other in the taxonomy. Chromatic groups follow the hue circle, and
// brown borders the warm hues it is a darker, muted form of. The neutral groups (white, grey,
// black) border every group through the chroma gate, which is judged separately (see below).
const HUE_NEIGHBOURS: Record<Exclude<ColorGroup, 'white' | 'gray' | 'black'>, ColorGroup[]> = {
  // Dark: burgundy borders deep purple directly (wine / plum), where pink does not exist.
  red: ['pink', 'orange', 'brown', 'purple'],
  orange: ['red', 'yellow', 'brown', 'pink'],
  yellow: ['orange', 'green', 'brown'],
  green: ['yellow', 'teal', 'brown'],
  teal: ['green', 'blue'],
  blue: ['teal', 'purple'],
  purple: ['blue', 'pink', 'red', 'brown'],
  pink: ['purple', 'red', 'orange', 'brown'],
  // Dark and muted: aubergine brown sits where brown, burgundy and deep purple meet.
  brown: ['red', 'orange', 'yellow', 'green', 'pink', 'purple'],
}
const NEUTRAL_GROUPS = new Set<ColorGroup>(['white', 'gray', 'black'])
// The audit's own definition of a colour with no visible cast. Deliberately NOT the engine's gate,
// so the audit does not move when the engine's thresholds do.
export const TRUE_NEUTRAL_CHROMA = 0.010

// An unreasonable jump: two unrelated hue groups (e.g. green → pink), or a TRUE neutral (chroma
// below the naming gate) that picks up a hue name. A neutral next to a tinted colour becoming
// "Light Pink" is a real boundary; a neutral grey becoming a hue from RGB noise is not.
export function isUnrelatedJump(from: ColorName, to: ColorName): boolean {
  if (from.group === to.group) return false
  const fromNeutral = NEUTRAL_GROUPS.has(from.group)
  const toNeutral = NEUTRAL_GROUPS.has(to.group)
  if (fromNeutral && toNeutral) return false
  if (fromNeutral || toNeutral) {
    const neutral = fromNeutral ? from : to
    return oklabChroma(hexToOklab(neutral.hex)!) < TRUE_NEUTRAL_CHROMA
  }
  return !HUE_NEIGHBOURS[from.group as keyof typeof HUE_NEIGHBOURS].includes(to.group)
}

export interface StabilityStats {
  delta: number
  colors: number
  pairs: number
  sameName: number
  sameFamily: number
  sameGroup: number
  sameValue: number
  sameTemperature: number
  sameChroma: number
  // warm ↔ cool on a grey (not warm/cool ↔ none).
  temperatureReversals: number
  unrelated: { from: ColorName; to: ColorName }[]
}

export function stability(hexes: string[], delta: number): StabilityStats {
  const stats: StabilityStats = { delta, colors: hexes.length, pairs: 0, sameName: 0, sameFamily: 0, sameGroup: 0, sameValue: 0, sameTemperature: 0, sameChroma: 0, temperatureReversals: 0, unrelated: [] }
  for (const hex of hexes) {
    const base = describeColor(hex)!
    for (const neighbour of rgbNeighbours(base.hex, delta)) {
      const next = describeColor(neighbour)!
      stats.pairs += 1
      if (next.en === base.en) stats.sameName += 1
      if (next.family === base.family) stats.sameFamily += 1
      if (next.group === base.group) stats.sameGroup += 1
      if (next.value === base.value) stats.sameValue += 1
      if (next.temperature === base.temperature) stats.sameTemperature += 1
      if (next.chroma === base.chroma) stats.sameChroma += 1
      if (base.temperature && next.temperature && base.temperature !== next.temperature) stats.temperatureReversals += 1
      if (isUnrelatedJump(base, next)) stats.unrelated.push({ from: base, to: next })
    }
  }
  return stats
}

export const percent = (part: number, whole: number) => `${(100 * part / whole).toFixed(1)}%`
