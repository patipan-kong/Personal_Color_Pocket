import { describe, expect, it } from 'vitest'
import { colorDistance, hexToOklab, normalizeHex, rgbToHex, rgbToOklab } from '../personalColor/colorUtils'
import type { RGB } from '../personalColor/colorUtils'
import {
  CLIPPED_FRACTION_WARN, DEFAULT_SAMPLE_RADIUS, MIN_OPAQUE_ALPHA, MIN_USABLE_PIXELS, MIXED_SPREAD, samplePhotoRegion,
} from './sampling'
import type { ImagePoint, PhotoColorSample, PhotoSampleResult, PixelSource, SampleOptions } from './types'
import samplingSource from './sampling.ts?raw'

type Rgba = [number, number, number, number?]

function makePixels(width: number, height: number, pixel: (col: number, row: number) => Rgba): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const [r, g, b, a = 255] = pixel(col, row)
      data.set([r, g, b, a], (row * width + col) * 4)
    }
  }
  return { width, height, data }
}

const solid = (width: number, height: number, { r, g, b }: RGB, a = 255) => makePixels(width, height, () => [r, g, b, a])

// Deterministic PRNG (mulberry32) so noisy fixtures are identical on every run.
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Independent reference for the disc contract: every in-bounds pixel whose CENTER is within r.
function referenceDiscCount(width: number, height: number, { x, y }: ImagePoint, radius: number) {
  let count = 0
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) if ((col + .5 - x) ** 2 + (row + .5 - y) ** 2 <= radius ** 2) count++
  }
  return count
}

function colorOf(result: PhotoSampleResult): PhotoColorSample {
  expect(result.kind).toBe('color')
  return result as PhotoColorSample
}

const deltaE = (sample: PhotoColorSample, rgb: RGB) => colorDistance(sample.oklab, rgbToOklab(rgb))

const FABRIC: RGB = { r: 184, g: 92, b: 70 } // terracotta
const W = 160
const H = 120
const CENTER = { x: 80, y: 60 }

describe('photo sampling — coordinate contract', () => {
  it('includes exactly the pixels whose centers lie within the radius (boundary inclusive)', () => {
    const image = solid(10, 10, FABRIC)
    // (5.5, 5.5) is the center of pixel (5,5); radius 1 reaches the 4 orthogonal neighbours' centers.
    expect(colorOf(samplePhotoRegion(image, { x: 5.5, y: 5.5 }, { radius: 1 })).diagnostics.regionPixelCount).toBe(5)
    // (5, 5) is a pixel corner: 4 centers are √0.5 away and the next 8 are √2.5 ≈ 1.58 away.
    expect(samplePhotoRegion(image, { x: 5, y: 5 }, { radius: 1.58 })).toEqual({ kind: 'unavailable', reason: 'insufficient-pixels' }) // 4 px
    expect(colorOf(samplePhotoRegion(image, { x: 5, y: 5 }, { radius: 1.59 })).diagnostics.regionPixelCount).toBe(12)
  })

  it('matches the reference disc for fractional points and several radii', () => {
    const image = solid(W, H, FABRIC)
    for (const point of [CENTER, { x: 33.25, y: 17.8 }, { x: .1, y: 119.9 }]) {
      for (const radius of [2.5, 3, 7.3, DEFAULT_SAMPLE_RADIUS, 48]) {
        expect(colorOf(samplePhotoRegion(image, point, { radius })).diagnostics.regionPixelCount)
          .toBe(referenceDiscCount(W, H, point, radius))
      }
    }
  })

  it('samples only the disc: pixels outside it never influence the color', () => {
    const inside: RGB = { r: 40, g: 110, b: 90 }
    const radius = 12
    const image = makePixels(W, H, (col, row) =>
      (col + .5 - CENTER.x) ** 2 + (row + .5 - CENTER.y) ** 2 <= radius ** 2 ? [inside.r, inside.g, inside.b] : [250, 0, 250])
    const sample = colorOf(samplePhotoRegion(image, CENTER, { radius }))
    expect(sample.rgb).toEqual(inside)
    expect(sample.diagnostics.spread).toBe(0)
  })

  it('uses image axes: x grows to the right, y grows downward, origin top-left', () => {
    const image = makePixels(W, H, (col, row) => [col < W / 2 ? 200 : 20, row < H / 2 ? 200 : 20, 100])
    expect(colorOf(samplePhotoRegion(image, { x: 20, y: 20 }, { radius: 5 })).rgb).toEqual({ r: 200, g: 200, b: 100 })
    expect(colorOf(samplePhotoRegion(image, { x: 140, y: 20 }, { radius: 5 })).rgb).toEqual({ r: 20, g: 200, b: 100 })
    expect(colorOf(samplePhotoRegion(image, { x: 20, y: 100 }, { radius: 5 })).rgb).toEqual({ r: 200, g: 20, b: 100 })
    expect(colorOf(samplePhotoRegion(image, { x: 140, y: 100 }, { radius: 5 })).rgb).toEqual({ r: 20, g: 20, b: 100 })
  })
})

