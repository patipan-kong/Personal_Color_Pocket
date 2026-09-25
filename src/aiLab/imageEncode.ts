import type { ImagePoint, PixelSource } from '../domain/photoColor/types'

// V2.0 AI Color Lab (Slice 0, extended Slice 0.1 -- plan §9-11): re-encodes the SAME
// working-image pixels the photo pipeline already produced (openPhoto's canvas is capped at a
// 1600px long edge -- see services/photoImage.ts) into a JPEG data URL for the provider calls.
// Deliberately does NOT re-read or re-decode the original file: nothing here sends more data
// than the existing local pipeline already keeps in memory.
export const AI_LAB_JPEG_QUALITY = 0.85

// Slice 0.1 grounding audit (docs/V2_AI_COLOR_LAB.md §16) found that the image sent to every
// provider carried NO indication at all of which point the user selected -- not even text
// coordinates -- while the visible sample marker in PhotoSurface.tsx is a CSS overlay drawn on
// top of the display, never burned into the canvas pixels that get encoded here. That fully
// explains why providers picked whatever garment/object looked most salient instead of the one
// the user actually tapped. The fix below burns a small ring + center-dot marker onto a
// throwaway AI-only copy of the canvas, at the EXACT SAME working-image point the deterministic
// sampler used -- there is no separate coordinate representation to transform or get wrong, and
// this never touches `image.data` itself (the original uploaded image, the production Photo
// Checker's canvas, and the deterministic sample all stay untouched -- plan §9, §15, §19).
const MARKER_RING_RADIUS_FACTOR = 2.4
const MARKER_MIN_RING_RADIUS = 20
const MARKER_MAX_RING_RADIUS = 90
const MARKER_LINE_WIDTH = 5
const MARKER_HALO_WIDTH = MARKER_LINE_WIDTH + 4
const MARKER_DOT_RADIUS = 5
const MARKER_COLOR = '#ff2d55' // bright magenta-red: unlikely to be mistaken for a garment color
const MARKER_HALO_COLOR = 'rgba(255,255,255,0.95)' // keeps the ring visible on dark AND light fabric

function drawRing(context: CanvasRenderingContext2D, point: ImagePoint, radius: number, color: string, lineWidth: number) {
  context.beginPath()
  context.arc(point.x, point.y, radius, 0, Math.PI * 2)
  context.strokeStyle = color
  context.lineWidth = lineWidth
  context.stroke()
}

function drawDot(context: CanvasRenderingContext2D, point: ImagePoint, radius: number, color: string) {
  context.beginPath()
  context.arc(point.x, point.y, radius, 0, Math.PI * 2)
  context.fillStyle = color
  context.fill()
}

// Ring radius scales with the deterministic sample radius (so the marker roughly frames the same
// disc the deterministic engine measured) but is clamped so it stays visible on a small image and
// never swallows a large share of the fabric on a big one (plan §9: "must not cover so much of
// the fabric that the AI can no longer inspect its color").
function drawTargetMarker(context: CanvasRenderingContext2D, point: ImagePoint, sampleRadius: number) {
  const ringRadius = Math.min(MARKER_MAX_RING_RADIUS, Math.max(MARKER_MIN_RING_RADIUS, sampleRadius * MARKER_RING_RADIUS_FACTOR))
  drawRing(context, point, ringRadius, MARKER_HALO_COLOR, MARKER_HALO_WIDTH)
  drawRing(context, point, ringRadius, MARKER_COLOR, MARKER_LINE_WIDTH)
  drawDot(context, point, MARKER_DOT_RADIUS + 2, MARKER_HALO_COLOR)
  drawDot(context, point, MARKER_DOT_RADIUS, MARKER_COLOR)
}

// The one encoder the AI Lab uses: full working image (no crop -- plan §10 wants surrounding
// context preserved so the model can tell garment from skin/sky/background), same for every
// provider, with the target marker burned in at `point`.
export function encodeAnnotatedImageForAiLab(image: PixelSource, point: ImagePoint, sampleRadius: number): string {
  const canvas = document.createElement('canvas')
  try {
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', { colorSpace: 'srgb' })
    if (!context) throw new Error('canvas-unavailable')
    context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
    drawTargetMarker(context, point, sampleRadius)
    return canvas.toDataURL('image/jpeg', AI_LAB_JPEG_QUALITY)
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
