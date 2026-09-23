import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hexToRgb } from '../domain/personalColor/colorUtils'
import { getPalette } from '../domain/personalColor/palettes'
import type { Subtype } from '../domain/personalColor/types'
import { fitContain, imageToDisplay, sampleRadiusFor } from '../domain/photoColor/coordinates'
import { inspectPhotoPoint, inspectPhotoTap } from '../domain/photoColor/inspect'
import type { PixelSource, Size } from '../domain/photoColor/types'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { openPhoto, PhotoImageError } from '../services/photoImage'
import type { PhotoImageErrorCode } from '../services/photoImage'
import { PhotoCheckerPanel } from './PhotoCheckerPanel'
import { KEYBOARD_BIG_STEP_FACTOR, PREPARING_NOTICE_DELAY_MS, initialPhotoPanelState, nudgePoint, photoPanelReducer } from './photoPanelState'
import panelSource from './PhotoCheckerPanel.tsx?raw'
import surfaceSource from './PhotoSurface.tsx?raw'
import stateSource from './photoPanelState.ts?raw'
import cardSource from './PhotoResultCard.tsx?raw'
import placementSource from '../domain/photoColor/placement.ts?raw'

// The pipeline is mocked at the service boundary (jsdom cannot decode images). The pure
// geometry and inspection code runs for real; inspect is wrapped only to observe delegation.
vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))
vi.mock('../domain/photoColor/inspect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/photoColor/inspect')>()
  return { inspectPhotoTap: vi.fn(actual.inspectPhotoTap), inspectPhotoPoint: vi.fn(actual.inspectPhotoPoint) }
})

const openPhotoMock = vi.mocked(openPhoto)
const tapSpy = vi.mocked(inspectPhotoTap)
const pointSpy = vi.mocked(inspectPhotoPoint)
const copy = en.photoChecker
const SUBTYPE: Subtype = 'warm-autumn'
const palette = getPalette(SUBTYPE)
const BEST = palette.best[0].hex.toUpperCase()
const HARDER = palette.harder[0].hex.toUpperCase()

// ---- Test doubles for browser APIs jsdom lacks ----

class FakePointerEvent extends MouseEvent {
  pointerType: string
  isPrimary: boolean
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? 'mouse'
    this.isPrimary = init.isPrimary ?? false
  }
}

class FakeImageData {
  constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {}
}

const observers: FakeResizeObserver[] = []
class FakeResizeObserver {
  observed: Element[] = []
  constructor(readonly callback: () => void) { observers.push(this) }
  observe(element: Element) { this.observed.push(element) }
  disconnect() { this.observed = [] }
}

let context: { putImageData: ReturnType<typeof vi.fn>; getImageData: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn> } | null
let getContextSpy: ReturnType<typeof vi.fn>
// The stage's layout box in CSS px, as the browser would report it. Offset like a real page.
let stageBox: Size = { width: 390, height: 292.5 }
const STAGE_OFFSET = { left: 12, top: 140 }

function setStageBox(box: Size) {
  stageBox = box
  act(() => observers.forEach((observer) => observer.observed.length && observer.callback()))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject })
  return { promise, resolve, reject }
}

function solid(width: number, height: number, hex: string): PixelSource {
  const { r, g, b } = hexToRgb(hex)!
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set([r, g, b, 255], index)
  return { width, height, data }
}

function split(width: number, height: number, left: string, right: string, vertical = false): PixelSource {
  const image = solid(width, height, left)
  const { r, g, b } = hexToRgb(right)!
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (vertical ? row >= height / 2 : col >= width / 2) image.data.set([r, g, b, 255], (row * width + col) * 4)
    }
  }
  return image
}

const photoFile = (name = 'photo.jpg') => new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' })

let fetchSpy: ReturnType<typeof vi.fn>
let createUrlSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  observers.length = 0
  stageBox = { width: 390, height: 292.5 }
  context = { putImageData: vi.fn(), getImageData: vi.fn(), drawImage: vi.fn() }
  getContextSpy = vi.fn(() => context)
  vi.stubGlobal('PointerEvent', FakePointerEvent)
  vi.stubGlobal('ImageData', FakeImageData)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  createUrlSpy = vi.fn(() => 'blob:x')
  Object.defineProperty(URL, 'createObjectURL', { value: createUrlSpy, configurable: true, writable: true })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContextSpy as never)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.classList.contains('photo-stage')) return new DOMRect(0, 0, 0, 0)
    return new DOMRect(STAGE_OFFSET.left, STAGE_OFFSET.top, stageBox.width, stageBox.height)
  })
  openPhotoMock.mockReset()
  tapSpy.mockClear()
  pointSpy.mockClear()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (URL as { createObjectURL?: unknown }).createObjectURL
})

