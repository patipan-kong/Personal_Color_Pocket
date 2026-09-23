import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { samplePhotoRegion } from '../domain/photoColor/sampling'
import photoImageSource from './photoImage.ts?raw'
import photoImageHeaderSource from './photoImageHeader.ts?raw'
import { ftyp, jpegHeader, jpegSegment, pngHeader, text, webpVp8, webpVp8l, webpVp8x } from './photoImage.fixtures'
import {
  HEADER_READ_BYTES, MAX_PHOTO_FILE_BYTES, MAX_PHOTO_PIXELS, PhotoImageError, WORKING_MAX_EDGE, openPhoto, workingSize,
} from './photoImage'
import type { PhotoImageErrorCode } from './photoImage'

// jsdom has no createImageBitmap, no canvas 2D context and never loads <img>, and its Blob
// lacks arrayBuffer(). The browser surface is therefore replaced by recording fakes, and
// files by a Blob double; real decoding stays with the Slice 0 spike harness and the
// physical-device matrix.

type Behaviour = 'load' | 'error'

interface Recorder {
  events: string[]
  bitmaps: FakeBitmap[]
  images: FakeImage[]
  canvases: FakeCanvas[]
  createdUrls: string[]
  revokedUrls: string[]
}

let log: Recorder

class FakeBitmap {
  closed = 0
  constructor(public width: number, public height: number) {}
  close() {
    this.closed++
    log.events.push('bitmap.close')
  }
}

// Image fake: loads or errors on `src` assignment, per the queued behaviour.
const imageBehaviour: { load: Behaviour[]; size: { width: number; height: number }; decode: 'ok' | 'reject' } = {
  load: [], size: { width: 0, height: 0 }, decode: 'ok',
}

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  decodeCalls = 0
  srcRemoved = false
  private current = ''
  constructor() {
    log.images.push(this)
  }
  get src() { return this.current }
  set src(value: string) {
    this.current = value
    const behaviour = imageBehaviour.load.shift() ?? 'error'
    log.events.push(`image.${behaviour}`)
    queueMicrotask(() => {
      if (behaviour === 'load') {
        this.naturalWidth = imageBehaviour.size.width
        this.naturalHeight = imageBehaviour.size.height
        this.onload?.()
      } else {
        this.onerror?.()
      }
    })
  }
  removeAttribute(name: string) {
    if (name === 'src') {
      this.current = ''
      this.srcRemoved = true
    }
  }
  decode() {
    this.decodeCalls++
    log.events.push('image.decode')
    return imageBehaviour.decode === 'ok' ? Promise.resolve() : Promise.reject(new DOMException('fail', 'EncodingError'))
  }
}

// Canvas fake: records sizes, context options, draws and reads, and returns `pixels(w, h)`.
const canvasBehaviour: {
  context: 'ok' | 'null'
  draw: 'ok' | 'throw'
  read: 'ok' | 'throw' | 'short'
  pixels: (width: number, height: number) => Uint8ClampedArray
} = { context: 'ok', draw: 'ok', read: 'ok', pixels: (width, height) => new Uint8ClampedArray(width * height * 4) }

class FakeCanvas {
  sizes: [number, number][] = []
  contextOptions: unknown[] = []
  draws: unknown[][] = []
  reads: unknown[][] = []
  smoothing: { enabled?: boolean; quality?: string } = {}
  private w = 300
  private h = 150
  constructor() {
    log.canvases.push(this)
  }
  get width() { return this.w }
  set width(value: number) { this.w = value; this.sizes.push([this.w, this.h]) }
  get height() { return this.h }
  set height(value: number) { this.h = value; this.sizes.push([this.w, this.h]) }
  getContext(kind: string, options: unknown) {
    this.contextOptions.push([kind, options])
    if (canvasBehaviour.context === 'null') return null
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const canvas = this
    return {
      set imageSmoothingEnabled(value: boolean) { canvas.smoothing.enabled = value },
      set imageSmoothingQuality(value: string) { canvas.smoothing.quality = value },
      drawImage(...args: unknown[]) {
        canvas.draws.push(args)
        log.events.push('canvas.draw')
        if (canvasBehaviour.draw === 'throw') throw new DOMException('draw', 'InvalidStateError')
      },
      getImageData(...args: unknown[]) {
        canvas.reads.push(args)
        log.events.push('canvas.read')
        if (canvasBehaviour.read === 'throw') throw new DOMException('read', 'SecurityError')
        const [, , width, height] = args as number[]
        const data = canvasBehaviour.pixels(width, height)
        return { width, height, data: canvasBehaviour.read === 'short' ? data.subarray(4) : data }
      },
    }
  }
}

