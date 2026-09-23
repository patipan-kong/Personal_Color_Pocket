import type { PixelSource } from '../domain/photoColor/types'
import { exceedsPixelLimit, isHeifSignature, isMarkupSignature, readImageHeader } from './photoImageHeader'

// V1.2 local photo pipeline (Slice 3, plan §4). Browser boundary: File in, working-image
// pixels out. The photo never leaves the page: no network, no storage, no logging, and
// errors carry a code only (never a file name, bytes or URL). If analytics or crash
// reporting is ever added, it may receive the error CODE and nothing else from here.
//
// File → size cap → header preflight (60 MP cap BEFORE decode) → createImageBitmap(file)
// → working canvas (long edge ≤ 1600 px, sRGB) → getImageData once → { width, height, data }.
//
// Limits are provisional (Slice 0): the 60 MP cap still needs physical Android tests A1–A7.

export const MAX_PHOTO_FILE_BYTES = 30 * 1024 * 1024 // inclusive: exactly 30 MiB is accepted
export const MAX_PHOTO_PIXELS = 60_000_000 // inclusive: exactly 60 MP is accepted
export const WORKING_MAX_EDGE = 1600
// Enough for JPEG APPn segments (EXIF ≤ 64 KiB, ICC, XMP) ahead of the frame header. A
// header that does not fit is resolved by the browser probe instead (see resolveSize).
export const HEADER_READ_BYTES = 256 * 1024

export type PhotoImageErrorCode =
  | 'file-too-large'     // file.size > MAX_PHOTO_FILE_BYTES
  | 'image-too-large'    // width × height > MAX_PHOTO_PIXELS
  | 'invalid-image'      // a JPEG/PNG/WebP (or empty) file whose header is corrupt or truncated
  | 'unsupported-format' // not an image this browser can open (unknown bytes, SVG/markup)
  | 'unsupported-heic'   // HEIC/HEIF that this browser cannot decode
  | 'decode-failed'      // the header was fine but the browser could not decode the pixels
  | 'canvas-failed'      // no 2D context, or drawing / reading pixels failed
  | 'aborted'            // the caller's AbortSignal fired

// Deliberately carries no `cause`: browser exception messages can include URLs or names.
export class PhotoImageError extends Error {
  readonly code: PhotoImageErrorCode
  constructor(code: PhotoImageErrorCode) {
    super(code)
    this.name = 'PhotoImageError'
    this.code = code
  }
}

export interface OpenPhotoOptions {
  // Checked between stages. A decode already in progress cannot be interrupted, but its
  // result is released and never reaches the caller.
  signal?: AbortSignal
}

interface Size { width: number; height: number }

interface DecodedImage extends Size {
  source: CanvasImageSource
  release: () => void
}

const fail = (code: PhotoImageErrorCode): never => { throw new PhotoImageError(code) }

// Cleanup may be reached from several paths (success, failure, finally); it runs once.
function once(action: () => void) {
  let done = false
  return () => {
    if (done) return
    done = true
    action()
  }
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) fail('aborted')
}

// Proportional downscale so the long edge is ≤ maxEdge. Never upscales. The long edge
// becomes exactly maxEdge; the short edge is rounded half-up and never below 1 px.
export function workingSize(width: number, height: number, maxEdge = WORKING_MAX_EDGE): Size {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxEdge) return { width, height }
  const scaled = (edge: number) => edge === longEdge ? maxEdge : Math.max(1, Math.round(edge * maxEdge / longEdge))
  return { width: scaled(width), height: scaled(height) }
}

// Loads a File into an unattached <img> through a page-local blob: URL. `release()` detaches
// the handlers, clears `src` and revokes the URL; callers must always call it.
async function loadImageElement(file: Blob) {
  const url = URL.createObjectURL(file)
  const image = new Image()
  const release = once(() => {
    image.onload = null
    image.onerror = null
    image.removeAttribute('src')
    URL.revokeObjectURL(url)
  })
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('load'))
      image.src = url
    })
  } catch (error) {
    release()
    throw error
  }
  return { image, release }
}

