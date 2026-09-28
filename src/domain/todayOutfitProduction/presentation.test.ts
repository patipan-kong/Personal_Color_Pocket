import { describe, expect, it } from 'vitest'
import type { OwnedOutfitRecommendation, OwnedOutfitRequest } from './contract'
import { buildOwnedOutfitPresentationFacts } from './presentation'

const request: OwnedOutfitRequest = {
  version: 1,
  language: 'en',
  subtype: 'warm-spring',
  occasion: 'work',
  luckyPreferences: [{ family: 'green', hex: '#448855', suitability: 'near-face', priority: 'soft' }],
  wardrobe: [
    { id: 'top', slot: 'top', garmentType: 'shirt', hex: '#448855', formality: 'smart-casual', personalColorCompatibility: { rating: 'Great Match', score: 0.92 }, luckyFamilyMatches: ['green'] },
    { id: 'bottom', slot: 'bottom', garmentType: 'trousers', hex: '#334455', formality: 'smart-casual', personalColorCompatibility: { rating: 'Good Match', score: 0.7 }, luckyFamilyMatches: [] },
    { id: 'shoes', slot: 'shoes', garmentType: 'formal-shoes', hex: '#111111', formality: 'formal', personalColorCompatibility: { rating: 'Wearable', score: 0.5 }, luckyFamilyMatches: [] },
  ],
}

const recommendation: OwnedOutfitRecommendation = {
  selection: { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' },
  reasoning: {
    occasion: 'formality: smart-casual with formal-shoes',
    personalColor: 'warm-spring 0.92 (Great Match) (near-face)',
    luckyColor: 'priority = soft',
  },
}

describe('owned-outfit presentation facts', () => {
  it('derives semantic display facts without returning provider-authored technical prose', () => {
    const facts = buildOwnedOutfitPresentationFacts(request, recommendation)
    expect(facts).toEqual({
      occasion: 'work',
      personalColor: { subtype: 'warm-spring', emphasis: 'brightening' },
      luckyColor: { requestedFamilies: ['green'], matchedFamilies: ['green'] },
    })
    expect(JSON.stringify(facts)).not.toContain('smart-casual')
    expect(JSON.stringify(facts)).not.toContain('formal-shoes')
    expect(JSON.stringify(facts)).not.toContain('0.92')
    expect(JSON.stringify(facts)).not.toContain('Great Match')
    expect(JSON.stringify(facts)).not.toContain('near-face')
  })

  it('omits Personal Color and Lucky presentation when those inputs are absent', () => {
    const facts = buildOwnedOutfitPresentationFacts({
      ...request,
      subtype: null,
      luckyPreferences: [],
      wardrobe: request.wardrobe.map((item) => ({ ...item, personalColorCompatibility: null, luckyFamilyMatches: [] })),
    }, { ...recommendation, reasoning: { occasion: 'Casual.', personalColor: null, luckyColor: null } })
    expect(facts.personalColor).toBeNull()
    expect(facts.luckyColor).toBeNull()
  })
})
