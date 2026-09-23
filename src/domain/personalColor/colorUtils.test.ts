import { describe, expect, it } from 'vitest'
import { colorDistance, hexToOklab, hexToRgb, hueDifference, normalizeHex, oklabChroma, oklabHue, rgbToHex } from './colorUtils'

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
  it('measures OKLab chroma and hue angle', () => {
    expect(oklabChroma({ l: .5, a: .03, b: .04 })).toBeCloseTo(.05, 12)
    expect(oklabChroma(hexToOklab('#808080')!)).toBeLessThan(1e-6)
    expect(oklabHue({ l: .5, a: .1, b: 0 })).toBe(0)
    expect(oklabHue({ l: .5, a: 0, b: .1 })).toBeCloseTo(90, 12)
    expect(oklabHue({ l: .5, a: -.1, b: 0 })).toBeCloseTo(180, 12)
    expect(oklabHue({ l: .5, a: 0, b: -.1 })).toBeCloseTo(270, 12)
    expect(oklabHue({ l: .5, a: .1, b: -.001 })).toBeGreaterThan(359)
    const red = oklabHue(hexToOklab('#FF0000')!)
    const blue = oklabHue(hexToOklab('#0000FF')!)
    expect(red).toBeGreaterThan(20)
    expect(red).toBeLessThan(40)
    expect(blue).toBeGreaterThan(250)
    expect(blue).toBeLessThan(280)
  })
  it('takes the shortest signed hue rotation, wrapping at 0°/360°', () => {
    expect(hueDifference(359, 1)).toBeCloseTo(2, 12)
    expect(hueDifference(1, 359)).toBeCloseTo(-2, 12)
    expect(hueDifference(10, 350)).toBeCloseTo(-20, 12)
    expect(hueDifference(90, 90)).toBe(0)
    expect(hueDifference(0, 180)).toBe(180)
    expect(hueDifference(180, 0)).toBe(180)
    expect(hueDifference(725, 3)).toBeCloseTo(-2, 12)
    for (let from = 0; from < 360; from += 17) {
      for (let to = 0; to < 360; to += 23) {
        const difference = hueDifference(from, to)
        expect(difference).toBeGreaterThan(-180)
        expect(difference).toBeLessThanOrEqual(180)
        expect((((from + difference - to) % 360) + 360) % 360).toBeCloseTo(0, 9)
      }
    }
  })
})
