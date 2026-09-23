import { rgbToHex, rgbToOklab } from '../personalColor/colorUtils'
import type { OKLab, RGB } from '../personalColor/colorUtils'
import type { ImagePoint, PhotoSampleResult, PixelSource, SampleFlag, SampleOptions } from './types'

// V1.2 photo sampling engine (plan §8.3). Pure: pixels + point in, color + diagnostics out.
// It knows nothing about the DOM, CSS pixels, or Personal Color matching.

// ~1,800 pixels per sample: the per-tap budget in plan §7 for a ≤1600 px working image.
// The UI derives the real radius from the on-screen size (plan §8.4) and passes it in.
export const DEFAULT_SAMPLE_RADIUS = 24
export const DEFAULT_TRIM_FRACTION = .2
// Alpha below this is ignored (transparent PNG areas, anti-aliased cut-out edges), so
// transparent black is never read as black.
export const MIN_OPAQUE_ALPHA = 250
// Fewer opaque pixels than this share of the region → 'transparent'.
export const MIN_OPAQUE_RATIO = .5
// Fewer opaque pixels than this → 'insufficient-pixels'. Never report a single pixel.
export const MIN_USABLE_PIXELS = 5
export const MIXED_SPREAD = .045
// Near-white / near-black on ALL channels. A single saturated channel (e.g. #FF2020 red
// fabric) is a real color, not a blown highlight.
export const HIGHLIGHT_CHANNEL_MIN = 250
export const SHADOW_CHANNEL_MAX = 5
export const CLIPPED_FRACTION_WARN = .35

interface SampledPixel { rgb: RGB; lab: OKLab }

function assertPixelSource({ width, height, data }: PixelSource) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`Invalid image size ${width}×${height}`)
  }
  if (!data || data.length !== width * height * 4) {
    throw new RangeError(`Pixel buffer length ${data?.length} does not match ${width}×${height} RGBA`)
  }
}

// Samples a disc of working-image pixels around `point`. Work is proportional to the disc's
// bounding box (≈ 4·radius² pixels), never to the whole image.
export function samplePhotoRegion(image: PixelSource, point: ImagePoint, options: SampleOptions = {}): PhotoSampleResult {
  assertPixelSource(image)
  const { x, y } = point
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError(`Invalid sample point ${x},${y}`)
  const radius = options.radius ?? DEFAULT_SAMPLE_RADIUS
  if (!Number.isFinite(radius) || radius < 1) throw new RangeError(`Invalid sample radius ${radius}`)
  const trimFraction = options.trimFraction ?? DEFAULT_TRIM_FRACTION
  if (!(trimFraction >= 0 && trimFraction < .5)) throw new RangeError(`Invalid trim fraction ${trimFraction}`)

  const { width, height, data } = image
  if (x < 0 || y < 0 || x > width || y > height) return { kind: 'unavailable', reason: 'outside-image' }

  // Pixel centers within `radius` of the point, clipped to the image.
  const left = Math.max(0, Math.floor(x - radius))
  const right = Math.min(width - 1, Math.ceil(x + radius))
  const top = Math.max(0, Math.floor(y - radius))
  const bottom = Math.min(height - 1, Math.ceil(y + radius))
  const radiusSquared = radius * radius
  const pixels: SampledPixel[] = []
  let regionPixelCount = 0
  let highlightCount = 0
  let shadowCount = 0
  for (let row = top; row <= bottom; row++) {
    const dy = row + .5 - y
    for (let col = left; col <= right; col++) {
      const dx = col + .5 - x
      if (dx * dx + dy * dy > radiusSquared) continue
      regionPixelCount++
      const index = (row * width + col) * 4
      if (data[index + 3] < MIN_OPAQUE_ALPHA) continue
      const rgb = { r: data[index], g: data[index + 1], b: data[index + 2] }
      if (Math.min(rgb.r, rgb.g, rgb.b) >= HIGHLIGHT_CHANNEL_MIN) highlightCount++
      else if (Math.max(rgb.r, rgb.g, rgb.b) <= SHADOW_CHANNEL_MAX) shadowCount++
      pixels.push({ rgb, lab: rgbToOklab(rgb) })
    }
  }

  const opaquePixelCount = pixels.length
  if (opaquePixelCount === 0 || opaquePixelCount < regionPixelCount * MIN_OPAQUE_RATIO) {
    return { kind: 'unavailable', reason: 'transparent' }
  }
  if (opaquePixelCount < MIN_USABLE_PIXELS) return { kind: 'unavailable', reason: 'insufficient-pixels' }

  // Drop the same count from each end of the lightness order (shadows/creases, then glare/lint).
  // floor() with trimFraction < 0.5 always keeps more than 0 pixels; ties keep scan order (stable sort).
  pixels.sort((first, second) => first.lab.l - second.lab.l)
  const cut = Math.floor(opaquePixelCount * trimFraction)
  const retained = pixels.slice(cut, opaquePixelCount - cut)

  // Mean of the retained 8-bit sRGB channels. The set is lightness-trimmed and near-uniform, so
  // this is within ≪ 0.01 ΔE_OK of a linear-light mean, and the output stays a real HEX whose
  // OKLab is identical to what the manual checker computes for that HEX.
  let red = 0
  let green = 0
  let blue = 0
  retained.forEach(({ rgb }) => { red += rgb.r; green += rgb.g; blue += rgb.b })
  const rgb = {
    r: Math.round(red / retained.length),
    g: Math.round(green / retained.length),
    b: Math.round(blue / retained.length),
  }
  const oklab = rgbToOklab(rgb)

  let squaredDistance = 0
  retained.forEach(({ lab }) => {
    squaredDistance += (lab.l - oklab.l) ** 2 + (lab.a - oklab.a) ** 2 + (lab.b - oklab.b) ** 2
  })
  const spread = Math.sqrt(squaredDistance / retained.length)
  const highlightFraction = highlightCount / opaquePixelCount
  const shadowFraction = shadowCount / opaquePixelCount

  const flags: SampleFlag[] = []
  if (spread > MIXED_SPREAD) flags.push('mixed')
  if (highlightFraction > CLIPPED_FRACTION_WARN) flags.push('highlight')
  if (shadowFraction > CLIPPED_FRACTION_WARN) flags.push('shadow')

  return {
    kind: 'color',
    hex: rgbToHex(rgb),
    rgb,
    oklab,
    diagnostics: {
      regionPixelCount,
      opaquePixelCount,
      retainedPixelCount: retained.length,
      spread,
      highlightFraction,
      shadowFraction,
      flags,
    },
  }
}
