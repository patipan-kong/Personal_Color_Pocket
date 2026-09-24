import { describe, expect, it } from 'vitest'
import { describeColor } from '../domain/colorNames/colorNames'
import { adaptLuckyColorToSubtype } from '../domain/luckyColor/adaptation'
import { getLuckyColorRule } from '../domain/luckyColor/luckyColor'
import { recommendLuckyGoalsOutfit } from '../domain/luckyColor/outfit'
import type { LuckyGoalsOutfitRecommendation } from '../domain/luckyColor/outfit'
import { getPalette } from '../domain/personalColor/palettes'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { Subtype } from '../domain/personalColor/types'
import { LUCKY_COLOR_FAMILIES, LUCKY_GOALS, LUCKY_WEEKDAYS } from '../domain/luckyColor/types'
import type { LuckyColorFamily, LuckyGoal, LuckyWeekday } from '../domain/luckyColor/types'
import { boardFillColor, boardFillTone, buildOutfitBoardModel } from './outfitBoard'
import type { OutfitBoardModel } from './outfitBoard'
import { LUCKY_FAMILY_DISPLAY_SWATCHES } from './presentation'

const pairs = <T,>(items: readonly T[]) => items.flatMap((item, index) => items.slice(index + 1).map((other) => [item, other] as const))
const recommend = (weekday: LuckyWeekday, goals: readonly LuckyGoal[], subtype?: Subtype) =>
  recommendLuckyGoalsOutfit({ rules: goals.map((goal) => getLuckyColorRule(weekday, goal)), subtype })
const board = (weekday: LuckyWeekday, goals: readonly LuckyGoal[], subtype?: Subtype) => buildOutfitBoardModel(recommend(weekday, goals, subtype))
const piece = (model: OutfitBoardModel, key: string) => model.pieces.find((item) => item.key === key)!
const keyOf = (role: string, slot?: number) => slot === undefined ? role : `${role}-${slot}`

// Every invariant the board must keep for any recommendation the engine can return.
function expectFaithfulBoard(recommendation: LuckyGoalsOutfitRecommendation, model: OutfitBoardModel) {
  expect(model.mode).toBe(recommendation.mode)
  expect(model.pieces.map((item) => item.key)).toEqual(recommendation.pieces.map((item) => keyOf(item.role, item.slot)))
  expect(new Set(model.pieces.map((item) => item.key)).size).toBe(model.pieces.length)
  for (const role of ['top', 'bottom', 'shoes'] as const) expect(model.pieces.filter((item) => item.role === role)).toHaveLength(1)
  expect(model.accessoryCount).toBe(model.pieces.filter((item) => item.role === 'accessory').length)
  recommendation.pieces.forEach((source, index) => {
    const shown = model.pieces[index]
    expect(shown.role).toBe(source.role)
    expect(shown.lucky).toBe(source.colorRole === 'lucky')
    if (source.color.kind === 'palette') {
      expect(shown.fill).toEqual({ kind: 'exact', hex: source.color.hex, name: source.color.name })
      expect(boardFillColor(shown.fill)).toBe(source.color.hex)
    } else if (source.color.token === 'lucky-family') {
      expect(shown.fill).toEqual({ kind: 'family-token', family: source.color.luckyFamily })
      expect(boardFillColor(shown.fill)).toBe(LUCKY_FAMILY_DISPLAY_SWATCHES[source.color.luckyFamily!])
      expect(shown.fill).not.toHaveProperty('hex')
    } else {
      expect(shown.fill).toEqual({ kind: 'neutral-token', token: source.color.token })
      expect(shown.fill).not.toHaveProperty('hex')
    }
    if (!shown.lucky) {
      expect(shown.luckyFamily).toBeNull()
      expect(shown.goals).toEqual([])
      expect(shown.support).toBe(source.colorRole === 'supporting-personal-color' ? 'personal-color' : 'neutral')
    }
  })
  // Exactly the recommendation's claims: same families, same goals, each on its own lucky piece.
  expect(model.claims.map((claim) => claim.luckyFamily)).toEqual(recommendation.luckyClaims.map((claim) => claim.luckyFamily))
  expect(model.claims.map((claim) => claim.luckyFamily)).toEqual(recommendation.luckyFamilies)
  expect(model.claims.flatMap((claim) => claim.goals)).toEqual(recommendation.luckyClaims.flatMap((claim) => claim.goals))
  expect([...model.claims.flatMap((claim) => claim.goals)].sort()).toEqual([...recommendation.selectedGoals].sort())
  const lucky = model.pieces.filter((item) => item.lucky)
  expect(lucky).toHaveLength(model.claims.length)
  expect(new Set(model.claims.map((claim) => claim.pieceKey)).size).toBe(model.claims.length)
  recommendation.luckyClaims.forEach((source, index) => {
    const claim = model.claims[index]
    const carrier = piece(model, claim.pieceKey)
    expect(claim.pieceKey).toBe(keyOf(source.pieceRole, source.pieceSlot))
    expect(claim.placement).toBe(source.placement)
    expect(carrier.lucky).toBe(true)
    expect(carrier.luckyFamily).toBe(source.luckyFamily)
    expect(carrier.goals).toEqual(source.goals)
    const selected = source.adaptation?.selectedColor
    if (selected) {
      expect(claim.exactColor).toEqual({ hex: selected.hex, name: selected.name })
      expect(carrier.fill).toMatchObject({ kind: 'exact', hex: selected.hex })
    } else {
      expect(claim.exactColor).toBeNull()
      expect(carrier.fill).toEqual({ kind: 'family-token', family: source.luckyFamily })
    }
  })
  for (const item of model.pieces) if (item.luckyFamily) expect(recommendation.luckyFamilies).toContain(item.luckyFamily)
  if (model.mode === 'general') expect(model.pieces.every((item) => item.fill.kind !== 'exact')).toBe(true)
}

