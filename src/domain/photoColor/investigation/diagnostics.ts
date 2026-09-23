import { oklabChroma, oklabHue, rgbToHex, rgbToOklab } from '../../personalColor/colorUtils'
import type { OKLab, RGB } from '../../personalColor/colorUtils'
import { displayToImage, sampleRadiusFor } from '../coordinates'
import { DEFAULT_TRIM_FRACTION, MIN_OPAQUE_ALPHA, MIXED_SPREAD, samplePhotoRegion } from '../sampling'
import type { DisplayTap, ImagePoint, PhotoSampleResult, PixelSource, SampleFlag } from '../types'

// INVESTIGATION ONLY (Slice 5e): a diagnostic view of ONE working-image point. Imported by
// investigation tests, never by the app (a test enforces this). It never changes production:
// the production numbers come from calling the unchanged samplePhotoRegion; everything else is an
// extra read-only measurement over the same disc, for engineering evidence.

export const INVESTIGATION_RADII = [3, 6, 12, 24, 36, 48]
// Relative-light context: the ring between the sample disc and CONTEXT_FACTOR × radius.
export const CONTEXT_FACTOR = 4
// Context pixels at least this much lighter (OKLab L) than the sample, with similar chroma…
export const CONTEXT_LIGHTER_L = .1
export const CONTEXT_CHROMA_TOLERANCE = .04
// …making up more than this share of the ring suggest the tap sits in a local shadow.
export const CONTEXT_LIGHTER_SHARE = .15

interface Pixel { rgb: RGB; lab: OKLab }

export interface RadiusRow { radius: number; hex: string | null; l: number; chroma: number; spread: number; flags: SampleFlag[] }

export type TintDirection = 'none' | 'warm' | 'green' | 'cool' | 'magenta'

export interface PointDiagnosis {
  point: ImagePoint
  radius: number
  production: PhotoSampleResult // exactly samplePhotoRegion(image, point, { radius })
  region: { pixelCount: number; opaqueCount: number; keptCount: number }
  sample: { rgb: RGB; hex: string; oklab: OKLab; chroma: number; hue: number | null; spread: number; highlightFraction: number; shadowFraction: number; flags: SampleFlag[] } | null
  radii: RadiusRow[]
  distribution: {
    meanRgb: RGB // untrimmed mean over all opaque disc pixels
    trimmedMeanHex: string // the production estimator, recomputed here and checked against production
    medianRgb: RGB // per-channel median of the retained pixels
    medianHex: string
    lMedianPixelHex: string // the retained pixel with the median OKLab L (a real pixel)
    lPercentiles: Record<'p10' | 'p25' | 'p50' | 'p75' | 'p90', number> // over ALL opaque pixels
    chromaPercentiles: Record<'p10' | 'p50' | 'p90', number>
    darkestRetainedHex: string
    brightestRetainedHex: string
    medianVsProduction: number // OKLab ΔE between median RGB and the production colour
  } | null
  cast: {
    chroma: number
    hue: number | null // only when chroma ≥ 0.01
    tint: TintDirection
    blueMinusRed: number // mean 8-bit channel differences of the retained pixels
    greenMinusMagenta: number // G − (R + B) / 2
    consistentButTinted: boolean // low spread (no `mixed`) AND a visible tint
  } | null
  context: {
    radius: number
    ringPixels: number
    ringP90L: number
    lighterSimilarShare: number
    probableLocalShadow: boolean
  } | null
}

function collect(image: PixelSource, point: ImagePoint, outer: number, inner = -1) {
  const { width, height, data } = image
  const left = Math.max(0, Math.floor(point.x - outer))
  const right = Math.min(width - 1, Math.ceil(point.x + outer))
  const top = Math.max(0, Math.floor(point.y - outer))
  const bottom = Math.min(height - 1, Math.ceil(point.y + outer))
  let pixelCount = 0
  const pixels: Pixel[] = []
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const squared = (col + .5 - point.x) ** 2 + (row + .5 - point.y) ** 2
      if (squared > outer * outer || (inner >= 0 && squared <= inner * inner)) continue
      pixelCount++
      const index = (row * width + col) * 4
      if (data[index + 3] < MIN_OPAQUE_ALPHA) continue
      const rgb = { r: data[index], g: data[index + 1], b: data[index + 2] }
      pixels.push({ rgb, lab: rgbToOklab(rgb) })
    }
  }
  return { pixelCount, pixels }
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return NaN
  const position = (sorted.length - 1) * q
  const low = Math.floor(position)
  return sorted[low] + (sorted[Math.min(sorted.length - 1, low + 1)] - sorted[low]) * (position - low)
}

const median = (values: number[]) => quantile([...values].sort((a, b) => a - b), .5)

export const deltaE = (first: OKLab, second: OKLab) => Math.hypot(first.l - second.l, first.a - second.a, first.b - second.b)

// Rough OKLab hue families for a near-neutral tint (investigation vocabulary only).
export function tintOf(lab: OKLab): TintDirection {
  if (oklabChroma(lab) < .01) return 'none'
  const hue = oklabHue(lab)
  if (hue >= 30 && hue < 110) return 'warm'
  if (hue >= 110 && hue < 180) return 'green'
  if (hue >= 180 && hue < 290) return 'cool'
  return 'magenta'
}

