import { describe, expect, it } from 'vitest'
import { colorDistance, hexToOklab, hexToRgb, normalizeHex, rgbToHex } from './colorUtils'

describe('color utilities', () => {
  it('normalizes 3 and 6 digit HEX values', () => { expect(normalizeHex(' abc ')).toBe('#AABBCC'); expect(normalizeHex('#d98463')).toBe('#D98463') })
  it('rejects invalid HEX input', () => { expect(normalizeHex('#12')).toBeNull(); expect(normalizeHex('hello')).toBeNull() })
  it('converts HEX to RGB', () => expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 }))
  it('converts RGB to normalized HEX (round-trips hexToRgb)', () => {
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe('#FF8000')
    expect(rgbToHex({ r: 0, g: 10, b: 171 })).toBe('#000AAB')
    for (const hex of ['#000000', '#FFFFFF', '#D98463', '#0A0B0C']) expect(rgbToHex(hexToRgb(hex)!)).toBe(hex)
  })
  it('converts known colors into sane OKLab values', () => {
    const black = hexToOklab('#000000')!
    const white = hexToOklab('#FFFFFF')!
    expect(black.l).toBeCloseTo(0, 5)
    expect(white.l).toBeCloseTo(1, 5)
    expect(colorDistance(black, white)).toBeCloseTo(1, 4)
    expect(colorDistance(white, white)).toBe(0)
  })
})