describe('photo sampling — region clipping and edges', () => {
  const image = solid(W, H, FABRIC)

  it.each([
    ['center', CENTER],
    ['top-left', { x: 0, y: 0 }],
    ['top-right', { x: W, y: 0 }],
    ['bottom-left', { x: 0, y: H }],
    ['bottom-right', { x: W, y: H }],
    ['left edge', { x: 0, y: 60 }],
    ['bottom edge', { x: 80, y: H }],
  ])('%s: clips the disc to the image and still samples', (_name, point) => {
    const sample = colorOf(samplePhotoRegion(image, point, { radius: 10 }))
    expect(sample.rgb).toEqual(FABRIC)
    expect(sample.diagnostics.regionPixelCount).toBe(referenceDiscCount(W, H, point, 10))
  })

  it('a corner tap sees roughly a quarter of the disc', () => {
    const full = colorOf(samplePhotoRegion(image, CENTER, { radius: 10 })).diagnostics.regionPixelCount
    const corner = colorOf(samplePhotoRegion(image, { x: 0, y: 0 }, { radius: 10 })).diagnostics.regionPixelCount
    expect(corner / full).toBeCloseTo(.25, 1)
  })

  it.each([
    { x: -.01, y: 60 }, { x: W + .01, y: 60 }, { x: 80, y: -1 }, { x: 80, y: H + 5 }, { x: -50, y: -50 },
  ])('a point outside [0,width]×[0,height] (%o) is unavailable, not an error', (point) => {
    expect(samplePhotoRegion(image, point)).toEqual({ kind: 'unavailable', reason: 'outside-image' })
  })

  it('a radius larger than the image samples the whole image', () => {
    const sample = colorOf(samplePhotoRegion(solid(10, 10, FABRIC), { x: 5, y: 5 }, { radius: 500 }))
    expect(sample.diagnostics.regionPixelCount).toBe(100)
    expect(sample.rgb).toEqual(FABRIC)
  })

  it('a 1×1 image has too few pixels to sample', () => {
    expect(samplePhotoRegion(solid(1, 1, FABRIC), { x: .5, y: .5 }, { radius: 3 }))
      .toEqual({ kind: 'unavailable', reason: 'insufficient-pixels' })
    expect(samplePhotoRegion(solid(1, 1, FABRIC, 0), { x: .5, y: .5 }, { radius: 3 }))
      .toEqual({ kind: 'unavailable', reason: 'transparent' })
  })

  it('narrow images (1 px wide / 1 px tall) clip to a line of pixels', () => {
    const tall = colorOf(samplePhotoRegion(solid(1, 200, FABRIC), { x: .5, y: 100 }, { radius: 24 }))
    expect(tall.diagnostics.regionPixelCount).toBe(referenceDiscCount(1, 200, { x: .5, y: 100 }, 24))
    expect(tall.rgb).toEqual(FABRIC)
    const wide = colorOf(samplePhotoRegion(solid(300, 1, FABRIC), { x: 299, y: 1 }, { radius: 24 }))
    expect(wide.diagnostics.regionPixelCount).toBe(referenceDiscCount(300, 1, { x: 299, y: 1 }, 24))
  })

  it('never reads outside the buffer, and only reads inside the disc\'s bounding box', () => {
    const big = solid(1600, 1200, FABRIC)
    for (const point of [{ x: 800, y: 600 }, { x: 0, y: 0 }, { x: 1600, y: 1200 }, { x: 1600, y: 0 }]) {
      const reads: number[] = []
      const data = new Proxy(big.data, {
        get(target, property) {
          if (typeof property === 'string' && /^\d+$/.test(property)) reads.push(Number(property))
          return Reflect.get(target, property)
        },
      })
      colorOf(samplePhotoRegion({ ...big, data }, point, { radius: 24 }))
      const box = 50 * 50 * 4 // ⌈2r⌉+2 pixels per side, 4 bytes each
      expect(reads.length).toBeGreaterThan(0)
      expect(reads.length).toBeLessThanOrEqual(box)
      expect(Math.min(...reads)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...reads)).toBeLessThan(big.data.length)
      reads.forEach((index) => {
        const pixel = Math.floor(index / 4)
        expect(Math.abs((pixel % 1600) + .5 - point.x)).toBeLessThanOrEqual(25)
        expect(Math.abs(Math.floor(pixel / 1600) + .5 - point.y)).toBeLessThanOrEqual(25)
      })
    }
  })
})

