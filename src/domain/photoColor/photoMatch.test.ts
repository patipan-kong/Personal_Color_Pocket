import { describe, expect, it } from 'vitest'
import { checkColor, pairingSuggestions } from '../personalColor/colorMatch'
import { colorDistance, hexToOklab, hexToRgb, hueDifference, oklabChroma, oklabHue, rgbToHex, rgbToOklab } from '../personalColor/colorUtils'
import type { OKLab, RGB } from '../personalColor/colorUtils'
import { palettes } from '../personalColor/palettes'
import { subtypeOrder } from '../personalColor/seasons'
import type { PaletteColor, Subtype } from '../personalColor/types'
import {
  DEEP_VALUE_MAX, HUE_FULL_CHROMA_MIN, HUE_IGNORED_CHROMA_MAX, LIGHT_VALUE_MIN, NEUTRAL_CHROMA_MAX, PHOTO_CLOSE_DISTANCE, PHOTO_LIGHTNESS_WEIGHT, PHOTO_RELATED_DISTANCE, matchPhotoColor,
} from './photoMatch'
import type { PhotoColorMatch, PhotoColorSample, PhotoMatchCategory, SampleFlag } from './types'
import photoMatchSource from './photoMatch.ts?raw'

// ---- Test-only color helpers (the app never needs OKLab → sRGB) ----

const encode = (linear: number) => 255 * (linear <= .0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - .055)
const decode = (channel: number) => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 }
const toByte = (linear: number) => Math.round(encode(Math.min(1, Math.max(0, linear))))

// Inverse OKLab (Ottosson), clipped to the sRGB gamut like a camera would.
function oklabToRgb({ l, a, b }: OKLab): RGB {
  const long = (l + .3963377774 * a + .2158037573 * b) ** 3
  const medium = (l - .1055613458 * a - .0638541728 * b) ** 3
  const short = (l - .0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: toByte(4.0767416621 * long - 3.3077115913 * medium + .2309699292 * short),
    g: toByte(-1.2684380046 * long + 2.6097574011 * medium - .3413193965 * short),
    b: toByte(-.0041960863 * long - .7034186147 * medium + 1.707614701 * short),
  }
}

// A real sample: 8-bit sRGB in, hex/rgb/oklab consistent exactly as samplePhotoRegion produces them.
function sampleOf(rgb: RGB, flags: SampleFlag[] = []): PhotoColorSample {
  return {
    kind: 'color',
    hex: rgbToHex(rgb),
    rgb,
    oklab: rgbToOklab(rgb),
    diagnostics: { regionPixelCount: 1810, opaquePixelCount: 1810, retainedPixelCount: 1086, spread: .01, highlightFraction: 0, shadowFraction: 0, flags },
  }
}
const sampleHex = (hex: string, flags: SampleFlag[] = []) => sampleOf(hexToRgb(hex)!, flags)
// Exact OKLab (no 8-bit rounding) for threshold-boundary and geometry tests. hex is only used for pairings.
function sampleAt(oklab: OKLab): PhotoColorSample {
  return { ...sampleOf(oklabToRgb(oklab)), oklab }
}

type Transform = (rgb: RGB) => RGB
// Per-channel gain in linear light: exposure and white-balance casts (plan §10.1).
const gain = (red: number, green: number, blue: number): Transform => ({ r, g, b }) => ({ r: toByte(decode(r) * red), g: toByte(decode(g) * green), b: toByte(decode(b) * blue) })
const inOklab = (change: (color: OKLab) => OKLab): Transform => (rgb) => oklabToRgb(change(rgbToOklab(rgb)))
const scaleChroma = (factor: number) => ({ l, a, b }: OKLab) => ({ l, a: a * factor, b: b * factor })
const rotateHue = (degrees: number) => ({ l, a, b }: OKLab) => {
  const angle = degrees * Math.PI / 180
  return { l, a: a * Math.cos(angle) - b * Math.sin(angle), b: a * Math.sin(angle) + b * Math.cos(angle) }
}

