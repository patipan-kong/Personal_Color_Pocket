import { describe, expect, it } from 'vitest'
import { hexToRgb } from '../personalColor/colorUtils'
import type { RGB } from '../personalColor/colorUtils'
import { getPalette } from '../personalColor/palettes'
import { subtypeOrder } from '../personalColor/seasons'
import type { Subtype } from '../personalColor/types'
import { fitContain, imageToDisplay, sampleRadiusFor } from './coordinates'
import { inspectPhotoPoint, inspectPhotoTap } from './inspect'
import { matchPhotoColor } from './photoMatch'
import { samplePhotoRegion } from './sampling'
import type { DisplayTap, PhotoColorSample, PhotoPointMatched, PhotoTapInspection, PixelSource, Size } from './types'
import inspectSource from './inspect.ts?raw'

type Rgba = [number, number, number, number?]

// Synthetic RGBA working images, same layout as getImageData / openPhoto output.
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

const rgbOf = (hex: string): RGB => hexToRgb(hex)!
const fill = ({ r, g, b }: RGB, a = 255): Rgba => [r, g, b, a]
const solid = (width: number, height: number, rgb: RGB) => makePixels(width, height, () => fill(rgb))

const SUBTYPE: Subtype = 'warm-autumn'
const palette = getPalette(SUBTYPE)
const BEST = palette.best[0]
const HARDER = palette.harder[0]

// A 1600×1200 working image (what openPhoto returns for a 4:3 photo) in a 390×500 phone box.
const PHONE_BOX: Size = { width: 390, height: 500 }

function matched(result: PhotoTapInspection): PhotoPointMatched {
  expect(result.kind).toBe('matched')
  return result as PhotoPointMatched
}

// Tap at a relative position of the DISPLAYED photo, the way the UI will produce taps.
function tapAt(image: PixelSource, container: Size, fx: number, fy: number): DisplayTap {
  const imageRect = fitContain(image, container)
  return { point: { x: imageRect.x + imageRect.width * fx, y: imageRect.y + imageRect.height * fy }, imageRect }
}

// The category the matcher gives the same color with no warnings: proves flags never move it.
const categoryWithoutFlags = (sample: PhotoColorSample, subtype: Subtype) =>
  matchPhotoColor({ ...sample, diagnostics: { ...sample.diagnostics, flags: [] } }, subtype).category

