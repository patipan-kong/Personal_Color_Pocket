import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { hexToRgb } from '../domain/personalColor/colorUtils'
import { getPalette } from '../domain/personalColor/palettes'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import type { Subtype } from '../domain/personalColor/types'
import { fitContain, imageToDisplay } from '../domain/photoColor/coordinates'
import { inspectPhotoPoint, inspectPhotoTap } from '../domain/photoColor/inspect'
import type { ImagePoint, PhotoTapInspection, PixelSource, Size } from '../domain/photoColor/types'
import type { LocaleCopy } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { openPhoto, PhotoImageError } from '../services/photoImage'
import { saveState, STORAGE_KEY } from '../services/persistence'
import stylesSource from '../styles.css?raw'
import { PhotoCheckerPanel } from './PhotoCheckerPanel'
import type { PhotoPanelErrorCode } from './photoPanelState'

// V1.2 Slice 6 hardening (docs/V1_2_SLICE_6_HARDENING.md). Adversarial lifecycle, race, ownership,
// resize, pointer, keyboard, error and mode-isolation checks on the real panel and App. The image
// service is mocked at its boundary (jsdom cannot decode), so every completion order is exact;
// geometry, sampling, matching and the result card run for real.

vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))
vi.mock('../domain/photoColor/inspect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/photoColor/inspect')>()
  return { inspectPhotoTap: vi.fn(actual.inspectPhotoTap), inspectPhotoPoint: vi.fn(actual.inspectPhotoPoint) }
})

const openPhotoMock = vi.mocked(openPhoto)
const tapSpy = vi.mocked(inspectPhotoTap)
const pointSpy = vi.mocked(inspectPhotoPoint)
const SUBTYPE: Subtype = 'warm-autumn'
const palette = getPalette(SUBTYPE)
const BEST = palette.best[0].hex.toUpperCase()
const HARDER = palette.harder[0].hex.toUpperCase()
const ERROR_CODES: PhotoPanelErrorCode[] = ['file-too-large', 'image-too-large', 'invalid-image', 'unsupported-format', 'unsupported-heic', 'decode-failed', 'canvas-failed']

// ---- Browser doubles jsdom lacks. They count what is alive, so accumulation is visible. ----

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

// Live observers: constructed and not yet disconnected.
const observers = new Set<FakeResizeObserver>()
class FakeResizeObserver {
  observed: Element[] = []
  constructor(readonly callback: () => void) { observers.add(this) }
  observe(element: Element) { this.observed.push(element) }
  disconnect() { this.observed = []; observers.delete(this) }
}

const canvases = new Set<HTMLCanvasElement>()
let putImageData: ReturnType<typeof vi.fn>
let contextAvailable = true
let stageBox: Size = { width: 400, height: 300 }
const STAGE_OFFSET = { left: 12, top: 140 }

beforeEach(() => {
  observers.clear()
  canvases.clear()
  stageBox = { width: 400, height: 300 }
  contextAvailable = true
  putImageData = vi.fn()
  vi.stubGlobal('PointerEvent', FakePointerEvent)
  vi.stubGlobal('ImageData', FakeImageData)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvases.add(this)
    return contextAvailable ? { putImageData } : null
  } as never)
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
})

// ---- Fixtures and helpers ----

function solid(width: number, height: number, hex: string): PixelSource {
  const { r, g, b } = hexToRgb(hex)!
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set([r, g, b, 255], index)
  return { width, height, data }
}

// Left/right (or top/bottom) halves, so a tap proves which half was sampled.
function split(width: number, height: number, first: string, second: string, vertical = false): PixelSource {
  const image = solid(width, height, first)
  const { r, g, b } = hexToRgb(second)!
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (vertical ? row >= height / 2 : col >= width / 2) image.data.set([r, g, b, 255], (row * width + col) * 4)
    }
  }
  return image
}

// 2 px vertical stripes: the sampler's `mixed` flag.
function stripes(width: number, height: number, first: string, second: string): PixelSource {
  const image = solid(width, height, first)
  const { r, g, b } = hexToRgb(second)!
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) if (Math.floor(col / 2) % 2) image.data.set([r, g, b, 255], (row * width + col) * 4)
  return image
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject })
  return { promise, resolve, reject }
}

const photoFile = (name = 'photo.jpg') => new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' })

const renderPanel = (locale: LocaleCopy = en, subtype: Subtype = SUBTYPE) =>
  render(<PhotoCheckerPanel copy={locale.photoChecker} resultCopy={locale.colorResult} garments={locale.styleExamples.garments} language={locale === th ? 'th' : 'en'} presentation="women" subtype={subtype} />)

const picker = () => document.querySelector<HTMLInputElement>('.photo-picker input')!
const stage = () => document.querySelector<HTMLElement>('.photo-stage')
const canvas = () => document.querySelector<HTMLCanvasElement>('.photo-canvas')
const marker = () => document.querySelector<HTMLElement>('.photo-marker')
const preparing = () => document.querySelector('.photo-placeholder') !== null
const alertText = () => screen.queryByRole('alert')?.textContent ?? null
const shownHex = () => document.querySelector('.check-hex')?.textContent ?? null
const $ = (selector: string) => document.querySelector<HTMLElement>(selector)