describe('photo sampling — programming-contract violations throw', () => {
  const image = solid(4, 4, FABRIC)
  it.each<[string, PixelSource]>([
    ['zero-size image', { width: 0, height: 0, data: new Uint8ClampedArray(0) }],
    ['non-integer size', { width: 2.5, height: 4, data: new Uint8ClampedArray(40) }],
    ['buffer too short', { width: 4, height: 4, data: new Uint8ClampedArray(63) }],
    ['buffer too long', { width: 4, height: 4, data: new Uint8ClampedArray(68) }],
  ])('%s', (_name, source) => {
    expect(() => samplePhotoRegion(source, { x: 1, y: 1 })).toThrow(RangeError)
  })
  it.each<[string, ImagePoint, SampleOptions]>([
    ['NaN point', { x: Number.NaN, y: 1 }, {}],
    ['infinite point', { x: 1, y: Number.POSITIVE_INFINITY }, {}],
    ['radius below 1', { x: 1, y: 1 }, { radius: .5 }],
    ['NaN radius', { x: 1, y: 1 }, { radius: Number.NaN }],
    ['trim of half', { x: 1, y: 1 }, { trimFraction: .5 }],
    ['negative trim', { x: 1, y: 1 }, { trimFraction: -.1 }],
  ])('%s', (_name, point, options) => {
    expect(() => samplePhotoRegion(image, point, options)).toThrow(RangeError)
  })
})

describe('photo sampling — lightness trimming and small samples', () => {
  // A 1×n strip of distinct greys 0..n-1, sampled whole.
  const ramp = (n: number) => makePixels(1, n, (_col, row) => [row, row, row])
  const whole = (n: number, options: SampleOptions = {}) => samplePhotoRegion(ramp(n), { x: .5, y: n / 2 }, { radius: n, ...options })

  it('0 usable pixels → transparent', () => {
    expect(samplePhotoRegion(solid(1, 4, FABRIC, 0), { x: .5, y: 2 }, { radius: 4 }))
      .toEqual({ kind: 'unavailable', reason: 'transparent' })
  })

  it.each([1, 2, 3, 4])('%i usable pixel(s) → insufficient-pixels (never a single-pixel answer)', (n) => {
    expect(n).toBeLessThan(MIN_USABLE_PIXELS)
    expect(whole(n)).toEqual({ kind: 'unavailable', reason: 'insufficient-pixels' })
  })

  it('5 pixels: drops exactly one darkest and one brightest', () => {
    const image = makePixels(1, 5, (_col, row) => [[10, 50, 100, 150, 200][row], [10, 50, 100, 150, 200][row], [10, 50, 100, 150, 200][row]])
    const sample = colorOf(samplePhotoRegion(image, { x: .5, y: 2.5 }, { radius: 5 }))
    expect(sample.diagnostics.retainedPixelCount).toBe(3)
    expect(sample.hex).toBe('#646464')
  })

  it('trims symmetrically and always keeps pixels, for every count from 5 to 200', () => {
    for (let n = 5; n <= 200; n++) {
      const sample = colorOf(whole(n))
      const cut = Math.floor(n * .2)
      expect(sample.diagnostics.opaquePixelCount).toBe(n)
      expect(sample.diagnostics.retainedPixelCount).toBe(n - 2 * cut)
      expect(sample.diagnostics.retainedPixelCount).toBeGreaterThan(0)
      // Symmetric trim of a symmetric ramp keeps its midpoint.
      expect(sample.rgb.r).toBe(Math.round((n - 1) / 2))
    }
  })

  it('trimFraction 0 is a plain mean; a larger trim keeps fewer pixels', () => {
    expect(colorOf(whole(100, { trimFraction: 0 })).diagnostics.retainedPixelCount).toBe(100)
    expect(colorOf(whole(100, { trimFraction: .3 })).diagnostics.retainedPixelCount).toBe(40)
    expect(colorOf(whole(100, { trimFraction: .49 })).diagnostics.retainedPixelCount).toBe(2)
  })

  it('large regions on a 1600×1200 working image stay exact for a solid color', () => {
    const sample = colorOf(samplePhotoRegion(solid(1600, 1200, FABRIC), { x: 800, y: 600 }, { radius: 48 }))
    expect(sample.diagnostics.regionPixelCount).toBe(referenceDiscCount(1600, 1200, { x: 800, y: 600 }, 48))
    expect(sample.diagnostics.regionPixelCount).toBeGreaterThan(7000)
    expect(sample.rgb).toEqual(FABRIC)
  })
})

