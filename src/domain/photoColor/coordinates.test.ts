import { describe, expect, it } from 'vitest'
import {
  MAX_SAMPLE_RADIUS_FRACTION, MIN_SAMPLE_RADIUS, displayToImage, fitContain, imageLengthToDisplay, imageToDisplay, sampleRadiusFor,
} from './coordinates'
import { DEFAULT_SAMPLE_RADIUS } from './sampling'
import type { DisplayPoint, DisplayRect, DisplayToImageResult, ImagePoint, Size } from './types'
import coordinatesSource from './coordinates.ts?raw'

const LANDSCAPE: Size = { width: 1600, height: 1200 }
const PORTRAIT: Size = { width: 1200, height: 1600 }

function imagePoint(result: DisplayToImageResult): ImagePoint {
  expect(result.kind).toBe('image-point')
  return (result as Extract<DisplayToImageResult, { kind: 'image-point' }>).point
}

const OUTSIDE = { kind: 'outside-displayed-image' }

// Deterministic PRNG (mulberry32), same as the sampling tests: generated cases, no flakiness.
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

// Deterministic mix of working images (as openPhoto produces them) and CSS boxes (incl. fractional).
function generatedCases(count: number) {
  const random = seeded(1204)
  return Array.from({ length: count }, () => {
    const long = random() < .8 ? 1600 : 1 + Math.floor(random() * 1599)
    const short = Math.max(1, Math.round(long * (.2 + random() * .8)))
    const image = random() < .5 ? { width: long, height: short } : { width: short, height: long }
    const container = { width: 1 + random() * 1400, height: 1 + random() * 1000 }
    return { image, container }
  })
}

