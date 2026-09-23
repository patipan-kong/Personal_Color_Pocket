// V1.2 photo header preflight (Slice 3). Pure byte parsing, no DOM: reads just enough of a
// JPEG / PNG / WebP header to learn the image dimensions, so the 60 MP cap can be enforced
// BEFORE the browser allocates a full decoded bitmap (Slice 0 §7).
//
// The bytes are untrusted. Every read is bounds-checked, every loop advances, nothing is
// allocated from a length field, and malformed input returns a result instead of throwing.
// This is deliberately not a general image parser: it never looks past the first frame
// header and never reads EXIF (the browser applies orientation on decode; Slice 0 §9).

export type HeaderFormat = 'jpeg' | 'png' | 'webp'

export type ImageHeader =
  | { status: 'ok'; format: HeaderFormat; width: number; height: number }
  // The signature matched but the bytes ended before the dimensions.
  | { status: 'truncated'; format: HeaderFormat }
  // The signature matched but the structure or the dimensions are invalid.
  | { status: 'malformed'; format: HeaderFormat }
  // Not a JPEG, PNG or WebP signature.
  | { status: 'unrecognized' }

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
// PNG limits each dimension to 2^31 − 1.
const PNG_MAX_DIMENSION = 0x7fffffff
// ISO BMFF major brands used by HEIC / HEIF stills and sequences (Slice 0 §10). AVIF
// ('avif' / 'avis') is deliberately absent: it is a different, browser-decodable format.
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'heif']

const u16be = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1]
const u32be = (bytes: Uint8Array, at: number) => ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3]
const u24le = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)
const u32le = (bytes: Uint8Array, at: number) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + bytes[at + 3] * 0x1000000
const ascii = (bytes: Uint8Array, at: number, length: number) =>
  at + length > bytes.length ? '' : String.fromCharCode(...bytes.subarray(at, at + length))
const startsWith = (bytes: Uint8Array, signature: number[]) =>
  bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value)

// SOF0–SOF15 carry the frame dimensions, except DHT (C4), JPG (C8) and DAC (CC), which
// share the range but are not frame headers. Covers baseline, extended, progressive,
// lossless and arithmetic-coded frames.
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

// Walks JPEG marker segments using their length fields, never scanning inside a segment,
// so an embedded EXIF thumbnail (inside APP1) is never mistaken for the main frame.
// Returns the dimensions as stored in the frame header, i.e. BEFORE EXIF orientation. For
// orientations 5–8 the decoded width and height are swapped, which leaves the pixel count
// (the only thing the cap needs) unchanged.
function readJpeg(bytes: Uint8Array): ImageHeader {
  const truncated = { status: 'truncated', format: 'jpeg' } as const
  const malformed = { status: 'malformed', format: 'jpeg' } as const
  let at = 2 // after SOI (FF D8)
  for (;;) {
    if (at >= bytes.length) return truncated
    if (bytes[at] !== 0xff) return malformed
    // Any number of 0xFF fill bytes may precede a marker.
    while (at < bytes.length && bytes[at] === 0xff) at++
    if (at >= bytes.length) return truncated
    const marker = bytes[at++]
    // Standalone markers (no length field): TEM and RST0–7. Tolerated and skipped.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    // Stuffed zero, a second SOI, end of image or start of scan before any frame header:
    // not a decodable image structure.
    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9 || marker === 0xda) return malformed
    if (at + 2 > bytes.length) return truncated
    const length = u16be(bytes, at) // includes its own 2 bytes
    if (length < 2) return malformed
    if (isStartOfFrame(marker)) {
      // length(2) precision(1) height(2) width(2) components(1)
      if (length < 8) return malformed
      if (at + 7 > bytes.length) return truncated
      const height = u16be(bytes, at + 3)
      const width = u16be(bytes, at + 5)
      // Height 0 means "defined later by a DNL marker", which browsers do not decode.
      if (width === 0 || height === 0) return malformed
      return { status: 'ok', format: 'jpeg', width, height }
    }
    at += length // strictly advances by ≥ 2, so the loop always terminates
  }
}

