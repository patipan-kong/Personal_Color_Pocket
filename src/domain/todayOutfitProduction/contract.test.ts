import { describe, expect, it } from 'vitest'
import type { OwnedOutfitRequest } from './contract'
import { validateOwnedOutfitRecommendation } from './contract'

const fact = (id: string, slot: 'top' | 'bottom' | 'one-piece' | 'outerwear' | 'shoes', garmentType: OwnedOutfitRequest['wardrobe'][number]['garmentType']): OwnedOutfitRequest['wardrobe'][number] => ({
  id, slot, garmentType, hex: '#112233', formality: 'smart-casual', personalColorCompatibility: null, luckyFamilyMatches: [],
})
const input: OwnedOutfitRequest = {
  version: 1, language: 'en', subtype: null, occasion: 'work', luckyPreferences: [],
  wardrobe: [fact('top', 'top', 'shirt'), fact('bottom', 'bottom', 'trousers'), fact('dress', 'one-piece', 'dress'), fact('coat', 'outerwear', 'coat'), fact('shoes', 'shoes', 'loafers')],
}
const reasoning = { occasion: 'Appropriate for work.', personalColor: null, luckyColor: null }

describe('owned recommendation strict validation', () => {
  it('accepts valid separates and one-piece bases', () => {
    expect(validateOwnedOutfitRecommendation({ selection: { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: 'coat', shoesId: 'shoes' }, reasoning }, input).ok).toBe(true)
    expect(validateOwnedOutfitRecommendation({ selection: { kind: 'one-piece', onePieceId: 'dress', outerwearId: null, shoesId: 'shoes' }, reasoning }, input).ok).toBe(true)
  })

  it.each([
    ['invented ID', { kind: 'separates', topId: 'invented', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' }],
    ['wrong slot', { kind: 'separates', topId: 'bottom', bottomId: 'top', outerwearId: null, shoesId: 'shoes' }],
    ['duplicate assignment', { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'top' }],
    ['missing shoes', { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: null }],
    ['malformed outerwear', { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: 'dress', shoesId: 'shoes' }],
  ])('rejects %s', (_label, selection) => {
    expect(validateOwnedOutfitRecommendation({ selection, reasoning }, input).ok).toBe(false)
  })

  it('rejects mixed base and unknown/provider-authored fact fields', () => {
    expect(validateOwnedOutfitRecommendation({ selection: { kind: 'one-piece', onePieceId: 'dress', topId: 'top', outerwearId: null, shoesId: 'shoes' }, reasoning }, input).ok).toBe(false)
    expect(validateOwnedOutfitRecommendation({ selection: { kind: 'one-piece', onePieceId: 'dress', outerwearId: null, shoesId: 'shoes' }, reasoning, hex: '#ffffff' }, input).ok).toBe(false)
  })
})