const renderPanel = (subtype: Subtype = SUBTYPE, localized = copy) => {
  const locale = localized === th.photoChecker ? th : en
  return render(<PhotoCheckerPanel copy={localized} garments={locale.styleExamples.garments} language={locale === th ? 'th' : 'en'} presentation="women" subtype={subtype} />)
}
const picker = () => screen.getByLabelText(new RegExp(`^(${copy.choose}|${copy.change})$`)) as HTMLInputElement
const stage = () => document.querySelector<HTMLElement>('.photo-stage')!
const canvas = () => document.querySelector<HTMLCanvasElement>('.photo-canvas')!
const marker = () => document.querySelector<HTMLElement>('.photo-marker')
const feedback = () => document.querySelector<HTMLElement>('.photo-feedback')!

async function choose(file = photoFile()) {
  await userEvent.setup({ delay: null }).upload(picker(), file)
}

async function openReady(image: PixelSource, box?: Size) {
  if (box) stageBox = box
  openPhotoMock.mockResolvedValueOnce(image)
  await choose()
  await act(async () => {})
  expect(stage()).toBeInTheDocument()
}

// Tap at CSS coordinates relative to the stage's top-left.
function tapStage(x: number, y: number, init: PointerEventInit = {}) {
  fireEvent.pointerUp(stage(), { clientX: STAGE_OFFSET.left + x, clientY: STAGE_OFFSET.top + y, isPrimary: true, pointerType: 'touch', button: 0, ...init })
}

const markerCenter = () => ({ x: parseFloat(marker()!.style.left), y: parseFloat(marker()!.style.top) })

describe('photo panel state model (pure reducer)', () => {
  const image = solid(4, 3, BEST)

  it('moves idle → preparing → slow notice → ready deterministically', () => {
    let state = photoPanelReducer(initialPhotoPanelState, { type: 'select', request: 1 })
    expect(state).toEqual({ status: 'preparing', request: 1, slow: false })
    state = photoPanelReducer(state, { type: 'slow', request: 1 })
    expect(state).toEqual({ status: 'preparing', request: 1, slow: true })
    state = photoPanelReducer(state, { type: 'prepared', request: 1, image })
    expect(state).toEqual({ status: 'ready', request: 1, image, selection: null })
  })

  it('ignores every completion from a superseded request', () => {
    const preparingB = photoPanelReducer(photoPanelReducer(initialPhotoPanelState, { type: 'select', request: 1 }), { type: 'select', request: 2 })
    expect(photoPanelReducer(preparingB, { type: 'prepared', request: 1, image })).toBe(preparingB)
    expect(photoPanelReducer(preparingB, { type: 'failed', request: 1, code: 'decode-failed' })).toBe(preparingB)
    expect(photoPanelReducer(preparingB, { type: 'slow', request: 1 })).toBe(preparingB)
    const readyB = photoPanelReducer(preparingB, { type: 'prepared', request: 2, image })
    expect(photoPanelReducer(readyB, { type: 'prepared', request: 1, image: solid(2, 2, HARDER) })).toBe(readyB)
    expect(photoPanelReducer(readyB, { type: 'inspected', request: 1, inspection: inspectPhotoPoint(image, { x: 2, y: 1 }, SUBTYPE) })).toBe(readyB)
  })

  it('never turns aborted into an error, and keeps letterbox taps from changing the selection', () => {
    const preparing = photoPanelReducer(initialPhotoPanelState, { type: 'select', request: 1 })
    expect(photoPanelReducer(preparing, { type: 'failed', request: 1, code: 'aborted' })).toBe(preparing)
    const ready = photoPanelReducer(preparing, { type: 'prepared', request: 1, image })
    const selected = photoPanelReducer(ready, { type: 'inspected', request: 1, inspection: inspectPhotoPoint(image, { x: 2, y: 1.5 }, SUBTYPE) })
    expect(photoPanelReducer(selected, { type: 'inspected', request: 1, inspection: { kind: 'outside-displayed-image' } })).toBe(selected)
  })

  it('selecting a new photo drops the previous image, marker and result', () => {
    const ready = photoPanelReducer(photoPanelReducer(initialPhotoPanelState, { type: 'select', request: 1 }), { type: 'prepared', request: 1, image })
    const selected = photoPanelReducer(ready, { type: 'moved', request: 1, point: { x: 1, y: 1 } })
    expect(photoPanelReducer(selected, { type: 'select', request: 2 })).toEqual({ status: 'preparing', request: 2, slow: false })
  })

  it('nudges in working-image px by the sample radius (×5 with Shift), clamped to [0,W]×[0,H]', () => {
    const photo = solid(1600, 1200, BEST)
    expect(nudgePoint({ x: 800, y: 600 }, 'ArrowRight', false, photo)).toEqual({ x: 824, y: 600 })
    expect(nudgePoint({ x: 800, y: 600 }, 'ArrowUp', true, photo)).toEqual({ x: 800, y: 600 - 24 * KEYBOARD_BIG_STEP_FACTOR })
    expect(nudgePoint({ x: 10, y: 5 }, 'ArrowLeft', false, photo)).toEqual({ x: 0, y: 5 })
    expect(nudgePoint({ x: 1590, y: 1190 }, 'ArrowDown', true, photo)).toEqual({ x: 1590, y: 1200 })
    expect(nudgePoint({ x: 1590, y: 10 }, 'ArrowRight', false, photo)).toEqual({ x: 1600, y: 10 })
    // Small images step by their own (capped) sample radius.
    expect(nudgePoint({ x: 50, y: 50 }, 'ArrowRight', false, solid(100, 100, BEST))).toEqual({ x: 54, y: 50 })
  })
})