const MODEST: Record<string, Transform> = {
  'exposure −20%': gain(.8, .8, .8),
  'exposure +20%': gain(1.2, 1.2, 1.2),
  'warm cast (R×1.08, B×0.82)': gain(1.08, 1, .82),
  'cool cast (R×0.92, B×1.12)': gain(.92, 1, 1.12),
  'ΔL −0.05': inOklab((color) => ({ ...color, l: color.l - .05 })),
  'ΔL +0.05': inOklab((color) => ({ ...color, l: color.l + .05 })),
  'chroma ×0.8': inOklab(scaleChroma(.8)),
  'chroma ×1.2': inOklab(scaleChroma(1.2)),
  'hue −8°': inOklab(rotateHue(-8)),
  'hue +8°': inOklab(rotateHue(8)),
}

const POSITIVE: PhotoMatchCategory[] = ['near-face', 'neutral-base', 'related']
const CLOSE: PhotoMatchCategory[] = ['near-face', 'neutral-base']
const oklabOf = (color: PaletteColor) => hexToOklab(color.hex)!
const match = (hex: string, subtype: Subtype) => matchPhotoColor(sampleHex(hex), subtype)

describe('photo match — contract', () => {
  it('returns qualitative guidance with no score, percentage or confidence', () => {
    const result = match('#E9785D', 'warm-spring')
    expect(Object.keys(result).sort()).toEqual(['category', 'closest', 'descriptors', 'difference', 'direction', 'hex', 'nearest', 'oklab', 'pairWith', 'resembles', 'subtype', 'warnings'])
    expect(JSON.stringify(result)).not.toMatch(/score|percent|confidence|probability/i)
    expect(result).toMatchObject({ subtype: 'warm-spring', hex: '#E9785D', category: 'near-face', resembles: null, direction: [], warnings: [] })
    expect(result.nearest).toEqual({ color: palettes['warm-spring'].best[0], group: 'best', distance: 0 })
    expect(result.closest.best).toBe(palettes['warm-spring'].best[0])
  })

  it('consumes the successful sample as-is (hex, oklab) and never reparses it', () => {
    const sample = sampleHex('#6E7D8B')
    const result = matchPhotoColor(sample, 'warm-spring')
    expect(result.hex).toBe(sample.hex)
    expect(result.oklab).toBe(sample.oklab)
  })

  it('rejects unavailable samples and non-finite colors as programming errors', () => {
    for (const reason of ['outside-image', 'transparent', 'insufficient-pixels'] as const) {
      // @ts-expect-error — the type system already forbids unavailable samples
      expect(() => matchPhotoColor({ kind: 'unavailable', reason }, 'warm-spring')).toThrow(TypeError)
    }
    expect(() => matchPhotoColor({ ...sampleHex('#808080'), oklab: { l: Number.NaN, a: 0, b: 0 } }, 'cool-winter')).toThrow(RangeError)
  })

  it('is deterministic and does not mutate its input', () => {
    const sample = sampleHex('#9B738A', ['mixed'])
    const snapshot = structuredClone(sample)
    const first = matchPhotoColor(sample, 'soft-summer')
    expect(matchPhotoColor(sample, 'soft-summer')).toEqual(first)
    expect(sample).toEqual(snapshot)
    first.warnings.push('shadow')
    expect(sample.diagnostics.flags).toEqual(['mixed'])
  })

  it.each(subtypeOrder)('%s: references only its own Best/Accent/Neutral/Harder colors, never metals', (subtype) => {
    const palette = palettes[subtype]
    const positiveIds = new Set([...palette.best, ...palette.accents, ...palette.neutrals].map((color) => color.id))
    const harderIds = new Set(palette.harder.map((color) => color.id))
    for (const hex of [...palette.metals.map((metal) => metal.hex), '#808080', '#FFFFFF', '#000000', '#FF0000', '#0000FF']) {
      const result = match(hex, subtype)
      expect(positiveIds.has(result.nearest.color.id)).toBe(true)
      if (result.resembles) expect(harderIds.has(result.resembles.color.id)).toBe(true)
      expect(result.nearest.color.id).not.toMatch(/-metal-/)
    }
  })
})