describe('photo sampling — transparency', () => {
  const BLUE: RGB = { r: 51, g: 102, b: 204 }

  it('fully opaque region: every region pixel is considered', () => {
    const sample = colorOf(samplePhotoRegion(solid(W, H, BLUE), CENTER, { radius: 10 }))
    expect(sample.diagnostics.opaquePixelCount).toBe(sample.diagnostics.regionPixelCount)
  })

  it('fully transparent region → transparent', () => {
    expect(samplePhotoRegion(solid(W, H, BLUE, 0), CENTER)).toEqual({ kind: 'unavailable', reason: 'transparent' })
  })

  it('mostly transparent region → transparent', () => {
    const image = makePixels(W, H, (col) => (col < 70 ? [BLUE.r, BLUE.g, BLUE.b] : [0, 0, 0, 0]))
    expect(samplePhotoRegion(image, CENTER, { radius: 20 })).toEqual({ kind: 'unavailable', reason: 'transparent' })
  })

  it('opaque subject next to transparent black: transparent pixels are ignored, not read as black', () => {
    const image = makePixels(W, H, (col) => (col < 84 ? [BLUE.r, BLUE.g, BLUE.b] : [0, 0, 0, 0]))
    const sample = colorOf(samplePhotoRegion(image, CENTER, { radius: 10 }))
    expect(sample.rgb).toEqual(BLUE)
    expect(sample.diagnostics.opaquePixelCount).toBeLessThan(sample.diagnostics.regionPixelCount)
    expect(sample.diagnostics.shadowFraction).toBe(0)
  })

  it('partially transparent pixels below the alpha threshold are ignored', () => {
    const image = makePixels(W, H, (col, row) => ((col + row) % 4 === 0 ? [255, 0, 0, 128] : [BLUE.r, BLUE.g, BLUE.b]))
    expect(colorOf(samplePhotoRegion(image, CENTER, { radius: 10 })).rgb).toEqual(BLUE)
  })

  it(`alpha ${MIN_OPAQUE_ALPHA} counts as opaque, ${MIN_OPAQUE_ALPHA - 1} does not`, () => {
    const region = { radius: 5 }
    expect(colorOf(samplePhotoRegion(solid(W, H, BLUE, MIN_OPAQUE_ALPHA), CENTER, region)).rgb).toEqual(BLUE)
    expect(samplePhotoRegion(solid(W, H, BLUE, MIN_OPAQUE_ALPHA - 1), CENTER, region).kind).toBe('unavailable')
  })
})

