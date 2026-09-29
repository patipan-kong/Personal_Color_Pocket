import { describe, expect, it } from 'vitest'
import {
  GARMENT_DEFINITIONS,
  GARMENT_TYPES,
  allowedGarmentTypesForGender,
  WARDROBE_FORMALITIES,
  WARDROBE_SLOTS,
  getDefaultFormality,
  getGarmentDefinition,
  getWardrobeSlot,
} from './taxonomy'

describe('production wardrobe taxonomy', () => {
  it('defines every garment type once with exactly one valid slot and default formality', () => {
    expect(new Set(GARMENT_TYPES).size).toBe(GARMENT_TYPES.length)
    expect(GARMENT_TYPES).toHaveLength(28)
    for (const type of GARMENT_TYPES) {
      const definition = getGarmentDefinition(type)
      expect(definition.id).toBe(type)
      expect(WARDROBE_SLOTS).toContain(definition.slot)
      expect(WARDROBE_FORMALITIES).toContain(definition.defaultFormality)
      expect(getWardrobeSlot(type)).toBe(definition.slot)
      expect(getDefaultFormality(type)).toBe(definition.defaultFormality)
    }
    expect(new Set(GARMENT_DEFINITIONS.map(({ id }) => id)).size).toBe(GARMENT_DEFINITIONS.length)
  })

  it('maps the approved one-piece types to one-piece', () => {
    for (const type of ['dress', 'jumpsuit', 'other-one-piece'] as const) expect(getWardrobeSlot(type)).toBe('one-piece')
  })

  it('uses conservative casual defaults for semantically open other types', () => {
    for (const type of GARMENT_TYPES.filter((candidate) => candidate.startsWith('other-'))) {
      expect(getDefaultFormality(type)).toBe('casual')
    }
  })

  it('freezes the initial default-formality decisions as one reviewable table', () => {
    expect(Object.fromEntries(GARMENT_DEFINITIONS.map(({ id, defaultFormality }) => [id, defaultFormality]))).toEqual({
      't-shirt': 'casual', polo: 'smart-casual', shirt: 'smart-casual', blouse: 'smart-casual', 'knit-top': 'smart-casual', 'other-top': 'casual',
      trousers: 'smart-casual', chinos: 'smart-casual', jeans: 'casual', skirt: 'smart-casual', shorts: 'casual', 'other-bottom': 'casual',
      dress: 'smart-casual', jumpsuit: 'smart-casual', 'other-one-piece': 'casual',
      jacket: 'smart-casual', blazer: 'smart-casual', cardigan: 'smart-casual', coat: 'smart-casual', 'other-outerwear': 'casual',
      sneakers: 'casual', loafers: 'smart-casual', flats: 'smart-casual', heels: 'formal', boots: 'smart-casual', sandals: 'casual', 'formal-shoes': 'formal', 'other-shoes': 'casual',
    })
  })

  it('centralizes gender applicability: explicit women-only entries, everything else unisex', () => {
    expect(GARMENT_DEFINITIONS.filter((d) => d.audience === 'women').map((d) => d.id)).toEqual(['blouse', 'skirt', 'dress', 'flats', 'heels'])
    expect(GARMENT_DEFINITIONS.map((d) => d.audience as string)).not.toContain('men')
  })

  it('derives allowed garment types per gender from that one source', () => {
    const men = allowedGarmentTypesForGender('men')
    const women = allowedGarmentTypesForGender('women')
    for (const type of ['heels', 'dress', 'skirt', 'blouse', 'flats'] as const) {
      expect(men).not.toContain(type)
      expect(women).toContain(type)
    }
    for (const type of ['polo', 'shorts', 'jumpsuit', 'sneakers', 'loafers', 'formal-shoes', 'other-shoes'] as const) {
      expect(men).toContain(type)
      expect(women).toContain(type)
    }
    expect(allowedGarmentTypesForGender(null)).toEqual(GARMENT_TYPES)
    for (const gender of ['men', 'women'] as const) for (const slot of ['top', 'bottom', 'one-piece', 'outerwear', 'shoes'] as const) expect(allowedGarmentTypesForGender(gender).some((type) => getWardrobeSlot(type) === slot)).toBe(true)
  })
})
