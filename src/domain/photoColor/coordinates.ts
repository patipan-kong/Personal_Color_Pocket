import { DEFAULT_SAMPLE_RADIUS } from './sampling'
import type { DisplayPoint, DisplayRect, DisplayToImageResult, ImagePoint, Size } from './types'

// V1.2 display ↔ working-image geometry (Slice 4, plan §8.4). Pure numbers in, numbers out:
// no DOM, no layout reads, no devicePixelRatio. Three coordinate spaces are kept apart:
//
//   display   CSS px, origin at the preview container's content-box top-left (pointer positions)
//   imageRect where the photo is actually drawn inside that container (letterbox excluded)
//   image     working-image px, continuous, [0, width] × [0, height] (the Slice 1 contract)
//
// Mapping only uses ratios of display lengths, so any uniform display unit (CSS px, device px)
// gives the same image point: DPR cancels and must not be applied.

// Radius rule (plan §8.4, simplified by Slice 4): a fixed working-image radius, independent of
// the on-screen size, capped for small images so a disc never spans a large share of the photo.
export const MIN_SAMPLE_RADIUS = 3
export const MAX_SAMPLE_RADIUS_FRACTION = .04

function assertSize({ width, height }: Size, label: string) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Invalid ${label} size ${width}×${height}`)
  }
}

function assertRect({ x, y, width, height }: DisplayRect) {
  if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) {
    throw new RangeError(`Invalid image rect ${x},${y} ${width}×${height}`)
  }
}

// The rectangle an image occupies when fitted inside `container` like CSS
// `object-fit: contain` with the default centered `object-position`: as large as possible,
// aspect ratio kept, centered on the free axis. The binding axis is exactly the container
// length, and the rect never exceeds the container. A collapsed container (0 wide or high,
// i.e. not laid out yet) gives an empty rect.
export function fitContain(image: Size, container: Size): DisplayRect {
  assertSize(image, 'image')
  const { width: boxWidth, height: boxHeight } = container
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth < 0 || boxHeight < 0) {
    throw new RangeError(`Invalid container size ${boxWidth}×${boxHeight}`)
  }
  if (boxWidth === 0 || boxHeight === 0) return { x: boxWidth / 2, y: boxHeight / 2, width: 0, height: 0 }
  // Compare aspect ratios by cross-multiplication: no division before the axis is chosen.
  if (boxWidth * image.height >= boxHeight * image.width) {
    // Box is relatively wider: height binds, pillarbox left/right.
    const width = Math.min(boxWidth, boxHeight * image.width / image.height)
    return { x: (boxWidth - width) / 2, y: 0, width, height: boxHeight }
  }
  // Box is relatively taller: width binds, letterbox top/bottom.
  const height = Math.min(boxHeight, boxWidth * image.height / image.width)
  return { x: 0, y: (boxHeight - height) / 2, width: boxWidth, height }
}

// Display point → working-image point. Inside means the CLOSED image rect, so taps exactly on
// its edges map to x = 0 / x = width and y = 0 / y = height, which Slice 1 accepts. Anything
// else, however close, is outside. The far edges are snapped and the result clamped only to
// absorb floating-point round-off ((x + width − x) / width can be 1 ± 1 ulp), never to pull a
// real outside tap in.
export function displayToImage(point: DisplayPoint, imageRect: DisplayRect, image: Size): DisplayToImageResult {
  assertSize(image, 'image')
  assertRect(imageRect)
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new RangeError(`Invalid display point ${point.x},${point.y}`)
  const { x, y, width, height } = imageRect
  const right = x + width
  const bottom = y + height
  if (width === 0 || height === 0) return { kind: 'outside-displayed-image' }
  if (point.x < x || point.y < y || point.x > right || point.y > bottom) return { kind: 'outside-displayed-image' }
  // Normalize to [0, 1] within the drawn photo, then scale to image px.
  const along = (value: number, start: number, end: number, length: number, size: number) =>
    value === end ? size : Math.min(size, Math.max(0, (value - start) / length * size))
  return {
    kind: 'image-point',
    point: { x: along(point.x, x, right, width, image.width), y: along(point.y, y, bottom, height, image.height) },
  }
}

// Working-image point → display point (e.g. to position the sample marker). Inverse of
// displayToImage up to floating-point round-off.
export function imageToDisplay(point: ImagePoint, imageRect: DisplayRect, image: Size): DisplayPoint {
  assertSize(image, 'image')
  assertRect(imageRect)
  return {
    x: imageRect.x + point.x / image.width * imageRect.width,
    y: imageRect.y + point.y / image.height * imageRect.height,
  }
}

// A working-image length (e.g. the sample radius) in display units, for drawing the marker
// ring at exactly the sampled size. The image rect keeps the aspect ratio, so x and y agree.
export function imageLengthToDisplay(length: number, imageRect: DisplayRect, image: Size) {
  assertSize(image, 'image')
  assertRect(imageRect)
  return length * imageRect.width / image.width
}

// Sample radius in working-image px. DEFAULT_SAMPLE_RADIUS (24) for every image whose short
// edge is ≥ 600 px, which includes every photo the pipeline downsizes to a 1600 px long edge
// with an aspect ratio up to 8:3. Smaller images get 4% of their short edge (plan §8.4 cap),
// never less than 3 px (≥ 28 pixels for trimming). Independent of the display size.
export function sampleRadiusFor(image: Size) {
  assertSize(image, 'image')
  const cap = Math.round(MAX_SAMPLE_RADIUS_FRACTION * Math.min(image.width, image.height))
  return Math.max(MIN_SAMPLE_RADIUS, Math.min(DEFAULT_SAMPLE_RADIUS, cap))
}