describe('photo sampling — fabric, texture and patterns', () => {
  it('solid fabric: exact color, zero spread, no flags', () => {
    const sample = colorOf(samplePhotoRegion(solid(W, H, FABRIC), CENTER))
    expect(sample.rgb).toEqual(FABRIC)
    expect(sample.diagnostics.spread).toBe(0)
    expect(sample.diagnostics.flags).toEqual([])
  })

  it('subtle texture (seeded ±12 sensor/JPEG-like noise) stays within 0.01 ΔE_OK and is not mixed', () => {
    const random = seeded(7)
    const noise = () => Math.round((random() * 2 - 1) * 12)
    const image = makePixels(W, H, () => [FABRIC.r + noise(), FABRIC.g + noise(), FABRIC.b + noise()])
    const sample = colorOf(samplePhotoRegion(image, CENTER))
    expect(deltaE(sample, FABRIC)).toBeLessThan(.01)
    expect(sample.diagnostics.flags).not.toContain('mixed')
  })

  it('knit-like texture (alternating slightly darker rows) is not mixed', () => {
    const image = makePixels(W, H, (_col, row) => (row % 2 ? [166, 83, 63] : [FABRIC.r, FABRIC.g, FABRIC.b]))
    const sample = colorOf(samplePhotoRegion(image, CENTER))
    expect(sample.diagnostics.flags).toEqual([])
    expect(deltaE(sample, FABRIC)).toBeLessThan(.03)
  })

  it('a thin dark pinstripe (1 column in 8) is trimmed away and not reported as mixed', () => {
    const image = makePixels(W, H, (col) => (col % 8 === 0 ? [25, 25, 40] : [FABRIC.r, FABRIC.g, FABRIC.b]))
    const sample = colorOf(samplePhotoRegion(image, CENTER))
    expect(sample.rgb).toEqual(FABRIC)
    expect(sample.diagnostics.flags).toEqual([])
  })

  it('strong two-color stripes are flagged mixed, and the blend is not passed off as either stripe', () => {
    const navy: RGB = { r: 30, g: 40, b: 90 }
    const cream: RGB = { r: 235, g: 225, b: 200 }
    const image = makePixels(W, H, (col) => (Math.floor(col / 4) % 2 ? [navy.r, navy.g, navy.b] : [cream.r, cream.g, cream.b]))
    const sample = colorOf(samplePhotoRegion(image, CENTER))
    expect(sample.diagnostics.flags).toContain('mixed')
    expect(sample.diagnostics.spread).toBeGreaterThan(MIXED_SPREAD)
    expect(deltaE(sample, navy)).toBeGreaterThan(.1)
    expect(deltaE(sample, cream)).toBeGreaterThan(.1)
  })

  it('stripes of equal lightness but different hue are still mixed (trimming on L cannot hide them)', () => {
    const red: RGB = { r: 190, g: 70, b: 70 }
    const green = { r: 50, g: 130, b: 70 }
    expect(Math.abs(rgbToOklab(red).l - rgbToOklab(green).l)).toBeLessThan(.03)
    const image = makePixels(W, H, (col) => (Math.floor(col / 3) % 2 ? [red.r, red.g, red.b] : [green.r, green.g, green.b]))
    expect(colorOf(samplePhotoRegion(image, CENTER)).diagnostics.flags).toContain('mixed')
  })

  it('a high-contrast fine check is mixed', () => {
    const image = makePixels(W, H, (col, row) => ((col + row) % 2 ? [20, 20, 24] : [238, 236, 230]))
    expect(colorOf(samplePhotoRegion(image, CENTER)).diagnostics.flags).toContain('mixed')
  })
})

describe('photo sampling — highlights and shadows', () => {
  // Each pixel independently: shadow with probability pShadow, highlight with pHighlight, else fabric.
  function speckled(pShadow: number, pHighlight: number, shadow: RGB = { r: 30, g: 16, b: 12 }, highlight: RGB = { r: 252, g: 250, b: 248 }) {
    const random = seeded(42)
    return makePixels(W, H, () => {
      const roll = random()
      const { r, g, b } = roll < pShadow ? shadow : roll < pShadow + pHighlight ? highlight : FABRIC
      return [r, g, b]
    })
  }

  it.each([
    ['15% shadow', .15, 0],
    ['15% highlight', 0, .15],
    ['15% shadow and 15% highlight', .15, .15],
  ])('%s: minority extremes are trimmed and do not move the fabric color', (_name, pShadow, pHighlight) => {
    const sample = colorOf(samplePhotoRegion(speckled(pShadow, pHighlight), CENTER))
    expect(sample.rgb).toEqual(FABRIC)
    expect(sample.diagnostics.flags).toEqual([])
  })

  it('without trimming, the same extremes would pull the color well away (why trimming exists)', () => {
    const sample = colorOf(samplePhotoRegion(speckled(.15, .15), CENTER, { trimFraction: 0 }))
    expect(deltaE(sample, FABRIC)).toBeGreaterThan(.03)
  })

  it('majority crushed shadow is flagged shadow', () => {
    const sample = colorOf(samplePhotoRegion(speckled(.6, 0, { r: 2, g: 2, b: 3 }), CENTER))
    expect(sample.diagnostics.shadowFraction).toBeGreaterThan(CLIPPED_FRACTION_WARN)
    expect(sample.diagnostics.flags).toContain('shadow')
  })

  it('majority blown highlight is flagged highlight', () => {
    const sample = colorOf(samplePhotoRegion(speckled(0, .6, undefined, { r: 255, g: 255, b: 255 }), CENTER))
    expect(sample.diagnostics.highlightFraction).toBeGreaterThan(CLIPPED_FRACTION_WARN)
    expect(sample.diagnostics.flags).toContain('highlight')
  })

  it('a fully blown region still returns its color, flagged highlight; a fully crushed one is flagged shadow', () => {
    const white = colorOf(samplePhotoRegion(solid(W, H, { r: 255, g: 255, b: 255 }), CENTER))
    expect(white.hex).toBe('#FFFFFF')
    expect(white.diagnostics.flags).toEqual(['highlight'])
    const black = colorOf(samplePhotoRegion(solid(W, H, { r: 0, g: 0, b: 0 }), CENTER))
    expect(black.hex).toBe('#000000')
    expect(black.diagnostics.flags).toEqual(['shadow'])
  })

  it('saturated or genuinely dark fabric is not mistaken for clipping', () => {
    for (const rgb of [{ r: 255, g: 32, b: 32 }, { r: 0, g: 40, b: 255 }, { r: 18, g: 18, b: 22 }, { r: 10, g: 10, b: 40 }]) {
      expect(colorOf(samplePhotoRegion(solid(W, H, rgb), CENTER)).diagnostics.flags).toEqual([])
    }
  })
})