describe('picker and selection lifecycle', () => {
  it('offers a gallery-only image picker with a real label and a privacy note', () => {
    renderPanel()
    const input = picker()
    expect(input.type).toBe('file')
    expect(input.accept).toBe('image/*')
    expect(input.hasAttribute('capture')).toBe(false)
    expect(input.multiple).toBe(false)
    expect(screen.getByText(copy.privacy)).toBeInTheDocument()
    expect(stage()).toBeNull()
  })

  it('resets the input and reopens the same file when it is chosen again', async () => {
    renderPanel()
    const file = photoFile()
    openPhotoMock.mockResolvedValue(solid(40, 30, BEST))
    await choose(file)
    expect(picker().value).toBe('')
    await act(async () => {})
    await choose(file)
    expect(picker().value).toBe('')
    expect(openPhotoMock).toHaveBeenCalledTimes(2)
    expect(openPhotoMock.mock.calls.map(([chosen]) => chosen)).toEqual([file, file])
  })

  it('passes a fresh AbortSignal per selection and aborts the previous one', async () => {
    renderPanel()
    const first = deferred<PixelSource>()
    const second = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    await choose(photoFile('a.jpg'))
    await choose(photoFile('b.jpg'))
    const [signalA, signalB] = openPhotoMock.mock.calls.map(([, options]) => options!.signal!)
    expect(signalA).not.toBe(signalB)
    expect(signalA.aborted).toBe(true)
    expect(signalB.aborted).toBe(false)
  })

  it('Photo A finishing after Photo B never replaces Photo B', async () => {
    renderPanel()
    const photoA = deferred<PixelSource>()
    const photoB = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoA.promise).mockReturnValueOnce(photoB.promise)
    await choose(photoFile('a.jpg'))
    await choose(photoFile('b.jpg'))
    await act(async () => { photoB.resolve(solid(30, 40, HARDER)) })
    expect(canvas().width).toBe(30)
    // A's decode could not be interrupted and completes late: ignored, as success or failure.
    await act(async () => { photoA.resolve(solid(80, 60, BEST)) })
    expect(canvas().width).toBe(30)
    expect(canvas().height).toBe(40)
    expect(context!.putImageData).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a late failure from a superseded photo shows no error', async () => {
    renderPanel()
    const photoA = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoA.promise).mockResolvedValueOnce(solid(30, 40, HARDER))
    await choose(photoFile('a.jpg'))
    await choose(photoFile('b.jpg'))
    await act(async () => { photoA.reject(new PhotoImageError('decode-failed')) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(stage()).toBeInTheDocument()
  })

  it('an aborted selection never shows an error', async () => {
    renderPanel()
    openPhotoMock.mockRejectedValueOnce(new PhotoImageError('aborted'))
    await choose()
    await act(async () => {})
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('choosing a new photo clears the previous marker and result immediately', async () => {
    renderPanel()
    await openReady(solid(1600, 1200, BEST))
    tapStage(195, 146.25)
    expect(feedback()).toHaveTextContent(BEST)
    const next = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(next.promise)
    await choose(photoFile('next.jpg'))
    expect(stage()).toBeNull()
    expect(marker()).toBeNull()
    expect(screen.queryByText(BEST)).toBeNull()
    await act(async () => { next.resolve(solid(1600, 1200, HARDER)) })
    expect(marker()).toBeNull()
    expect(feedback()).toHaveTextContent(copy.instruction)
  })

  it('aborts pending preparation, clears the timer and ignores late results on unmount', async () => {
    vi.useFakeTimers()
    const view = renderPanel()
    const pending = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(pending.promise)
    fireEvent.change(picker(), { target: { files: [photoFile()] } })
    const signal = openPhotoMock.mock.calls[0][1]!.signal!
    view.unmount()
    expect(signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { pending.resolve(solid(10, 10, BEST)) })
    expect(document.querySelector('.photo-checker')).toBeNull()
  })

  it('ignores a picker change with no file', () => {
    renderPanel()
    fireEvent.change(picker(), { target: { files: [] } })
    expect(openPhotoMock).not.toHaveBeenCalled()
    expect(document.querySelector('.photo-placeholder')).toBeNull()
  })
})

describe('preparing state', () => {
  it('stays quiet for fast photos and announces only after ~150 ms', async () => {
    vi.useFakeTimers()
    renderPanel()
    const pending = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(pending.promise)
    fireEvent.change(picker(), { target: { files: [photoFile()] } })
    const status = within('.photo-placeholder')
    expect(status).toHaveTextContent('')
    expect(document.querySelector('.photo-checker')).toHaveAttribute('aria-busy', 'true')
    act(() => { vi.advanceTimersByTime(PREPARING_NOTICE_DELAY_MS - 1) })
    expect(status).toHaveTextContent('')
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('status')).toHaveTextContent(copy.preparing)
    // No photo, marker or old result while preparing: nothing can be tapped.
    expect(stage()).toBeNull()
    await act(async () => { pending.resolve(solid(40, 30, BEST)) })
    expect(screen.queryByText(copy.preparing)).toBeNull()
    expect(document.querySelector('.photo-checker')).toHaveAttribute('aria-busy', 'false')
  })

  it('never shows the notice when preparation finishes first, and cancels the timer', async () => {
    vi.useFakeTimers()
    renderPanel()
    openPhotoMock.mockResolvedValueOnce(solid(40, 30, BEST))
    fireEvent.change(picker(), { target: { files: [photoFile()] } })
    await act(async () => {})
    expect(vi.getTimerCount()).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByText(copy.preparing)).toBeNull()
    expect(stage()).toBeInTheDocument()
  })
})

