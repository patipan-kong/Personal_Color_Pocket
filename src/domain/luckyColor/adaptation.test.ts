import { describe, expect, it } from 'vitest'
import { describeColor, COLOR_FAMILIES } from '../colorNames/colorNames'
import { getPalette, palettes } from '../personalColor/palettes'
import { subtypeOrder } from '../personalColor/seasons'
import type { Subtype } from '../personalColor/types'
import { adaptLuckyColorToSubtype, luckyFamiliesForColorName, luckyFamiliesForHex } from './adaptation'
import { LUCKY_COLOR_FAMILIES } from './types'
import adaptationSource from './adaptation.ts?raw'

const CATEGORIES = ['best', 'accents', 'neutrals', 'harder'] as const

function paletteEntries(subtype: Subtype) {
  const palette = getPalette(subtype)
  return CATEGORIES.flatMap((category) => palette[category].map((color) => ({ ...color, category })))
}

describe('V1.3 Personal Color lucky-family adaptation', () => {
  it('gives every V1.2 naming family an explicit deterministic lucky-family answer', () => {
    for (const family of COLOR_FAMILIES) {
      const first = luckyFamiliesForColorName({ family })
      expect(first).toEqual(luckyFamiliesForColorName({ family }))
      first.forEach((luckyFamily) => expect(LUCKY_COLOR_FAMILIES).toContain(luckyFamily))
    }
  })

  it('applies the documented boundary-family decisions from structured V1.2 families', () => {
    expect(luckyFamiliesForColorName({ family: 'coral' })).toEqual(['red', 'orange'])
    expect(luckyFamiliesForColorName({ family: 'peach' })).toEqual(['orange'])
    expect(luckyFamiliesForColorName({ family: 'teal' })).toEqual(['green', 'blue'])
    expect(luckyFamiliesForColorName({ family: 'mint' })).toEqual(['green'])
    expect(luckyFamiliesForColorName({ family: 'navy' })).toEqual(['blue'])
    expect(luckyFamiliesForColorName({ family: 'lavender' })).toEqual(['purple'])
    expect(luckyFamiliesForColorName({ family: 'burgundy' })).toEqual(['red'])
    expect(luckyFamiliesForColorName({ family: 'mustard' })).toEqual(['yellow'])
    expect(luckyFamiliesForColorName({ family: 'olive' })).toEqual(['green'])
    expect(luckyFamiliesForColorName({ family: 'blue-gray' })).toEqual(['gray'])
    expect(luckyFamiliesForColorName({ family: 'cream' })).toEqual(['white'])
    expect(luckyFamiliesForColorName({ family: 'off-white' })).toEqual(['white'])
  })

  it('classifies every actual curated palette swatch without locale-string parsing', () => {
    for (const subtype of subtypeOrder) {
      for (const { hex } of paletteEntries(subtype)) {
        const name = describeColor(hex)!
        expect(luckyFamiliesForHex(hex)).toEqual(luckyFamiliesForColorName(name))
      }
    }
    expect(adaptationSource).not.toMatch(/\.includes\s*\(\s*['\"][^'\"]*(Green|Blue|Olive|Teal|Mint|Navy|Burgundy|Coral)/i)
  })

  it('handles every one of the 120 valid subtype-family combinations without substituting the family', () => {
    for (const subtype of subtypeOrder) {
      for (const family of LUCKY_COLOR_FAMILIES) {
        const first = adaptLuckyColorToSubtype(family, subtype)
        expect(first).toEqual(adaptLuckyColorToSubtype(family, subtype))
        expect(first.luckyFamily).toBe(family)
        expect(first.subtype).toBe(subtype)
        expect(['near-face', 'main-piece', 'below-face', 'accessory']).toContain(first.suitability)
        if (!first.selectedColor) {
          expect(first.suitability).toBe('accessory')
          expect(first.alternatives).toEqual([])
          continue
        }
        const paletteColor = paletteEntries(subtype).find((color) => color.id === first.selectedColor!.id)
        expect(paletteColor).toMatchObject({ hex: first.selectedColor.hex, name: first.selectedColor.paletteName, category: first.selectedColor.paletteCategory })
        expect(first.selectedColor.name).toEqual(describeColor(first.selectedColor.hex))
        expect(first.selectedColor.luckyFamilies).toContain(family)
        expect(first.alternatives[0]).toEqual(first.selectedColor)
      }
    }
  })

  it('preserves the category ladder and never promotes a Harder-only candidate near the face', () => {
    for (const subtype of subtypeOrder) for (const family of LUCKY_COLOR_FAMILIES) {
      const adaptation = adaptLuckyColorToSubtype(family, subtype)
      const categories = adaptation.alternatives.map((candidate) => candidate.paletteCategory)
      expect(categories).toEqual([...categories].sort((left, right) => CATEGORIES.indexOf(left) - CATEGORIES.indexOf(right)))
      if (adaptation.selectedColor?.paletteCategory === 'harder') expect(adaptation.suitability).toBe('below-face')
      if (adaptation.selectedColor?.paletteCategory === 'best') expect(adaptation.suitability).toBe('near-face')
      if (adaptation.selectedColor?.paletteCategory === 'accents' || adaptation.selectedColor?.paletteCategory === 'neutrals') expect(adaptation.suitability).toBe('main-piece')
    }
  })

  it('rejects invalid runtime inputs instead of selecting a default family or subtype', () => {
    expect(() => adaptLuckyColorToSubtype('brown' as never, 'warm-spring')).toThrow(RangeError)
    expect(() => adaptLuckyColorToSubtype('green', 'unknown' as never)).toThrow(RangeError)
    expect(() => luckyFamiliesForHex('not-a-hex')).toThrow(RangeError)
  })

  it('has no date, goal, locale, presentation, randomness, browser, or network dependency', () => {
    const code = adaptationSource.replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bDate\b|\bweekday\b|\bgoal\b|\blocale\b|\bIntl\b|Math\.random|\bwindow\b|\bdocument\b|localStorage|sessionStorage|\bfetch\b|XMLHttpRequest|\bnavigator\b|photoColor|placement|pairing|styleGuide|oklab/i)
  })

  it('has the documented complete 120-combination coverage audit', () => {
    const coverage = { best: 0, accents: 0, neutrals: 0, harder: 0, none: 0, multiple: 0, harderOnly: 0, accessoryFallback: 0 }
    const anyCategoryCoverage = { best: 0, accents: 0, neutrals: 0, harder: 0 }
    const availableByFamily = Object.fromEntries(LUCKY_COLOR_FAMILIES.map((family) => [family, 0])) as Record<string, number>
    const rows = subtypeOrder.map((subtype) => {
      const cells = LUCKY_COLOR_FAMILIES.map((family) => {
        const adaptation = adaptLuckyColorToSubtype(family, subtype)
        for (const category of CATEGORIES) if (adaptation.alternatives.some((candidate) => candidate.paletteCategory === category)) anyCategoryCoverage[category] += 1
        if (adaptation.alternatives.length > 1) coverage.multiple += 1
        if (!adaptation.selectedColor) {
          coverage.none += 1
          coverage.accessoryFallback += 1
        } else {
          coverage[adaptation.selectedColor.paletteCategory] += 1
          availableByFamily[family] += 1
          if (adaptation.alternatives.every((candidate) => candidate.paletteCategory === 'harder')) coverage.harderOnly += 1
        }
        return adaptation.selectedColor?.paletteCategory === 'accents' ? 'A' : adaptation.selectedColor?.paletteCategory === 'neutrals' ? 'N' : adaptation.selectedColor?.paletteCategory === 'harder' ? 'H' : adaptation.selectedColor ? 'B' : '-'
      })
      return cells.join('')
    })
    expect(rows).toEqual([
      'N B B B B B H B N H', 'N B H B B B - B H -', 'N B H B B B B B H -', 'N B B - B B B H N H',
      'N - B H B B B H N -', 'H - B H B B B H B H', 'H A B - B B - - N -', 'N B H B B B H B N -',
      'N B H B B B H A N -', 'N H B B B B B H N N', 'N - B B B B B H N N', 'N B B B B B B H N N',
    ].map((row) => row.replaceAll(' ', '')))
    expect(coverage).toEqual({ best: 59, accents: 2, neutrals: 22, harder: 23, none: 14, multiple: 67, harderOnly: 23, accessoryFallback: 14 })
    expect(anyCategoryCoverage).toEqual({ best: 59, accents: 51, neutrals: 30, harder: 38 })
    expect(availableByFamily).toEqual({ white: 12, yellow: 9, pink: 12, red: 10, green: 12, blue: 12, purple: 10, orange: 11, gray: 12, black: 6 })
  })
})
