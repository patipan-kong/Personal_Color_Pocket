import { describe, expect, it } from 'vitest'
import { checkColor, pairingSuggestions } from './colorMatch'
import { palettes } from './palettes'
import { subtypeOrder } from './seasons'
import type { ColorMatchResult } from './types'

// Freezes the manual Color Checker's externally observable output (V1.2 Slice 2).
// The photo matcher is a separate model; if anything shared (colorUtils, palettes,
// pairingSuggestions) changes a manual result, these fingerprints fail.
// Do NOT update the expected values to make a change pass — a change here is a V1.1 regression.

function fnv1a(text: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function describeResult(input: string, result: ColorMatchResult | null) {
  if (!result) return `${input}|null`
  return [
    input,
    result.normalizedHex,
    result.rating,
    result.score.toFixed(9),
    result.closestColors.map((color) => color.id).join(','),
    `${result.reason.type}:${result.reason.referenceColor?.id ?? '-'}`,
    result.pairWith.map((color) => color.id).join(','),
  ].join('|')
}

// Every curated HEX (all groups incl. harder and metals, all subtypes) plus a 6×6×6 sRGB grid.
const paletteInputs = [...new Set(subtypeOrder.flatMap((subtype) => {
  const palette = palettes[subtype]
  return [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder, ...palette.metals].map((color) => color.hex)
}))]
const steps = [0, 51, 102, 153, 204, 255]
const gridInputs = steps.flatMap((r) => steps.flatMap((g) => steps.map((b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)))
const inputs = [...paletteInputs, ...gridInputs]

const expectedFingerprints: Record<string, { hash: string; ratings: [great: number, good: number, wearable: number, tricky: number] }> = {
  'light-spring': { hash: '5426ef2d', ratings: [15, 25, 114, 344] },
  'warm-spring': { hash: '12bf90be', ratings: [10, 33, 107, 348] },
  'clear-spring': { hash: 'a54f5091', ratings: [14, 29, 143, 312] },
  'light-summer': { hash: '684ab514', ratings: [15, 34, 92, 357] },
  'cool-summer': { hash: 'c7d43418', ratings: [11, 22, 118, 347] },
  'soft-summer': { hash: 'a389fb6b', ratings: [15, 31, 106, 346] },
  'soft-autumn': { hash: '16ff1d0c', ratings: [15, 34, 133, 316] },
  'warm-autumn': { hash: 'bb663600', ratings: [15, 43, 103, 337] },
  'deep-autumn': { hash: '33816dd6', ratings: [22, 33, 87, 356] },
  'deep-winter': { hash: '7308b29f', ratings: [22, 32, 87, 357] },
  'cool-winter': { hash: 'a5704e8d', ratings: [16, 40, 94, 348] },
  'clear-winter': { hash: 'b3140c23', ratings: [18, 34, 111, 335] },
}

describe('manual color checker regression freeze', () => {
  it('uses a fixed input set', () => {
    expect(paletteInputs).toHaveLength(282)
    expect(inputs).toHaveLength(282 + 216)
  })

  it.each(subtypeOrder)('%s: every checkColor output is unchanged (rating, score, closest, reason, pairings)', (subtype) => {
    const results = inputs.map((input) => checkColor(input, subtype))
    const ratings = (['Great Match', 'Good Match', 'Wearable', 'Tricky'] as const).map((rating) => results.filter((result) => result?.rating === rating).length)
    expect({ hash: fnv1a(results.map((result, index) => describeResult(inputs[index], result)).join('\n')), ratings }).toEqual(expectedFingerprints[subtype])
  })

  it('keeps readable reference results', () => {
    const coral = checkColor('#e9785d', 'warm-spring')!
    expect(coral.normalizedHex).toBe('#E9785D')
    expect(coral.rating).toBe('Great Match')
    expect(coral.score).toBeCloseTo(.92, 9)
    expect(coral.closestColors.map((color) => color.id)).toEqual(['warm-spring-best-1', 'warm-spring-best-8'])
    expect(coral.reason).toEqual({ type: 'Great Match', referenceColor: palettes['warm-spring'].best[0] })
    expect(coral.pairWith.map((color) => color.id)).toEqual(['warm-spring-neutral-4', 'warm-spring-best-4', 'warm-spring-accent-3'])

    const grey = checkColor('#808080', 'warm-spring')!
    expect(grey.rating).toBe('Tricky')
    expect(grey.score).toBeCloseTo(.2779941300590154, 9)
    expect(grey.reason.referenceColor?.id ?? null).toBe('warm-spring-harder-3')
    expect(grey.pairWith.map((color) => color.id)).toEqual(['warm-spring-neutral-2', 'warm-spring-best-2', 'warm-spring-accent-2'])

    expect(checkColor('not a color', 'warm-spring')).toBeNull()
    expect(checkColor('#12', 'cool-winter')).toBeNull()
  })

  it.each(subtypeOrder)('%s: the exported pairingSuggestions is exactly what checkColor returns as pairWith', (subtype) => {
    inputs.forEach((input) => expect(pairingSuggestions(checkColor(input, subtype)!.normalizedHex, subtype)).toEqual(checkColor(input, subtype)!.pairWith))
  })

  it('keeps the curated palette data byte-identical', () => {
    expect(fnv1a(JSON.stringify(subtypeOrder.map((subtype) => [subtype, palettes[subtype]])))).toBe('f68e7bfe')
  })
})
