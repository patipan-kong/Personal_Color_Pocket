import { describe, expect, it } from 'vitest'
import { colorDistance, hexToOklab, hexToRgb, normalizeHex } from './colorUtils'

describe('color utilities', () => {
  it('normalizes 3 and 6 digit HEX values', () => { expect(normalizeHex(' abc ')).toBe('#AABBCC'); expect(normalizeHex('#d98463')).toBe('#D98463') })
  it('rejects invalid HEX input', () => { expect(normalizeHex('#12')).toBeNull(); expect(normalizeHex('hello')).toBeNull() })
  it('converts HEX to RGB', () => expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 }))
  it('converts known colors into sane OKLab values', () => {
    const black = hexToOklab('#000000')!
    const white = hexToOklab('#FFFFFF')!
    expect(black.l).toBeCloseTo(0, 5)
    expect(white.l).toBeCloseTo(1, 5)
    expect(colorDistance(black, white)).toBeCloseTo(1, 4)
    expect(colorDistance(white, white)).toBe(0)
  })
})
