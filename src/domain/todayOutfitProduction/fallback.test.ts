import { describe, expect, it } from 'vitest'
import type { OwnedOutfitRequest, OwnedWardrobeFact } from './contract'
import { recommendOwnedOutfitFallback } from './fallback'

const item = (id: string, slot: OwnedWardrobeFact['slot'], formality: OwnedWardrobeFact['formality'], score: number, lucky = false): OwnedWardrobeFact => ({
  id, slot, garmentType: slot === 'top' ? 'shirt' : slot === 'bottom' ? 'trousers' : slot === 'one-piece' ? 'dress' : slot === 'outerwear' ? 'blazer' : 'loafers',
  hex: '#112233', formality, personalColorCompatibility: { rating: 'Good Match', score }, luckyFamilyMatches: lucky ? ['green'] : [],
})
const request = (wardrobe: OwnedWardrobeFact[], occasion: OwnedOutfitRequest['occasion'] = 'work'): OwnedOutfitRequest => ({
  version: 1, language: 'en', subtype: 'warm-spring', occasion, wardrobe,
  luckyPreferences: [{ family: 'green', hex: '#448855', suitability: 'near-face', priority: 'soft' }],
})

describe('production deterministic owned-outfit fallback', () => {
  it('supports separates and stable ID tie-breaking', () => {
    const input = request([item('z-top', 'top', 'smart-casual', .8), item('a-top', 'top', 'smart-casual', .8), item('bottom', 'bottom', 'smart-casual', .5), item('shoes', 'shoes', 'smart-casual', .5)])
    expect(recommendOwnedOutfitFallback(input)?.selection).toMatchObject({ kind: 'separates', topId: 'a-top', bottomId: 'bottom', shoesId: 'shoes' })
  })

  it('supports a one-piece base', () => {
    const input = request([item('dress', 'one-piece', 'smart-casual', .8), item('shoes', 'shoes', 'smart-casual', .5)])
    expect(recommendOwnedOutfitFallback(input)?.selection).toEqual({ kind: 'one-piece', onePieceId: 'dress', outerwearId: null, shoesId: 'shoes' })
  })

  it('keeps occasion stronger than Personal Color and Lucky, while weighting near-face Personal Color above Lucky', () => {
    const input = request([
      item('formal-top', 'top', 'smart-casual', .2), item('lucky-casual-top', 'top', 'casual', 1, true),
      item('pc-top', 'top', 'smart-casual', .9), item('lucky-top', 'top', 'smart-casual', .8, true),
      item('bottom', 'bottom', 'smart-casual', .5), item('shoes', 'shoes', 'smart-casual', .5),
    ])
    expect(recommendOwnedOutfitFallback(input)?.selection).toMatchObject({ kind: 'separates', topId: 'pc-top' })
  })

  it('rejects an incomplete wardrobe before recommending', () => {
    expect(recommendOwnedOutfitFallback(request([item('top', 'top', 'smart-casual', .8), item('shoes', 'shoes', 'smart-casual', .5)]))).toBeNull()
  })
})