describe('inspectPhotoTap — end to end: pixels → tap → sample → match', () => {
  it('solid Best color on a real-size working image: exact HEX, near-face, no warnings', () => {
    const image = solid(1600, 1200, rgbOf(BEST.hex))
    const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .5, .5), SUBTYPE))
    expect(result.point).toEqual({ x: 800, y: 600 })
    expect(result.radius).toBe(24)
    expect(result.sample.hex).toBe(BEST.hex.toUpperCase())
    expect(result.sample.diagnostics.flags).toEqual([])
    expect(result.match.category).toBe('near-face')
    expect(result.match.nearest.color).toEqual(BEST)
    expect(result.match.subtype).toBe(SUBTYPE)
    expect(result.match.warnings).toEqual([])
  })

  it('solid Harder color: away-from-face, and it names the Harder color', () => {
    const image = solid(400, 300, rgbOf(HARDER.hex))
    const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .3, .7), SUBTYPE))
    expect(result.sample.hex).toBe(HARDER.hex.toUpperCase())
    expect(result.match.category).toBe('away-from-face')
    expect(result.match.resembles?.color).toEqual(HARDER)
  })

  it('maps the tap to the right part of the photo (left half Best, right half Harder, letterboxed)', () => {
    const image = makePixels(400, 300, (col) => fill(rgbOf(col < 200 ? BEST.hex : HARDER.hex)))
    const left = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .25, .5), SUBTYPE))
    const right = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .75, .5), SUBTYPE))
    expect(left.point).toEqual({ x: 100, y: 150 })
    expect(right.point).toEqual({ x: 300, y: 150 })
    expect(left.match.category).toBe('near-face')
    expect(right.match.category).toBe('away-from-face')
  })

  it('maps taps on a pillarboxed portrait photo in a desktop box', () => {
    const image = makePixels(300, 400, (_, row) => fill(rgbOf(row < 200 ? BEST.hex : HARDER.hex)))
    const desktop = { width: 1280, height: 720 }
    const top = matched(inspectPhotoTap(image, tapAt(image, desktop, .5, .25), SUBTYPE))
    const bottom = matched(inspectPhotoTap(image, tapAt(image, desktop, .5, .75), SUBTYPE))
    expect(top.point).toEqual({ x: 150, y: 100 })
    expect(bottom.point).toEqual({ x: 150, y: 300 })
    expect(top.sample.hex).toBe(BEST.hex.toUpperCase())
    expect(bottom.sample.hex).toBe(HARDER.hex.toUpperCase())
  })

  it('returns a typed outside result for a tap in the letterbox, without sampling', () => {
    const image = solid(1600, 1200, rgbOf(BEST.hex))
    const imageRect = fitContain(image, PHONE_BOX) // photo drawn at y 103.75 … 396.25
    for (const point of [{ x: 195, y: 20 }, { x: 195, y: 103.74 }, { x: 195, y: 396.26 }, { x: 195, y: 499 }, { x: -1, y: 250 }, { x: 391, y: 250 }]) {
      expect(inspectPhotoTap(image, { point, imageRect }, SUBTYPE)).toEqual({ kind: 'outside-displayed-image' })
    }
  })

  it('samples at the exact corners and edges of the displayed photo', () => {
    const image = solid(400, 300, rgbOf(BEST.hex))
    for (const [fx, fy, x, y] of [[0, 0, 0, 0], [1, 0, 400, 0], [0, 1, 0, 300], [1, 1, 400, 300], [.5, 0, 200, 0], [1, .5, 400, 150]]) {
      const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, fx, fy), SUBTYPE))
      expect(result.point).toEqual({ x, y })
      expect(result.sample.hex).toBe(BEST.hex.toUpperCase())
    }
  })

  it('transparent area: typed unavailable state with the mapped point and radius', () => {
    const image = makePixels(400, 300, (col) => col < 200 ? [0, 0, 0, 0] : fill(rgbOf(BEST.hex)))
    const result = inspectPhotoTap(image, tapAt(image, PHONE_BOX, .25, .5), SUBTYPE)
    expect(result).toEqual({ kind: 'unavailable', point: { x: 100, y: 150 }, radius: 12, reason: 'transparent' })
    // The opaque half still matches, and transparent black is never read as black.
    expect(matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .75, .5), SUBTYPE)).sample.hex).toBe(BEST.hex.toUpperCase())
  })

  it('insufficient pixels on a tiny image is an unavailable state, not an exception', () => {
    const image = solid(2, 2, rgbOf(BEST.hex))
    expect(sampleRadiusFor(image)).toBe(3)
    const result = inspectPhotoTap(image, tapAt(image, PHONE_BOX, 0, 0), SUBTYPE)
    expect(result).toEqual({ kind: 'unavailable', point: { x: 0, y: 0 }, radius: 3, reason: 'insufficient-pixels' })
  })
})

describe('warnings survive the full path and never change the category', () => {
  it('strong mixed pattern → mixed', () => {
    // 2 px stripes of two very different colors: finer than the disc, so the average is a blend.
    const image = makePixels(400, 300, (col) => fill(col % 4 < 2 ? { r: 192, g: 57, b: 43 } : { r: 46, g: 134, b: 193 }))
    const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .5, .5), SUBTYPE))
    expect(result.sample.diagnostics.flags).toContain('mixed')
    expect(result.match.warnings).toEqual(result.sample.diagnostics.flags)
    expect(result.match.category).toBe(categoryWithoutFlags(result.sample, SUBTYPE))
  })

  it('highlight-contaminated Best color → highlight, category unchanged by the flag', () => {
    // 40% of pixels blown to white (> 35% warn level) in a deterministic pattern.
    const image = makePixels(400, 300, (col, row) => (col * 7 + row * 13) % 10 < 4 ? [255, 255, 255] : fill(rgbOf(BEST.hex)))
    const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .5, .5), SUBTYPE))
    expect(result.sample.diagnostics.flags).toContain('highlight')
    expect(result.match.warnings).toContain('highlight')
    expect(result.match.category).toBe(categoryWithoutFlags(result.sample, SUBTYPE))
  })

  it('shadow-contaminated Best color → shadow, category unchanged by the flag', () => {
    const image = makePixels(400, 300, (col, row) => (col * 7 + row * 13) % 10 < 4 ? [0, 0, 0] : fill(rgbOf(BEST.hex)))
    const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .5, .5), SUBTYPE))
    expect(result.sample.diagnostics.flags).toContain('shadow')
    expect(result.match.warnings).toContain('shadow')
    expect(result.match.category).toBe(categoryWithoutFlags(result.sample, SUBTYPE))
  })

  it('mild contamination (under the trim) keeps the exact Best color and no flag', () => {
    // 15% white + 15% black: both removed by the 20% lightness trim.
    const image = makePixels(400, 300, (col, row) => {
      const cell = (col * 7 + row * 13) % 20
      return cell < 3 ? [255, 255, 255] : cell < 6 ? [0, 0, 0] : fill(rgbOf(BEST.hex))
    })
    const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .5, .5), SUBTYPE))
    expect(result.sample.hex).toBe(BEST.hex.toUpperCase())
    expect(result.sample.diagnostics.flags).toEqual([])
    expect(result.match.category).toBe('near-face')
  })
})