function within(selector: string) {
  return document.querySelector<HTMLElement>(`${selector} [role="status"]`)!
}

describe('errors', () => {
  const codes: Exclude<PhotoImageErrorCode, 'aborted'>[] = ['file-too-large', 'image-too-large', 'invalid-image', 'unsupported-format', 'unsupported-heic', 'decode-failed', 'canvas-failed']

  it.each(codes)('maps %s to a localized alert, and the same file can be retried', async (code) => {
    renderPanel()
    openPhotoMock.mockRejectedValueOnce(new PhotoImageError(code))
    const file = photoFile()
    await choose(file)
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors[code])
    // Retry with the same file (input was reset) replaces the error.
    openPhotoMock.mockResolvedValueOnce(solid(40, 30, BEST))
    await choose(file)
    await act(async () => {})
    expect(screen.queryByRole('alert')).toBeNull()
    expect(stage()).toBeInTheDocument()
  })

  it('explains HEIC without claiming HEIC is never supported', () => {
    for (const text of [en.photoChecker.errors['unsupported-heic'], th.photoChecker.errors['unsupported-heic']]) {
      expect(text).toMatch(/HEIC/)
      expect(text).toMatch(/JPEG/)
      expect(text).toMatch(/PNG/)
      expect(text).toMatch(/WebP/)
    }
    expect(en.photoChecker.errors['unsupported-heic']).toMatch(/^This browser can't read this/)
  })

  it('maps an unexpected rejection to decode-failed without exposing its message', async () => {
    renderPanel()
    openPhotoMock.mockRejectedValueOnce(new Error('secret-name.jpg at blob:abc'))
    await choose()
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors['decode-failed'])
    expect(document.body.textContent).not.toMatch(/secret-name|blob:/)
  })

  it('reports canvas-failed when the display canvas cannot be painted', async () => {
    context = null
    renderPanel()
    openPhotoMock.mockResolvedValueOnce(solid(40, 30, BEST))
    await choose()
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors['canvas-failed'])
    expect(stage()).toBeNull()
  })
})

describe('preview canvas', () => {
  it('paints the PixelSource once, at working size, with no decode, object URL or read-back', async () => {
    renderPanel()
    const image = solid(1600, 1200, BEST)
    await openReady(image)
    expect(canvas().width).toBe(1600)
    expect(canvas().height).toBe(1200)
    expect(getContextSpy).toHaveBeenCalledWith('2d', { colorSpace: 'srgb' })
    expect(context!.putImageData).toHaveBeenCalledTimes(1)
    const [imageData, x, y] = context!.putImageData.mock.calls[0]
    expect(imageData.data).toBe(image.data) // wraps the same buffer, no copy
    expect([imageData.width, imageData.height, x, y]).toEqual([1600, 1200, 0, 0])
    expect(context!.getImageData).not.toHaveBeenCalled()
    expect(context!.drawImage).not.toHaveBeenCalled()
    expect(openPhotoMock).toHaveBeenCalledTimes(1)
    expect(createUrlSpy).not.toHaveBeenCalled()
    expect(canvas()).toHaveAttribute('aria-hidden', 'true')
  })

  it('lays the canvas out with fitContain and changes layout only on resize', async () => {
    renderPanel()
    const image = solid(1600, 1200, BEST)
    await openReady(image, { width: 390, height: 292.5 })
    expect(canvas().style.width).toBe('390px')
    expect(canvas().style.height).toBe('292.5px')
    tapStage(97.5, 73.125)
    const inspections = tapSpy.mock.calls.length
    // Desktop-like box: pillarboxed.
    setStageBox({ width: 960, height: 480 })
    const rect = fitContain(image, { width: 960, height: 480 })
    expect(canvas().style.left).toBe(`${rect.x}px`)
    expect(canvas().style.width).toBe(`${rect.width}px`)
    expect(canvas().style.height).toBe('480px')
    expect(context!.putImageData).toHaveBeenCalledTimes(1)
    expect(openPhotoMock).toHaveBeenCalledTimes(1)
    expect(tapSpy.mock.calls.length).toBe(inspections)
    expect(pointSpy).not.toHaveBeenCalled()
  })

  it('zeroes the display canvas when the photo is replaced or the panel closes', async () => {
    const view = renderPanel()
    await openReady(solid(1600, 1200, BEST))
    const first = canvas()
    openPhotoMock.mockResolvedValueOnce(solid(1200, 1600, HARDER))
    await choose(photoFile('b.jpg'))
    expect(first.width).toBe(0)
    await act(async () => {})
    const second = canvas()
    expect(second.width).toBe(1200)
    view.unmount()
    expect(second.width).toBe(0)
    expect(second.height).toBe(0)
  })
})

