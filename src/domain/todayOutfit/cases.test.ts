import { describe, expect, it } from 'vitest'
import { OUTFIT_BAKEOFF_CASES } from './cases'
import { validateTodayOutfitInput } from './contract'

describe('Today Outfit curated bakeoff inventory', () => {
  it('contains 15–20 unique, valid, text-only cases with stated review intent', () => {
    expect(OUTFIT_BAKEOFF_CASES.length).toBeGreaterThanOrEqual(15)
    expect(OUTFIT_BAKEOFF_CASES.length).toBeLessThanOrEqual(20)
    expect(new Set(OUTFIT_BAKEOFF_CASES.map((item) => item.id)).size).toBe(OUTFIT_BAKEOFF_CASES.length)
    for (const item of OUTFIT_BAKEOFF_CASES) {
      expect(validateTodayOutfitInput(item).ok, item.id).toBe(true)
      expect(item.intendedTest.length).toBeGreaterThan(10)
      expect(JSON.stringify(item)).not.toMatch(/image|photo|weather|price|brand/i)
    }
  })
  it('covers the requested occasion and reasoning patterns without hidden correct answers', () => {
    const text = OUTFIT_BAKEOFF_CASES.map((item) => `${item.id} ${item.title} ${item.intendedTest} ${item.occasion}`).join(' ')
    for (const token of ['casual', 'casual-dinner', 'work', 'smart-casual', 'date', 'formal', 'wedding-guest', 'outerwear', 'shoe', 'near-face', 'Multiple valid', 'cream']) expect(text).toContain(token)
    expect(text).not.toMatch(/correct answer|ground truth|accuracy score/i)
  })
})