describe('V1.3 Slice 5 outfit board model', () => {
  it('A/C/J/K: shows one lucky claim on the top, marks only that piece, and keeps supports quiet', () => {
    const model = board('mon', ['work'], 'warm-spring')
    expect(model.claims).toHaveLength(1)
    expect(model.claims[0]).toMatchObject({ luckyFamily: 'green', goals: ['work'], placement: 'top', pieceKey: 'top' })
    expect(model.pieces.filter((item) => item.lucky).map((item) => item.key)).toEqual(['top'])
    expect(piece(model, 'bottom')).toMatchObject({ lucky: false, support: 'neutral', luckyFamily: null, goals: [] })
    expect(piece(model, 'shoes')).toMatchObject({ lucky: false, support: 'neutral' })
  })

  it('B/L: keeps both dual claims, each with its own goal provenance and piece', () => {
    const model = board('mon', ['work', 'money'], 'warm-spring')
    expect(model.claims.map((claim) => [claim.luckyFamily, claim.goals, claim.pieceKey])).toEqual([['green', ['work'], 'top'], ['orange', ['money'], 'accessory-1']])
    expect(model.pieces.filter((item) => item.lucky).map((item) => [item.key, item.luckyFamily, item.goals])).toEqual([['top', 'green', ['work']], ['accessory-1', 'orange', ['money']]])
  })

  it('D: puts a below-face lucky colour on the bottom with a Personal Color top', () => {
    const model = board('sun', ['work'], 'warm-spring')
    expect(model.claims[0]).toMatchObject({ luckyFamily: 'pink', placement: 'below-face', pieceKey: 'bottom' })
    expect(piece(model, 'bottom').lucky).toBe(true)
    expect(piece(model, 'top')).toMatchObject({ lucky: false, support: 'personal-color' })
  })

  it('E/I: an accessory fallback stays a broad-family token with no personalized shade', () => {
    const model = board('mon', ['luck'], 'soft-autumn')
    expect(adaptLuckyColorToSubtype('purple', 'soft-autumn').selectedColor).toBeNull()
    expect(model.claims[0]).toMatchObject({ luckyFamily: 'purple', placement: 'accessory', pieceKey: 'accessory', exactColor: null })
    const accessory = piece(model, 'accessory')
    expect(accessory.fill).toEqual({ kind: 'family-token', family: 'purple' })
    expect(boardFillColor(accessory.fill)).toBe(LUCKY_FAMILY_DISPLAY_SWATCHES.purple)
    for (const item of model.pieces.filter((entry) => !entry.lucky)) expect(item.fill.kind).toBe('exact')
  })

  it('F: represents two lucky accessory slots without merging them', () => {
    const model = board('mon', ['money', 'luck'], 'soft-autumn')
    expect(model.accessoryCount).toBe(2)
    expect(model.pieces.filter((item) => item.role === 'accessory').map((item) => [item.key, item.slot, item.fill])).toEqual([
      ['accessory-1', 1, { kind: 'family-token', family: 'purple' }],
      ['accessory-2', 2, { kind: 'family-token', family: 'orange' }],
    ])
    expect(model.claims.map((claim) => claim.goals)).toEqual([['luck'], ['money']])
  })

  it('G/H: paints exact lucky and supporting colours with their HEX unchanged', () => {
    const recommendation = recommend('mon', ['work'], 'warm-spring')
    const model = buildOutfitBoardModel(recommendation)
    const selected = adaptLuckyColorToSubtype('green', 'warm-spring').selectedColor!
    expect(boardFillColor(piece(model, 'top').fill)).toBe(selected.hex)
    const palette = getPalette('warm-spring')
    const neutrals = palette.neutrals.map((color) => color.hex)
    for (const key of ['bottom', 'shoes']) {
      const hex = boardFillColor(piece(model, key).fill)
      expect(neutrals).toContain(hex)
      expect(hex).toBe((recommendation.pieces.find((item) => item.role === key)!.color as { hex: string }).hex)
    }
  })

  it('M: renders the same board for either selection order', () => {
    for (const weekday of LUCKY_WEEKDAYS) for (const [left, right] of pairs(LUCKY_GOALS)) for (const subtype of [undefined, ...subtypeOrder] as const) {
      expect(board(weekday, [right, left], subtype)).toEqual(board(weekday, [left, right], subtype))
    }
  })

  it('N: has no locale input, so a locale switch cannot change the board', () => {
    expect(buildOutfitBoardModel.length).toBe(1)
    expect(JSON.stringify(board('thu', ['work', 'money']))).not.toMatch(/"(en|th)":/)
  })

  it('O/P: general mode (no or invalid profile) uses honest tokens only', () => {
    const model = board('thu', ['work', 'money'])
    expect(model.mode).toBe('general')
    expect(model.claims.map((claim) => [claim.luckyFamily, claim.exactColor])).toEqual([['yellow', null], ['blue', null]])
    expect(model.pieces.map((item) => item.fill.kind)).toEqual(['family-token', 'family-token', 'neutral-token'])
    expect(board('mon', ['work']).pieces.map((item) => item.fill)).toEqual([
      { kind: 'family-token', family: 'green' }, { kind: 'neutral-token', token: 'light-neutral' }, { kind: 'neutral-token', token: 'neutral' },
    ])
  })

  it('Q/R: classifies light and dark fills for outline visibility without changing them', () => {
    const light = board('thu', ['money'], 'light-spring')
    expect(piece(light, 'top').lucky).toBe(true)
    expect(boardFillTone(piece(light, 'top').fill)).toBe('light')
    expect(boardFillTone({ kind: 'exact', hex: '#FFFFFF', name: describeColor('#FFFFFF')! })).toBe('light')
    expect(boardFillTone({ kind: 'family-token', family: 'white' })).toBe('light')
    const dark = board('sat', ['money'], 'deep-winter')
    expect(piece(dark, 'top').lucky).toBe(true)
    expect(boardFillColor(piece(dark, 'top').fill)).toBe('#581B33')
    expect(boardFillTone(piece(dark, 'top').fill)).toBe('dark')
    expect(boardFillTone({ kind: 'family-token', family: 'black' })).toBe('dark')
    expect(boardFillTone({ kind: 'family-token', family: 'yellow' })).not.toBe('dark')
  })

  it('keeps the same-family contract: one visual claim carrying both goals', () => {
    const work = getLuckyColorRule('mon', 'work')
    const money = { ...getLuckyColorRule('mon', 'money'), colorFamilies: ['green'] as const }
    for (const subtype of [undefined, 'warm-spring', 'soft-autumn'] as const) {
      const recommendation = recommendLuckyGoalsOutfit({ rules: [money, work], subtype })
      const model = buildOutfitBoardModel(recommendation)
      expectFaithfulBoard(recommendation, model)
      expect(model.claims).toHaveLength(1)
      expect(model.claims[0].goals).toEqual(['work', 'money'])
      expect(model.pieces.filter((item) => item.lucky)).toHaveLength(1)
      expect(model.pieces.find((item) => item.lucky)!.goals).toEqual(['work', 'money'])
    }
  })

  it('refuses a recommendation whose lucky piece has no claim', () => {
    const recommendation = recommend('mon', ['work'], 'warm-spring')
    expect(() => buildOutfitBoardModel({ ...recommendation, luckyClaims: [] })).toThrow(RangeError)
    const wrongFamily = recommend('mon', ['luck'], 'soft-autumn')
    expect(() => buildOutfitBoardModel({ ...wrongFamily, luckyClaims: [{ ...wrongFamily.luckyClaims[0], luckyFamily: 'green' }] })).toThrow(RangeError)
  })

  it('audits all 120 family × subtype adaptations and all 10 general families', () => {
    let count = 0
    const base = getLuckyColorRule('mon', 'work')
    for (const family of LUCKY_COLOR_FAMILIES) for (const subtype of [undefined, ...subtypeOrder] as const) {
      const recommendation = recommendLuckyGoalsOutfit({ rules: [{ ...base, colorFamilies: [family] as readonly LuckyColorFamily[] }], subtype })
      const model = buildOutfitBoardModel(recommendation)
      expectFaithfulBoard(recommendation, model)
      expect(model.claims).toHaveLength(1)
      expect(model.claims[0].luckyFamily).toBe(family)
      if (subtype) expect(model.claims[0].exactColor?.hex ?? null).toBe(adaptLuckyColorToSubtype(family, subtype).selectedColor?.hex ?? null)
      count += 1
    }
    expect(count).toBe(130)
  })

  it('audits every production weekday × 1–2 goal selection × profile (910 boards)', () => {
    let count = 0
    const selections = [...LUCKY_GOALS.map((goal) => [goal] as const), ...pairs(LUCKY_GOALS)]
    for (const weekday of LUCKY_WEEKDAYS) for (const goals of selections) for (const subtype of [undefined, ...subtypeOrder] as const) {
      const recommendation = recommend(weekday, goals, subtype)
      expectFaithfulBoard(recommendation, buildOutfitBoardModel(recommendation))
      count += 1
    }
    expect(count).toBe(7 * 10 * 13)
  })
})