describe('glue only: exactly the sampler and matcher results', () => {
  it('returns the unmodified samplePhotoRegion and matchPhotoColor outputs for the mapped point', () => {
    const image = makePixels(400, 300, (col, row) => fill({ r: 120 + (col % 17), g: 80 + (row % 11), b: 60 + ((col + row) % 7) }))
    for (const [fx, fy] of [[.1, .1], [.5, .5], [.83, .29], [1, 1]]) {
      const result = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, fx, fy), SUBTYPE))
      const sample = samplePhotoRegion(image, result.point, { radius: sampleRadiusFor(image) })
      expect(result.sample).toEqual(sample)
      expect(result.match).toEqual(matchPhotoColor(sample as PhotoColorSample, SUBTYPE))
    }
  })

  it('uses the given subtype as-is for every subtype (no inference, no re-scoring)', () => {
    const image = solid(400, 300, rgbOf(BEST.hex))
    const tap = tapAt(image, PHONE_BOX, .5, .5)
    for (const subtype of subtypeOrder) {
      const result = matched(inspectPhotoTap(image, tap, subtype))
      expect(result.match.subtype).toBe(subtype)
      expect(result.match).toEqual(matchPhotoColor(result.sample, subtype))
    }
  })

  it('inspectPhotoPoint takes working-image points directly (keyboard marker) and reports off-image points', () => {
    const image = solid(400, 300, rgbOf(BEST.hex))
    const tapped = matched(inspectPhotoTap(image, tapAt(image, PHONE_BOX, .25, .75), SUBTYPE))
    expect(inspectPhotoPoint(image, { x: 100, y: 225 }, SUBTYPE)).toEqual(tapped)
    expect(inspectPhotoPoint(image, { x: -1, y: 10 }, SUBTYPE)).toEqual({ kind: 'unavailable', point: { x: -1, y: 10 }, radius: 12, reason: 'outside-image' })
  })

  it('gives the marker position back in display coordinates', () => {
    const image = solid(1600, 1200, rgbOf(BEST.hex))
    const tap = tapAt(image, PHONE_BOX, .3, .6)
    const result = matched(inspectPhotoTap(image, tap, SUBTYPE))
    const marker = imageToDisplay(result.point, tap.imageRect, image)
    expect(marker.x).toBeCloseTo(tap.point.x, 9)
    expect(marker.y).toBeCloseTo(tap.point.y, 9)
  })

  it('is deterministic', () => {
    const image = makePixels(400, 300, (col, row) => fill({ r: (col * 31) % 256, g: (row * 17) % 256, b: 90 }))
    const tap = tapAt(image, PHONE_BOX, .42, .58)
    expect(inspectPhotoTap(image, tap, SUBTYPE)).toEqual(inspectPhotoTap(image, tap, SUBTYPE))
  })

  it('lets programming errors throw as the lower layers define them', () => {
    const broken = { width: 4, height: 4, data: new Uint8ClampedArray(3) }
    expect(() => inspectPhotoPoint(broken, { x: 1, y: 1 }, SUBTYPE)).toThrow(RangeError)
    const image = solid(4, 4, rgbOf(BEST.hex))
    expect(() => inspectPhotoTap(image, { point: { x: NaN, y: 0 }, imageRect: { x: 0, y: 0, width: 4, height: 4 } }, SUBTYPE)).toThrow(RangeError)
  })

  it('has no color logic, DOM access or storage of its own', () => {
    const code = inspectSource.replace(/\/\/.*$/gm, '')
    const imports = [...code.matchAll(/from '([^']+)'/g)].map(([, path]) => path)
    expect(imports).toEqual(['../personalColor/types', './coordinates', './photoMatch', './sampling', './types'])
    for (const forbidden of ['window', 'document', 'localStorage', 'fetch', 'oklab', 'Distance', 'getPalette', 'pairingSuggestions', 'devicePixelRatio']) {
      expect(code).not.toMatch(new RegExp(`\\b${forbidden}\\b`, 'i'))
    }
  })
})