let bitmapQueue: (FakeBitmap | Error)[] = []
let createImageBitmapMock: ReturnType<typeof vi.fn>
let fetchSpy: ReturnType<typeof vi.fn>

const domError = (name: string) => new DOMException('The source image could not be decoded.', name)

function installBrowser({ bitmapApi = true } = {}) {
  createImageBitmapMock = vi.fn(async (...args: unknown[]) => {
    log.events.push(`createImageBitmap(${args.length})`)
    const next = bitmapQueue.shift()
    if (!next) throw domError('InvalidStateError')
    if (!(next instanceof FakeBitmap)) throw next
    log.bitmaps.push(next)
    return next
  })
  vi.stubGlobal('createImageBitmap', bitmapApi ? createImageBitmapMock : undefined)
  vi.stubGlobal('Image', FakeImage)
  let counter = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:local/${++counter}`
    log.createdUrls.push(url)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => { log.revokedUrls.push(url) })
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'canvas' ? new FakeCanvas() : createElement(tag)) as typeof document.createElement)
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
}

// A File double: `head` followed by zeros up to `size`, materialized only for the ranges
// actually read, so the 30 MB boundary needs no 30 MB buffer. Records every slice read.
function sizedFile(size: number, head: Uint8Array, { name = 'IMG_0001.jpg', type = '' } = {}) {
  const reads: [number, number][] = []
  const blob = {
    size,
    name,
    type,
    slice(start = 0, end = size) {
      reads.push([start, end])
      const chunk = new Uint8Array(Math.max(0, Math.min(end, size) - start))
      chunk.set(head.subarray(start, start + chunk.length))
      return { size: chunk.length, arrayBuffer: async () => chunk.buffer }
    },
  }
  return { file: blob as unknown as File, reads }
}

const fileOf = (content: Uint8Array, name?: string, type?: string) => sizedFile(content.length, content, { name, type }).file

async function expectCode(promise: Promise<unknown>, code: PhotoImageErrorCode) {
  const error = await promise.then(() => null, (reason: unknown) => reason)
  expect(error).toBeInstanceOf(PhotoImageError)
  expect((error as PhotoImageError).code).toBe(code)
  return error as PhotoImageError
}

// Every browser resource created during a call has been released, whatever the outcome.
function expectAllReleased() {
  log.bitmaps.forEach((bitmap) => expect(bitmap.closed).toBe(1))
  expect([...log.revokedUrls].sort()).toEqual([...log.createdUrls].sort())
  log.images.forEach((image) => {
    expect(image.onload).toBeNull()
    expect(image.onerror).toBeNull()
    expect(image.srcRemoved).toBe(true)
  })
  log.canvases.forEach((canvas) => {
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  })
  expect(fetchSpy).not.toHaveBeenCalled()
}

beforeEach(() => {
  log = { events: [], bitmaps: [], images: [], canvases: [], createdUrls: [], revokedUrls: [] }
  bitmapQueue = []
  imageBehaviour.load = []
  imageBehaviour.size = { width: 0, height: 0 }
  imageBehaviour.decode = 'ok'
  canvasBehaviour.context = 'ok'
  canvasBehaviour.draw = 'ok'
  canvasBehaviour.read = 'ok'
  canvasBehaviour.pixels = (width, height) => new Uint8ClampedArray(width * height * 4)
  installBrowser()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('workingSize (long edge ≤ 1600, never upscaled)', () => {
  it.each([
    [4000, 3000, 1600, 1200],  // landscape
    [3000, 4000, 1200, 1600],  // portrait
    [4032, 3024, 1600, 1200],  // 12 MP phone
    [8000, 6000, 1600, 1200],  // 48 MP
    [5000, 5000, 1600, 1600],  // square
    [1080, 2400, 720, 1600],   // screenshot
    [800, 600, 800, 600],      // already small
    [1600, 1200, 1600, 1200],  // exactly at the limit
    [1601, 1601, 1600, 1600],
    [1, 1, 1, 1],
    [3001, 2000, 1600, 1066],  // 1066.31 rounds down
    [3200, 1001, 1600, 501],   // 500.5 rounds half-up
    [10000, 3, 1600, 1],       // 0.48 would round to 0: clamped to 1 px
  ])('%i × %i → %i × %i', (width, height, expectedWidth, expectedHeight) => {
    expect(workingSize(width, height)).toEqual({ width: expectedWidth, height: expectedHeight })
  })

  it('keeps the aspect ratio within one rounding step', () => {
    for (let width = 1601; width < 9000; width += 373) {
      for (let height = 1; height < 9000; height += 611) {
        const size = workingSize(width, height)
        expect(Math.max(size.width, size.height)).toBe(WORKING_MAX_EDGE)
        const scale = WORKING_MAX_EDGE / Math.max(width, height)
        expect(Math.abs(size.width - width * scale)).toBeLessThanOrEqual(.5 + 1e-9)
        expect(Math.abs(size.height - height * scale)).toBeLessThanOrEqual(.5 + 1e-9 + (height * scale < .5 ? 1 : 0))
      }
    }
  })
})

describe('openPhoto: preferred createImageBitmap path', () => {
  it('decodes, downsamples to 1600 px and reads sRGB pixels exactly once', async () => {
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    const result = await openPhoto(fileOf(jpegHeader(4000, 3000)))

    expect(Object.keys(result).sort()).toEqual(['data', 'height', 'width'])
    expect(result.width).toBe(1600)
    expect(result.height).toBe(1200)
    expect(result.data).toBeInstanceOf(Uint8ClampedArray)
    expect(result.data.length).toBe(1600 * 1200 * 4)

    // createImageBitmap(file) with NO resize options (Slice 0 §6).
    expect(createImageBitmapMock).toHaveBeenCalledTimes(1)
    expect(createImageBitmapMock.mock.calls[0]).toHaveLength(1)

    const [canvas] = log.canvases
    expect(log.canvases).toHaveLength(1)
    expect(canvas.contextOptions).toEqual([['2d', { colorSpace: 'srgb' }]])
    expect(canvas.smoothing).toEqual({ enabled: true, quality: 'high' })
    expect(canvas.draws).toEqual([[log.bitmaps[0], 0, 0, 1600, 1200]])
    expect(canvas.reads).toEqual([[0, 0, 1600, 1200, { colorSpace: 'srgb' }]])
    expect(canvas.sizes[1]).toEqual([1600, 1200])

    // Bitmap closed right after drawing, before the read; the canvas is zeroed at the end.
    expect(log.events).toEqual(['createImageBitmap(1)', 'canvas.draw', 'bitmap.close', 'canvas.read'])
    expectAllReleased()
    expect(log.images).toHaveLength(0)
    expect(log.createdUrls).toHaveLength(0)
  })

  it('reads only the header prefix of the file before decoding', async () => {
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    const { file, reads } = sizedFile(20 * 1024 * 1024, jpegHeader(4000, 3000))
    await openPhoto(file)
    expect(reads).toEqual([[0, HEADER_READ_BYTES]])
  })

  it.each([
    ['PNG', pngHeader(1080, 2400), [1080, 2400], [720, 1600]],
    ['WebP VP8', webpVp8(4000, 3000), [4000, 3000], [1600, 1200]],
    ['WebP VP8L', webpVp8l(640, 480), [640, 480], [640, 480]],
    ['WebP VP8X', webpVp8x(3000, 4000), [3000, 4000], [1200, 1600]],
  ])('%s is preflighted from its header and decoded', async (_, head, decoded, expected) => {
    bitmapQueue.push(new FakeBitmap(decoded[0], decoded[1]))
    const result = await openPhoto(fileOf(head, 'photo'))
    expect([result.width, result.height]).toEqual(expected)
    expect(log.images).toHaveLength(0) // no <img> probe for a parsed header
    expectAllReleased()
  })

  it('orientation: working size follows the decoded (EXIF-applied) size, not the raw header', async () => {
    // Raw JPEG frame 4000×3000 with EXIF orientation 6; the browser decodes it upright as 3000×4000.
    bitmapQueue.push(new FakeBitmap(3000, 4000))
    const result = await openPhoto(fileOf(jpegHeader(4000, 3000)))
    expect([result.width, result.height]).toEqual([1200, 1600])
    expect(log.canvases[0].draws[0]).toEqual([log.bitmaps[0], 0, 0, 1200, 1600])
    expectAllReleased()
  })

  it('never upscales a small image', async () => {
    bitmapQueue.push(new FakeBitmap(800, 600))
    const result = await openPhoto(fileOf(pngHeader(800, 600)))
    expect([result.width, result.height]).toEqual([800, 600])
    expect(log.canvases[0].draws[0]).toEqual([log.bitmaps[0], 0, 0, 800, 600])
  })
})

describe('openPhoto: limits', () => {
  it('file size: below and exactly 30 MiB are accepted, one byte more is rejected before any read', async () => {
    expect(MAX_PHOTO_FILE_BYTES).toBe(31_457_280)
    for (const size of [MAX_PHOTO_FILE_BYTES - 1, MAX_PHOTO_FILE_BYTES]) {
      bitmapQueue.push(new FakeBitmap(4000, 3000))
      const { file } = sizedFile(size, jpegHeader(4000, 3000))
      await expect(openPhoto(file)).resolves.toMatchObject({ width: 1600, height: 1200 })
    }
    const { file, reads } = sizedFile(MAX_PHOTO_FILE_BYTES + 1, jpegHeader(4000, 3000))
    await expectCode(openPhoto(file), 'file-too-large')
    expect(reads).toHaveLength(0)
    expect(createImageBitmapMock).toHaveBeenCalledTimes(2)
  })

  it('an empty file is invalid', async () => {
    await expectCode(openPhoto(fileOf(new Uint8Array())), 'invalid-image')
    expect(createImageBitmapMock).not.toHaveBeenCalled()
  })

  it('pixels: exactly 60 MP is decoded; above 60 MP is rejected BEFORE decode', async () => {
    bitmapQueue.push(new FakeBitmap(6000, 10000))
    await expect(openPhoto(fileOf(pngHeader(6000, 10000)))).resolves.toMatchObject({ width: 960, height: 1600 })
    expect(createImageBitmapMock).toHaveBeenCalledTimes(1)

    for (const head of [pngHeader(6000, 10001), jpegHeader(7746, 7746), webpVp8x(12000, 8000), jpegHeader(65535, 65535), pngHeader(0x7fffffff, 0x7fffffff)]) {
      await expectCode(openPhoto(fileOf(head)), 'image-too-large')
    }
    expect(createImageBitmapMock).toHaveBeenCalledTimes(1)
    expect(log.canvases).toHaveLength(1)
  })

  it('a decoded size above the cap is rejected even if the header understated it, and the bitmap is closed', async () => {
    bitmapQueue.push(new FakeBitmap(8000, 8000))
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'image-too-large')
    expect(log.canvases).toHaveLength(0)
    expectAllReleased()
  })

  it('a decoded 0 × 0 image is a decode failure', async () => {
    bitmapQueue.push(new FakeBitmap(0, 0))
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'decode-failed')
    expectAllReleased()
  })
})

describe('openPhoto: header outcomes', () => {
  it.each([
    ['a malformed JPEG', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0, 0])],
    ['a JPEG truncated before its frame header', jpegHeader(4000, 3000).slice(0, 60)],
    ['a malformed PNG', pngHeader(0, 10)],
    ['a truncated PNG', pngHeader(10, 10).slice(0, 20)],
    ['a malformed WebP', webpVp8(100, 100, { startCode: [0, 0, 0] })],
  ])('%s is invalid and never decoded or probed', async (_, head) => {
    await expectCode(openPhoto(fileOf(head)), 'invalid-image')
    expect(createImageBitmapMock).not.toHaveBeenCalled()
    expect(log.images).toHaveLength(0)
  })

  it('a JPEG whose header does not fit in the read prefix is sized by the <img> probe instead', async () => {
    const bigSegments = Array.from({ length: 5 }, () => jpegSegment(0xe2, new Array(65000).fill(1)))
    const head = jpegHeader(4000, 3000, { before: bigSegments })
    expect(head.length).toBeGreaterThan(HEADER_READ_BYTES)
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 3000, height: 4000 }
    bitmapQueue.push(new FakeBitmap(3000, 4000))
    await expect(openPhoto(fileOf(head))).resolves.toMatchObject({ width: 1200, height: 1600 })
    expect(log.events).toEqual(['image.load', 'createImageBitmap(1)', 'canvas.draw', 'bitmap.close', 'canvas.read'])
    expectAllReleased()
  })

  it('an unrecognized format is sized by the probe, then decoded (e.g. AVIF, GIF)', async () => {
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 2000, height: 1000 }
    bitmapQueue.push(new FakeBitmap(2000, 1000))
    await expect(openPhoto(fileOf(ftyp('avif', ['avif', 'mif1'])))).resolves.toMatchObject({ width: 1600, height: 800 })
    expect(log.createdUrls).toHaveLength(1)
    expectAllReleased()
  })

  it('an unrecognized format above the cap is rejected by the probe, before decode', async () => {
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 12000, height: 9000 }
    await expectCode(openPhoto(fileOf(text('GIF89a....'))), 'image-too-large')
    expect(createImageBitmapMock).not.toHaveBeenCalled()
    expectAllReleased()
  })

  it('an unrecognized format that the browser cannot open is unsupported', async () => {
    imageBehaviour.load = ['error']
    await expectCode(openPhoto(fileOf(text('BM6\x00\x00\x00 not really an image'))), 'unsupported-format')
    expect(createImageBitmapMock).not.toHaveBeenCalled()
    expectAllReleased()
  })

  it('a probe reporting a 0 × 0 image is unsupported', async () => {
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 0, height: 0 }
    await expectCode(openPhoto(fileOf(text('\x00\x00\x00\x0cjP  '))), 'unsupported-format')
    expectAllReleased()
  })

  it('SVG / markup is unsupported without being probed or decoded, whatever its name or type', async () => {
    const svg = fileOf(text('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), 'photo.jpg', 'image/jpeg')
    await expectCode(openPhoto(svg), 'unsupported-format')
    expect(log.images).toHaveLength(0)
    expect(createImageBitmapMock).not.toHaveBeenCalled()
  })

  it('does not trust the file name or MIME type: a JPEG named .heic with type image/heic decodes', async () => {
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    const file = fileOf(jpegHeader(4000, 3000), 'IMG_0001.HEIC', 'image/heic')
    await expect(openPhoto(file)).resolves.toMatchObject({ width: 1600, height: 1200 })
  })
})

describe('openPhoto: HEIC / HEIF', () => {
  it('a HEIC the browser cannot open gets its own code; nothing is decoded', async () => {
    imageBehaviour.load = ['error']
    await expectCode(openPhoto(fileOf(ftyp('heic'), 'IMG_0001.HEIC')), 'unsupported-heic')
    expect(createImageBitmapMock).not.toHaveBeenCalled()
    expect(log.createdUrls).toHaveLength(1) // one probe attempt, no retries
    expectAllReleased()
  })

  it.each(['mif1', 'heix', 'msf1'])('brand %s is recognised as HEIF', async (brand) => {
    imageBehaviour.load = ['error']
    await expectCode(openPhoto(fileOf(ftyp(brand))), 'unsupported-heic')
  })

  it('is attempted, not rejected: a browser that decodes HEIC (Safari) opens it normally', async () => {
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 3024, height: 4032 }
    bitmapQueue.push(new FakeBitmap(3024, 4032))
    const file = fileOf(ftyp('heic'), 'IMG_0001.HEIC', 'image/heic')
    await expect(openPhoto(file)).resolves.toMatchObject({ width: 1200, height: 1600 })
    expectAllReleased()
  })

  it('a HEIC that probes but then fails to decode also gets the HEIC code', async () => {
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 3024, height: 4032 }
    bitmapQueue.push(domError('InvalidStateError'))
    await expectCode(openPhoto(fileOf(ftyp('heic'))), 'unsupported-heic')
    expectAllReleased()
  })
})

describe('openPhoto: fallback policy', () => {
  it('createImageBitmap unavailable → <img> fallback, with the object URL revoked', async () => {
    installBrowser({ bitmapApi: false })
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 4000, height: 3000 }
    const result = await openPhoto(fileOf(jpegHeader(4000, 3000)))
    expect([result.width, result.height]).toEqual([1600, 1200])
    const [image] = log.images
    expect(log.images).toHaveLength(1)
    expect(image.decodeCalls).toBe(1)
    expect(log.canvases[0].draws[0]).toEqual([image, 0, 0, 1600, 1200])
    expect(log.createdUrls).toEqual(['blob:local/1'])
    expect(log.revokedUrls).toEqual(['blob:local/1'])
    expect(log.events).toEqual(['image.load', 'image.decode', 'canvas.draw', 'canvas.read'])
    expectAllReleased()
  })

  it.each(['TypeError', 'NotSupportedError'])('createImageBitmap rejecting with %s (API cannot take a Blob) → one <img> fallback', async (name) => {
    bitmapQueue.push(name === 'TypeError' ? new TypeError('Blob not supported') : domError(name))
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 4000, height: 3000 }
    await expect(openPhoto(fileOf(jpegHeader(4000, 3000)))).resolves.toMatchObject({ width: 1600, height: 1200 })
    expect(log.images).toHaveLength(1)
    expectAllReleased()
  })

  it.each(['InvalidStateError', 'EncodingError', 'Error'])('createImageBitmap decode failure (%s) → decode-failed, no second decoder', async (name) => {
    bitmapQueue.push(name === 'Error' ? new Error('boom') : domError(name))
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'decode-failed')
    expect(createImageBitmapMock).toHaveBeenCalledTimes(1)
    expect(log.images).toHaveLength(0)
    expect(log.canvases).toHaveLength(0)
    expectAllReleased()
  })

  it('fallback load failure → decode-failed, object URL revoked', async () => {
    installBrowser({ bitmapApi: false })
    imageBehaviour.load = ['error']
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'decode-failed')
    expect(log.createdUrls).toHaveLength(1)
    expectAllReleased()
  })

  it('fallback decode() rejection → decode-failed, object URL revoked', async () => {
    installBrowser({ bitmapApi: false })
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 4000, height: 3000 }
    imageBehaviour.decode = 'reject'
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'decode-failed')
    expect(log.canvases).toHaveLength(0)
    expectAllReleased()
  })

  it('HEIC on a browser without createImageBitmap: probe fails once, no fallback decode', async () => {
    installBrowser({ bitmapApi: false })
    imageBehaviour.load = ['error']
    await expectCode(openPhoto(fileOf(ftyp('heic'))), 'unsupported-heic')
    expect(log.images).toHaveLength(1)
    expectAllReleased()
  })
})

describe('openPhoto: canvas failures', () => {
  it('no 2D context → canvas-failed; bitmap closed, canvas zeroed', async () => {
    canvasBehaviour.context = 'null'
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'canvas-failed')
    expectAllReleased()
  })

  it('drawImage throwing → canvas-failed; bitmap closed, canvas zeroed', async () => {
    canvasBehaviour.draw = 'throw'
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'canvas-failed')
    expectAllReleased()
  })

  it('getImageData throwing → canvas-failed; bitmap closed, canvas zeroed', async () => {
    canvasBehaviour.read = 'throw'
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'canvas-failed')
    expect(log.canvases[0].reads).toHaveLength(1)
    expectAllReleased()
  })

  it('a pixel buffer of the wrong length → canvas-failed', async () => {
    canvasBehaviour.read = 'short'
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'canvas-failed')
    expectAllReleased()
  })

  it('canvas failure in the fallback path also revokes the object URL', async () => {
    installBrowser({ bitmapApi: false })
    canvasBehaviour.read = 'throw'
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 4000, height: 3000 }
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000))), 'canvas-failed')
    expect(log.revokedUrls).toHaveLength(1)
    expectAllReleased()
  })
})

describe('openPhoto: AbortSignal', () => {
  it('an already-aborted signal rejects before anything is read', async () => {
    const controller = new AbortController()
    controller.abort()
    const { file, reads } = sizedFile(1000, jpegHeader(40, 30))
    await expectCode(openPhoto(file, { signal: controller.signal }), 'aborted')
    expect(reads).toHaveLength(0)
  })

  it('aborting during decode releases the bitmap and never creates a canvas', async () => {
    const controller = new AbortController()
    const bitmap = new FakeBitmap(4000, 3000)
    createImageBitmapMock.mockImplementationOnce(async () => {
      controller.abort()
      log.bitmaps.push(bitmap)
      return bitmap
    })
    await expectCode(openPhoto(fileOf(jpegHeader(4000, 3000)), { signal: controller.signal }), 'aborted')
    expect(bitmap.closed).toBe(1)
    expect(log.canvases).toHaveLength(0)
    expectAllReleased()
  })

  it('aborting during the probe revokes the probe URL and never decodes', async () => {
    const controller = new AbortController()
    imageBehaviour.load = ['load']
    imageBehaviour.size = { width: 100, height: 100 }
    const pending = openPhoto(fileOf(text('GIF89a')), { signal: controller.signal })
    controller.abort()
    await expectCode(pending, 'aborted')
    expect(createImageBitmapMock).not.toHaveBeenCalled()
    expectAllReleased()
  })
})

describe('errors are codes only (privacy)', () => {
  it('never include the file name, bytes, object URL or a cause', async () => {
    imageBehaviour.load = ['error']
    const error = await expectCode(openPhoto(fileOf(ftyp('heic'), 'secret-family-photo.heic')), 'unsupported-heic')
    const serialized = `${error.message} ${String(error)} ${error.stack ?? ''} ${JSON.stringify(error)}`
    expect(serialized).not.toMatch(/secret|family|blob:|ftyp/)
    expect(error.message).toBe('unsupported-heic')
    expect(error.name).toBe('PhotoImageError')
    expect('cause' in error).toBe(false)
    expect(Object.keys(error).sort()).toEqual(['code', 'name'])
  })
})

describe('output feeds the Slice 1 sampler directly', () => {
  it('prepared pixels (with alpha kept) go straight into samplePhotoRegion()', async () => {
    let read: Uint8ClampedArray | undefined
    // Left half: rust fabric (#B7410E) fully opaque. Right half: fully transparent.
    canvasBehaviour.pixels = (width, height) => {
      const data = new Uint8ClampedArray(width * height * 4)
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const index = (row * width + col) * 4
          if (col < width / 2) data.set([0xb7, 0x41, 0x0e, 255], index)
        }
      }
      read = data
      return data
    }
    bitmapQueue.push(new FakeBitmap(4000, 3000))
    const image = await openPhoto(fileOf(pngHeader(4000, 3000)))

    const fabric = samplePhotoRegion(image, { x: 400, y: 600 })
    expect(fabric).toMatchObject({ kind: 'color', hex: '#B7410E' })
    expect(samplePhotoRegion(image, { x: 1200, y: 600 })).toEqual({ kind: 'unavailable', reason: 'transparent' })
    // The very buffer returned by getImageData: no copy, no conversion, alpha untouched.
    expect(image.data).toBe(read)
    expect(image.data[(600 * 1600 + 1200) * 4 + 3]).toBe(0)
  })
})

describe('module boundary and local-only audit', () => {
  const sources = { 'photoImage.ts': photoImageSource, 'photoImageHeader.ts': photoImageHeaderSource }

  it.each(Object.entries(sources))('%s makes no network, storage or reporting calls', (_, source) => {
    const code = source.replace(/\/\/.*$/gm, '')
    for (const forbidden of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /https?:\/\//, /localStorage/, /sessionStorage/, /indexedDB/, /\bconsole\./, /FileReader/, /toDataURL/, /toBlob/, /\bimport\s*\(/, /navigator\./, /postMessage/]) {
      expect({ forbidden: String(forbidden), found: forbidden.test(code) }).toEqual({ forbidden: String(forbidden), found: false })
    }
  })

  it('imports only the pixel type from the domain: never the matcher or the sampler', () => {
    const imports = [...photoImageSource.matchAll(/^import .* from '(.+)'$/gm)].map((match) => match[0])
    expect(imports).toEqual([
      "import type { PixelSource } from '../domain/photoColor/types'",
      "import { exceedsPixelLimit, isHeifSignature, isMarkupSignature, readImageHeader } from './photoImageHeader'",
    ])
    expect([...photoImageHeaderSource.matchAll(/^import /gm)]).toHaveLength(0)
  })
})
