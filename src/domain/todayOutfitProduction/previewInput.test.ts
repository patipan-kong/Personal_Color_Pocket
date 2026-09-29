import { describe, expect, it } from 'vitest'
import type { OwnedOutfitRecommendation, OwnedOutfitRequest } from './contract'
import { buildInspirationOutfitRequest } from './inspirationRequest'
import type { InspirationOutfitRecommendation } from './inspirationContract'
import { mapInspirationRecommendationToPreviewInput, mapOwnedRecommendationToPreviewInput } from './previewInput'

const ownedFact = (id: string, slot: OwnedOutfitRequest['wardrobe'][number]['slot'], garmentType: OwnedOutfitRequest['wardrobe'][number]['garmentType'], hex: string): OwnedOutfitRequest['wardrobe'][number] => ({
  id, slot, garmentType, hex, formality: 'smart-casual', personalColorCompatibility: null, luckyFamilyMatches: [],
})
const ownedRequest: OwnedOutfitRequest = {
  version: 1, language: 'en', subtype: null, occasion: 'work', luckyPreferences: [],
  wardrobe: [
    ownedFact('top-id', 'top', 'shirt', '#123456'),
    ownedFact('bottom-id', 'bottom', 'trousers', '#654321'),
    ownedFact('dress-id', 'one-piece', 'dress', '#AABBCC'),
    ownedFact('outer-id', 'outerwear', 'blazer', '#112233'),
    ownedFact('shoes-id', 'shoes', 'loafers', '#FFFFFF'),
    ownedFact('unselected-private-id', 'top', 'blouse', '#ABCDEF'),
  ],
}
const reasoning = { occasion: 'Provider prose.', personalColor: null, luckyColor: null }

const inspirationRequest = buildInspirationOutfitRequest({ date: new Date(2026, 8, 29), goals: [], subtype: 'warm-spring', occasion: 'work' })
const canonical = { kind: 'canonical' as const, canonicalColorId: inspirationRequest.canonicalColorIds[0] }
const generic = (colorId: typeof inspirationRequest.genericColorIds[number]) => ({ kind: 'generic' as const, colorId })