describe('fitContain — aspect-fit rectangle (object-fit: contain, centered)', () => {
  it.each<[string, Size, Size, DisplayRect]>([
    ['same aspect ratio', LANDSCAPE, { width: 400, height: 300 }, { x: 0, y: 0, width: 400, height: 300 }],
    ['same aspect ratio, larger than the image', LANDSCAPE, { width: 3200, height: 2400 }, { x: 0, y: 0, width: 3200, height: 2400 }],
    ['portrait image in landscape box (pillarbox)', PORTRAIT, { width: 1280, height: 720 }, { x: 370, y: 0, width: 540, height: 720 }],
    ['landscape image in portrait box (letterbox)', LANDSCAPE, { width: 390, height: 500 }, { x: 0, y: 103.75, width: 390, height: 292.5 }],
    ['square image in landscape box', { width: 1000, height: 1000 }, { width: 300, height: 200 }, { x: 50, y: 0, width: 200, height: 200 }],
    ['square image in portrait box', { width: 1000, height: 1000 }, { width: 200, height: 300 }, { x: 0, y: 50, width: 200, height: 200 }],
    ['square image in square box', { width: 1000, height: 1000 }, { width: 250, height: 250 }, { x: 0, y: 0, width: 250, height: 250 }],
    ['landscape image in square box', LANDSCAPE, { width: 400, height: 400 }, { x: 0, y: 50, width: 400, height: 300 }],
    ['portrait image in square box', PORTRAIT, { width: 400, height: 400 }, { x: 50, y: 0, width: 300, height: 400 }],
    ['very small box', LANDSCAPE, { width: 1, height: 1 }, { x: 0, y: .125, width: 1, height: .75 }],
    ['sub-pixel box', PORTRAIT, { width: .5, height: .25 }, { x: .15625, y: 0, width: .1875, height: .25 }],
    ['1×1 image in a wide box', { width: 1, height: 1 }, { width: 10, height: 2 }, { x: 4, y: 0, width: 2, height: 2 }],
  ])('%s', (_, image, container, expected) => {
    expect(fitContain(image, container)).toEqual(expected)
  })

  it.each<[Size, Size, DisplayRect]>([
    // Realistic phone / desktop preview boxes (CSS px).
    [LANDSCAPE, { width: 390, height: 500 }, { x: 0, y: 103.75, width: 390, height: 292.5 }],
    [LANDSCAPE, { width: 430, height: 600 }, { x: 0, y: 138.75, width: 430, height: 322.5 }],
    [LANDSCAPE, { width: 1280, height: 720 }, { x: 160, y: 0, width: 960, height: 720 }],
    [PORTRAIT, { width: 390, height: 500 }, { x: 7.5, y: 0, width: 375, height: 500 }],
    [PORTRAIT, { width: 430, height: 600 }, { x: 0, y: 13.333333333333343, width: 430, height: 573.3333333333333 }],
    [PORTRAIT, { width: 1280, height: 720 }, { x: 370, y: 0, width: 540, height: 720 }],
  ])('realistic: %o in %o', (image, container, expected) => {
    const rect = fitContain(image, container)
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(rect[key]).toBeCloseTo(expected[key], 9)
  })

  it('handles fractional CSS sizes: the binding axis is exact and the aspect ratio is kept', () => {
    const container = { width: 392.72727272727275, height: 512.3636474609375 }
    const landscape = fitContain(LANDSCAPE, container)
    expect(landscape.width).toBe(container.width)
    expect(landscape.height).toBeCloseTo(container.width * .75, 9)
    expect(landscape.y).toBeCloseTo((container.height - container.width * .75) / 2, 9)
    const portrait = fitContain(PORTRAIT, { width: 411.4285583496094, height: 523.4285888671875 })
    expect(portrait.height).toBe(523.4285888671875)
    expect(portrait.width).toBeCloseTo(523.4285888671875 * .75, 9)
    expect(portrait.x).toBeCloseTo((411.4285583496094 - portrait.width) / 2, 9)
  })

  it('gives an empty rect for a container that is not laid out yet', () => {
    expect(fitContain(LANDSCAPE, { width: 0, height: 500 })).toEqual({ x: 0, y: 250, width: 0, height: 0 })
    expect(fitContain(LANDSCAPE, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('never exceeds its container and always binds one axis (generated cases)', () => {
    for (const { image, container } of generatedCases(3000)) {
      const rect = fitContain(image, container)
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.width).toBeLessThanOrEqual(container.width)
      expect(rect.height).toBeLessThanOrEqual(container.height)
      expect(rect.x + rect.width).toBeLessThanOrEqual(container.width * (1 + 1e-15))
      expect(rect.y + rect.height).toBeLessThanOrEqual(container.height * (1 + 1e-15))
      expect(rect.width === container.width || rect.height === container.height).toBe(true)
      expect(rect.width / rect.height).toBeCloseTo(image.width / image.height, 9)
      // Centered on the free axis.
      expect(rect.x * 2 + rect.width).toBeCloseTo(container.width, 9)
      expect(rect.y * 2 + rect.height).toBeCloseTo(container.height, 9)
    }
  })

  it('rejects invalid sizes as programming errors', () => {
    for (const image of [{ width: 0, height: 10 }, { width: 10, height: -1 }, { width: NaN, height: 10 }, { width: 10, height: Infinity }]) {
      expect(() => fitContain(image, { width: 100, height: 100 })).toThrow(RangeError)
    }
    for (const container of [{ width: -1, height: 10 }, { width: 10, height: NaN }, { width: Infinity, height: 10 }]) {
      expect(() => fitContain(LANDSCAPE, container)).toThrow(RangeError)
    }
  })
})

describe('displayToImage — tap mapping and boundaries', () => {
  // 1600×1200 in a 390×500 phone box: drawn at y 103.75 … 396.25, x 0 … 390.
  const container = { width: 390, height: 500 }
  const rect = fitContain(LANDSCAPE, container)
  const { x, y, width, height } = rect
  const map = (point: DisplayPoint) => displayToImage(point, rect, LANDSCAPE)

  it.each<[string, DisplayPoint, ImagePoint]>([
    ['top-left', { x, y }, { x: 0, y: 0 }],
    ['top-right', { x: x + width, y }, { x: 1600, y: 0 }],
    ['bottom-left', { x, y: y + height }, { x: 0, y: 1200 }],
    ['bottom-right', { x: x + width, y: y + height }, { x: 1600, y: 1200 }],
    ['center', { x: x + width / 2, y: y + height / 2 }, { x: 800, y: 600 }],
    ['left edge, middle', { x, y: y + height / 2 }, { x: 0, y: 600 }],
    ['right edge, middle', { x: x + width, y: y + height / 2 }, { x: 1600, y: 600 }],
    ['top edge, middle', { x: x + width / 2, y }, { x: 800, y: 0 }],
    ['bottom edge, middle', { x: x + width / 2, y: y + height }, { x: 800, y: 1200 }],
    ['quarter point', { x: x + width / 4, y: y + height * .75 }, { x: 400, y: 900 }],
  ])('%s maps into the closed image rectangle', (_, point, expected) => {
    expect(imagePoint(map(point))).toEqual(expected)
  })

  it.each([1e-9, 1e-6, .01, .5, 20])('a tap %s CSS px outside any edge of the photo is outside', (epsilon) => {
    expect(map({ x: x - epsilon, y: y + height / 2 })).toEqual(OUTSIDE)
    expect(map({ x: x + width + epsilon, y: y + height / 2 })).toEqual(OUTSIDE)
    expect(map({ x: x + width / 2, y: y - epsilon })).toEqual(OUTSIDE)
    expect(map({ x: x + width / 2, y: y + height + epsilon })).toEqual(OUTSIDE)
  })

  it('treats the letterbox bands as outside the displayed image', () => {
    for (const point of [{ x: 195, y: 0 }, { x: 195, y: 50 }, { x: 0, y: 103.7 }, { x: 390, y: 396.3 }, { x: 195, y: 499 }, { x: 195, y: 500 }]) {
      expect(map(point)).toEqual(OUTSIDE)
    }
    // Pillarbox: a portrait photo in a desktop box leaves 370 CSS px empty on each side.
    const pillar = fitContain(PORTRAIT, { width: 1280, height: 720 })
    expect(displayToImage({ x: 369.99, y: 360 }, pillar, PORTRAIT)).toEqual(OUTSIDE)
    expect(displayToImage({ x: 910.01, y: 360 }, pillar, PORTRAIT)).toEqual(OUTSIDE)
    expect(imagePoint(displayToImage({ x: 370, y: 360 }, pillar, PORTRAIT))).toEqual({ x: 0, y: 800 })
    expect(imagePoint(displayToImage({ x: 910, y: 720 }, pillar, PORTRAIT))).toEqual({ x: 1200, y: 1600 })
  })

  it('treats a tap on a photo that is not laid out as outside', () => {
    const collapsed = fitContain(LANDSCAPE, { width: 0, height: 500 })
    expect(displayToImage({ x: 0, y: 250 }, collapsed, LANDSCAPE)).toEqual(OUTSIDE)
  })

  it('keeps edge taps inside [0,width]×[0,height] despite floating-point round-off', () => {
    // .1 + .2 = .30000000000000004 and (.30000000000000004 − .1) / .2 > 1.
    const tiny = { x: .1, y: .1, width: .2, height: .2 }
    expect(imagePoint(displayToImage({ x: .1 + .2, y: .1 + .2 }, tiny, { width: 7, height: 7 }))).toEqual({ x: 7, y: 7 })
    for (const { image, container } of generatedCases(1000)) {
      const box = fitContain(image, container)
      const corner = imagePoint(displayToImage({ x: box.x + box.width, y: box.y + box.height }, box, image))
      expect(corner).toEqual({ x: image.width, y: image.height })
      expect(imagePoint(displayToImage({ x: box.x, y: box.y }, box, image))).toEqual({ x: 0, y: 0 })
    }
  })

  it('distinguishes continuous coordinates from pixel indices', () => {
    // 4×2 image drawn 400×200: each image pixel is 100 CSS px. The first pixel's center (0.5, 0.5)
    // is 50 CSS px in, not 0 and not 100; the last pixel's center is (3.5, 1.5).
    const small = { width: 4, height: 2 }
    const drawn = { x: 0, y: 0, width: 400, height: 200 }
    expect(imagePoint(displayToImage({ x: 50, y: 50 }, drawn, small))).toEqual({ x: .5, y: .5 })
    expect(imagePoint(displayToImage({ x: 350, y: 150 }, drawn, small))).toEqual({ x: 3.5, y: 1.5 })
    expect(imagePoint(displayToImage({ x: 400, y: 200 }, drawn, small))).toEqual({ x: 4, y: 2 })
  })

  it('rejects non-finite points and invalid rects as programming errors', () => {
    expect(() => map({ x: NaN, y: 1 })).toThrow(RangeError)
    expect(() => map({ x: 1, y: Infinity })).toThrow(RangeError)
    expect(() => displayToImage({ x: 1, y: 1 }, { x: 0, y: 0, width: -1, height: 1 }, LANDSCAPE)).toThrow(RangeError)
    expect(() => displayToImage({ x: 1, y: 1 }, { x: NaN, y: 0, width: 1, height: 1 }, LANDSCAPE)).toThrow(RangeError)
    expect(() => displayToImage({ x: 1, y: 1 }, rect, { width: 0, height: 1200 })).toThrow(RangeError)
  })
})

describe('realistic previews: box → rect → tap → working-image point', () => {
  it.each<[Size, Size, DisplayPoint, ImagePoint | null]>([
    // [working image, CSS box, tap in box coordinates, expected image point or null = letterbox]
    [LANDSCAPE, { width: 390, height: 500 }, { x: 97.5, y: 176.875 }, { x: 400, y: 300 }],
    [LANDSCAPE, { width: 390, height: 500 }, { x: 195, y: 90 }, null],
    [LANDSCAPE, { width: 430, height: 600 }, { x: 322.5, y: 380.625 }, { x: 1200, y: 900 }],
    [LANDSCAPE, { width: 430, height: 600 }, { x: 215, y: 470 }, null],
    [LANDSCAPE, { width: 1280, height: 720 }, { x: 640, y: 360 }, { x: 800, y: 600 }],
    [LANDSCAPE, { width: 1280, height: 720 }, { x: 1120, y: 720 }, { x: 1600, y: 1200 }],
    [LANDSCAPE, { width: 1280, height: 720 }, { x: 100, y: 360 }, null],
    [PORTRAIT, { width: 390, height: 500 }, { x: 7.5, y: 0 }, { x: 0, y: 0 }],
    [PORTRAIT, { width: 390, height: 500 }, { x: 5, y: 250 }, null],
    [PORTRAIT, { width: 430, height: 600 }, { x: 215, y: 300 }, { x: 600, y: 800 }],
    [PORTRAIT, { width: 1280, height: 720 }, { x: 505, y: 180 }, { x: 300, y: 400 }],
  ])('%o in %o, tap %o', (image, container, tap, expected) => {
    const result = displayToImage(tap, fitContain(image, container), image)
    if (expected === null) {
      expect(result).toEqual(OUTSIDE)
      return
    }
    const point = imagePoint(result)
    expect(point.x).toBeCloseTo(expected.x, 9)
    expect(point.y).toBeCloseTo(expected.y, 9)
  })

  it('maps fractional CSS geometry (e.g. 392.727 px wide at DPR 2.75)', () => {
    const container = { width: 392.72727272727275, height: 523.6363636363636 }
    const rect = fitContain(LANDSCAPE, container)
    const point = imagePoint(displayToImage({ x: rect.x + rect.width * .3, y: rect.y + rect.height * .6 }, rect, LANDSCAPE))
    expect(point.x).toBeCloseTo(480, 9)
    expect(point.y).toBeCloseTo(720, 9)
  })
})

describe('device pixel ratio cancels out', () => {
  // The same layout measured in CSS px (DPR 1) or in device px (CSS × DPR) must give the same
  // image point. The mapping only uses ratios of display lengths, so no DPR factor is applied.
  it.each([1, 1.5, 2, 2.625, 2.75, 3, 4])('DPR %s', (dpr) => {
    const scaleSize = ({ width, height }: Size) => ({ width: width * dpr, height: height * dpr })
    for (const [image, container] of [[LANDSCAPE, { width: 390, height: 500 }], [PORTRAIT, { width: 430, height: 600 }], [LANDSCAPE, { width: 392.72727272727275, height: 512.3636 }]] as const) {
      const cssRect = fitContain(image, container)
      const deviceRect = fitContain(image, scaleSize(container))
      // Interior points: the CSS tap scaled by DPR. (Exact edges are excluded here only because
      // CSS edge × 2.625 need not be bit-identical to the device rect's edge; the next loop and the
      // closed-rectangle tests cover edges.)
      for (const [fx, fy] of [[.5, .5], [.000001, .999999], [.123, .877], [.9, .01]]) {
        const cssTap = { x: cssRect.x + cssRect.width * fx, y: cssRect.y + cssRect.height * fy }
        const fromCss = imagePoint(displayToImage(cssTap, cssRect, image))
        const fromDevice = imagePoint(displayToImage({ x: cssTap.x * dpr, y: cssTap.y * dpr }, deviceRect, image))
        expect(fromDevice.x).toBeCloseTo(fromCss.x, 9)
        expect(fromDevice.y).toBeCloseTo(fromCss.y, 9)
      }
      // The same relative position in each layout, including the exact corners.
      for (const [fx, fy] of [[0, 0], [1, 1], [0, 1], [1, 0], [.5, .5], [.123, .877]]) {
        const fromCss = imagePoint(displayToImage({ x: cssRect.x + cssRect.width * fx, y: cssRect.y + cssRect.height * fy }, cssRect, image))
        const fromDevice = imagePoint(displayToImage({ x: deviceRect.x + deviceRect.width * fx, y: deviceRect.y + deviceRect.height * fy }, deviceRect, image))
        expect(fromDevice.x).toBeCloseTo(fromCss.x, 9)
        expect(fromDevice.y).toBeCloseTo(fromCss.y, 9)
      }
    }
  })

  it('is exact for power-of-two ratios', () => {
    const cssRect = fitContain(LANDSCAPE, { width: 390, height: 500 })
    const deviceRect = fitContain(LANDSCAPE, { width: 780, height: 1000 })
    const cssTap = { x: 123.456, y: 234.567 }
    expect(displayToImage({ x: cssTap.x * 2, y: cssTap.y * 2 }, deviceRect, LANDSCAPE)).toEqual(displayToImage(cssTap, cssRect, LANDSCAPE))
  })

  it('does not depend on the canvas backing-store size', () => {
    // A 1600×1200 image drawn into a DPR-3 backing store (1170×877.5 device px) is still laid out
    // and tapped in CSS px; the backing store never enters the mapping.
    const rect = fitContain(LANDSCAPE, { width: 390, height: 500 })
    expect(imagePoint(displayToImage({ x: 195, y: 250 }, rect, LANDSCAPE))).toEqual({ x: 800, y: 600 })
  })
})

describe('mapping invariants (generated cases)', () => {
  it('maps the center to the center, and edges to 0 / width and 0 / height', () => {
    for (const { image, container } of generatedCases(2000)) {
      const rect = fitContain(image, container)
      const center = imagePoint(displayToImage({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, rect, image))
      expect(center.x).toBeCloseTo(image.width / 2, 9)
      expect(center.y).toBeCloseTo(image.height / 2, 9)
      const middleY = rect.y + rect.height / 2
      const middleX = rect.x + rect.width / 2
      expect(imagePoint(displayToImage({ x: rect.x, y: middleY }, rect, image)).x).toBe(0)
      expect(imagePoint(displayToImage({ x: rect.x + rect.width, y: middleY }, rect, image)).x).toBe(image.width)
      expect(imagePoint(displayToImage({ x: middleX, y: rect.y }, rect, image)).y).toBe(0)
      expect(imagePoint(displayToImage({ x: middleX, y: rect.y + rect.height }, rect, image)).y).toBe(image.height)
    }
  })

  it('is monotonic along both axes', () => {
    for (const { image, container } of generatedCases(200)) {
      const rect = fitContain(image, container)
      let previous = { x: -1, y: -1 }
      for (let step = 0; step <= 256; step++) {
        const t = step / 256
        const point = imagePoint(displayToImage({ x: rect.x + rect.width * t, y: rect.y + rect.height * t }, rect, image))
        expect(point.x).toBeGreaterThanOrEqual(previous.x)
        expect(point.y).toBeGreaterThanOrEqual(previous.y)
        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThanOrEqual(image.width)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(image.height)
        previous = point
      }
    }
  })

  it('keeps the normalized position and round-trips through imageToDisplay', () => {
    const random = seeded(77)
    for (const { image, container } of generatedCases(1000)) {
      const rect = fitContain(image, container)
      const fx = random()
      const fy = random()
      const tap = { x: rect.x + rect.width * fx, y: rect.y + rect.height * fy }
      const point = imagePoint(displayToImage(tap, rect, image))
      // Normalized position within the displayed photo equals normalized position in the image.
      expect(point.x / image.width).toBeCloseTo((tap.x - rect.x) / rect.width, 12)
      expect(point.y / image.height).toBeCloseTo((tap.y - rect.y) / rect.height, 12)
      // display → image → display, and image → display → image, are stable.
      const back = imageToDisplay(point, rect, image)
      expect(back.x).toBeCloseTo(tap.x, 9)
      expect(back.y).toBeCloseTo(tap.y, 9)
      const again = imagePoint(displayToImage(back, rect, image))
      expect(again.x).toBeCloseTo(point.x, 9)
      expect(again.y).toBeCloseTo(point.y, 9)
    }
  })
})

describe('sample radius rule', () => {
  it.each<[Size, number]>([
    [LANDSCAPE, 24],
    [PORTRAIT, 24],
    [{ width: 1600, height: 1600 }, 24],
    [{ width: 1600, height: 900 }, 24],
    [{ width: 1600, height: 600 }, 24], // 8:3 panorama: 4% of 600 = 24
    [{ width: 1600, height: 587 }, 23], // round(23.48)
    [{ width: 800, height: 600 }, 24], // small but not tiny: still the default
    [{ width: 640, height: 480 }, 19],
    [{ width: 400, height: 300 }, 12],
    [{ width: 100, height: 75 }, 3],
    [{ width: 10, height: 10 }, MIN_SAMPLE_RADIUS],
    [{ width: 1, height: 1 }, MIN_SAMPLE_RADIUS],
  ])('%o → %s working-image px', (image, radius) => {
    expect(sampleRadiusFor(image)).toBe(radius)
  })

  it('never exceeds the Slice 1 default or 4% of the short edge (above the 3 px floor), and is an integer ≥ 3', () => {
    for (const { image } of generatedCases(2000)) {
      const radius = sampleRadiusFor(image)
      expect(Number.isInteger(radius)).toBe(true)
      expect(radius).toBeGreaterThanOrEqual(MIN_SAMPLE_RADIUS)
      expect(radius).toBeLessThanOrEqual(DEFAULT_SAMPLE_RADIUS)
      if (radius > MIN_SAMPLE_RADIUS) expect(radius).toBeLessThanOrEqual(Math.round(MAX_SAMPLE_RADIUS_FRACTION * Math.min(image.width, image.height)))
    }
  })

  it('does not depend on the preview size: the disc is the same share of the photo on every screen', () => {
    // The rule takes only the image. On screen the marker ring scales with the preview instead.
    expect(sampleRadiusFor.length).toBe(1)
    const phone = fitContain(LANDSCAPE, { width: 390, height: 500 })
    const desktop = fitContain(LANDSCAPE, { width: 1280, height: 720 })
    const radius = sampleRadiusFor(LANDSCAPE)
    expect(imageLengthToDisplay(radius, phone, LANDSCAPE)).toBeCloseTo(5.85, 9) // 24 × 390 / 1600
    expect(imageLengthToDisplay(radius, desktop, LANDSCAPE)).toBeCloseTo(14.4, 9) // 24 × 960 / 1600
    // A tiny preview does not inflate the sampled area.
    const thumbnail = fitContain(LANDSCAPE, { width: 80, height: 80 })
    expect(sampleRadiusFor(LANDSCAPE)).toBe(radius)
    expect(imageLengthToDisplay(radius, thumbnail, LANDSCAPE)).toBeCloseTo(1.2, 9)
  })

  it('rejects invalid image sizes', () => {
    expect(() => sampleRadiusFor({ width: 0, height: 10 })).toThrow(RangeError)
    expect(() => sampleRadiusFor({ width: NaN, height: 10 })).toThrow(RangeError)
  })
})

describe('coordinates module boundary', () => {
  it('uses no DOM, layout, DPR or pointer APIs, and imports only sampling and types', () => {
    const code = coordinatesSource.replace(/\/\/.*$/gm, '') // comments may name what the code avoids
    for (const forbidden of ['window', 'document', 'devicePixelRatio', 'getBoundingClientRect', 'PointerEvent', 'MouseEvent', 'CanvasRenderingContext2D', 'HTMLElement', 'getComputedStyle', 'react']) {
      expect(code).not.toMatch(new RegExp(`\\b${forbidden}\\b`, 'i'))
    }
    const imports = [...coordinatesSource.matchAll(/from '([^']+)'/g)].map(([, path]) => path)
    expect(imports).toEqual(['./sampling', './types'])
  })
})
