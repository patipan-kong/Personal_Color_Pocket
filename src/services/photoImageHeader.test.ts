import { describe, expect, it } from 'vitest'
import { ftyp, jpegFrameHeader, jpegHeader, jpegSegment, pngHeader, riffChunk, text, webpVp8, webpVp8l, webpVp8x } from './photoImage.fixtures'
import { exceedsPixelLimit, isHeifSignature, isMarkupSignature, readImageHeader } from './photoImageHeader'
import { MAX_PHOTO_PIXELS } from './photoImage'

const STATUSES = ['ok', 'truncated', 'malformed', 'unrecognized']

// Seeded PRNG so the fuzz cases are reproducible.
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('JPEG header', () => {
  it('reads baseline and progressive frame dimensions as stored (width, height)', () => {
    expect(readImageHeader(jpegHeader(4000, 3000))).toEqual({ status: 'ok', format: 'jpeg', width: 4000, height: 3000 })
    expect(readImageHeader(jpegHeader(3000, 4000, { marker: 0xc2 }))).toEqual({ status: 'ok', format: 'jpeg', width: 3000, height: 4000 })
    expect(readImageHeader(jpegHeader(65535, 65535))).toEqual({ status: 'ok', format: 'jpeg', width: 65535, height: 65535 })
  })

  it.each([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].map((marker) => [marker.toString(16).toUpperCase(), marker]))('accepts SOF marker FF %s', (_, marker) => {
    expect(readImageHeader(jpegHeader(640, 480, { marker }))).toMatchObject({ status: 'ok', width: 640, height: 480 })
  })

  it('skips many variable-length segments (APPn, COM, ICC, XMP) and the EXIF thumbnail frame inside APP1', () => {
    const before = [
      jpegSegment(0xe2, new Array(3000).fill(7)),     // ICC profile
      jpegSegment(0xe1, [...new Array(500).fill(0xff)]), // XMP-sized run of 0xFF inside a payload
      jpegSegment(0xfe, [0x41, 0x42]),                  // COM
      jpegSegment(0xed, []),                            // empty APP13 (length 2)
    ]
    // The APP1 in jpegHeader embeds a 160×120 frame header; it must not be reported.
    expect(readImageHeader(jpegHeader(8000, 6000, { before }))).toEqual({ status: 'ok', format: 'jpeg', width: 8000, height: 6000 })
  })

  it('does not mistake DHT (C4), JPG (C8) or DAC (CC) for a frame header', () => {
    const before = [jpegSegment(0xc4, [1, 2, 3, 4, 5, 6, 7, 8]), jpegSegment(0xc8, [9, 9, 9, 9, 9, 9, 9]), jpegSegment(0xcc, [1, 2, 3, 4, 5, 6])]
    expect(readImageHeader(jpegHeader(1200, 900, { before }))).toMatchObject({ status: 'ok', width: 1200, height: 900 })
  })

  it('tolerates 0xFF fill bytes and standalone RST/TEM markers between segments', () => {
    const head = jpegHeader(300, 200)
    const withFill = Uint8Array.from([0xff, 0xd8, 0xff, 0xff, 0xff, 0x01, 0xff, 0xd3, ...head.slice(2)])
    expect(readImageHeader(withFill)).toMatchObject({ status: 'ok', width: 300, height: 200 })
  })

  it('reports every cut before the end of the frame dimensions as truncated', () => {
    const head = jpegHeader(4000, 3000)
    const sof = head.findIndex((value, index) => value === 0xff && head[index + 1] === 0xc0 && index > 40)
    const dimensionsEnd = sof + 9 // FF C0 len(2) precision(1) height(2) width(2)
    for (let cut = 3; cut < dimensionsEnd; cut++) {
      expect({ cut, header: readImageHeader(head.slice(0, cut)) }).toEqual({ cut, header: { status: 'truncated', format: 'jpeg' } })
    }
    expect(readImageHeader(head.slice(0, dimensionsEnd))).toMatchObject({ status: 'ok', width: 4000, height: 3000 })
  })

  it('reports a segment length pointing past the available bytes as truncated, without allocating', () => {
    const head = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2, 3])
    expect(readImageHeader(head)).toEqual({ status: 'truncated', format: 'jpeg' })
  })

  it.each([
    ['segment length below 2', [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0, 0, 0, 0]],
    ['segment length landing on non-marker bytes', [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 1, 2, 0x12, 0x34, 0xff, 0xc0]],
    ['garbage where a marker must start', [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0x00, 0xff, 0xc0]],
    ['stuffed zero marker outside entropy data', [0xff, 0xd8, 0xff, 0x00, 0x00, 0x10]],
    ['start of scan before any frame header', [0xff, 0xd8, ...jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]), ...jpegFrameHeader(10, 10)]],
    ['end of image before any frame header', [0xff, 0xd8, 0xff, 0xd9]],
    ['a second start of image', [0xff, 0xd8, 0xff, 0xd8, ...jpegFrameHeader(10, 10)]],
    ['frame header shorter than its fields', [0xff, 0xd8, ...jpegSegment(0xc0, [8, 0, 10, 0])]],
    ['zero width', [0xff, 0xd8, ...jpegFrameHeader(0, 100)]],
    ['zero height (DNL-defined)', [0xff, 0xd8, ...jpegFrameHeader(100, 0)]],
  ])('reports %s as malformed', (_, head) => {
    expect(readImageHeader(Uint8Array.from(head))).toEqual({ status: 'malformed', format: 'jpeg' })
  })

  it('never throws or loops on random bytes after a JPEG signature, or on mutated real headers', () => {
    const next = random(20260923)
    const valid = jpegHeader(4000, 3000)
    for (let round = 0; round < 3000; round++) {
      let head: Uint8Array
      if (round % 2) {
        head = Uint8Array.from({ length: 3 + Math.floor(next() * 200) }, () => Math.floor(next() * 256))
        head.set([0xff, 0xd8, 0xff])
      } else {
        head = valid.slice(0, 3 + Math.floor(next() * (valid.length - 3)))
        for (let flips = 0; flips < 3; flips++) head[3 + Math.floor(next() * (head.length - 3))] = Math.floor(next() * 256)
      }
      const header = readImageHeader(head)
      expect(STATUSES).toContain(header.status)
      if (header.status === 'ok') expect(header.width * header.height).toBeGreaterThan(0)
    }
  })
})

