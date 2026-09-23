import type { OKLab, RGB } from '../personalColor/colorUtils'

// Working-image pixels in canvas `getImageData` layout: row-major, 4 bytes (R, G, B, A) per
// pixel, non-premultiplied sRGB. Structurally compatible with the DOM `ImageData`, but the
// sampler never needs a DOM type.
export interface PixelSource {
  width: number
  height: number
  data: Uint8ClampedArray
}

// Coordinates in WORKING-IMAGE pixel space (never CSS pixels). Continuous: pixel (col, row)
// covers [col, col + 1) × [row, row + 1), so its center is (col + 0.5, row + 0.5). Valid
// points lie in the closed rectangle [0, width] × [0, height].
export interface ImagePoint {
  x: number
  y: number
}

export interface SampleOptions {
  // Disc radius in working-image pixels (≥ 1). Defaults to DEFAULT_SAMPLE_RADIUS.
  radius?: number
  // Fraction dropped from EACH end of the lightness order, in [0, 0.5). Defaults to DEFAULT_TRIM_FRACTION.
  trimFraction?: number
}

// mixed: retained pixels are heterogeneous (print, stripes, garment edge).
// highlight: a large share of the region is blown to near-white.
// shadow: a large share of the region is crushed to near-black.
export type SampleFlag = 'mixed' | 'highlight' | 'shadow'

export interface SampleDiagnostics {
  regionPixelCount: number   // in-bounds pixels whose centers lie inside the disc
  opaquePixelCount: number   // of those, pixels opaque enough to be considered
  retainedPixelCount: number // opaque pixels left after lightness trimming (averaged)
  spread: number             // RMS OKLab distance of retained pixels from the representative color
  highlightFraction: number  // share of opaque pixels with every channel ≥ HIGHLIGHT_CHANNEL_MIN
  shadowFraction: number     // share of opaque pixels with every channel ≤ SHADOW_CHANNEL_MAX
  flags: SampleFlag[]
}

export interface PhotoColorSample {
  kind: 'color'
  hex: string // "#RRGGBB", same format as normalizeHex
  rgb: RGB
  oklab: OKLab // exactly rgbToOklab(rgb), so hex and OKLab never disagree
  diagnostics: SampleDiagnostics
}

// Normal user conditions, returned instead of thrown.
export type SampleUnavailableReason = 'outside-image' | 'transparent' | 'insufficient-pixels'

export interface PhotoSampleUnavailable {
  kind: 'unavailable'
  reason: SampleUnavailableReason
}

export type PhotoSampleResult = PhotoColorSample | PhotoSampleUnavailable