function readPng(bytes: Uint8Array): ImageHeader {
  // signature(8) IHDR length(4) "IHDR"(4) width(4) height(4)
  if (bytes.length < 24) return { status: 'truncated', format: 'png' }
  if (u32be(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== 'IHDR') return { status: 'malformed', format: 'png' }
  const width = u32be(bytes, 16)
  const height = u32be(bytes, 20)
  if (width < 1 || height < 1 || width > PNG_MAX_DIMENSION || height > PNG_MAX_DIMENSION) return { status: 'malformed', format: 'png' }
  return { status: 'ok', format: 'png', width, height }
}

// The first chunk after "RIFF....WEBP" identifies the three dimension-bearing forms:
// VP8 (lossy), VP8L (lossless) and VP8X (extended: alpha, animation, EXIF/ICC).
function readWebp(bytes: Uint8Array): ImageHeader {
  const truncated = { status: 'truncated', format: 'webp' } as const
  const malformed = { status: 'malformed', format: 'webp' } as const
  if (bytes.length < 20) return truncated
  const chunk = ascii(bytes, 12, 4)
  const chunkSize = u32le(bytes, 16)
  const payload = 20
  if (chunk === 'VP8 ') {
    // frame tag(3) start code 9D 01 2A(3) width(2) height(2); top 2 bits of each are scale.
    if (chunkSize < 10) return malformed
    if (bytes.length < payload + 10) return truncated
    const keyFrame = (bytes[payload] & 1) === 0
    if (!keyFrame || bytes[payload + 3] !== 0x9d || bytes[payload + 4] !== 0x01 || bytes[payload + 5] !== 0x2a) return malformed
    const width = (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff
    const height = (bytes[payload + 8] | (bytes[payload + 9] << 8)) & 0x3fff
    if (width === 0 || height === 0) return malformed
    return { status: 'ok', format: 'webp', width, height }
  }
  if (chunk === 'VP8L') {
    // signature 0x2F(1), then 14-bit width−1, 14-bit height−1, alpha(1), version(3) = 0.
    if (chunkSize < 5) return malformed
    if (bytes.length < payload + 5) return truncated
    if (bytes[payload] !== 0x2f) return malformed
    const bits = u32le(bytes, payload + 1)
    if (bits >>> 29 !== 0) return malformed
    return { status: 'ok', format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    // flags(1) reserved(3) canvas width−1 (24-bit LE) canvas height−1 (24-bit LE).
    if (chunkSize < 10) return malformed
    if (bytes.length < payload + 10) return truncated
    return { status: 'ok', format: 'webp', width: u24le(bytes, payload + 4) + 1, height: u24le(bytes, payload + 7) + 1 }
  }
  return malformed
}

// Identifies the format from its signature (never from a file name or MIME type) and reads
// its dimensions from `bytes`, which may be a prefix of the file.
export function readImageHeader(bytes: Uint8Array): ImageHeader {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return readJpeg(bytes)
  if (startsWith(bytes, PNG_SIGNATURE)) return readPng(bytes)
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return readWebp(bytes)
  return { status: 'unrecognized' }
}

// ISO BMFF "ftyp" box with a HEIC/HEIF major brand: bytes 4–8 are "ftyp", bytes 8–12 the brand.
export function isHeifSignature(bytes: Uint8Array) {
  return ascii(bytes, 4, 4) === 'ftyp' && HEIF_BRANDS.includes(ascii(bytes, 8, 4))
}

// SVG / XML / HTML text. Vector markup is not a photo, and SVG can reference external
// resources (plan §6), so it is never handed to the browser.
export function isMarkupSignature(bytes: Uint8Array) {
  let at = startsWith(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0 // UTF-8 BOM
  while (at < bytes.length && at < 256 && (bytes[at] === 0x20 || bytes[at] === 0x09 || bytes[at] === 0x0a || bytes[at] === 0x0d)) at++
  return bytes[at] === 0x3c // '<'
}

// Overflow-safe cap check: never multiplies two untrusted dimensions. A dimension alone
// above the cap already fails; otherwise width ≤ cap / height is exact enough (both are
// positive integers and the cap is far below 2^53).
export function exceedsPixelLimit(width: number, height: number, maxPixels: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return true
  if (width > maxPixels || height > maxPixels) return true
  return width > maxPixels / height
}
