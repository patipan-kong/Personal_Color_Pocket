import { describe, expect, it } from 'vitest'
import {
  GARMENT_DEFINITIONS,
  GARMENT_TYPES,
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
})
