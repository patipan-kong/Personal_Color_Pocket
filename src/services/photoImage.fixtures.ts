// Test-only byte builders for the Slice 3 header tests. Headers only (a few dozen bytes):
// no real image data, nothing decodable, no binary fixtures in the repository.

const bytes = (...parts: (number | number[] | Uint8Array)[]) =>
  Uint8Array.from(parts.flatMap((part) => typeof part === 'number' ? [part] : Array.from(part)))
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0))
const u16be = (value: number) => [(value >>> 8) & 0xff, value & 0xff]
const u32be = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
const u32le = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
const u24le = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff]

// A JPEG marker segment: FF <marker> <length incl. itself> <payload>.
export const jpegSegment = (marker: number, payload: number[]) => [0xff, marker, ...u16be(payload.length + 2), ...payload]

export const jpegFrameHeader = (width: number, height: number, marker = 0xc0) =>
  jpegSegment(marker, [8, ...u16be(height), ...u16be(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])

// SOI, JFIF APP0, an EXIF APP1 that embeds a 160×120 thumbnail frame header (must be
// skipped, never read), DQT, the real frame header, DHT, SOS.
export function jpegHeader(width: number, height: number, { marker = 0xc0, before = [] as number[][] } = {}) {
  const thumbnail = [0xff, 0xd8, ...jpegFrameHeader(160, 120)]
  return bytes(
    0xff, 0xd8,
    jpegSegment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    jpegSegment(0xe1, [...ascii('Exif'), 0, 0, ...thumbnail]),
    ...before,
    jpegSegment(0xdb, [0, ...new Array(64).fill(1)]),
    jpegFrameHeader(width, height, marker),
    jpegSegment(0xc4, [0, ...new Array(16).fill(0)]),
    jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]),
  )
}

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function pngHeader(width: number, height: number, { length = 13, type = 'IHDR' } = {}) {
  return bytes(PNG_SIGNATURE, u32be(length), ascii(type), u32be(width), u32be(height), 8, 6, 0, 0, 0, 0, 0, 0, 0)
}

const riff = (chunk: string, payload: number[]) =>
  bytes(ascii('RIFF'), u32le(4 + 8 + payload.length), ascii('WEBP'), ascii(chunk), u32le(payload.length), payload)

// Lossy: frame tag, start code 9D 01 2A, 14-bit width/height with 2 scale bits on top.
export function webpVp8(width: number, height: number, { scale = 0, startCode = [0x9d, 0x01, 0x2a], keyFrame = true } = {}) {
  const w = (scale << 14) | width
  const h = (scale << 14) | height
  return riff('VP8 ', [keyFrame ? 0x10 : 0x11, 0x02, 0x00, ...startCode, w & 0xff, w >>> 8, h & 0xff, h >>> 8])
}

// Lossless: signature 0x2F, then width−1 (14 bits), height−1 (14 bits), alpha (1), version (3).
export function webpVp8l(width: number, height: number, { signature = 0x2f, version = 0 } = {}) {
  const bits = ((width - 1) | ((height - 1) << 14) | (1 << 28) | (version << 29)) >>> 0
  return riff('VP8L', [signature, ...u32le(bits)])
}

// Extended: flags, 3 reserved bytes, canvas width−1 and height−1 as 24-bit little endian.
export function webpVp8x(width: number, height: number, { flags = 0x10 } = {}) {
  return riff('VP8X', [flags, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)])
}

export const riffChunk = riff

// ISO BMFF ftyp box: size, "ftyp", major brand, minor version, compatible brands.
export const ftyp = (major: string, compatible: string[] = ['mif1']) =>
  bytes(u32be(16 + 4 * compatible.length), ascii('ftyp'), ascii(major), 0, 0, 0, 0, ...compatible.map(ascii))

export const text = (value: string) => bytes(ascii(value))