describe('PNG header', () => {
  it('reads IHDR dimensions', () => {
    expect(readImageHeader(pngHeader(1080, 2400))).toEqual({ status: 'ok', format: 'png', width: 1080, height: 2400 })
    expect(readImageHeader(pngHeader(0x7fffffff, 1))).toEqual({ status: 'ok', format: 'png', width: 0x7fffffff, height: 1 })
  })

  it('reports every cut before the end of IHDR height as truncated', () => {
    const head = pngHeader(1080, 2400)
    for (let cut = 8; cut < 24; cut++) expect(readImageHeader(head.slice(0, cut))).toEqual({ status: 'truncated', format: 'png' })
  })

  it('does not recognise a damaged signature (or fewer than 8 bytes) as PNG', () => {
    const head = pngHeader(10, 10)
    head[3] = 0x48
    expect(readImageHeader(head)).toEqual({ status: 'unrecognized' })
    expect(readImageHeader(pngHeader(10, 10).slice(0, 7))).toEqual({ status: 'unrecognized' })
  })

  it.each([
    ['zero width', pngHeader(0, 10)],
    ['zero height', pngHeader(10, 0)],
    ['width above 2^31 − 1', pngHeader(0x80000000, 10)],
    ['height above 2^31 − 1', pngHeader(10, 0xffffffff)],
    ['IHDR length other than 13', pngHeader(10, 10, { length: 12 })],
    ['a first chunk that is not IHDR', pngHeader(10, 10, { type: 'IDAT' })],
  ])('reports %s as malformed', (_, head) => {
    expect(readImageHeader(head)).toEqual({ status: 'malformed', format: 'png' })
  })
})

describe('WebP header', () => {
  it('reads VP8 (lossy) dimensions, ignoring the scale bits', () => {
    expect(readImageHeader(webpVp8(4000, 3000))).toEqual({ status: 'ok', format: 'webp', width: 4000, height: 3000 })
    expect(readImageHeader(webpVp8(16383, 16383, { scale: 3 }))).toEqual({ status: 'ok', format: 'webp', width: 16383, height: 16383 })
  })

  it('reads VP8L (lossless) dimensions', () => {
    expect(readImageHeader(webpVp8l(1, 1))).toEqual({ status: 'ok', format: 'webp', width: 1, height: 1 })
    expect(readImageHeader(webpVp8l(1080, 2400))).toEqual({ status: 'ok', format: 'webp', width: 1080, height: 2400 })
    expect(readImageHeader(webpVp8l(16384, 16384))).toEqual({ status: 'ok', format: 'webp', width: 16384, height: 16384 })
  })

  it('reads VP8X (extended) canvas dimensions, including sizes beyond 14 bits', () => {
    expect(readImageHeader(webpVp8x(20000, 15000))).toEqual({ status: 'ok', format: 'webp', width: 20000, height: 15000 })
    expect(readImageHeader(webpVp8x(2 ** 24, 1))).toEqual({ status: 'ok', format: 'webp', width: 2 ** 24, height: 1 })
  })

  it.each([
    ['VP8', webpVp8(4000, 3000)],
    ['VP8L', webpVp8l(4000, 3000)],
    ['VP8X', webpVp8x(4000, 3000)],
  ])('%s: every cut before the end of the dimensions is truncated', (_, head) => {
    for (let cut = 12; cut < head.length; cut++) expect(readImageHeader(head.slice(0, cut))).toEqual({ status: 'truncated', format: 'webp' })
  })

  it.each([
    ['VP8 with zero width', webpVp8(0, 100)],
    ['VP8 with zero height', webpVp8(100, 0, { scale: 2 })],
    ['VP8 with a bad start code', webpVp8(100, 100, { startCode: [0x9d, 0x01, 0x2b] })],
    ['VP8 whose first frame is not a key frame', webpVp8(100, 100, { keyFrame: false })],
    ['VP8L with a bad signature', webpVp8l(100, 100, { signature: 0x2e })],
    ['VP8L with a non-zero version', webpVp8l(100, 100, { version: 1 })],
    ['VP8 chunk too short for a frame header', riffChunk('VP8 ', [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, 1, 0, 1])],
    ['VP8X chunk too short', riffChunk('VP8X', [0x10, 0, 0, 0, 1, 0, 0, 1, 0])],
    ['an unknown first chunk', riffChunk('ALPH', new Array(10).fill(0))],
  ])('reports %s as malformed', (_, head) => {
    expect(readImageHeader(head)).toEqual({ status: 'malformed', format: 'webp' })
  })

  it('does not recognise RIFF containers that are not WebP', () => {
    const wave = webpVp8(10, 10)
    wave.set(Array.from('WAVE', (char) => char.charCodeAt(0)), 8)
    expect(readImageHeader(wave)).toEqual({ status: 'unrecognized' })
  })

  it('never throws on random bytes after a WebP signature', () => {
    const next = random(1600)
    for (let round = 0; round < 2000; round++) {
      const head = webpVp8x(100, 100)
      const mutated = head.slice(0, 12 + Math.floor(next() * (head.length - 11)))
      for (let at = 12; at < mutated.length; at++) if (next() < .3) mutated[at] = Math.floor(next() * 256)
      expect(STATUSES).toContain(readImageHeader(mutated).status)
    }
  })
})

