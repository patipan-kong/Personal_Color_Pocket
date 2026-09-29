import { describe, expect, it } from 'vitest'
import type { TodayOutfitInput } from './contract'
import { validateOutfitRecommendation, validateTodayOutfitInput } from './contract'

const input: TodayOutfitInput = {
  subtype: 'warm-spring', occasion: 'casual-dinner', wardrobe: [
    { id: 'cream-shirt', name: 'Cream shirt', category: 'top', color: { name: 'Cream', hex: '#FFF0CF', canonicalColorId: 'warm-spring-neutral-1' }, formality: 'smart-casual' },
    { id: 'navy-trousers', name: 'Navy trousers', category: 'bottom', color: { name: 'Warm navy', hex: '#314C5A' }, formality: 'smart-casual' },
    { id: 'navy-jacket', name: 'Navy jacket', category: 'outerwear', color: { name: 'Warm navy', hex: '#314C5A' }, formality: 'smart-casual' },
    { id: 'brown-shoes', name: 'Brown shoes', category: 'shoes', color: { name: 'Warm cocoa', hex: '#82624A' }, formality: 'smart-casual' },
  ],
}

const success = { status: 'success', selectedItemIds: { topId: 'cream-shirt', bottomId: 'navy-trousers', outerwearId: null, shoesId: 'brown-shoes' }, alternative: null, reasoning: 'Coherent and appropriate.', personalColorNotes: 'Cream is strong near the face.', confidence: 'medium' }

describe('Today Outfit input contract', () => {
  it('accepts the smallest complete structured wardrobe and a valid canonical identity', () => expect(validateTodayOutfitInput(input).ok).toBe(true))
  it('rejects duplicate IDs, invalid occasions, and malformed color data', () => {
    const bad = { ...input, occasion: 'beach-party', wardrobe: [...input.wardrobe, { ...input.wardrobe[0], color: { name: 'x', hex: 'red' } }] }
    const result = validateTodayOutfitInput(bad)
    expect(result.ok).toBe(false)
    expect(result.issues.join(' ')).toMatch(/occasion|duplicated|hex/)
  })
  it('rejects a canonical palette ID whose subtype/HEX identity does not match', () => {
    const bad = { ...input, wardrobe: [{ ...input.wardrobe[0], color: { ...input.wardrobe[0].color, hex: '#FFFFFF' } }] }
    expect(validateTodayOutfitInput(bad).issues).toContain('wardrobe[0].color canonical identity does not match warm-spring')
  })
})

describe('provider-independent recommendation contract', () => {
  it('accepts success with optional outerwear null', () => expect(validateOutfitRecommendation(success, input).value).toEqual(success))
  it('accepts explicit uncertain and failure states', () => {
    expect(validateOutfitRecommendation({ status: 'uncertain', reason: 'Two options are equally defensible.' }, input).ok).toBe(true)
    expect(validateOutfitRecommendation({ status: 'failure', reason: 'No shoes were supplied.' }, input).ok).toBe(true)
  })
  it('rejects invented IDs', () => {
    const result = validateOutfitRecommendation({ ...success, selectedItemIds: { ...success.selectedItemIds, shoesId: 'invented-shoes' } }, input)
    expect(result.ok).toBe(false)
    expect(result.issues.join(' ')).toContain('invents unknown item ID invented-shoes')
  })
  it('rejects category mismatches and duplicate incompatible slot assignment', () => {
    const result = validateOutfitRecommendation({ ...success, selectedItemIds: { topId: 'cream-shirt', bottomId: 'cream-shirt', outerwearId: null, shoesId: 'brown-shoes' } }, input)
    expect(result.ok).toBe(false)
    expect(result.issues.join(' ')).toMatch(/expected bottom|multiple incompatible/)
  })
  it('rejects an identical alternative', () => {
    const result = validateOutfitRecommendation({ ...success, alternative: { ...success.selectedItemIds } }, input)
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('alternative must differ from the primary outfit')
  })
  it('rejects provider attempts to redefine app-owned subtype or color facts', () => {
    const result = validateOutfitRecommendation({ ...success, subtype: 'cool-winter', correctedHex: '#000000' }, input)
    expect(result.ok).toBe(false)
    expect(result.issues.join(' ')).toMatch(/unsupported fields.*subtype.*correctedHex/)
  })
})