function radiusRow(image: PixelSource, point: ImagePoint, radius: number): RadiusRow {
  const result = samplePhotoRegion(image, point, { radius })
  if (result.kind !== 'color') return { radius, hex: null, l: NaN, chroma: NaN, spread: NaN, flags: [] }
  return { radius, hex: result.hex, l: result.oklab.l, chroma: oklabChroma(result.oklab), spread: result.diagnostics.spread, flags: result.diagnostics.flags }
}

export function diagnosePoint(image: PixelSource, point: ImagePoint, radius = sampleRadiusFor(image)): PointDiagnosis {
  const production = samplePhotoRegion(image, point, { radius })
  const { pixelCount, pixels } = collect(image, point, radius)
  const radii = INVESTIGATION_RADII.map((value) => radiusRow(image, point, value))
  const base = { point, radius, production, radii }
  if (production.kind !== 'color') {
    return { ...base, region: { pixelCount, opaqueCount: pixels.length, keptCount: 0 }, sample: null, distribution: null, cast: null, context: null }
  }

  // Same order and trim as production (stable sort by L, equal cut from each end).
  const sorted = [...pixels].sort((first, second) => first.lab.l - second.lab.l)
  const cut = Math.floor(sorted.length * DEFAULT_TRIM_FRACTION)
  const retained = sorted.slice(cut, sorted.length - cut)
  const mean = (set: Pixel[]) => ({
    r: set.reduce((sum, { rgb }) => sum + rgb.r, 0) / set.length,
    g: set.reduce((sum, { rgb }) => sum + rgb.g, 0) / set.length,
    b: set.reduce((sum, { rgb }) => sum + rgb.b, 0) / set.length,
  })
  const trimmed = mean(retained)
  const medianRgb = { r: median(retained.map(({ rgb }) => rgb.r)), g: median(retained.map(({ rgb }) => rgb.g)), b: median(retained.map(({ rgb }) => rgb.b)) }
  const lValues = sorted.map(({ lab }) => lab.l)
  const chromas = pixels.map(({ lab }) => oklabChroma(lab)).sort((a, b) => a - b)
  const { oklab, diagnostics } = production
  const chroma = oklabChroma(oklab)

  // Relative light: is the disc noticeably darker than similar-chroma pixels around it?
  const contextRadius = radius * CONTEXT_FACTOR
  const ring = collect(image, point, contextRadius, radius).pixels
  const ringL = ring.map(({ lab }) => lab.l).sort((a, b) => a - b)
  const lighterSimilar = ring.filter(({ lab }) => lab.l >= oklab.l + CONTEXT_LIGHTER_L && Math.abs(oklabChroma(lab) - chroma) <= CONTEXT_CHROMA_TOLERANCE).length
  const lighterSimilarShare = ring.length ? lighterSimilar / ring.length : 0

  const channelMean = (pick: (rgb: RGB) => number) => retained.reduce((sum, { rgb }) => sum + pick(rgb), 0) / retained.length
  const tint = tintOf(oklab)

  return {
    ...base,
    region: { pixelCount, opaqueCount: pixels.length, keptCount: retained.length },
    sample: {
      rgb: production.rgb, hex: production.hex, oklab, chroma, hue: chroma >= .01 ? oklabHue(oklab) : null,
      spread: diagnostics.spread, highlightFraction: diagnostics.highlightFraction, shadowFraction: diagnostics.shadowFraction, flags: diagnostics.flags,
    },
    radii,
    distribution: {
      meanRgb: mean(pixels),
      trimmedMeanHex: rgbToHex(trimmed),
      medianRgb,
      medianHex: rgbToHex(medianRgb),
      lMedianPixelHex: rgbToHex(retained[Math.floor(retained.length / 2)].rgb),
      lPercentiles: { p10: quantile(lValues, .1), p25: quantile(lValues, .25), p50: quantile(lValues, .5), p75: quantile(lValues, .75), p90: quantile(lValues, .9) },
      chromaPercentiles: { p10: quantile(chromas, .1), p50: quantile(chromas, .5), p90: quantile(chromas, .9) },
      darkestRetainedHex: rgbToHex(retained[0].rgb),
      brightestRetainedHex: rgbToHex(retained[retained.length - 1].rgb),
      medianVsProduction: deltaE(rgbToOklab({ r: Math.round(medianRgb.r), g: Math.round(medianRgb.g), b: Math.round(medianRgb.b) }), oklab),
    },
    cast: {
      chroma,
      hue: chroma >= .01 ? oklabHue(oklab) : null,
      tint,
      blueMinusRed: channelMean(({ r, b }) => b - r),
      greenMinusMagenta: channelMean(({ r, g, b }) => g - (r + b) / 2),
      consistentButTinted: diagnostics.spread <= MIXED_SPREAD && tint !== 'none',
    },
    context: {
      radius: contextRadius,
      ringPixels: ring.length,
      ringP90L: quantile(ringL, .9),
      lighterSimilarShare,
      probableLocalShadow: lighterSimilarShare > CONTEXT_LIGHTER_SHARE,
    },
  }
}

// The same, starting from a display tap (maps with the unchanged Slice 4 geometry).
export function diagnoseTap(image: PixelSource, tap: DisplayTap): PointDiagnosis | { kind: 'outside-displayed-image' } {
  const mapped = displayToImage(tap.point, tap.imageRect, image)
  return mapped.kind === 'image-point' ? diagnosePoint(image, mapped.point) : mapped
}
