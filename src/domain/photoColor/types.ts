import type { OKLab, RGB } from '../personalColor/colorUtils'
import type { PaletteColor, Subtype } from '../personalColor/types'

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

// ---- Photo match (Slice 2, plan §10.3) ----

// Ordered from "wear it anywhere" to "outside the palette" (plan §11.1 labels):
// near-face      → "Great near your face"        (close to a Best or Accent color)
// neutral-base   → "Easy neutral"                (close to a Neutral)
// related        → "Works with care"             (in the palette's neighbourhood)
// away-from-face → "Better away from your face"  (resembles a Harder color)
// outside        → "Outside your palette"
export type PhotoMatchCategory = 'near-face' | 'neutral-base' | 'related' | 'away-from-face' | 'outside'

export type PositivePaletteGroup = 'best' | 'accents' | 'neutrals'

// How the photographed color differs from its nearest palette color (plan §10.3 "direction").
export type PhotoMatchDirection = 'lighter' | 'deeper' | 'brighter' | 'muted' | 'warmer' | 'cooler'

export interface PhotoMatchDescriptors {
  value: 'light' | 'medium' | 'deep'
  clarity: 'soft' | 'moderate' | 'clear'
}

export interface PhotoColorMatch {
  subtype: Subtype
  hex: string
  oklab: OKLab
  category: PhotoMatchCategory
  // Nearest Best / Accent / Neutral color. Always present, even for 'outside'.
  nearest: { color: PaletteColor; group: PositivePaletteGroup; distance: number }
  // Nearest Harder color, only when it is genuinely close (≤ PHOTO_RELATED_DISTANCE).
  resembles: { color: PaletteColor; distance: number } | null
  closest: Record<PositivePaletteGroup, PaletteColor>
  // Sample minus nearest: OKLab L, OKLab chroma, and signed hue rotation in degrees
  // (null when either color is too close to neutral for hue to mean anything).
  difference: { lightness: number; chroma: number; hue: number | null }
  // Up to 2 notable differences, largest first. Empty for near-face / neutral-base.
  direction: PhotoMatchDirection[]
  descriptors: PhotoMatchDescriptors
  pairWith: PaletteColor[]
  // Sampling flags carried through unchanged. They never change the category.
  warnings: SampleFlag[]
}

// ---- Display geometry and tap inspection (Slice 4) ----

// A width/height pair in any one consistent unit (CSS px for the display, pixels for images).
export interface Size {
  width: number
  height: number
}

// An axis-aligned rectangle in DISPLAY coordinates: CSS px, origin at the top-left of the
// preview container's content box, x right, y down.
export interface DisplayRect {
  x: number
  y: number
  width: number
  height: number
}

// A pointer position in the same display coordinates as the DisplayRect it is compared with.
export interface DisplayPoint {
  x: number
  y: number
}

export type DisplayToImageResult =
  | { kind: 'image-point'; point: ImagePoint }
  // The pointer is in the letterbox/padding around the photo, or the photo is not laid out.
  | { kind: 'outside-displayed-image' }

// A tap: where the pointer is, and where the photo is drawn, both in display coordinates.
export interface DisplayTap {
  point: DisplayPoint
  imageRect: DisplayRect
}

export interface PhotoPointUnavailable {
  kind: 'unavailable'
  point: ImagePoint
  radius: number
  reason: SampleUnavailableReason
}

export interface PhotoPointMatched {
  kind: 'matched'
  point: ImagePoint
  radius: number // working-image px actually sampled, so the UI can draw the same disc
  sample: PhotoColorSample // diagnostics and flags unchanged from the sampler
  match: PhotoColorMatch
}

export type PhotoPointInspection = PhotoPointUnavailable | PhotoPointMatched

export type PhotoTapInspection = { kind: 'outside-displayed-image' } | PhotoPointInspection