// One `change` event, as the browser fires it. Synchronous, so the selection order is exact.
const select = (file = photoFile()) => { fireEvent.change(picker(), { target: { files: [file] } }) }
const settle = () => act(async () => {})

async function openReady(image: PixelSource, box?: Size) {
  if (box) stageBox = box
  openPhotoMock.mockResolvedValueOnce(image)
  select()
  await settle()
  expect(stage()).not.toBeNull()
}

function setStageBox(box: Size) {
  stageBox = box
  act(() => observers.forEach((observer) => observer.observed.length && observer.callback()))
}

// Tap at CSS px relative to the stage's top-left corner.
function tapStage(x: number, y: number) {
  fireEvent.pointerUp(stage()!, { clientX: STAGE_OFFSET.left + x, clientY: STAGE_OFFSET.top + y, isPrimary: true, pointerType: 'touch', button: 0 })
}

const markerCenter = () => ({ x: parseFloat(marker()!.style.left), y: parseFloat(marker()!.style.top) })
const lastTap = () => tapSpy.mock.results.at(-1)!.value as PhotoTapInspection
const tappedPoint = () => { const inspection = lastTap(); return inspection.kind === 'outside-displayed-image' ? null : inspection.point }

// Which of `targets` the React tree still references through component props, state, refs or
// effect deps (current fibers only; DOM nodes and React-internal back links are not followed).
// It proves APPLICATION ownership only: it says nothing about when a browser frees memory.
function reactReferences(container: HTMLElement, targets: object[]) {
  const key = Object.keys(container).find((name) => name.startsWith('__reactContainer$'))
  if (!key) return []
  const wanted = new Set(targets)
  const found = new Set<object>()
  const seen = new Set<object>()
  const skip = new Set(['return', 'alternate', 'stateNode', 'child', 'sibling', 'deletions'])
  const scan = (value: unknown) => {
    if (!value || typeof value !== 'object' || seen.has(value) || value instanceof Node) return
    seen.add(value)
    if (wanted.has(value)) found.add(value)
    if (ArrayBuffer.isView(value)) return
    for (const [name, child] of Object.entries(value)) if (!name.startsWith('_') && !skip.has(name)) scan(child)
  }
  type Fiber = { memoizedProps: unknown; memoizedState: unknown; updateQueue: unknown; child: Fiber | null; sibling: Fiber | null }
  const walk = (fiber: Fiber | null) => {
    for (let node = fiber; node; node = node.sibling) {
      scan(node.memoizedProps)
      scan(node.memoizedState)
      scan(node.updateQueue)
      walk(node.child)
    }
  }
  walk((container as unknown as Record<string, { stateNode: { current: Fiber } }>)[key].stateNode.current)
  return [...found]
}