describe('pointer interaction through the component', () => {
  it('center tap on a landscape photo samples the center and delegates to inspectPhotoTap', async () => {
    renderPanel()
    const image = solid(1600, 1200, BEST)
    await openReady(image, { width: 390, height: 292.5 })
    tapStage(195, 146.25)
    expect(tapSpy).toHaveBeenCalledTimes(1)
    const [calledImage, tap, subtype] = tapSpy.mock.calls[0]
    expect(calledImage).toBe(image)
    expect(subtype).toBe(SUBTYPE)
    expect(tap).toEqual({ point: { x: 195, y: 146.25 }, imageRect: fitContain(image, { width: 390, height: 292.5 }) })
    expect(feedback()).toHaveTextContent(BEST)
    expect(feedback()).toHaveTextContent(copy.categories['near-face'])
    expect(markerCenter()).toEqual({ x: 195, y: 146.25 })
  })

  it('edge taps on the drawn photo are valid samples', async () => {
    renderPanel()
    await openReady(solid(1600, 1200, BEST), { width: 390, height: 292.5 })
    tapStage(390, 292.5)
    expect(tapSpy.mock.results[0].value).toMatchObject({ kind: 'matched', point: { x: 1600, y: 1200 } })
    expect(markerCenter()).toEqual({ x: 390, y: 292.5 })
    tapStage(0, 0)
    expect(tapSpy.mock.results[1].value).toMatchObject({ kind: 'matched', point: { x: 0, y: 0 } })
  })

  it('a letterbox tap keeps the previous marker and result', async () => {
    renderPanel()
    const image = split(1600, 1200, BEST, HARDER)
    // A wide stage (clamped by max-height) pillarboxes a 4:3 photo: drawn at x 120 … 520.
    await openReady(image, { width: 640, height: 300 })
    tapStage(220, 150)
    expect(feedback()).toHaveTextContent(BEST)
    const before = markerCenter()
    tapStage(60, 150)
    tapStage(600, 150)
    expect(tapSpy.mock.results.slice(1).map(({ value }) => value)).toEqual([{ kind: 'outside-displayed-image' }, { kind: 'outside-displayed-image' }])
    expect(feedback()).toHaveTextContent(BEST)
    expect(markerCenter()).toEqual(before)
  })

  it('maps taps on a portrait photo to the right half', async () => {
    renderPanel()
    const image = split(1200, 1600, BEST, HARDER, true)
    await openReady(image, { width: 360, height: 480 })
    tapStage(180, 100)
    expect(feedback()).toHaveTextContent(BEST)
    tapStage(180, 400)
    expect(feedback()).toHaveTextContent(HARDER)
    expect(feedback()).toHaveTextContent(copy.categories['away-from-face'])
  })

  it('after a resize, the marker follows its working-image point and new taps use the new layout', async () => {
    renderPanel()
    const image = split(1600, 1200, BEST, HARDER)
    await openReady(image, { width: 390, height: 292.5 })
    tapStage(97.5, 73.125) // image (400, 300)
    setStageBox({ width: 780, height: 585 })
    expect(markerCenter()).toEqual(imageToDisplay({ x: 400, y: 300 }, fitContain(image, stageBox), image))
    expect(markerCenter()).toEqual({ x: 195, y: 146.25 })
    expect(feedback()).toHaveTextContent(BEST)
    tapStage(585, 146.25) // image (1200, 300): right half
    expect(tapSpy.mock.results.at(-1)!.value).toMatchObject({ point: { x: 1200, y: 300 } })
    expect(feedback()).toHaveTextContent(HARDER)
  })

  it('ignores non-primary pointers and non-left mouse buttons', async () => {
    renderPanel()
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    tapStage(200, 150, { isPrimary: false })
    tapStage(200, 150, { pointerType: 'mouse', button: 2 })
    expect(tapSpy).not.toHaveBeenCalled()
    tapStage(200, 150, { pointerType: 'mouse', button: 0 })
    expect(tapSpy).toHaveBeenCalledTimes(1)
  })

  it('shows unavailable samples as feedback, not errors, and keeps the marker', async () => {
    renderPanel()
    const image = solid(400, 300, BEST)
    for (let index = 3; index < image.data.length / 2; index += 4) image.data[index] = 0 // top half transparent
    await openReady(image, { width: 400, height: 300 })
    tapStage(200, 50)
    expect(feedback()).toHaveTextContent(copy.unavailable.transparent)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(marker()).not.toBeNull()
    tapStage(200, 250)
    expect(feedback()).toHaveTextContent(BEST)
  })

  it('reports too-few-pixels for a tiny image', async () => {
    renderPanel()
    await openReady(solid(2, 2, BEST), { width: 200, height: 200 })
    tapStage(0, 0)
    expect(feedback()).toHaveTextContent(copy.unavailable['insufficient-pixels'])
  })

  it('shows warnings next to a still-visible category', async () => {
    renderPanel()
    const width = 400
    const image = solid(width, 300, BEST)
    for (let row = 0; row < 300; row++) for (let col = 0; col < width; col++) if ((col * 7 + row * 13) % 10 < 4) image.data.set([255, 255, 255, 255], (row * width + col) * 4)
    await openReady(image, { width: 400, height: 300 })
    tapStage(200, 150)
    const result = tapSpy.mock.results[0].value
    expect(result.match.warnings).toContain('highlight')
    expect(feedback()).toHaveTextContent(copy.warnings.highlight)
    expect(feedback()).toHaveTextContent(copy.categories[result.match.category as keyof typeof copy.categories])
  })
})