describe('photo match — distance model', () => {
  it('uses (kL·ΔL)² + Δa² + Δb² with kL = 0.5', () => {
    const base = oklabOf(palettes['cool-winter'].best[2])
    const shifted = { l: base.l + .06, a: base.a + .02, b: base.b - .01 }
    const result = matchPhotoColor(sampleAt(shifted), 'cool-winter')
    expect(PHOTO_LIGHTNESS_WEIGHT).toBe(.5)
    expect(result.nearest.color).toBe(palettes['cool-winter'].best[2])
    expect(result.nearest.distance).toBeCloseTo(Math.sqrt(.03 ** 2 + .02 ** 2 + .01 ** 2), 12)
  })

  it('equals the plan formula exactly when both colors are chromatic', () => {
    let checked = 0
    for (const subtype of subtypeOrder) {
      for (const color of palettes[subtype].best) {
        const base = oklabOf(color)
        const shifted = { l: base.l - .04, a: base.a * 1.1 + .01, b: base.b * 1.1 - .01 }
        const result = matchPhotoColor(sampleAt(shifted), subtype)
        const reference = oklabOf(result.nearest.color)
        if (Math.min(oklabChroma(shifted), oklabChroma(reference)) < HUE_FULL_CHROMA_MIN) continue
        expect(result.nearest.distance).toBeCloseTo(Math.sqrt((.5 * (shifted.l - reference.l)) ** 2 + (shifted.a - reference.a) ** 2 + (shifted.b - reference.b) ** 2), 12)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(80)
  })

  it('judges near-neutral colors on lightness and chroma only (hue term ignored at low chroma)', () => {
    const grey = { l: .6, a: .006, b: -.0045 } // chroma 0.0075, hue ≈ 323°
    expect(oklabChroma(grey)).toBeLessThanOrEqual(HUE_IGNORED_CHROMA_MAX)
    const result = matchPhotoColor(sampleAt(grey), 'cool-winter')
    const reference = oklabOf(result.nearest.color)
    expect(result.nearest.distance).toBeCloseTo(Math.sqrt((.5 * (grey.l - reference.l)) ** 2 + (oklabChroma(grey) - oklabChroma(reference)) ** 2), 12)
  })

  it.each(subtypeOrder)('%s: a lighting-sized ΔL of 0.08 stays close, although plain OKLab distance would not', (subtype) => {
    for (const color of palettes[subtype].best) {
      const base = oklabOf(color)
      const shifted = { ...base, l: base.l + (base.l > .6 ? -.08 : .08) }
      expect(colorDistance(base, shifted)).toBeGreaterThan(PHOTO_CLOSE_DISTANCE)
      expect(CLOSE).toContain(matchPhotoColor(sampleAt(shifted), subtype).category)
    }
  })

  it.each(subtypeOrder)('%s: a large value change (ΔL 0.3) never keeps the same close match', (subtype) => {
    for (const color of palettes[subtype].best) {
      const base = oklabOf(color)
      const result = matchPhotoColor(sampleAt({ ...base, l: base.l + (base.l > .5 ? -.3 : .3) }), subtype)
      expect(result.category === 'near-face' && result.nearest.color === color).toBe(false)
    }
  })

  it('light vs very deep: the same hue at L 0.9 and L 0.3 gets different guidance', () => {
    const coral = oklabOf(palettes['warm-spring'].best[0])
    const light = matchPhotoColor(sampleAt({ ...coral, l: .9, a: coral.a * .4, b: coral.b * .4 }), 'deep-winter')
    const deep = matchPhotoColor(sampleAt({ ...coral, l: .3, a: coral.a * .4, b: coral.b * .4 }), 'deep-winter')
    expect(light.category).not.toBe(deep.category)
    expect(light.descriptors.value).toBe('light')
    expect(deep.descriptors.value).toBe('deep')
  })

  it('chroma counts at full weight: +0.06 chroma on the same hue leaves "close"', () => {
    const smoky = oklabOf(palettes['soft-summer'].best[2]) // Smoky Blue, low chroma
    const factor = (oklabChroma(smoky) + .06) / oklabChroma(smoky)
    const vivid = matchPhotoColor(sampleAt(scaleChroma(factor)(smoky)), 'soft-summer')
    expect(vivid.category).not.toBe('near-face')
    expect(vivid.difference.chroma).toBeGreaterThan(0)
  })
})

describe('photo match — hue and near-neutral handling', () => {
  it('treats hue as circular: 359° and 1° are 2° apart, so matching is continuous across 0°', () => {
    expect(hueDifference(359, 1)).toBeCloseTo(2, 12)
    const at = (hue: number) => { const angle = hue * Math.PI / 180; return { l: .6, a: .12 * Math.cos(angle), b: .12 * Math.sin(angle) } }
    for (const subtype of subtypeOrder) {
      const below = matchPhotoColor(sampleAt(at(359)), subtype)
      const above = matchPhotoColor(sampleAt(at(1)), subtype)
      // 2° at chroma 0.12 is a chord of 0.0042; a 358° reading would be ~0.24.
      expect(Math.abs(above.nearest.distance - below.nearest.distance)).toBeLessThanOrEqual(.0042)
      if (above.nearest.color === below.nearest.color && above.difference.hue !== null) expect(above.difference.hue - below.difference.hue!).toBeCloseTo(2, 6)
    }
  })

  it.each(subtypeOrder)('%s: hue noise on a near-neutral grey never changes the guidance', (subtype) => {
    for (const l of [.35, .6, .85]) {
      const results = Array.from({ length: 24 }, (_, step) => {
        const angle = step * 15 * Math.PI / 180
        return matchPhotoColor(sampleAt({ l, a: .008 * Math.cos(angle), b: .008 * Math.sin(angle) }), subtype)
      })
      results.forEach((result) => {
        expect(result.category).toBe(results[0].category)
        expect(result.nearest.color).toBe(results[0].nearest.color)
        expect(result.nearest.distance).toBeCloseTo(results[0].nearest.distance, 12)
        expect(result.difference.hue).toBeNull()
        expect(result.direction).not.toContain('warmer')
        expect(result.direction).not.toContain('cooler')
        expect(result.descriptors.clarity).toBe('soft')
      })
    }
  })

  it('reports hue difference and warmer/cooler only when both colors have real chroma', () => {
    const shifted = rotateHue(20)(oklabOf(palettes['warm-spring'].best[0]))
    const chromatic = matchPhotoColor(sampleAt(shifted), 'warm-spring')
    expect(chromatic.difference.hue).toBeCloseTo(hueDifference(oklabHue(oklabOf(chromatic.nearest.color)), oklabHue(shifted)), 9)
    const greyish = matchPhotoColor(sampleAt({ l: .5, a: NEUTRAL_CHROMA_MAX / 2, b: 0 }), 'warm-spring')
    expect(greyish.difference.hue).toBeNull()
  })

  it.each([
    ['white', '#FFFFFF'], ['off-white', '#F5F2EA'], ['mid grey', '#808080'], ['charcoal', '#3A3A3A'], ['near black', '#111111'],
    ['beige', '#C8B8A0'], ['taupe', '#8B7D70'],
  ])('%s is judged by lightness and chroma, never by an unstable hue (%s)', (_, hex) => {
    for (const subtype of subtypeOrder) {
      const result = match(hex, subtype)
      expect(result.difference.hue === null || oklabChroma(result.oklab) >= NEUTRAL_CHROMA_MAX).toBe(true)
      if (result.difference.hue === null) {
        expect(result.direction).not.toContain('warmer')
        expect(result.direction).not.toContain('cooler')
      }
    }
  })

  it('photographed whites follow each palette: an Easy neutral where white is curated, away-from-face where it is Harder', () => {
    expect(match('#FFFFFF', 'cool-winter').category).toBe('neutral-base')
    expect(match('#FFFFFF', 'clear-winter').category).toBe('neutral-base')
    for (const subtype of ['warm-spring', 'soft-summer', 'soft-autumn', 'warm-autumn'] as const) {
      const result = match('#FFFFFF', subtype)
      expect(result.category).toBe('away-from-face')
      expect(result.resembles?.color.name).toBe('Optic White')
    }
    // A slightly warm off-white is still judged, not rejected.
    expect(POSITIVE).toContain(match('#F5F2EA', 'light-summer').category)
  })
})

describe('photo match — direction and descriptors', () => {
  it('darker, lighter, more muted, brighter, warmer and cooler versions are explained in that direction', () => {
    const checked: Record<string, number> = {}
    for (const subtype of subtypeOrder) {
      for (const color of [...palettes[subtype].best, ...palettes[subtype].accents]) {
        const base = oklabOf(color)
        const cases: [OKLab, string][] = [[{ ...base, l: base.l - .2 }, 'deeper'], [{ ...base, l: base.l + .2 }, 'lighter'], [scaleChroma(1.6)(base), 'brighter']]
        if (oklabChroma(base) > .1) cases.push([scaleChroma(.55)(base), 'muted'])
        // Rotate 25° toward / away from the warm pole, only where that does not cross a pole.
        const fromPole = hueDifference(70, oklabHue(base))
        if (oklabChroma(base) > .08 && Math.abs(fromPole) > 25 && Math.abs(fromPole) < 155) {
          const toward = -Math.sign(fromPole)
          cases.push([rotateHue(25 * toward)(base), 'warmer'], [rotateHue(-25 * toward)(base), 'cooler'])
        }
        for (const [shifted, expected] of cases) {
          const result = matchPhotoColor(sampleAt(shifted), subtype)
          // Only judge cases still explained relative to the original color and not "close".
          if (result.nearest.color !== color || CLOSE.includes(result.category)) continue
          expect({ color: color.id, expected, direction: result.direction }).toEqual({ color: color.id, expected, direction: expect.arrayContaining([expected]) })
          expect(result.direction.length).toBeLessThanOrEqual(2)
          checked[expected] = (checked[expected] ?? 0) + 1
        }
      }
    }
    for (const direction of ["deeper", "lighter", "muted", "brighter", "warmer", "cooler"]) expect(checked[direction]).toBeGreaterThanOrEqual(5)
  })

  it('has no direction for close categories', () => {
    const shifted = oklabOf(palettes['warm-spring'].best[0])
    expect(matchPhotoColor(sampleAt({ ...shifted, l: shifted.l - .07 }), 'warm-spring').direction).toEqual([])
  })

  it('describes value (light/medium/deep) and clarity (soft/moderate/clear) from OKLab', () => {
    expect(match('#808080', 'soft-summer').descriptors).toEqual({ value: 'medium', clarity: 'soft' })
    expect(match('#E02582', 'clear-winter').descriptors).toEqual({ value: 'medium', clarity: 'clear' })
    expect(match('#B9828F', 'soft-summer').descriptors.clarity).toBe('moderate')
    expect(matchPhotoColor(sampleAt({ l: LIGHT_VALUE_MIN, a: 0, b: 0 }), 'soft-summer').descriptors.value).toBe('light')
    expect(matchPhotoColor(sampleAt({ l: DEEP_VALUE_MAX, a: 0, b: 0 }), 'soft-summer').descriptors.value).toBe('deep')
    expect(matchPhotoColor(sampleAt({ l: (LIGHT_VALUE_MIN + DEEP_VALUE_MAX) / 2, a: 0, b: 0 }), 'soft-summer').descriptors.value).toBe('medium')
  })
})

// Anchors: each curated color classifies as its own group. Perturbation tables below are the real calibration.
describe('photo match — 12-subtype calibration table', () => {
  it.each(subtypeOrder)('%s: curated colors land in their own relationship', (subtype) => {
    const palette = palettes[subtype]
    palette.best.concat(palette.accents).forEach((color) => expect(match(color.hex, subtype).category).toBe('near-face'))
    palette.neutrals.forEach((color) => expect(match(color.hex, subtype).category).toBe('neutral-base'))
    palette.harder.forEach((color) => {
      const result = match(color.hex, subtype)
      expect(result.category).toBe('away-from-face')
      expect(result.resembles).toEqual({ color, distance: 0 })
      expect(result.nearest.distance).toBeGreaterThan(PHOTO_CLOSE_DISTANCE)
    })
  })

  it.each(subtypeOrder)('%s: modest photo variation keeps Best/Accent/Neutral colors positive', (subtype) => {
    const palette = palettes[subtype]
    for (const [name, transform] of Object.entries(MODEST)) {
      for (const color of [...palette.best, ...palette.accents, ...palette.neutrals]) {
        const result = matchPhotoColor(sampleOf(transform(hexToRgb(color.hex)!)), subtype)
        expect({ transform: name, color: color.name, category: result.category }).toEqual({ transform: name, color: color.name, category: expect.toBeOneOf(POSITIVE) })
      }
    }
  })

  it('modest photo variation never turns a Harder color into near-face, and mostly keeps it away-from-face', () => {
    let total = 0
    let away = 0
    for (const subtype of subtypeOrder) {
      for (const transform of Object.values(MODEST)) {
        for (const color of palettes[subtype].harder) {
          const category = matchPhotoColor(sampleOf(transform(hexToRgb(color.hex)!)), subtype).category
          expect(category).not.toBe('near-face')
          total++
          if (category === 'away-from-face') away++
        }
      }
    }
    expect(total).toBe(480)
    expect(away / total).toBeGreaterThanOrEqual(.97)
  })

  it('stronger exposure (±25%) degrades gracefully: at most one step, never positive → away', () => {
    const moved: string[] = []
    for (const subtype of subtypeOrder) {
      for (const factor of [.75, 1.25]) {
        const palette = palettes[subtype]
        for (const color of [...palette.best, ...palette.accents]) {
          const category = matchPhotoColor(sampleOf(gain(factor, factor, factor)(hexToRgb(color.hex)!)), subtype).category
          if (!POSITIVE.includes(category)) moved.push(`${subtype}/${color.name}→${category}`)
        }
      }
    }
    expect(moved).toEqual([])
  })
})

describe('photo match — strong mismatches (chosen from measured palette properties)', () => {
  // Per-subtype mean of Best + Accent colors, measured from the curated data rather than season names.
  const measured = subtypeOrder.map((subtype) => {
    const colors = [...palettes[subtype].best, ...palettes[subtype].accents].map(oklabOf)
    const mean = (value: (color: OKLab) => number) => colors.reduce((total, color) => total + value(color), 0) / colors.length
    const warmth = (color: OKLab) => oklabChroma(color) < NEUTRAL_CHROMA_MAX ? 90 : 180 - Math.abs((oklabHue(color) - 70 + 540) % 360 - 180)
    return { subtype, lightness: mean((color) => color.l), chroma: mean(oklabChroma), warmth: mean(warmth) }
  })
  const extremes = (key: 'lightness' | 'chroma' | 'warmth') => {
    const sorted = [...measured].sort((first, second) => first[key] - second[key])
    return [sorted[0].subtype, sorted[sorted.length - 1].subtype] as const
  }

  it('picks the expected opposed subtypes from the data', () => {
    expect(extremes('lightness')).toEqual(['deep-winter', 'light-spring'])
    expect(extremes('chroma')).toEqual(['soft-summer', 'clear-winter'])
    expect(extremes('warmth')).toEqual(['cool-summer', 'warm-autumn'])
  })

  it.each(['lightness', 'chroma', 'warmth'] as const)('%s: an opposed subtype\'s Best colors are mostly away-from-face or outside', (key) => {
    const [low, high] = extremes(key)
    for (const [from, into] of [[low, high], [high, low]] as const) {
      const categories = palettes[from].best.map((color) => match(color.hex, into).category)
      expect(categories.filter((category) => category === 'near-face').length).toBeLessThanOrEqual(1)
      expect(categories.filter((category) => category === 'away-from-face' || category === 'outside').length).toBeGreaterThanOrEqual(5)
    }
  })

  it('muted vs vivid: soft-summer Best colors are never near-face for clear-winter; clear-winter Best colors are never close for soft-summer', () => {
    // A greyed soft-summer blue can honestly read as clear-winter's Cool Grey neutral, so neutral-base is allowed there.
    palettes['soft-summer'].best.forEach((color) => expect(match(color.hex, 'clear-winter').category).not.toBe('near-face'))
    palettes['clear-winter'].best.forEach((color) => expect(CLOSE).not.toContain(match(color.hex, 'soft-summer').category))
  })
})

describe('photo match — threshold boundaries (inclusive, float-safe)', () => {
  // Offsets along +a from a palette color whose surroundings are empty far enough for the test.
  function isolatedAnchor(group: 'best' | 'harder') {
    for (const subtype of subtypeOrder) {
      const palette = palettes[subtype]
      for (const anchor of palette[group]) {
        const base = oklabOf(anchor)
        const probe = { ...base, a: base.a + PHOTO_RELATED_DISTANCE + .01 }
        const others = [...palette.best, ...palette.accents, ...palette.neutrals, ...palette.harder].filter((color) => color !== anchor)
        const clear = others.every((color) => {
          const other = oklabOf(color)
          const distanceAt = (point: OKLab) => Math.sqrt((.5 * (point.l - other.l)) ** 2 + (point.a - other.a) ** 2 + (point.b - other.b) ** 2)
          return [0, .25, .5, .75, 1].every((t) => distanceAt({ ...base, a: base.a + t * (probe.a - base.a) }) > PHOTO_RELATED_DISTANCE + .02)
        })
        if (clear) return { subtype, anchor, base }
      }
    }
    throw new Error(`no isolated ${group} anchor`)
  }
  const at = (base: OKLab, offset: number) => ({ ...base, a: base.a + offset })

  it('close / related / outside around a Best color', () => {
    const { subtype, anchor, base } = isolatedAnchor('best')
    const category = (offset: number) => {
      const result = matchPhotoColor(sampleAt(at(base, offset)), subtype)
      expect(result.nearest.color).toBe(anchor)
      return result.category
    }
    expect(Math.abs(matchPhotoColor(sampleAt(at(base, PHOTO_CLOSE_DISTANCE)), subtype).nearest.distance - PHOTO_CLOSE_DISTANCE)).toBeLessThan(1e-12)
    expect(category(PHOTO_CLOSE_DISTANCE - 1e-6)).toBe('near-face')
    expect(category(PHOTO_CLOSE_DISTANCE)).toBe('near-face')
    expect(category(PHOTO_CLOSE_DISTANCE + 1e-6)).toBe('related')
    expect(category(PHOTO_RELATED_DISTANCE - 1e-6)).toBe('related')
    expect(category(PHOTO_RELATED_DISTANCE)).toBe('related')
    expect(category(PHOTO_RELATED_DISTANCE + 1e-6)).toBe('outside')
  })

  it('away-from-face / outside around a Harder color, with resembles only while close', () => {
    const { subtype, anchor, base } = isolatedAnchor('harder')
    const result = (offset: number) => matchPhotoColor(sampleAt(at(base, offset)), subtype)
    expect(result(PHOTO_CLOSE_DISTANCE + 1e-6).category).toBe('away-from-face')
    expect(result(PHOTO_RELATED_DISTANCE).category).toBe('away-from-face')
    expect(result(PHOTO_RELATED_DISTANCE).resembles?.color).toBe(anchor)
    expect(result(PHOTO_RELATED_DISTANCE + 1e-6).category).toBe('outside')
    expect(result(PHOTO_RELATED_DISTANCE + 1e-6).resembles).toBeNull()
  })

  it('never names a far-away Harder color (fixes the manual checker\'s "closer to Black")', () => {
    const grey = match('#808080', 'warm-spring')
    expect(checkColor('#808080', 'warm-spring')!.reason.referenceColor?.name).toBe('Blue Grey')
    if (grey.resembles) expect(grey.resembles.distance).toBeLessThanOrEqual(PHOTO_RELATED_DISTANCE)
    const green = match('#3C9A5A', 'light-spring')
    expect(green.resembles).toBeNull()
  })
})

describe('photo match — sampling warnings', () => {
  it.each<SampleFlag[]>([['mixed'], ['highlight'], ['shadow'], ['mixed', 'highlight']])('%s is carried through without changing the guidance', (...flags) => {
    for (const subtype of subtypeOrder) {
      for (const hex of ['#E9785D', '#808080', '#FFFFFF', '#1756C4']) {
        const plain = matchPhotoColor(sampleHex(hex), subtype)
        const flagged = matchPhotoColor(sampleHex(hex, flags), subtype)
        expect(flagged.warnings).toEqual(flags)
        expect({ ...flagged, warnings: [] }).toEqual(plain)
      }
    }
  })
})

describe('photo match — pairing suggestions reuse', () => {
  it.each(subtypeOrder)('%s: pairWith is exactly the manual checker\'s pairing suggestions', (subtype) => {
    for (const hex of ['#E9785D', '#808080', '#FFFFFF', '#101010', palettes[subtype].best[3].hex, palettes[subtype].harder[0].hex]) {
      const result: PhotoColorMatch = match(hex, subtype)
      expect(result.pairWith).toEqual(pairingSuggestions(hex, subtype))
      expect(result.pairWith).toEqual(checkColor(hex, subtype)!.pairWith)
    }
  })
})

describe('photo match — module boundaries', () => {
  it('is pure: no DOM, image, storage or manual-checker scoring dependencies', () => {
    const imports = [...photoMatchSource.matchAll(/from '([^']+)'/g)].map((found) => found[1]).sort()
    expect(imports).toEqual(['../personalColor/colorMatch', '../personalColor/colorUtils', '../personalColor/colorUtils', '../personalColor/palettes', '../personalColor/types', './types'])
    for (const token of ['document', 'window', 'canvas', 'File', 'fetch', 'localStorage', 'checkColor', 'Math.exp', 'seasonDefinitions']) {
      expect(photoMatchSource).not.toMatch(new RegExp(`\\b${token.replace('.', '\\.')}\\b`))
    }
  })
})