describe('Slice 6: adversarial file-selection races', () => {
  const images = { A: solid(40, 30, BEST), B: solid(30, 40, HARDER), C: solid(50, 20, '#2E86AB') }
  type Name = keyof typeof images

  function selectThree() {
    const pending = { A: deferred<PixelSource>(), B: deferred<PixelSource>(), C: deferred<PixelSource>() }
    openPhotoMock.mockReturnValueOnce(pending.A.promise).mockReturnValueOnce(pending.B.promise).mockReturnValueOnce(pending.C.promise)
    renderPanel()
    select(photoFile('a.jpg'))
    select(photoFile('b.jpg'))
    select(photoFile('c.jpg'))
    return pending
  }

  const signals = () => openPhotoMock.mock.calls.map(([, options]) => options!.signal!)

  const expectOnly = (name: Name) => {
    expect(canvas()!.width).toBe(images[name].width)
    expect(canvas()!.height).toBe(images[name].height)
    expect(putImageData).toHaveBeenCalledTimes(1)
    expect(putImageData.mock.calls[0][0].data).toBe(images[name].data)
    expect(alertText()).toBeNull()
  }

  it.each([['B → A → C', ['B', 'A', 'C']], ['C → A → B', ['C', 'A', 'B']]] as const)('A, B, C chosen in turn and resolved %s: only C ever becomes active', async (_, order) => {
    const pending = selectThree()
    // Each new choice aborted the one before; only C is still wanted.
    expect(signals().map((signal) => signal.aborted)).toEqual([true, true, false])
    let resolvedC = false
    for (const name of order) {
      await act(async () => pending[name].resolve(images[name]))
      resolvedC ||= name === 'C'
      if (resolvedC) expectOnly('C')
      else {
        expect(stage()).toBeNull()
        expect(preparing()).toBe(true)
        expect(putImageData).not.toHaveBeenCalled()
      }
    }
  })

  it('A failing after B succeeded changes nothing', async () => {
    const photoA = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoA.promise).mockResolvedValueOnce(images.B)
    renderPanel()
    select(photoFile('a.jpg'))
    select(photoFile('b.jpg'))
    await settle()
    await act(async () => photoA.reject(new PhotoImageError('decode-failed')))
    expectOnly('B')
  })

  it('A succeeding after B failed keeps B\'s error, and never shows A', async () => {
    const photoA = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoA.promise).mockRejectedValueOnce(new PhotoImageError('unsupported-heic'))
    renderPanel()
    select(photoFile('a.jpg'))
    select(photoFile('b.heic'))
    await settle()
    expect(alertText()).toBe(en.photoChecker.errors['unsupported-heic'])
    await act(async () => photoA.resolve(images.A))
    expect(alertText()).toBe(en.photoChecker.errors['unsupported-heic'])
    expect(stage()).toBeNull()
    expect(putImageData).not.toHaveBeenCalled()
  })

  it.each([
    ['its abort', new PhotoImageError('aborted')],
    ['a raw browser error', new DOMException('Failed to decode C:\\Users\\me\\secret-family-photo.jpg', 'EncodingError')],
    ['a stale "too large" error', new PhotoImageError('file-too-large')],
  ])('A reporting %s after B succeeded is silent and cannot replace B', async (_, error) => {
    const photoA = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoA.promise).mockResolvedValueOnce(images.B)
    renderPanel()
    select(photoFile('a.jpg'))
    select(photoFile('b.jpg'))
    await settle()
    await act(async () => photoA.reject(error))
    expectOnly('B')
  })

  it('unmounting while photos decode aborts them, clears the timer, and a late result or error does nothing', async () => {
    vi.useFakeTimers()
    const consoleError = vi.spyOn(console, 'error')
    const photoA = deferred<PixelSource>()
    const photoB = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoA.promise).mockReturnValueOnce(photoB.promise)
    const view = renderPanel()
    select(photoFile('a.jpg'))
    select(photoFile('b.jpg'))
    expect(vi.getTimerCount()).toBe(1)
    view.unmount()
    expect(signals().map((signal) => signal.aborted)).toEqual([true, true])
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { photoA.resolve(images.A); photoB.reject(new PhotoImageError('decode-failed')) })
    await act(async () => { vi.runAllTimers() })
    expect(document.body.innerHTML).toBe('<div></div>')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('choosing the same file again while it is still preparing aborts the first attempt and shows the second', async () => {
    const file = photoFile('same.jpg')
    const first = deferred<PixelSource>()
    const second = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    renderPanel()
    select(file)
    select(file)
    expect(openPhotoMock.mock.calls.map(([chosen]) => chosen)).toEqual([file, file])
    expect(signals().map((signal) => signal.aborted)).toEqual([true, false])
    await act(async () => second.resolve(images.B))
    await act(async () => first.resolve(images.A))
    expectOnly('B')
  })

  it('choosing again right after an error clears the error at once, and rapid choices still end on the last one', async () => {
    openPhotoMock.mockRejectedValueOnce(new PhotoImageError('invalid-image'))
    renderPanel()
    select(photoFile('broken.jpg'))
    await settle()
    expect(alertText()).toBe(en.photoChecker.errors['invalid-image'])
    const photoB = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoB.promise).mockResolvedValueOnce(images.C)
    select(photoFile('b.jpg'))
    expect(alertText()).toBeNull()
    expect(preparing()).toBe(true)
    select(photoFile('c.jpg'))
    await settle()
    await act(async () => photoB.resolve(images.B))
    expectOnly('C')
  })

  it('a new photo never inherits the previous marker or result, before or after it is ready', async () => {
    renderPanel()
    await openReady(solid(400, 300, BEST))
    tapStage(200, 150)
    expect(marker()).not.toBeNull()
    expect(shownHex()).toBe(BEST)
    const next = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(next.promise)
    select(photoFile('next.jpg'))
    expect(marker()).toBeNull()
    expect(shownHex()).toBeNull()
    await act(async () => next.resolve(solid(400, 300, HARDER)))
    expect(marker()).toBeNull()
    expect(shownHex()).toBeNull()
    expect($('.photo-summary')).toHaveTextContent(en.photoChecker.instruction)
    tapStage(200, 150)
    expect(shownHex()).toBe(HARDER)
  })
})

describe('Slice 6: switching to Manual while a photo is preparing (App)', () => {
  const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }

  it('aborts it; a late result or error never appears, and Photo starts fresh', async () => {
    saveState({ answers, result: analyzeQuiz(answers), quizStep: 10 })
    localStorage.setItem('personal-color-pocket:language', 'en')
    const user = userEvent.setup({ delay: null })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /color checker/i }))
    await user.click(screen.getByRole('tab', { name: 'Photo' }))
    const photoA = deferred<PixelSource>()
    const photoB = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(photoA.promise).mockReturnValueOnce(photoB.promise)
    select(photoFile('a.jpg'))
    await user.click(screen.getByRole('tab', { name: 'Manual' }))
    expect(openPhotoMock.mock.calls[0][1]!.signal!.aborted).toBe(true)
    await user.click(screen.getByRole('tab', { name: 'Photo' }))
    await act(async () => photoA.resolve(solid(40, 30, BEST)))
    expect(stage()).toBeNull()
    expect(preparing()).toBe(false)
    select(photoFile('b.jpg'))
    await act(async () => photoB.resolve(solid(30, 40, HARDER)))
    expect(canvas()!.width).toBe(30)
    expect(alertText()).toBeNull()
  })
})