describe('Owned and Inspiration to Preview mapping', () => {
  it.each([
    ['separates / outerwear absent', { kind: 'separates', topId: 'top-id', bottomId: 'bottom-id', outerwearId: null, shoesId: 'shoes-id' }],
    ['separates / outerwear present', { kind: 'separates', topId: 'top-id', bottomId: 'bottom-id', outerwearId: 'outer-id', shoesId: 'shoes-id' }],
    ['one-piece / outerwear absent', { kind: 'one-piece', onePieceId: 'dress-id', outerwearId: null, shoesId: 'shoes-id' }],
    ['one-piece / outerwear present', { kind: 'one-piece', onePieceId: 'dress-id', outerwearId: 'outer-id', shoesId: 'shoes-id' }],
  ] as const)('maps Owned %s without IDs or recommendation context', (_label, selection) => {
    const mapped = mapOwnedRecommendationToPreviewInput({ selection, reasoning } as OwnedOutfitRecommendation, ownedRequest)
    expect(mapped.ok).toBe(true)
    const serialized = JSON.stringify(mapped.value)
    expect(serialized).not.toMatch(/-id|formality|compatibility|lucky|occasion|reasoning|custom/i)
    expect(serialized).not.toContain('#ABCDEF')
    expect(mapped.value?.outfit.kind).toBe(selection.kind)
    expect(mapped.value?.outfit.outerwear === null).toBe(selection.outerwearId === null)
  })

  it('fails closed when an Owned selection cannot resolve or has the wrong slot', () => {
    expect(mapOwnedRecommendationToPreviewInput({ selection: { kind: 'separates', topId: 'missing', bottomId: 'bottom-id', outerwearId: null, shoesId: 'shoes-id' }, reasoning }, ownedRequest).ok).toBe(false)
    expect(mapOwnedRecommendationToPreviewInput({ selection: { kind: 'separates', topId: 'bottom-id', bottomId: 'top-id', outerwearId: null, shoesId: 'shoes-id' }, reasoning }, ownedRequest).ok).toBe(false)
  })

  it.each([
    ['separates / outerwear absent', { kind: 'separates', top: { garmentType: 'shirt', color: canonical }, bottom: { garmentType: 'trousers', color: generic('navy') }, outerwear: null, shoes: { garmentType: 'loafers', color: generic('brown') } }],
    ['separates / outerwear present', { kind: 'separates', top: { garmentType: 'shirt', color: canonical }, bottom: { garmentType: 'trousers', color: generic('navy') }, outerwear: { garmentType: 'blazer', color: generic('beige') }, shoes: { garmentType: 'loafers', color: generic('brown') } }],
    ['one-piece / outerwear absent', { kind: 'one-piece', onePiece: { garmentType: 'dress', color: canonical }, outerwear: null, shoes: { garmentType: 'heels', color: generic('brown') } }],
    ['one-piece / outerwear present', { kind: 'one-piece', onePiece: { garmentType: 'dress', color: canonical }, outerwear: { garmentType: 'coat', color: generic('beige') }, shoes: { garmentType: 'heels', color: generic('brown') } }],
  ] as const)('maps Inspiration %s without making another styling decision', (_label, outfit) => {
    const recommendation = { outfit } as unknown as InspirationOutfitRecommendation
    const mapped = mapInspirationRecommendationToPreviewInput(recommendation, inspirationRequest)
    expect(mapped.ok).toBe(true)
    expect(mapped.value?.outfit.kind).toBe(outfit.kind)
    expect(mapped.value?.outfit.outerwear === null).toBe(outfit.outerwear === null)
    expect(JSON.stringify(mapped.value)).not.toMatch(/canonicalColorId|colorId|occasion|subtype|lucky|reasoning/i)
  })

  it('fails closed when an Inspiration color identity is not in the exact request', () => {
    const recommendation = { outfit: { kind: 'one-piece', onePiece: { garmentType: 'dress', color: { kind: 'generic', colorId: 'invented' } }, outerwear: null, shoes: { garmentType: 'heels', color: generic('brown') } } } as unknown as InspirationOutfitRecommendation
    expect(mapInspirationRecommendationToPreviewInput(recommendation, inspirationRequest).ok).toBe(false)
  })

  it.each([
    ['men', "men's casual sandals"],
    ['women', "women's casual sandals"],
  ] as const)('adds an app-owned %s presentation hint without changing sandals or its HEX', (gender, visualDescription) => {
    const request = buildInspirationOutfitRequest({ date: new Date(2026, 8, 29), goals: [], subtype: 'warm-spring', gender, occasion: 'casual' })
    const recommendation: InspirationOutfitRecommendation = {
      outfit: {
        kind: 'separates',
        top: { garmentType: 't-shirt', color: { kind: 'generic', colorId: 'white' } },
        bottom: { garmentType: 'shorts', color: { kind: 'generic', colorId: 'navy' } },
        outerwear: null,
        shoes: { garmentType: 'sandals', color: { kind: 'generic', colorId: 'brown' } },
      },
    }
    const mapped = mapInspirationRecommendationToPreviewInput(recommendation, request)
    expect(mapped.ok).toBe(true)
    expect(mapped.value?.outfit.kind === 'separates' && mapped.value.outfit.shoes).toEqual({
      garmentType: 'sandals',
      color: { hex: '#7B4C31' },
      visualDescription,
    })
  })

  it('does not default null gender to a feminine visual presentation', () => {
    const request = buildInspirationOutfitRequest({ date: new Date(2026, 8, 29), goals: [], occasion: 'casual' })
    const recommendation: InspirationOutfitRecommendation = {
      outfit: {
        kind: 'separates',
        top: { garmentType: 't-shirt', color: { kind: 'generic', colorId: 'white' } },
        bottom: { garmentType: 'shorts', color: { kind: 'generic', colorId: 'navy' } },
        outerwear: null,
        shoes: { garmentType: 'sandals', color: { kind: 'generic', colorId: 'brown' } },
      },
    }
    const mapped = mapInspirationRecommendationToPreviewInput(recommendation, request)
    expect(mapped.ok).toBe(true)
    expect(mapped.value?.outfit.kind === 'separates' && mapped.value.outfit.shoes).toEqual({ garmentType: 'sandals', color: { hex: '#7B4C31' } })
  })

  it('keeps Owned inventory neutral even when its garment is presentation-sensitive', () => {
    const request: OwnedOutfitRequest = {
      ...ownedRequest,
      wardrobe: ownedRequest.wardrobe.map((fact) => fact.id === 'shoes-id' ? { ...fact, garmentType: 'sandals' } : fact),
    }
    const mapped = mapOwnedRecommendationToPreviewInput({
      selection: { kind: 'separates', topId: 'top-id', bottomId: 'bottom-id', outerwearId: null, shoesId: 'shoes-id' },
      reasoning,
    }, request)
    expect(mapped.ok).toBe(true)
    expect(mapped.value?.outfit.kind === 'separates' && mapped.value.outfit.shoes).toEqual({ garmentType: 'sandals', color: { hex: '#FFFFFF' } })
  })
})
