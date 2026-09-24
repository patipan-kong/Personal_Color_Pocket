import { describe, expect, it } from 'vitest'
import { adaptLuckyColorToSubtype } from './adaptation'
import { getLuckyColorForDate } from './luckyColor'
import { recommendLuckyGoalsOutfit, recommendLuckyRuleOutfit } from './outfit'
import { subtypeOrder } from '../personalColor/seasons'
import { LUCKY_COLOR_FAMILIES, LUCKY_GOALS, LUCKY_WEEKDAYS } from './types'
import { getLuckyColorRule } from './luckyColor'
import type { LuckyGoal } from './types'

const sunday = new Date(2026, 8, 20, 12, 0, 0)
const dateFor = (weekdayIndex: number) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + weekdayIndex, 12, 0, 0)
const pairs = <T,>(items: readonly T[]) => items.flatMap((item, index) => items.slice(index + 1).map((other) => [item, other] as const))

describe('V1.3 Slice 4.1 multi-goal composition', () => {
  it('composes two independent claims without blending and is independent of input order', () => {
    const first = getLuckyColorRule('mon', 'work')
    const second = getLuckyColorRule('mon', 'money')
    const forward = recommendLuckyGoalsOutfit({ rules: [first, second], subtype: 'warm-spring' })
    const reverse = recommendLuckyGoalsOutfit({ rules: [second, first], subtype: 'warm-spring' })
    expect(forward).toEqual(reverse)
    expect(forward.luckyFamilies).toEqual(['green', 'orange'])
    expect(forward.luckyClaims).toHaveLength(2)
    expect(forward.luckyClaims.flatMap((claim) => claim.goals)).toEqual(['work', 'money'])
    const luckyPieces = forward.pieces.filter((piece) => piece.colorRole === 'lucky')
    expect(luckyPieces).toHaveLength(2)
    expect(luckyPieces.map((piece) => piece.role)).toEqual(expect.arrayContaining(['top']))
    expect(luckyPieces.some((piece) => piece.role === 'bottom' || piece.role === 'accessory')).toBe(true)
    expect(forward.pieces.filter((piece) => piece.colorRole === 'lucky').map((piece) => piece.color.kind)).not.toContain('semantic')
  })

  it('collapses same-family provenance to one visual claim', () => {
    const work = getLuckyColorRule('mon', 'work')
    const money = { ...getLuckyColorRule('mon', 'money'), colorFamilies: ['green'] as const }
    const recommendation = recommendLuckyGoalsOutfit({ rules: [money, work], subtype: 'warm-spring' })
    expect(recommendation.luckyFamilies).toEqual(['green'])
    expect(recommendation.luckyClaims).toHaveLength(1)
    expect(recommendation.luckyClaims[0].goals).toEqual(['work', 'money'])
    expect(recommendation.pieces.filter((piece) => piece.colorRole === 'lucky')).toHaveLength(1)
  })

  it('uses semantic family tokens in general dual mode and never claims a subtype', () => {
    const recommendation = recommendLuckyGoalsOutfit({ rules: [getLuckyColorRule('thu', 'work'), getLuckyColorRule('thu', 'money')] })
    expect(recommendation.mode).toBe('general')
    expect(recommendation.luckyClaims).toHaveLength(2)
    expect(recommendation.pieces.filter((piece) => piece.colorRole === 'lucky')).toHaveLength(2)
    expect(recommendation.pieces.filter((piece) => piece.colorRole === 'lucky').map((piece) => piece.color.kind)).toEqual(['semantic', 'semantic'])
    expect(recommendation.pieces.filter((piece) => piece.colorRole === 'lucky').map((piece) => piece.color.kind === 'semantic' ? piece.color.luckyFamily : null)).toEqual(['yellow', 'blue'])
    recommendation.pieces.forEach((piece) => expect(piece.color.kind).toBe('semantic'))
    expect(recommendation.luckyClaims.every((claim) => claim.adaptation === null)).toBe(true)
  })

  it('keeps the single-goal engine shape and meaning unchanged through the composition entry point', () => {
    for (const weekday of LUCKY_WEEKDAYS) for (const goal of LUCKY_GOALS) for (const subtype of [undefined, ...subtypeOrder] as const) {
      const rule = getLuckyColorRule(weekday, goal)
      const legacy = recommendLuckyRuleOutfit(rule, subtype)
      const composed = recommendLuckyGoalsOutfit({ rules: [rule], subtype })
      expect(composed.mode).toBe(legacy.mode)
      expect(composed.luckyFamily).toBe(legacy.luckyFamily)
      expect(composed.strategy).toBe(legacy.strategy)
      expect(composed.luckyPlacement).toBe(legacy.luckyPlacement)
      expect(composed.luckyRule).toBe(legacy.luckyRule)
      expect(composed.adaptation).toEqual(legacy.adaptation)
      expect(composed.pieces).toEqual(legacy.pieces)
      if (subtype) expect(composed.adaptation).toEqual(adaptLuckyColorToSubtype(rule.colorFamilies[0], subtype))
    }
  })

  it('rejects zero, three, malformed, or non-positive rules', () => {
    const rule = getLuckyColorRule('mon', 'work')
    const money = getLuckyColorRule('mon', 'money')
    const luck = getLuckyColorRule('mon', 'luck')
    expect(() => recommendLuckyGoalsOutfit({ rules: [] })).toThrow(RangeError)
    expect(() => recommendLuckyGoalsOutfit({ rules: [rule, money, luck] })).toThrow(RangeError)
    expect(() => recommendLuckyGoalsOutfit({ rules: [{ ...rule, goal: null, traditionalCategory: 'kalakini' } as typeof rule] })).toThrow(RangeError)
  })

  it('resolves every 70 single/dual weekday selection and all 42 general dual selections', () => {
    let selectionCount = 0
    let dualCount = 0
    for (let weekdayIndex = 0; weekdayIndex < LUCKY_WEEKDAYS.length; weekdayIndex += 1) {
      const date = dateFor(weekdayIndex)
      for (const goal of LUCKY_GOALS) {
        const recommendation = recommendLuckyGoalsOutfit({ rules: [getLuckyColorForDate(date, goal)] })
        expect(recommendation.selectedGoals).toHaveLength(1)
        selectionCount += 1
      }
      for (const [left, right] of pairs(LUCKY_GOALS)) {
        const recommendation = recommendLuckyGoalsOutfit({ rules: [getLuckyColorForDate(date, left), getLuckyColorForDate(date, right)] })
        expect(recommendation.selectedGoals).toHaveLength(2)
        expect(recommendation.luckyClaims.length).toBeGreaterThanOrEqual(1)
        expect(recommendLuckyGoalsOutfit({ rules: [getLuckyColorForDate(date, left), getLuckyColorForDate(date, right)] }).mode).toBe('general')
        selectionCount += 1
        dualCount += 1
      }
    }
    expect(selectionCount).toBe(70)
    expect(dualCount).toBe(42)
  })

  it('passes the exhaustive 504 personalized dual combinations with no unrelated families or palette mutation', () => {
    let count = 0
    for (let weekdayIndex = 0; weekdayIndex < LUCKY_WEEKDAYS.length; weekdayIndex += 1) for (const [left, right] of pairs(LUCKY_GOALS)) for (const subtype of subtypeOrder) {
      const date = dateFor(weekdayIndex)
      const leftRule = getLuckyColorForDate(date, left)
      const rightRule = getLuckyColorForDate(date, right)
      const recommendation = recommendLuckyGoalsOutfit({ rules: [rightRule, leftRule], subtype })
      const expectedFamilies = [...new Set([leftRule.colorFamilies[0], rightRule.colorFamilies[0]])]
      expect(recommendation.selectedGoals).toHaveLength(2)
      expect(recommendation.luckyRules).toEqual([leftRule, rightRule].sort((a, b) => LUCKY_COLOR_FAMILIES.indexOf(a.colorFamilies[0]) - LUCKY_COLOR_FAMILIES.indexOf(b.colorFamilies[0])))
      expect(recommendation.luckyFamilies).toEqual(expect.arrayContaining(expectedFamilies))
      expect(recommendation.luckyClaims.flatMap((claim) => claim.rules)).toHaveLength(2)
      expect(recommendation.pieces.filter((piece) => piece.colorRole === 'lucky')).toHaveLength(recommendation.luckyClaims.length)
      recommendation.luckyClaims.forEach((claim) => {
        expect(claim.adaptation?.luckyFamily).toBe(claim.luckyFamily)
        if (claim.adaptation?.selectedColor) {
          const luckyPieces = recommendation.pieces.filter((piece) => piece.colorRole === 'lucky')
          const linked = luckyPieces.find((piece) => piece.role === claim.pieceRole && piece.slot === claim.pieceSlot)
          expect(linked?.color).toMatchObject({ kind: 'palette', hex: claim.adaptation.selectedColor.hex })
          if (claim.adaptation.selectedColor.paletteCategory === 'harder') expect(claim.pieceRole).not.toBe('top')
        } else {
          const linked = recommendation.pieces.find((piece) => piece.role === claim.pieceRole && piece.slot === claim.pieceSlot)
          expect(linked?.color).toMatchObject({ kind: 'semantic', token: 'lucky-family', luckyFamily: claim.luckyFamily })
        }
      })
      expect(recommendation.pieces.filter((piece) => piece.colorRole !== 'lucky').every((piece) => piece.color.kind === 'palette')).toBe(true)
      count += 1
    }
    expect(count).toBe(504)
  })

  it('proves order independence across every weekday, pair, and subtype', () => {
    for (let weekdayIndex = 0; weekdayIndex < LUCKY_WEEKDAYS.length; weekdayIndex += 1) for (const [left, right] of pairs(LUCKY_GOALS)) for (const subtype of [undefined, ...subtypeOrder] as const) {
      const date = dateFor(weekdayIndex)
      const forward = recommendLuckyGoalsOutfit({ rules: [getLuckyColorForDate(date, left), getLuckyColorForDate(date, right)], subtype })
      const reverse = recommendLuckyGoalsOutfit({ rules: [getLuckyColorForDate(date, right), getLuckyColorForDate(date, left)], subtype })
      expect(reverse).toEqual(forward)
    }
  })

  it('keeps the domain goal set distinct from UI selection order', () => {
    const work = getLuckyColorRule('thu', 'work')
    const money = getLuckyColorRule('thu', 'money')
    const recommendation = recommendLuckyGoalsOutfit({ rules: [money, work] })
    expect(recommendation.selectedGoals).toEqual(['money', 'work'])
    expect(recommendation.luckyClaims.flatMap((claim) => claim.goals)).toEqual(['money', 'work'])
  })

  it('keeps the product goal universe at exactly four canonical IDs', () => {
    expect(LUCKY_GOALS).toEqual(['work', 'money', 'luck', 'mentor-support'] satisfies readonly LuckyGoal[])
  })

  it('reports the production daily dual-family audit distribution', () => {
    const distinctFamilyPairs = new Map<string, number>()
    let sameFamily = 0
    let placementConflicts = 0
    for (let weekdayIndex = 0; weekdayIndex < LUCKY_WEEKDAYS.length; weekdayIndex += 1) for (const [left, right] of pairs(LUCKY_GOALS)) {
      const recommendation = recommendLuckyGoalsOutfit({ rules: [getLuckyColorForDate(dateFor(weekdayIndex), left), getLuckyColorForDate(dateFor(weekdayIndex), right)], subtype: 'warm-spring' })
      const families = recommendation.luckyFamilies
      if (families.length === 1) sameFamily += 1
      else {
        const key = [...families].sort((a, b) => LUCKY_COLOR_FAMILIES.indexOf(a) - LUCKY_COLOR_FAMILIES.indexOf(b)).join('+')
        distinctFamilyPairs.set(key, (distinctFamilyPairs.get(key) ?? 0) + 1)
      }
      const roles = recommendation.luckyClaims.map((claim) => `${claim.pieceRole}-${claim.pieceSlot ?? 0}`)
      if (new Set(roles).size !== roles.length) placementConflicts += 1
    }
    expect([...distinctFamilyPairs.values()].reduce((sum, value) => sum + value, 0)).toBe(42)
    expect(sameFamily).toBe(0)
    expect(placementConflicts).toBe(0)
  })
})