describe('keyboard interaction', () => {
  it('Enter on the focused photo creates the first marker at the center and checks it', async () => {
    const user = userEvent.setup()
    renderPanel()
    const image = solid(1600, 1200, BEST)
    await openReady(image, { width: 390, height: 292.5 })
    // After choosing, focus is still on the picker (as in a browser); Tab reaches the photo next.
    expect(picker()).toHaveFocus()
    await user.tab()
    expect(stage()).toHaveFocus()
    expect(stage()).toHaveAttribute('aria-describedby', document.querySelector('.photo-hint')!.id)
    expect(document.querySelector('.photo-hint')).toHaveTextContent(copy.keyboardHint)
    await user.keyboard('{Enter}')
    expect(pointSpy).toHaveBeenCalledWith(image, { x: 800, y: 600 }, SUBTYPE)
    expect(feedback()).toHaveTextContent(BEST)
    expect(markerCenter()).toEqual({ x: 195, y: 146.25 })
    expect(stage()).toHaveFocus()
  })

  it('the first arrow places the marker at the center, then arrows move it; Enter evaluates', async () => {
    const user = userEvent.setup()
    renderPanel()
    const image = split(1600, 1200, BEST, HARDER)
    await openReady(image, { width: 400, height: 300 })
    stage().focus()
    await user.keyboard('{ArrowLeft}')
    expect(markerCenter()).toEqual({ x: 200, y: 150 })
    expect(feedback()).toHaveTextContent(copy.pending)
    expect(pointSpy).not.toHaveBeenCalled()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(markerCenter().x).toBeCloseTo(200 - 2 * 24 / 4, 9)
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(markerCenter().y).toBeCloseTo(150 - 120 / 4, 9)
    await user.keyboard('{Enter}')
    expect(pointSpy).toHaveBeenLastCalledWith(image, { x: 752, y: 480 }, SUBTYPE)
    expect(feedback()).toHaveTextContent(BEST)
    // Space also evaluates.
    await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift} ')
    expect(pointSpy).toHaveBeenLastCalledWith(image, { x: 992, y: 480 }, SUBTYPE)
    expect(feedback()).toHaveTextContent(HARDER)
  })

  it('clamps at the image boundaries', async () => {
    const user = userEvent.setup()
    renderPanel()
    const image = solid(1600, 1200, BEST)
    await openReady(image, { width: 400, height: 300 })
    stage().focus()
    await user.keyboard('{ArrowLeft}')
    for (let press = 0; press < 12; press++) await user.keyboard('{Shift>}{ArrowLeft}{ArrowUp}{/Shift}')
    await user.keyboard('{Enter}')
    expect(pointSpy).toHaveBeenLastCalledWith(image, { x: 0, y: 0 }, SUBTYPE)
    for (let press = 0; press < 20; press++) await user.keyboard('{Shift>}{ArrowRight}{ArrowDown}{/Shift}')
    await user.keyboard('{Enter}')
    expect(pointSpy).toHaveBeenLastCalledWith(image, { x: 1600, y: 1200 }, SUBTYPE)
    expect(markerCenter()).toEqual({ x: 400, y: 300 })
  })

  it('moves by working-image steps regardless of preview size, and resize keeps the point', async () => {
    const user = userEvent.setup()
    renderPanel()
    const image = solid(1600, 1200, BEST)
    await openReady(image, { width: 200, height: 150 })
    stage().focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    setStageBox({ width: 800, height: 600 })
    await user.keyboard('{ArrowRight}{Enter}')
    expect(pointSpy).toHaveBeenLastCalledWith(image, { x: 800 + 2 * sampleRadiusFor(image), y: 600 }, SUBTYPE)
    expect(markerCenter()).toEqual({ x: 424, y: 300 })
    expect(stage()).toHaveFocus()
  })

  it('does not scroll the page with arrows/space and leaves other keys alone', async () => {
    renderPanel()
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    const arrow = fireEvent.keyDown(stage(), { key: 'ArrowDown' })
    const space = fireEvent.keyDown(stage(), { key: ' ' })
    const tab = fireEvent.keyDown(stage(), { key: 'Tab' })
    expect([arrow, space, tab]).toEqual([false, false, true]) // false = default prevented
  })
})

