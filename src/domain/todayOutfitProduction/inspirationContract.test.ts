import { describe, expect, it } from 'vitest'
import { buildInspirationOutfitRequest } from './inspirationRequest'
import { validateInspirationOutfitRecommendation, validateInspirationOutfitRequest } from './inspirationContract'

const request = buildInspirationOutfitRequest({ date: new Date(2026, 8, 21), goals: [], subtype: 'warm-spring', occasion: 'work' })
const canonical = { kind: 'canonical' as const, canonicalColorId: request.canonicalColorIds[0] }
const generic = { kind: 'generic' as const, colorId: request.genericColorIds[0] }
const piece = (garmentType: string, color: unknown = generic) => ({ garmentType, color })

describe('production Inspiration strict contract', () => {
  it('accepts valid separates and one-piece outfits', () => {
    expect(validateInspirationOutfitRecommendation({ outfit: { kind: 'separates', top: piece('shirt', canonical), bottom: piece('trousers'), outerwear: null, shoes: piece('loafers') } }, request).ok).toBe(true)
    expect(validateInspirationOutfitRecommendation({ outfit: { kind: 'one-piece', onePiece: piece('jumpsuit', canonical), outerwear: piece('blazer'), shoes: piece('formal-shoes') } }, request).ok).toBe(true)
  })

  it.each([
    ['missing shoes', { outfit: { kind: 'separates', top: piece('shirt'), bottom: piece('trousers'), outerwear: null } }],
    ['invalid garment type', { outfit: { kind: 'separates', top: piece('cape'), bottom: piece('trousers'), outerwear: null, shoes: piece('loafers') } }],
    ['wrong-slot garment', { outfit: { kind: 'separates', top: piece('trousers'), bottom: piece('shirt'), outerwear: null, shoes: piece('loafers') } }],
    ['arbitrary HEX', { outfit: { kind: 'separates', top: piece('shirt', { kind: 'generic', colorId: 'black', hex: '#000000' }), bottom: piece('trousers'), outerwear: null, shoes: piece('loafers') } }],
    ['unknown generic color', { outfit: { kind: 'separates', top: piece('shirt', { kind: 'generic', colorId: 'chartreuse' }), bottom: piece('trousers'), outerwear: null, shoes: piece('loafers') } }],
    ['unknown canonical ID', { outfit: { kind: 'separates', top: piece('shirt', { kind: 'canonical', canonicalColorId: 'warm-spring-invented-99' }), bottom: piece('trousers'), outerwear: null, shoes: piece('loafers') } }],
    ['mixed base', { outfit: { kind: 'one-piece', onePiece: piece('jumpsuit'), top: piece('shirt'), outerwear: null, shoes: piece('loafers') } }],
    ['unknown recommendation field', { outfit: { kind: 'one-piece', onePiece: piece('jumpsuit'), outerwear: null, shoes: piece('loafers') }, reasoning: 'provider prose' }],
  ])('rejects %s', (_label, value) => expect(validateInspirationOutfitRecommendation(value, request).ok).toBe(false))

  describe('selected profile gender is a hard garment constraint', () => {
    const shoes = (garmentType: string) => ({ outfit: { kind: 'separates', top: piece('polo', canonical), bottom: piece('shorts'), outerwear: null, shoes: piece(garmentType) } })
    const male = buildInspirationOutfitRequest({ date: new Date(2026, 8, 21), goals: [], subtype: 'warm-spring', gender: 'men', occasion: 'casual' })
    const female = buildInspirationOutfitRequest({ date: new Date(2026, 8, 21), goals: [], subtype: 'warm-spring', gender: 'women', occasion: 'casual' })

    it('rejects a women-only garment for a men profile but accepts it for women (reported heels case)', () => {
      expect(validateInspirationOutfitRecommendation(shoes('heels'), male).ok).toBe(false)
      expect(validateInspirationOutfitRecommendation(shoes('heels'), female).ok).toBe(true)
      expect(validateInspirationOutfitRecommendation({ outfit: { kind: 'one-piece', onePiece: piece('dress', canonical), outerwear: null, shoes: piece('sneakers') } }, male).ok).toBe(false)
      expect(validateInspirationOutfitRecommendation({ outfit: { kind: 'separates', top: piece('shirt', canonical), bottom: piece('skirt'), outerwear: null, shoes: piece('sneakers') } }, male).ok).toBe(false)
    })

    it('keeps unisex garments valid for both profiles', () => {
      for (const target of [male, female]) expect(validateInspirationOutfitRecommendation(shoes('sneakers'), target).ok).toBe(true)
    })

    it('with no selected gender excludes nothing', () => expect(validateInspirationOutfitRecommendation(shoes('heels'), request).ok).toBe(true))

    it('requires a valid gender and never accepts a client-supplied garment list', () => {
      const { gender: _gender, ...withoutGender } = male
      expect(validateInspirationOutfitRequest(withoutGender).ok).toBe(false)
      expect(validateInspirationOutfitRequest({ ...male, gender: 'other' }).ok).toBe(false)
      expect(validateInspirationOutfitRequest({ ...male, allowedGarmentTypes: ['heels'] }).ok).toBe(false)
      expect(validateInspirationOutfitRequest(male).ok).toBe(true)
    })
  })
})