// Header preflight: the source dimensions WITHOUT a full decode.
// - JPEG / PNG / WebP: parsed from the first bytes.
// - Anything else, or a header that did not fit in HEADER_READ_BYTES: the Slice 0 probe
//   (<img> load → naturalWidth/Height, orientation-aware, no full pixel decode). This keeps
//   HEIC on Safari, AVIF and GIF openable while still enforcing the cap before decode.
// - A probe failure is final: HEIC gets its own code, everything else is unsupported.
async function resolveSize(file: Blob, head: Uint8Array, signal?: AbortSignal): Promise<Size> {
  const header = readImageHeader(head)
  if (header.status === 'ok') return header
  if (header.status === 'malformed') fail('invalid-image')
  if (header.status === 'truncated' && head.length >= file.size) fail('invalid-image')
  if (isMarkupSignature(head)) fail('unsupported-format')
  if (typeof Image !== 'function' || typeof URL.createObjectURL !== 'function') fail('unsupported-format')

  let probe: Awaited<ReturnType<typeof loadImageElement>>
  try {
    probe = await loadImageElement(file)
  } catch {
    return fail(isHeifSignature(head) ? 'unsupported-heic' : 'unsupported-format')
  }
  const size = { width: probe.image.naturalWidth, height: probe.image.naturalHeight }
  probe.release()
  checkAborted(signal)
  if (size.width < 1 || size.height < 1) fail('unsupported-format')
  return size
}

// Engines that lack createImageBitmap, or that cannot take a Blob source, report that as
// TypeError / NotSupportedError. That is an API gap, so the <img> fallback is tried once.
// Any other rejection is a decode failure of this file, and re-decoding it through a second
// decoder would only repeat the failure and the memory spike.
const isApiGap = (error: unknown) => {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined
  return name === 'TypeError' || name === 'NotSupportedError'
}

async function decodeWithBitmap(file: Blob): Promise<DecodedImage> {
  // No resize options: they do not lower peak memory in Chromium and are slower (Slice 0 §6).
  const bitmap = await createImageBitmap(file)
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: once(() => bitmap.close()) }
}

// Fallback only. Chromium keeps <img> decodes in its image cache after revoke
// (+105–186 MiB at 48 MP, Slice 0 §6), so this path is not memory-equivalent.
async function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  const { image, release } = await loadImageElement(file)
  try {
    if (typeof image.decode === 'function') await image.decode()
  } catch (error) {
    release()
    throw error
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release }
}

async function decode(file: Blob, head: Uint8Array): Promise<DecodedImage> {
  const failDecode = () => fail(isHeifSignature(head) ? 'unsupported-heic' : 'decode-failed')
  if (typeof createImageBitmap === 'function') {
    try {
      return await decodeWithBitmap(file)
    } catch (error) {
      if (!isApiGap(error)) return failDecode()
    }
  }
  if (typeof Image !== 'function' || typeof URL.createObjectURL !== 'function') return failDecode()
  try {
    return await decodeWithImageElement(file)
  } catch {
    return failDecode()
  }
}

// Draws the decoded image into a temporary sRGB canvas at working size and reads its pixels
// exactly once. The decoded image is released right after drawImage (safe before readback:
// Slice 0 §5) and the canvas backing store is dropped in every case.
function rasterize(decoded: DecodedImage): PixelSource {
  const { width, height } = workingSize(decoded.width, decoded.height)
  const canvas = document.createElement('canvas')
  try {
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { colorSpace: 'srgb' })
    if (!context) return fail('canvas-failed')
    let data: Uint8ClampedArray
    try {
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(decoded.source, 0, 0, width, height)
      decoded.release()
      // Non-premultiplied RGBA; alpha is kept as decoded (transparent pixels are not flattened).
      data = context.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data
    } catch {
      return fail('canvas-failed')
    }
    if (data.length !== width * height * 4) fail('canvas-failed')
    return { width, height, data }
  } finally {
    decoded.release()
    canvas.width = 0
    canvas.height = 0
  }
}

// Prepares a locally selected photo for sampling. Resolves to pixels that go straight into
// samplePhotoRegion(); rejects with a PhotoImageError. Nothing is retained after it settles:
// no File, no decoded bitmap, no object URL, no canvas.
export async function openPhoto(file: Blob, options: OpenPhotoOptions = {}): Promise<PixelSource> {
  const { signal } = options
  checkAborted(signal)
  if (file.size > MAX_PHOTO_FILE_BYTES) fail('file-too-large')
  if (file.size === 0) fail('invalid-image')

  const head = new Uint8Array(await file.slice(0, Math.min(file.size, HEADER_READ_BYTES)).arrayBuffer())
  checkAborted(signal)
  const source = await resolveSize(file, head, signal)
  if (exceedsPixelLimit(source.width, source.height, MAX_PHOTO_PIXELS)) fail('image-too-large')

  const decoded = await decode(file, head)
  try {
    checkAborted(signal)
    // Defence in depth: the decoded (oriented) size must agree with the cap as well.
    if (exceedsPixelLimit(decoded.width, decoded.height, MAX_PHOTO_PIXELS)) {
      return fail(decoded.width < 1 || decoded.height < 1 ? 'decode-failed' : 'image-too-large')
    }
    return rasterize(decoded)
  } finally {
    decoded.release()
  }
}