describe('accessibility and localization', () => {
  it('names the surface, announces results politely and errors assertively', async () => {
    renderPanel()
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    expect(screen.getByRole('group', { name: copy.surfaceLabel })).toBe(stage())
    expect(stage().tabIndex).toBe(0)
    expect(feedback().querySelector('.photo-summary')).toHaveAttribute('role', 'status')
    expect(feedback()).toHaveTextContent(copy.instruction)
    tapStage(200, 150)
    expect(feedback()).toHaveTextContent(`${copy.sampleLabel}${BEST}${copy.categories['near-face']}`)
  })

  it('renders Thai copy for the whole flow', async () => {
    renderPanel(SUBTYPE, th.photoChecker)
    expect(screen.getByLabelText(th.photoChecker.choose)).toBeInTheDocument()
    expect(screen.getByText(th.photoChecker.privacy)).toBeInTheDocument()
    openPhotoMock.mockResolvedValueOnce(solid(400, 300, BEST))
    await userEvent.setup().upload(screen.getByLabelText(th.photoChecker.choose), photoFile())
    await act(async () => {})
    expect(screen.getByLabelText(th.photoChecker.change)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: th.photoChecker.surfaceLabel })).toBeInTheDocument()
    tapStage(200, 150)
    expect(feedback()).toHaveTextContent(th.photoChecker.categories['near-face'])
  })

  it('has complete EN and TH copy for every state this slice can show', () => {
    for (const localized of [en.photoChecker, th.photoChecker]) {
      const strings = [localized.modeAria, localized.modes.manual, localized.modes.photo, localized.choose, localized.change, localized.privacy, localized.preparing,
        localized.instruction, localized.surfaceLabel, localized.keyboardHint, localized.pending, localized.sampleLabel,
        ...Object.values(localized.categories), ...Object.values(localized.warnings), ...Object.values(localized.unavailable), ...Object.values(localized.errors)]
      strings.forEach((text) => expect(text.trim().length).toBeGreaterThan(0))
      expect(Object.keys(localized.categories).sort()).toEqual(['away-from-face', 'near-face', 'neutral-base', 'outside', 'related'])
      expect(Object.keys(localized.errors)).not.toContain('aborted')
      expect(JSON.stringify(localized)).not.toMatch(/%/)
    }
    ;[th.photoChecker.privacy, th.photoChecker.instruction, ...Object.values(th.photoChecker.categories)].forEach((text) => expect(text).toMatch(/[ก-๙]/))
  })
})

