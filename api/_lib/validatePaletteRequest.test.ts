import { describe, expect, it } from 'vitest'
import { validatePaletteSelectionRequest } from './validatePaletteRequest'

const VALID = {
  imageDataUrl: 'data:image/jpeg;base64,AAAA',
  subtype: 'warm-spring',
  palette: [
    { colorId: 'warm-spring-best-1', name: 'Warm Coral', hex: '#E9785D' },
    { colorId: 'warm-spring-neutral-1', name: 'Cream', hex: '#FFF0CF' },
  ],
}

describe('validatePaletteSelectionRequest', () => {
  it('accepts a fully valid payload', () => {
    expect(validatePaletteSelectionRequest(VALID)).toEqual(VALID)
  })

  it('rejects a non-object, and a non-data-URL image', () => {
    expect(validatePaletteSelectionRequest('nonsense')).toBeNull()
    expect(validatePaletteSelectionRequest({ ...VALID, imageDataUrl: 'https://example.com/x.jpg' })).toBeNull()
  })

  it('rejects an unknown subtype', () => {
    expect(validatePaletteSelectionRequest({ ...VALID, subtype: 'not-a-real-subtype' })).toBeNull()
  })

  it('rejects an empty palette', () => {
    expect(validatePaletteSelectionRequest({ ...VALID, palette: [] })).toBeNull()
  })

  it('rejects a palette entry with a malformed hex', () => {
    const palette = [{ ...VALID.palette[0], hex: 'not-a-hex' }]
    expect(validatePaletteSelectionRequest({ ...VALID, palette })).toBeNull()
  })

  it('rejects a palette with two candidates sharing the same colorId (would not resolve unambiguously)', () => {
    const palette = [VALID.palette[0], { ...VALID.palette[1], colorId: VALID.palette[0].colorId }]
    expect(validatePaletteSelectionRequest({ ...VALID, palette })).toBeNull()
  })

  it('rejects an oversized palette', () => {
    const palette = Array.from({ length: 65 }, (_, index) => ({ colorId: `id-${index}`, name: 'x', hex: '#123456' }))
    expect(validatePaletteSelectionRequest({ ...VALID, palette })).toBeNull()
  })
})