describe('format identification', () => {
  it('identifies formats by content only; empty and unknown bytes are unrecognized', () => {
    expect(readImageHeader(new Uint8Array())).toEqual({ status: 'unrecognized' })
    expect(readImageHeader(Uint8Array.from([0xff, 0xd8]))).toEqual({ status: 'unrecognized' })
    expect(readImageHeader(text('GIF89a\x10\x00\x10\x00'))).toEqual({ status: 'unrecognized' })
    expect(readImageHeader(ftyp('heic'))).toEqual({ status: 'unrecognized' })
    expect(readImageHeader(ftyp('avif'))).toEqual({ status: 'unrecognized' })
  })

  it('detects HEIC/HEIF ftyp brands, but not AVIF', () => {
    for (const brand of ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1', 'heif']) expect(isHeifSignature(ftyp(brand))).toBe(true)
    expect(isHeifSignature(ftyp('avif'))).toBe(false)
    expect(isHeifSignature(ftyp('isom'))).toBe(false)
    expect(isHeifSignature(ftyp('heic').slice(0, 11))).toBe(false)
    expect(isHeifSignature(jpegHeader(10, 10))).toBe(false)
  })

  it('detects SVG / XML markup, including a BOM and leading whitespace', () => {
    expect(isMarkupSignature(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(true)
    expect(isMarkupSignature(Uint8Array.from([0xef, 0xbb, 0xbf, 0x20, 0x0a, 0x3c, 0x3f]))).toBe(true)
    expect(isMarkupSignature(jpegHeader(10, 10))).toBe(false)
    expect(isMarkupSignature(pngHeader(10, 10))).toBe(false)
    expect(isMarkupSignature(new Uint8Array())).toBe(false)
  })
})

describe('pixel limit (60 MP, inclusive)', () => {
  it('uses the provisional Slice 0 cap', () => {
    expect(MAX_PHOTO_PIXELS).toBe(60_000_000)
  })

  it.each([
    [4000, 3000, false],
    [8000, 6000, false],       // 48 MP
    [6000, 10000, false],      // exactly 60 MP
    [7500, 8000, false],       // exactly 60 MP
    [1, 60_000_000, false],    // exactly 60 MP
    [7746, 7746, true],        // 60,000,516
    [6000, 10001, true],       // 60,006,000
    [1, 60_000_001, true],
    [60_000_001, 1, true],
    [65535, 65535, true],      // JPEG maximum
    [0x7fffffff, 0x7fffffff, true], // PNG maximum: product exceeds 2^53
    [2 ** 24, 2 ** 24, true],  // VP8X maximum
  ])('%i × %i exceeds: %s', (width, height, expected) => {
    expect(exceedsPixelLimit(width, height, MAX_PHOTO_PIXELS)).toBe(expected)
  })

  it('treats non-positive or non-finite dimensions as exceeding (never as safe)', () => {
    for (const [width, height] of [[0, 10], [10, 0], [-1, 10], [Number.NaN, 10], [10, Number.POSITIVE_INFINITY]]) {
      expect(exceedsPixelLimit(width, height, MAX_PHOTO_PIXELS)).toBe(true)
    }
  })
})