describe('Slice 5b guidance inside the panel', () => {
  it('lays out photo and result as two blocks (stacked on mobile, side by side on desktop via CSS)', async () => {
    renderPanel()
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    const layout = document.querySelector('.photo-layout')!
    expect([...layout.children].map((child) => child.className)).toEqual(['photo-view', 'photo-feedback'])
    expect(document.querySelector('.photo-view')!.contains(stage())).toBe(true)
    expect(stage().nextElementSibling).toHaveClass('photo-hint')
  })

  it('a tap shows the full guidance; a new tap replaces it cleanly and keeps the photo', async () => {
    renderPanel()
    await openReady(split(1600, 1200, BEST, HARDER), { width: 400, height: 300 })
    const photo = canvas()
    tapStage(100, 150)
    expect(feedback()).toHaveTextContent(copy.categories['near-face'])
    expect(document.querySelectorAll('.photo-guidance')).toHaveLength(1)
    expect(feedback().querySelector('.photo-pairing h2')).toHaveTextContent(copy.pairing.around.heading)
    const firstCard = document.querySelector('.photo-guidance')
    tapStage(300, 150)
    expect(feedback()).toHaveTextContent(copy.categories['away-from-face'])
    expect(feedback()).not.toHaveTextContent(copy.categories['near-face'])
    expect(document.querySelectorAll('.photo-guidance')).toHaveLength(1)
    expect(document.querySelector('.photo-guidance')).not.toBe(firstCard)
    expect(feedback().querySelector('.photo-pairing h2')).toHaveTextContent(copy.pairing['near-face'].heading)
    expect(canvas()).toBe(photo)
    expect(openPhotoMock).toHaveBeenCalledTimes(1)
  })

  it('moving the marker by keyboard removes the old guidance until Enter checks the new spot', async () => {
    renderPanel()
    await openReady(split(1600, 1200, BEST, HARDER), { width: 400, height: 300 })
    tapStage(100, 150)
    expect(document.querySelector('.photo-guidance')).not.toBeNull()
    stage().focus()
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    expect(document.querySelector('.photo-guidance')).toBeNull()
    expect(feedback().querySelector('.photo-summary')).toHaveTextContent(copy.pending)
    fireEvent.keyDown(stage(), { key: 'Enter' })
    expect(document.querySelector('.photo-guidance')).not.toBeNull()
  })

  it('a real glare sample keeps its category, placement and pairings, with the warning after them', async () => {
    renderPanel()
    const width = 400
    const image = solid(width, 300, BEST)
    for (let row = 0; row < 300; row++) for (let col = 0; col < width; col++) if ((col * 7 + row * 13) % 10 < 4) image.data.set([255, 255, 255, 255], (row * width + col) * 4)
    await openReady(image, { width: 400, height: 300 })
    tapStage(200, 150)
    const result = tapSpy.mock.results[0].value
    expect(result.match.warnings).toContain('highlight')
    expect(feedback().querySelector('.photo-category')).toHaveTextContent(copy.categories[result.match.category as keyof typeof copy.categories])
    expect(feedback().querySelectorAll('.photo-place').length).toBeGreaterThan(0)
    expect(feedback().querySelectorAll('.photo-pairs .color-chip')).toHaveLength(result.match.pairWith.length)
    expect(feedback().querySelector('.photo-warnings')).toHaveTextContent(copy.warnings.highlight)
  })

  it('presentation changes example pieces only', async () => {
    const { unmount } = render(<PhotoCheckerPanel copy={copy} garments={en.styleExamples.garments} language="en" presentation="men" subtype={SUBTYPE} />)
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    tapStage(200, 150)
    const men = {
      category: feedback().querySelector('.photo-category')!.textContent,
      areas: [...document.querySelectorAll('.photo-place span')].map((node) => node.textContent),
      examples: [...document.querySelectorAll('.photo-place small')].map((node) => node.textContent).join(' | '),
    }
    unmount()
    renderPanel()
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    tapStage(200, 150)
    expect(feedback().querySelector('.photo-category')!.textContent).toBe(men.category)
    expect([...document.querySelectorAll('.photo-place span')].map((node) => node.textContent)).toEqual(men.areas)
    expect([...document.querySelectorAll('.photo-place small')].map((node) => node.textContent).join(' | ')).not.toBe(men.examples)
    expect(men.examples).not.toMatch(/Dress|Skirt|Blouse/)
  })
})

describe('focus styling by input type', () => {
  it('marks pointer focus so the ring and keyboard hint are kept for keyboard use', async () => {
    renderPanel()
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    expect(stage()).toHaveAttribute('data-input', 'keyboard')
    fireEvent.pointerDown(stage(), { isPrimary: true, pointerType: 'touch' })
    tapStage(200, 150)
    expect(document.activeElement).toBe(stage())
    expect(stage()).toHaveAttribute('data-input', 'pointer')
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' })
    expect(stage()).toHaveAttribute('data-input', 'keyboard')
  })
})

describe('privacy', () => {
  it('stores nothing and makes no network request during a full photo flow', async () => {
    localStorage.setItem('personal-color-pocket:v1', '{"keep":true}')
    const before = { ...localStorage }
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    renderPanel()
    await openReady(solid(400, 300, BEST), { width: 400, height: 300 })
    tapStage(200, 150)
    stage().focus()
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    fireEvent.keyDown(stage(), { key: 'Enter' })
    expect(setItem).not.toHaveBeenCalled()
    expect({ ...localStorage }).toEqual(before)
    expect(sessionStorage.length).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(createUrlSpy).not.toHaveBeenCalled()
  })

  it('has no storage, network, URL or colour-math code of its own', () => {
    for (const source of [panelSource, surfaceSource, stateSource, cardSource, placementSource]) {
      const code = source.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'sendBeacon', 'createObjectURL', 'FileReader', 'getImageData', 'devicePixelRatio', 'samplePhotoRegion', 'matchPhotoColor', 'rgbToOklab', 'console']) {
        expect(code, forbidden).not.toMatch(new RegExp(`\\b${forbidden}\\b`))
      }
    }
  })
})