describe('Slice 6: repeated photo replacement (application ownership)', () => {
  it('50+ replacements, alternating completed and superseded, accumulate no observers, timers, listeners, canvases, requests or stale state', async () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:x')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true })
    const windowListeners = vi.spyOn(window, 'addEventListener')
    const view = renderPanel()
    const files: File[] = []
    const shown: PixelSource[] = []
    const superseded: { resolve: (image: PixelSource) => void; image: PixelSource }[] = []
    const supersededSignals: AbortSignal[] = []

    for (let round = 0; round <= 50; round++) {
      const image = solid(40 + (round % 7), 30 + (round % 5), round % 3 ? BEST : HARDER)
      const file = photoFile(`private-photo-${round}.jpg`)
      files.push(file)
      if (round % 2 === 1 && round < 50) {
        // Chosen, then replaced before it finishes; it completes late, after later photos.
        const pending = deferred<PixelSource>()
        openPhotoMock.mockReturnValueOnce(pending.promise)
        select(file)
        superseded.push({ resolve: pending.resolve, image })
        supersededSignals.push(openPhotoMock.mock.calls.at(-1)![1]!.signal!)
        expect(stage()).toBeNull()
        expect(marker()).toBeNull()
        expect(observers.size).toBe(0)
        expect(vi.getTimerCount()).toBe(1)
        continue
      }
      openPhotoMock.mockResolvedValueOnce(image)
      select(file)
      await settle()
      shown.push(image)
      expect(canvas()!.width).toBe(image.width)
      expect(marker()).toBeNull()
      tapStage(200, 150)
      expect(marker()).not.toBeNull()
      expect(document.querySelectorAll('.check-verdict')).toHaveLength(1)
      expect(observers.size).toBe(1)
      expect(vi.getTimerCount()).toBe(0)
      expect(document.querySelectorAll('.photo-canvas')).toHaveLength(1)
    }

    // Every superseded selection was aborted, and its late completion changes nothing.
    expect(supersededSignals.every((signal) => signal.aborted)).toBe(true)
    const before = { html: $('.photo-checker')!.innerHTML, paints: putImageData.mock.calls.length }
    await act(async () => superseded.forEach(({ resolve, image }) => resolve(image)))
    expect($('.photo-checker')!.innerHTML).toBe(before.html)
    expect(putImageData).toHaveBeenCalledTimes(before.paints)

    // One paint per shown photo, each from that photo's own buffer (no copy, no repaint).
    expect(putImageData.mock.calls.map(([imageData]) => imageData.data)).toEqual(shown.map((image) => image.data))
    // Every earlier display canvas was released; only the current one keeps a backing store.
    const current = canvas()!
    expect([...canvases].filter((each) => each !== current).every((each) => each.width === 0 && each.height === 0)).toBe(true)
    expect(canvases.size).toBe(shown.length)
    expect(windowListeners.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(0)
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    // Ownership: the app keeps the current PixelSource and nothing older, and never a File.
    const latest = shown.at(-1)!
    const older = [...shown.slice(0, -1), ...superseded.map(({ image }) => image)]
    expect(reactReferences(view.container, [latest])).toEqual([latest])
    expect(reactReferences(view.container, [...older, ...older.map((image) => image.data)])).toEqual([])
    expect(reactReferences(view.container, files)).toEqual([])

    view.unmount()
    expect(observers.size).toBe(0)
    expect([...canvases].every((each) => each.width === 0 && each.height === 0)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('without ResizeObserver, the window resize fallback never accumulates listeners across 20 photos', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const resizeListeners = () => added.mock.calls.filter(([type]) => type === 'resize').length - removed.mock.calls.filter(([type]) => type === 'resize').length
    const view = renderPanel()
    for (let round = 0; round < 20; round++) {
      await openReady(solid(40, 30, round % 2 ? BEST : HARDER))
      expect(resizeListeners()).toBe(1)
    }
    view.unmount()
    expect(resizeListeners()).toBe(0)
  })

  it('at READY the app holds the PixelSource it paints, and the File only until preparation settles', async () => {
    const file = photoFile('holiday.jpg')
    const pending = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(pending.promise)
    const view = renderPanel()
    select(file)
    expect(reactReferences(view.container, [file])).toEqual([])
    const image = solid(40, 30, BEST)
    await act(async () => pending.resolve(image))
    expect(reactReferences(view.container, [image])).toEqual([image])
    expect(reactReferences(view.container, [file])).toEqual([])
    expect(putImageData.mock.calls[0][0].data).toBe(image.data)
    view.unmount()
    expect(canvases.size).toBe(1)
    expect([...canvases][0].width).toBe(0)
  })
})

describe('Slice 6: resize hardening', () => {
  it('hundreds of layout changes keep the working point, marker and result exactly, with no re-open, re-sample or repaint', async () => {
    renderPanel()
    const image = split(1600, 1200, BEST, HARDER)
    await openReady(image, { width: 400, height: 300 })
    tapStage(100, 75)
    expect(tappedPoint()).toEqual({ x: 400, y: 300 })
    const result = $('.photo-feedback')!.textContent
    const calls = { taps: tapSpy.mock.calls.length, points: pointSpy.mock.calls.length, opens: openPhotoMock.mock.calls.length, paints: putImageData.mock.calls.length }
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const boxes: Size[] = [{ width: 320, height: 240 }, { width: 1024, height: 680 }, { width: 390, height: 900 }, { width: 0, height: 0 }, { width: 777.77, height: 123.45 }]
    for (let index = 0; index < 300; index++) boxes.push({ width: 1 + random() * 1400, height: 1 + random() * 1000 })
    for (const box of boxes) {
      setStageBox(box)
      if (box.width && box.height) {
        const expected = imageToDisplay({ x: 400, y: 300 }, fitContain(image, box), image)
        expect(markerCenter().x).toBeCloseTo(expected.x, 9)
        expect(markerCenter().y).toBeCloseTo(expected.y, 9)
      }
    }
    setStageBox({ width: 400, height: 300 })
    expect(markerCenter()).toEqual({ x: 100, y: 75 })
    expect($('.photo-feedback')!.textContent).toBe(result)
    expect({ taps: tapSpy.mock.calls.length, points: pointSpy.mock.calls.length, opens: openPhotoMock.mock.calls.length, paints: putImageData.mock.calls.length }).toEqual(calls)
  })

  it('a transient zero-size container is safe: no throw, taps on it are ignored, and the layout recovers', async () => {
    renderPanel()
    const image = solid(1600, 1200, BEST)
    await openReady(image, { width: 400, height: 300 })
    tapStage(200, 150)
    const result = $('.photo-feedback')!.textContent
    setStageBox({ width: 0, height: 0 })
    expect(canvas()!.style.width).toBe('0px')
    tapStage(0, 0)
    expect(lastTap()).toEqual({ kind: 'outside-displayed-image' })
    expect($('.photo-feedback')!.textContent).toBe(result)
    setStageBox({ width: 400, height: 300 })
    expect(markerCenter()).toEqual({ x: 200, y: 150 })
  })

  it.each([
    ['landscape', 1600, 1200],
    ['portrait', 1200, 1600],
  ])('%s photo: phone stacked → desktop side-by-side → phone keeps the same image point, and taps still hit the right half', async (_, width, height) => {
    renderPanel()
    const image = split(width, height, BEST, HARDER, height > width)
    const phone = { width: 358, height: 358 * height / width }
    await openReady(image, phone)
    const second = height > width ? { x: width / 2, y: height * .75 } : { x: width * .75, y: height / 2 }
    const secondOnPhone = imageToDisplay(second, fitContain(image, phone), image)
    tapStage(secondOnPhone.x, secondOnPhone.y)
    expect(tappedPoint()!.x).toBeCloseTo(second.x, 6)
    expect(tappedPoint()!.y).toBeCloseTo(second.y, 6)
    expect(shownHex()).toBe(HARDER)
    for (const box of [{ width: 560, height: 680 }, { width: 1280, height: 680 }, phone]) {
      setStageBox(box)
      const expected = imageToDisplay(tappedPoint()!, fitContain(image, box), image)
      expect(markerCenter().x).toBeCloseTo(expected.x, 9)
      expect(markerCenter().y).toBeCloseTo(expected.y, 9)
    }
    // The first half, tapped on the desktop layout.
    setStageBox({ width: 1280, height: 680 })
    const rect = fitContain(image, { width: 1280, height: 680 })
    const first = imageToDisplay(height > width ? { x: width / 2, y: height * .25 } : { x: width * .25, y: height / 2 }, rect, image)
    tapStage(first.x, first.y)
    expect(shownHex()).toBe(BEST)
  })
})

describe('Slice 6: pointer hardening', () => {
  const W = 1600
  const H = 1200

  it('center, the four corners, the exact far edges and 1 CSS px inside every edge map exactly; marker and sample agree', async () => {
    renderPanel()
    await openReady(solid(W, H, BEST), { width: 400, height: 300 })
    const cases: [number, number, ImagePoint][] = [
      [200, 150, { x: 800, y: 600 }],
      [0, 0, { x: 0, y: 0 }], [400, 0, { x: W, y: 0 }], [0, 300, { x: 0, y: H }], [400, 300, { x: W, y: H }],
      [400, 150, { x: W, y: 600 }], [200, 300, { x: 800, y: H }], [0, 150, { x: 0, y: 600 }], [200, 0, { x: 800, y: 0 }],
      [1, 150, { x: 4, y: 600 }], [399, 150, { x: 1596, y: 600 }], [200, 1, { x: 800, y: 4 }], [200, 299, { x: 800, y: 1196 }],
    ]
    for (const [x, y, expected] of cases) {
      tapStage(x, y)
      const inspection = lastTap()
      expect(inspection.kind, `${x},${y}`).toBe('matched')
      expect(tappedPoint()).toEqual(expected)
      expect(markerCenter()).toEqual({ x, y })
      expect(shownHex()).toBe(BEST)
    }
  })

  it('letterbox, pillarbox and just-outside taps keep the previous valid marker and result', async () => {
    renderPanel()
    await openReady(split(W, H, BEST, HARDER), { width: 400, height: 400 }) // image rect: y 50 … 350
    tapStage(300, 200)
    const result = $('.photo-feedback')!.textContent
    const markerBefore = markerCenter()
    for (const [x, y] of [[200, 20], [200, 49.99], [200, 350.01], [5, 399]]) {
      tapStage(x, y)
      expect(lastTap(), `${x},${y}`).toEqual({ kind: 'outside-displayed-image' })
      expect(markerCenter()).toEqual(markerBefore)
      expect($('.photo-feedback')!.textContent).toBe(result)
    }
    setStageBox({ width: 600, height: 300 }) // pillarbox: x 100 … 500
    tapStage(50, 150)
    expect(lastTap()).toEqual({ kind: 'outside-displayed-image' })
    expect($('.photo-feedback')!.textContent).toBe(result)
  })

  it('rapid repeated taps: every tap is evaluated, the last one wins, one verdict shows, and nothing drifts', async () => {
    renderPanel()
    const image = split(W, H, BEST, HARDER)
    await openReady(image, { width: 400, height: 300 })
    for (let index = 0; index < 60; index++) tapStage(index % 2 ? 100 : 300, 150)
    expect(tapSpy).toHaveBeenCalledTimes(60)
    expect(tappedPoint()).toEqual({ x: 400, y: 600 })
    expect(markerCenter()).toEqual({ x: 100, y: 150 })
    expect(document.querySelectorAll('.check-verdict')).toHaveLength(1)
    expect(shownHex()).toBe(BEST)
    for (let index = 0; index < 60; index++) tapStage(300, 150)
    expect(tappedPoint()).toEqual({ x: 1200, y: 600 })
    expect(markerCenter()).toEqual({ x: 300, y: 150 })
    expect(shownHex()).toBe(HARDER)
  })

  it('a tap in the same tick the photo becomes ready is evaluated against that photo', async () => {
    renderPanel()
    const pending = deferred<PixelSource>()
    openPhotoMock.mockReturnValueOnce(pending.promise)
    select()
    expect(stage()).toBeNull()
    await act(async () => { pending.resolve(solid(W, H, HARDER)) })
    tapStage(200, 150)
    expect(shownHex()).toBe(HARDER)
    expect(tapSpy.mock.calls[0][0].width).toBe(W)
  })

  it('ignores non-primary pointers and non-left mouse buttons', async () => {
    renderPanel()
    await openReady(solid(W, H, BEST), { width: 400, height: 300 })
    fireEvent.pointerUp(stage()!, { clientX: STAGE_OFFSET.left + 10, clientY: STAGE_OFFSET.top + 10, isPrimary: false, pointerType: 'touch' })
    fireEvent.pointerUp(stage()!, { clientX: STAGE_OFFSET.left + 10, clientY: STAGE_OFFSET.top + 10, isPrimary: true, pointerType: 'mouse', button: 2 })
    expect(tapSpy).not.toHaveBeenCalled()
    expect(marker()).toBeNull()
  })
})

describe('Slice 6: keyboard hardening', () => {
  const W = 1600
  const H = 1200
  const key = (name: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(stage()!, { key: name, ...init })

  it('the photo is focusable, named, described, and has a keyboard-only visible focus style', async () => {
    renderPanel()
    await openReady(solid(W, H, BEST))
    expect(stage()).toHaveAttribute('tabindex', '0')
    expect(stage()).toHaveAttribute('role', 'group')
    expect(stage()).toHaveAccessibleName(en.photoChecker.surfaceLabel)
    expect(stage()).toHaveAccessibleDescription(en.photoChecker.keyboardHint)
    expect(stylesSource).toMatch(/\.photo-stage:focus-visible:not\(\[data-input="pointer"\]\)\s*\{[^}]*outline: 3px solid/)
  })

  it.each([['Enter'], [' ']])('%j with no marker checks the photo centre, and focus stays on the photo', async (name) => {
    renderPanel()
    await openReady(solid(W, H, BEST), { width: 400, height: 300 })
    stage()!.focus()
    key(name)
    expect(pointSpy).toHaveBeenLastCalledWith(expect.anything(), { x: 800, y: 600 }, SUBTYPE)
    expect(markerCenter()).toEqual({ x: 200, y: 150 })
    expect(stage()).toHaveFocus()
  })

  it.each([
    ['ArrowLeft', { x: 0, y: 600 }], ['ArrowRight', { x: W, y: 600 }], ['ArrowUp', { x: 800, y: 0 }], ['ArrowDown', { x: 800, y: H }],
  ] as const)('%s clamps at its edge and Enter checks exactly there', async (arrow, edge) => {
    renderPanel()
    await openReady(solid(W, H, BEST), { width: 400, height: 300 })
    key('Enter')
    for (let press = 0; press < 20; press++) key(arrow, { shiftKey: true })
    key('Enter')
    expect(pointSpy).toHaveBeenLastCalledWith(expect.anything(), edge, SUBTYPE)
    expect(markerCenter()).toEqual({ x: edge.x / 4, y: edge.y / 4 })
  })

  it('resizing between key presses keeps the working-image point', async () => {
    renderPanel()
    await openReady(solid(W, H, BEST), { width: 400, height: 300 })
    key('Enter')
    key('ArrowRight')
    setStageBox({ width: 800, height: 600 })
    key('ArrowRight')
    key('Enter')
    expect(pointSpy).toHaveBeenLastCalledWith(expect.anything(), { x: 848, y: 600 }, SUBTYPE)
  })

  it.each([
    ['Alt+ArrowLeft (browser Back)', 'ArrowLeft', { altKey: true }],
    ['Ctrl+ArrowRight', 'ArrowRight', { ctrlKey: true }],
    ['Meta+ArrowLeft (browser Back on macOS)', 'ArrowLeft', { metaKey: true }],
    ['Alt+ArrowDown', 'ArrowDown', { altKey: true }],
    ['Ctrl+Enter', 'Enter', { ctrlKey: true }],
    ['Meta+Enter', 'Enter', { metaKey: true }],
    ['Ctrl+Space', ' ', { ctrlKey: true }],
    ['Alt+Space', ' ', { altKey: true }],
  ])('%s is left to the browser and assistive technology: not prevented, and the marker does not change', async (_, name, modifiers) => {
    renderPanel()
    await openReady(solid(W, H, BEST), { width: 400, height: 300 })
    key('Enter')
    const before = { marker: markerCenter(), checks: pointSpy.mock.calls.length }
    expect(key(name, modifiers)).toBe(true) // true = default NOT prevented
    expect(markerCenter()).toEqual(before.marker)
    expect(pointSpy).toHaveBeenCalledTimes(before.checks)
  })

  it('keys pressed elsewhere on the page are never captured by the photo', async () => {
    renderPanel()
    await openReady(solid(W, H, BEST), { width: 400, height: 300 })
    for (const name of ['ArrowDown', ' ', 'Enter', 'PageDown']) expect(fireEvent.keyDown(document.body, { key: name })).toBe(true)
    expect(marker()).toBeNull()
    expect(pointSpy).not.toHaveBeenCalled()
  })
})

describe('Slice 6: error matrix (EN and TH)', () => {
  it.each((['en', 'th'] as const).flatMap((language) => ERROR_CODES.map((code) => [language, code] as const)))(
    '%s %s: localized, friendly, leaks nothing, and the same file can be retried', async (language, code) => {
      const locale = language === 'th' ? th : en
      renderPanel(locale)
      const file = photoFile('secret-family-photo.jpg')
      openPhotoMock.mockRejectedValueOnce(new PhotoImageError(code)).mockResolvedValueOnce(solid(40, 30, BEST))
      select(file)
      await settle()
      const text = alertText()!
      expect(text).toBe(locale.photoChecker.errors[code])
      expect(text).not.toMatch(/secret|family|\.jpe?g\b|PhotoImageError|DOMException|Error\b|stack|blob:|https?:|undefined|null|NaN|[{}<>]/i)
      expect(text).not.toContain(code)
      if (language === 'th') expect(text).toMatch(/[ก-๙]/)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      select(file)
      expect(alertText()).toBeNull()
      await settle()
      expect(stage()).not.toBeNull()
      expect(openPhotoMock.mock.calls.map(([chosen]) => chosen)).toEqual([file, file])
    })

  it('an unknown rejection shows the generic copy and never its message', async () => {
    renderPanel(th)
    openPhotoMock.mockRejectedValueOnce(Object.assign(new Error('decode C:\\Users\\me\\secret-family-photo.jpg at blob:http://x/1'), { stack: 'at decode (photoImage.ts:1)' }))
    select(photoFile('secret-family-photo.jpg'))
    await settle()
    expect(alertText()).toBe(th.photoChecker.errors['decode-failed'])
    expect(document.body.textContent).not.toMatch(/secret|blob:|photoImage|at decode/)
  })

  it('a display canvas that cannot paint shows canvas-failed, and choosing again recovers', async () => {
    contextAvailable = false
    renderPanel()
    await act(async () => { openPhotoMock.mockResolvedValueOnce(solid(40, 30, BEST)); select() })
    expect(alertText()).toBe(en.photoChecker.errors['canvas-failed'])
    contextAvailable = true
    await openReady(solid(40, 30, BEST))
    expect(alertText()).toBeNull()
  })
})

describe('Slice 6: Manual ↔ Photo isolation (App)', () => {
  const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
  const PHOTO_ONLY = ['.check-caveat', '.check-warnings', '.check-info', '.check-details', '.photo-tip', '.photo-stage', '.photo-feedback']
  const manualSnapshot = () => ({
    input: (screen.getByLabelText(/or enter a hex value/i) as HTMLInputElement).value,
    sections: [...document.querySelectorAll('.manual-result [class^="check-"]')].map((node) => node.className),
    text: $('.manual-result')!.textContent,
  })

  it('Manual → Photo → Manual → Photo → Manual: manual input and result are kept, photo state is discarded, and no photo guidance leaks', async () => {
    const result = analyzeQuiz(answers)
    saveState({ answers, result, quizStep: 10 })
    localStorage.setItem('personal-color-pocket:language', 'en')
    const storage = { ...localStorage }
    const user = userEvent.setup({ delay: null })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /color checker/i }))
    const input = screen.getByLabelText(/or enter a hex value/i)
    await user.clear(input)
    await user.type(input, 'F4F4F2')
    await user.click(document.querySelector<HTMLButtonElement>('.hex-field button[type="submit"]')!)
    const manual = manualSnapshot()
    expect(manual.input).toBe('F4F4F2')
    for (const selector of PHOTO_ONLY) expect($(selector), selector).toBeNull()

    // Photo, with a sampling warning (clipped white).
    await user.click(screen.getByRole('tab', { name: 'Photo' }))
    expect($('.photo-tip')).not.toBeNull()
    await openReady(solid(400, 300, '#FFFFFF'))
    tapStage(200, 150)
    expect($('.check-warnings')).not.toBeNull()
    expect(tapSpy.mock.calls.at(-1)![2]).toBe(result.subtype)

    await user.click(screen.getByRole('tab', { name: 'Manual' }))
    expect(manualSnapshot()).toEqual(manual)
    for (const selector of PHOTO_ONLY) expect($(selector), selector).toBeNull()

    // Back to Photo: the previous photo, marker and result are gone (current policy).
    await user.click(screen.getByRole('tab', { name: 'Photo' }))
    expect(stage()).toBeNull()
    expect(marker()).toBeNull()
    expect($('.check-verdict')).toBeNull()
    await openReady(solid(400, 300, '#F4F4F2'))
    tapStage(200, 150)
    expect($('.check-info')).toHaveTextContent(en.photoChecker.lightingNote)

    await user.click(screen.getByRole('tab', { name: 'Manual' }))
    expect(manualSnapshot()).toEqual(manual)
    for (const selector of PHOTO_ONLY) expect($(selector), selector).toBeNull()
    expect({ ...localStorage }).toEqual(storage)
  })
})