describe('photo sampling — output contract', () => {
  it('hex, rgb and OKLab describe the same color, in the manual checker\'s HEX format', () => {
    const random = seeded(3)
    const image = makePixels(W, H, () => [Math.round(random() * 255), 120, 60])
    const sample = colorOf(samplePhotoRegion(image, CENTER))
    expect(normalizeHex(sample.hex)).toBe(sample.hex)
    expect(sample.hex).toBe(rgbToHex(sample.rgb))
    expect(sample.oklab).toEqual(rgbToOklab(sample.rgb))
    expect(sample.oklab).toEqual(hexToOklab(sample.hex))
  })

  it('carries no score or percentage — sampling does not judge the color', () => {
    const sample = colorOf(samplePhotoRegion(solid(W, H, FABRIC), CENTER))
    expect(Object.keys(sample).sort()).toEqual(['diagnostics', 'hex', 'kind', 'oklab', 'rgb'])
    expect(Object.keys(sample.diagnostics).sort()).toEqual([
      'flags', 'highlightFraction', 'opaquePixelCount', 'regionPixelCount', 'retainedPixelCount', 'shadowFraction', 'spread',
    ])
  })

  it('is deterministic and does not mutate the pixel buffer', () => {
    const random = seeded(11)
    const image = makePixels(W, H, () => [Math.round(random() * 255), Math.round(random() * 255), Math.round(random() * 255)])
    const before = image.data.slice()
    const first = samplePhotoRegion(image, { x: 41.7, y: 88.2 }, { radius: 17 })
    expect(samplePhotoRegion(image, { x: 41.7, y: 88.2 }, { radius: 17 })).toEqual(first)
    expect(image.data).toEqual(before)
  })

  it('defaults to the documented radius and 20% trim', () => {
    const sample = colorOf(samplePhotoRegion(solid(W, H, FABRIC), CENTER))
    const count = referenceDiscCount(W, H, CENTER, DEFAULT_SAMPLE_RADIUS)
    expect(sample.diagnostics.regionPixelCount).toBe(count)
    expect(sample.diagnostics.retainedPixelCount).toBe(count - 2 * Math.floor(count * .2))
  })
})

describe('photo sampling — module boundaries', () => {
  it('is pure: no DOM, canvas, display-coordinate or matching dependencies', () => {
    const imports = [...samplingSource.matchAll(/from '([^']+)'/g)].map((match) => match[1]).sort()
    expect(imports).toEqual(['../personalColor/colorUtils', '../personalColor/colorUtils', './types'])
    for (const token of ['document', 'window', 'canvas', 'getImageData', 'devicePixelRatio', 'getBoundingClientRect', 'palette', 'checkColor']) {
      expect(samplingSource).not.toMatch(new RegExp(`\\b${token}\\b`))
    }
  })

  it('the Personal Color domain never imports photo code', () => {
    const sources = import.meta.glob('../personalColor/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    Object.values(sources).forEach((source) => expect(source).not.toMatch(/photoColor/))
  })
})
