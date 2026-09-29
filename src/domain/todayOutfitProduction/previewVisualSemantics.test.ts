import { describe, expect, it } from 'vitest'
import { GARMENT_TYPES } from '../wardrobe/taxonomy'
import {
  PREVIEW_TAXONOMY_AUDIT,
  isAllowedPreviewVisualDescription,
  resolveInspirationPreviewVisualDescription,
} from './previewVisualSemantics'

describe('Preview visual semantics', () => {
  it('classifies every garment in the closed taxonomy', () => {
    expect(Object.keys(PREVIEW_TAXONOMY_AUDIT).sort()).toEqual([...GARMENT_TYPES].sort())
    expect(PREVIEW_TAXONOMY_AUDIT.flats).toBe('gender-restricted')
    expect(PREVIEW_TAXONOMY_AUDIT.sandals).toBe('presentation-sensitive')
    expect(PREVIEW_TAXONOMY_AUDIT['other-shoes']).toBe('too-generic')
  })

  it('has a presentation description for every and only presentation-sensitive type', () => {
    for (const garmentType of GARMENT_TYPES) {
      const expected = PREVIEW_TAXONOMY_AUDIT[garmentType] === 'presentation-sensitive'
      expect(resolveInspirationPreviewVisualDescription(garmentType, 'men') !== undefined).toBe(expected)
      expect(resolveInspirationPreviewVisualDescription(garmentType, 'women') !== undefined).toBe(expected)
    }
  })

  it('resolves app-owned descriptions only for explicit-gender Inspiration ambiguity', () => {
    expect(resolveInspirationPreviewVisualDescription('sandals', 'men')).toBe("men's casual sandals")
    expect(resolveInspirationPreviewVisualDescription('sandals', 'women')).toBe("women's casual sandals")
    expect(resolveInspirationPreviewVisualDescription('sandals', null)).toBeUndefined()
    expect(resolveInspirationPreviewVisualDescription('sneakers', 'men')).toBeUndefined()
    expect(resolveInspirationPreviewVisualDescription('other-shoes', 'women')).toBeUndefined()
  })

  it('allows only the fixed description paired with its semantic garment type', () => {
    expect(isAllowedPreviewVisualDescription('sandals', "men's casual sandals")).toBe(true)
    expect(isAllowedPreviewVisualDescription('sandals', "men's loafers")).toBe(false)
    expect(isAllowedPreviewVisualDescription('sneakers', "men's casual sandals")).toBe(false)
  })
})