describe('Slice 6: unified result and lighting guidance regression (Photo)', () => {
  const ORDER = ['check-sample', 'check-verdict', 'check-category', 'check-reason', 'check-action', 'check-reference', 'check-note', 'check-placement', 'check-pairing', 'check-details', 'check-warnings', 'check-info', 'check-caveat']
  const structure = () => [...document.querySelectorAll(ORDER.map((name) => `.${name}`).join(','))].map((node) => ORDER.find((name) => node.classList.contains(name))!)
  const flag = en.photoChecker.warnings

  it.each([
    ['#9FABB4 (the reported shaded-white sample)', solid(400, 300, '#9FABB4'), [], true],
    ['white fabric #F4F4F2', solid(400, 300, '#F4F4F2'), [], true],
    ['off-white #FAF9F6', solid(400, 300, '#FAF9F6'), [], true],
    ['light grey #D3D3D3', solid(400, 300, '#D3D3D3'), [], true],
    ['clipped pure white #FFFFFF', solid(400, 300, '#FFFFFF'), [flag.highlight], false],
    ['navy #1F2A44', solid(400, 300, '#1F2A44'), [], false],
    ['charcoal #333333', solid(400, 300, '#333333'), [], false],
    ['red #CC0000', solid(400, 300, '#CC0000'), [], false],
    ['white/navy stripes', stripes(400, 300, '#F4F4F2', '#1F2A44'), [flag.mixed], false],
    ['crushed black #000000', solid(400, 300, '#000000'), [flag.shadow], false],
  ] as const)('%s: warnings, lighting note and caveat as in Slice 5f, in the shared order, HEX unchanged', async (_, image, warnings, note) => {
    renderPanel()
    await openReady(image, { width: 400, height: 300 })
    tapStage(200, 150)
    const inspection = lastTap()
    if (inspection.kind !== 'matched') throw new Error('expected a match')
    expect(shownHex()).toBe(inspection.sample.hex)
    expect(shownHex()).toMatch(/^#[0-9A-F]{6}$/)
    expect([...document.querySelectorAll('.check-warnings li')].map((item) => item.textContent)).toEqual(warnings)
    expect($('.check-info')?.textContent ?? null).toBe(note ? en.photoChecker.lightingNote : null)
    expect($('.check-caveat')).toHaveTextContent(en.photoChecker.caveat)
    const order = structure()
    expect(order).toEqual(ORDER.filter((name) => order.includes(name)))
    expect(order.slice(0, 6)).toEqual(ORDER.slice(0, 6))
    expect($('.check-info')?.closest('[role="status"]') ?? null).toBeNull()
    expect(document.body.textContent).not.toMatch(/\d+ ?%/)
  })
})
