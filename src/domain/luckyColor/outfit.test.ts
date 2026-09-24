import { describe, expect, it } from 'vitest'
import { describeColor } from '../colorNames/colorNames'
import { getPalette } from '../personalColor/palettes'
import { subtypeOrder } from '../personalColor/seasons'
import type { Subtype } from '../personalColor/types'
import { adaptLuckyColorToSubtype } from './adaptation'
import { recommendLuckyFamilyOutfit, recommendLuckyRuleOutfit } from './outfit'
import { getLuckyColorRule } from './luckyColor'
import { LUCKY_COLOR_KNOWLEDGE } from './knowledge'
import { LUCKY_COLOR_FAMILIES } from './types'
import type { LuckyColorFamily, LuckyColorRule } from './types'
import outfitSource from './outfit.ts?raw'

const ROLES = ['top', 'bottom', 'shoes'] as const

function paletteEntries(subtype: Subtype) {
  const palette = getPalette(subtype)
  return [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder]
}

describe('V1.3 lucky-color outfit recommendations', () => {
  it('preserves a real positive Slice 1 rule and delegates its family to Slice 2', () => {
    const rule = getLuckyColorRule('thu', 'money')
    const recommendation = recommendLuckyRuleOutfit(rule, 'warm-spring')
    expect(recommendation.luckyRule).toBe(rule)
    expect(recommendation.luckyFamily).toBe('yellow')
    expect(recommendation.adaptation).toEqual(adaptLuckyColorToSubtype('yellow', 'warm-spring'))
  })

  it('rejects kalakini or malformed rules rather than reinterpreting them as recommendations', () => {
    const kalakini = LUCKY_COLOR_KNOWLEDGE.rules.find((rule) => rule.goal === null)!
    expect(() => recommendLuckyRuleOutfit(kalakini)).toThrow(RangeError)
    expect(() => recommendLuckyRuleOutfit({ ...getLuckyColorRule('sun', 'work'), colorFamilies: ['pink', 'red'] } as LuckyColorRule)).toThrow(RangeError)
  })

  it('handles all 120 personalized combinations with one preserved lucky role and curated supports', () => {
    const strategies = { 'lucky-top': 0, 'lucky-main': 0, 'lucky-bottom': 0, 'lucky-accessory': 0 }
    const supportIds = new Set<string>()
    for (const subtype of subtypeOrder) for (const family of LUCKY_COLOR_FAMILIES) {
      const recommendation = recommendLuckyFamilyOutfit(family, subtype)
      const adaptation = adaptLuckyColorToSubtype(family, subtype)
      strategies[recommendation.strategy] += 1
      expect(recommendation).toEqual(recommendLuckyFamilyOutfit(family, subtype))
      expect(recommendation.mode).toBe('personalized')
      expect(recommendation.luckyFamily).toBe(family)
      expect(recommendation.adaptation).toEqual(adaptation)
      expect(recommendation.pieces.map((piece) => piece.role)).toEqual(expect.arrayContaining([...ROLES]))
      expect(new Set(recommendation.pieces.map((piece) => piece.role)).size).toBe(recommendation.pieces.length)

      const lucky = recommendation.pieces.filter((piece) => piece.colorRole === 'lucky')
      expect(lucky).toHaveLength(1)
      if (adaptation.selectedColor) {
        expect(lucky[0].color).toMatchObject({ kind: 'palette', hex: adaptation.selectedColor.hex, id: adaptation.selectedColor.id })
        expect(lucky[0].color.kind).toBe('palette')
        expect(lucky[0].color.kind === 'palette' && lucky[0].color.name).toEqual(adaptation.selectedColor.name)
      } else {
        expect(recommendation.strategy).toBe('lucky-accessory')
        expect(lucky[0]).toMatchObject({ role: 'accessory', color: { kind: 'semantic', token: 'lucky-family', luckyFamily: family } })
      }

      for (const piece of recommendation.pieces) {
        const color = piece.color
        if (color.kind !== 'palette') continue
        const source = paletteEntries(subtype).find((entry) => entry.id === color.id)
        expect(source).toMatchObject({ hex: color.hex, name: color.paletteName })
        expect(color.name).toEqual(describeColor(color.hex))
        if (piece.colorRole !== 'lucky') {
          supportIds.add(color.id)
          expect(color.paletteCategory).not.toBe('harder')
        }
      }
    }
    expect(strategies).toEqual({ 'lucky-top': 59, 'lucky-main': 24, 'lucky-bottom': 23, 'lucky-accessory': 14 })
    expect(supportIds.size).toBe(36)
    expect(supportIds.size).toBeGreaterThan(0)
  })

  it('maps Slice 2 suitability to the documented lucky placement strategy', () => {
    const expected = {
      'near-face': { strategy: 'lucky-top', placement: 'top' },
      'main-piece': { strategy: 'lucky-main', placement: 'main-piece' },
      'below-face': { strategy: 'lucky-bottom', placement: 'below-face' },
      accessory: { strategy: 'lucky-accessory', placement: 'accessory' },
    } as const
    for (const subtype of subtypeOrder) for (const family of LUCKY_COLOR_FAMILIES) {
      const adaptation = adaptLuckyColorToSubtype(family, subtype)
      const recommendation = recommendLuckyFamilyOutfit(family, subtype)
      expect(recommendation.strategy).toBe(expected[adaptation.suitability].strategy)
      expect(recommendation.luckyPlacement).toBe(expected[adaptation.suitability].placement)
    }
  })

  it('keeps a curated Best top near the face whenever lucky colour is below-face or accessory-only', () => {
    for (const subtype of subtypeOrder) for (const family of LUCKY_COLOR_FAMILIES) {
      const recommendation = recommendLuckyFamilyOutfit(family, subtype)
      if (recommendation.strategy === 'lucky-top') continue
      const top = recommendation.pieces.find((piece) => piece.role === 'top')!
      expect(top).toMatchObject({ colorRole: 'supporting-personal-color', color: { kind: 'palette', paletteCategory: 'best' } })
    }
  })

  it('returns all ten families in honest general mode with semantic, non-personalized colours only', () => {
    for (const family of LUCKY_COLOR_FAMILIES) {
      const recommendation = recommendLuckyFamilyOutfit(family)
      expect(recommendation).toEqual(recommendLuckyFamilyOutfit(family))
      expect(recommendation).toMatchObject({ mode: 'general', luckyFamily: family, strategy: 'lucky-top', luckyPlacement: 'top', adaptation: null, luckyRule: null })
      expect(recommendation.pieces).toHaveLength(3)
      expect(new Set(recommendation.pieces.map((piece) => piece.role)).size).toBe(recommendation.pieces.length)
      expect(recommendation.pieces.find((piece) => piece.colorRole === 'lucky')).toMatchObject({ role: 'top', color: { kind: 'semantic', token: 'lucky-family', luckyFamily: family } })
      recommendation.pieces.forEach((piece) => expect(piece.color.kind).toBe('semantic'))
    }
  })

  it('rejects invalid families and subtypes without defaulting', () => {
    expect(() => recommendLuckyFamilyOutfit('brown' as LuckyColorFamily)).toThrow(RangeError)
    expect(() => recommendLuckyFamilyOutfit('green', 'unknown' as Subtype)).toThrow(RangeError)
  })

  it('uses no date, goal, locale, presentation, random, persistence, browser, network, pairing, or photo dependency', () => {
    const code = outfitSource.replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bDate\b|\bweekday\b|\blocale\b|\bIntl\b|Math\.random|localStorage|sessionStorage|\bwindow\b|\bdocument\b|\bfetch\b|XMLHttpRequest|\bnavigator\b|pairing|photoColor|styleGuide|PresentationPreference/i)
  })

  it('audits all 60 curated neutral swatches as valid V1.2 named support candidates', () => {
    for (const subtype of subtypeOrder) {
      const neutrals = getPalette(subtype).neutrals
      expect(neutrals).toHaveLength(5)
      neutrals.forEach((color) => expect(describeColor(color.hex)).not.toBeNull())
    }
  })
})
