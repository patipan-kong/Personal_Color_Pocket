import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import { saveState, STORAGE_KEY } from '../services/persistence'
import { jpegHeader } from '../services/photoImage.fixtures'

// V1.2 Slice 6 privacy and pipeline guard (docs/V1_2_SLICE_6_HARDENING.md §21–§24).
// The REAL image service (openPhoto) runs here: header parse, size caps, decode call, working
// canvas, one getImageData. Only the browser primitives jsdom lacks are faked (decoder, 2D
// context). Every outbound channel a web page has is spied, and the whole photo flow must leave
// all of them untouched: the photo, its name, its pixels, the tap and the sampled colour stay on
// the device. Normal static asset loading by Vite is not part of this test.

const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const result = analyzeQuiz(answers)
const QUADRANTS = { topLeft: [183, 65, 14], topRight: [31, 42, 68], bottomLeft: [244, 244, 242], bottomRight: [46, 134, 171] } as const
const hex = (rgb: readonly number[]) => '#' + rgb.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()

class FakePointerEvent extends MouseEvent {
  pointerType: string
  isPrimary: boolean
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? 'mouse'
    this.isPrimary = init.isPrimary ?? false
  }
}

const observers = new Set<{ callback: () => void }>()
let stageBox = { width: 400, height: 300 }
let decodedSize = { width: 4000, height: 3000 }
let network: Record<string, ReturnType<typeof vi.fn>>
let storageWrites: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>
let pipeline: { decodes: number; draws: number; reads: number; paints: unknown[]; readBuffers: Uint8ClampedArray[]; bitmapsClosed: number; canvases: Set<HTMLCanvasElement> }
let imageSources: string[]

// Pixels the fake decoder "decoded": four colour quadrants of the upright (EXIF-applied) image.
function quadrantPixels(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const colour = row < height / 2 ? (col < width / 2 ? QUADRANTS.topLeft : QUADRANTS.topRight) : (col < width / 2 ? QUADRANTS.bottomLeft : QUADRANTS.bottomRight)
      data.set([...colour, 255], (row * width + col) * 4)
    }
  }
  return data
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  saveState({ answers, result, quizStep: 10 })
  localStorage.setItem('personal-color-pocket:language', 'en')
  observers.clear()
  stageBox = { width: 400, height: 300 }
  decodedSize = { width: 4000, height: 3000 }
  imageSources = []
  pipeline = { decodes: 0, draws: 0, reads: 0, paints: [], readBuffers: [], bitmapsClosed: 0, canvases: new Set() }

  // jsdom's Blob has no arrayBuffer(); the service reads the header prefix through it.
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value(this: Blob) {
        return new Promise<ArrayBuffer>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(this) })
      },
    })
  }
  vi.stubGlobal('createImageBitmap', vi.fn(async () => {
    pipeline.decodes++
    return { width: decodedSize.width, height: decodedSize.height, close: () => { pipeline.bitmapsClosed++ } }
  }))
  vi.stubGlobal('ImageData', class { constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {} })
  vi.stubGlobal('PointerEvent', FakePointerEvent)
  vi.stubGlobal('ResizeObserver', class {
    constructor(readonly callback: () => void) { observers.add(this) }
    observe() {}
    disconnect() { observers.delete(this) }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    pipeline.canvases.add(this)
    return {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: () => { pipeline.draws++ },
      getImageData: (_x: number, _y: number, width: number, height: number) => {
        pipeline.reads++
        const data = quadrantPixels(width, height)
        pipeline.readBuffers.push(data)
        return { width, height, data }
      },
      putImageData: (imageData: unknown) => { pipeline.paints.push(imageData) },
    }
  } as never)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('photo-stage') ? new DOMRect(0, 0, stageBox.width, stageBox.height) : new DOMRect(0, 0, 0, 0)
  })
  const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!
  vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement, value: string) { imageSources.push(value); imageSrc.set!.call(this, value) })

  // Every outbound channel a page could use.
  network = {
    fetch: vi.fn(),
    xhrOpen: vi.fn(),
    xhrSend: vi.fn(),
    sendBeacon: vi.fn(() => true),
    WebSocket: vi.fn(),
    EventSource: vi.fn(),
    Worker: vi.fn(),
    SharedWorker: vi.fn(),
    windowOpen: vi.fn(),
    postMessage: vi.fn(),
    formSubmit: vi.fn(),
    formRequestSubmit: vi.fn(),
    submitEvent: vi.fn(),
    createObjectURL: vi.fn(() => 'blob:local/1'),
    indexedDB: vi.fn(),
    caches: vi.fn(),
    cookie: vi.fn(),
  }
  vi.stubGlobal('fetch', network.fetch)
  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(network.xhrOpen as never)
  vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(network.xhrSend as never)
  Object.defineProperty(navigator, 'sendBeacon', { value: network.sendBeacon, configurable: true, writable: true })
  vi.stubGlobal('WebSocket', network.WebSocket)
  vi.stubGlobal('EventSource', network.EventSource)
  vi.stubGlobal('Worker', network.Worker)
  vi.stubGlobal('SharedWorker', network.SharedWorker)
  vi.spyOn(window, 'open').mockImplementation(network.windowOpen as never)
  vi.spyOn(window, 'postMessage').mockImplementation(network.postMessage as never)
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(network.formSubmit as never)
  vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(network.formRequestSubmit as never)
  document.addEventListener('submit', network.submitEvent as never, true)
  Object.defineProperty(URL, 'createObjectURL', { value: network.createObjectURL, configurable: true, writable: true })
  vi.stubGlobal('indexedDB', { open: network.indexedDB, deleteDatabase: network.indexedDB })
  vi.stubGlobal('caches', { open: network.caches, match: network.caches, has: network.caches, keys: network.caches, delete: network.caches })
  vi.spyOn(document, 'cookie', 'set').mockImplementation(network.cookie as never)
  storageWrites = vi.fn<(...args: unknown[]) => void>()
  for (const method of ['setItem', 'removeItem', 'clear'] as const) vi.spyOn(Storage.prototype, method).mockImplementation(function (this: Storage, ...args: unknown[]) { storageWrites(this === localStorage ? 'local' : 'session', method, ...args) })
})

afterEach(() => {
  document.removeEventListener('submit', network.submitEvent as never, true)
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (navigator as { sendBeacon?: unknown }).sendBeacon
  delete (URL as { createObjectURL?: unknown }).createObjectURL
})

const stage = () => document.querySelector<HTMLElement>('.photo-stage')
const shownHex = () => document.querySelector('.check-hex')?.textContent ?? null
const tap = (x: number, y: number) => fireEvent.pointerUp(stage()!, { clientX: x, clientY: y, isPrimary: true, pointerType: 'touch', button: 0 })
const resize = (box: { width: number; height: number }) => { stageBox = box; act(() => observers.forEach((observer) => observer.callback())) }
const jpeg = (name: string, width = 4000, height = 3000) => new File([jpegHeader(width, height)], name, { type: 'image/jpeg' })

async function openPhotoTab() {
  const user = userEvent.setup({ delay: null })
  render(<App />)
  await user.click(screen.getByRole('button', { name: /color checker/i }))
  await user.click(screen.getByRole('tab', { name: 'Photo' }))
  return user
}

async function choose(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText(/^Choose (a|another) photo$/), file)
  await waitFor(() => expect(stage()).not.toBeNull())
}

describe('Slice 6: nothing leaves the device during a complete photo check', () => {
  it('choose → prepare → display → tap → keyboard → resize → another photo → Manual: no network, no storage writes, no new keys', async () => {
    const storageBefore = { local: { ...localStorage }, session: { ...sessionStorage } }
    const cookieBefore = document.cookie
    const user = await openPhotoTab()
    // Baseline: the app's own static illustrations may already have loaded on earlier screens.
    storageWrites.mockClear()
    imageSources.length = 0

    await choose(user, jpeg('IMG_2041-secret-family-photo.jpg'))
    tap(100, 75)
    expect(shownHex()).toBe(hex(QUADRANTS.topLeft))
    fireEvent.keyDown(stage()!, { key: 'ArrowRight' })
    fireEvent.keyDown(stage()!, { key: 'Enter' })
    resize({ width: 1024, height: 768 })
    tap(768, 576)
    expect(shownHex()).toBe(hex(QUADRANTS.bottomRight))
    await choose(user, jpeg('IMG_2042.heic', 3000, 4000))
    tap(10, 10)
    await user.click(screen.getByRole('tab', { name: 'Manual' }))
    await user.click(screen.getByRole('tab', { name: 'Photo' }))

    for (const [channel, spy] of Object.entries(network)) expect(spy, channel).not.toHaveBeenCalled()
    expect(imageSources).toEqual([])
    expect(storageWrites).not.toHaveBeenCalled()
    expect({ local: { ...localStorage }, session: { ...sessionStorage } }).toEqual(storageBefore)
    expect(Object.keys(localStorage).sort()).toEqual([STORAGE_KEY, 'personal-color-pocket:language'].sort())
    expect(document.cookie).toBe(cookieBefore)
    // Neither the file name nor any sampled colour was written anywhere or shown.
    const persisted = JSON.stringify({ ...localStorage, ...sessionStorage })
    for (const secret of ['IMG_2041', 'secret-family-photo', 'IMG_2042', hex(QUADRANTS.topLeft), hex(QUADRANTS.bottomRight)]) expect(persisted).not.toContain(secret)
    expect(document.body.textContent).not.toMatch(/IMG_204|secret-family-photo/)
  })

  it('the sampled colour is identical at device pixel ratio 1, 2 and 3', async () => {
    const user = await openPhotoTab()
    await choose(user, jpeg('dpr.jpg'))
    const seen = new Set<string | null>()
    for (const ratio of [1, 2, 3]) {
      vi.stubGlobal('devicePixelRatio', ratio)
      resize({ width: 390 * ratio / ratio, height: 292.5 })
      tap(97.5, 73.125)
      seen.add(shownHex())
    }
    expect([...seen]).toEqual([hex(QUADRANTS.topLeft)])
  })
})

describe('Slice 6: canvas / pixel pipeline (real service)', () => {
  it('one decode, one draw and one getImageData per photo; the preview paints those same pixels once; taps, keys and resizes never decode, read or repaint', async () => {
    const user = await openPhotoTab()
    await choose(user, jpeg('a.jpg'))
    expect(pipeline).toMatchObject({ decodes: 1, draws: 1, reads: 1, bitmapsClosed: 1 })
    expect(pipeline.paints).toHaveLength(1)
    expect((pipeline.paints[0] as { data: Uint8ClampedArray }).data).toBe(pipeline.readBuffers[0])
    for (let index = 0; index < 25; index++) {
      tap(40 + index * 12, 30 + index * 9)
      fireEvent.keyDown(stage()!, { key: index % 2 ? 'ArrowLeft' : 'ArrowDown' })
      fireEvent.keyDown(stage()!, { key: 'Enter' })
      resize({ width: 320 + index * 37, height: 240 + index * 23 })
    }
    expect(pipeline).toMatchObject({ decodes: 1, draws: 1, reads: 1, bitmapsClosed: 1 })
    expect(pipeline.paints).toHaveLength(1)
    // The service's temporary canvas was released; only the display canvas keeps a backing store.
    const display = document.querySelector('.photo-canvas')
    expect([...pipeline.canvases].filter((canvas) => canvas !== display).every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true)
    expect(display).toHaveProperty('width', 1600)
    await choose(user, jpeg('b.jpg'))
    expect(pipeline).toMatchObject({ decodes: 2, draws: 2, reads: 2, bitmapsClosed: 2 })
    expect(pipeline.paints).toHaveLength(2)
  })
})

describe('Slice 6: orientation consistency (real service)', () => {
  // A 4000×3000 JPEG frame whose EXIF says "rotate 90°": the browser decodes it upright as
  // 3000×4000. No EXIF is parsed by the app; everything downstream follows the decoded size.
  it('decoded orientation → PixelSource size → preview aspect → fitContain → tap → marker → sampled quadrant all agree', async () => {
    decodedSize = { width: 3000, height: 4000 }
    stageBox = { width: 300, height: 400 }
    const user = await openPhotoTab()
    await choose(user, jpeg('rotated.jpg', 4000, 3000))
    expect(stage()!.style.aspectRatio).toBe('1200 / 1600')
    expect(document.querySelector('.photo-canvas')).toHaveProperty('width', 1200)
    expect(document.querySelector('.photo-canvas')).toHaveProperty('height', 1600)
    for (const [x, y, colour] of [[75, 100, QUADRANTS.topLeft], [225, 100, QUADRANTS.topRight], [75, 300, QUADRANTS.bottomLeft], [225, 300, QUADRANTS.bottomRight]] as const) {
      tap(x, y)
      expect(shownHex(), `${x},${y}`).toBe(hex(colour))
      const marker = document.querySelector<HTMLElement>('.photo-marker')!
      expect({ x: parseFloat(marker.style.left), y: parseFloat(marker.style.top) }).toEqual({ x, y })
    }
    // A wide desktop box pillarboxes the portrait photo; the same quadrants are still hit.
    resize({ width: 900, height: 600 })
    tap(450 - 112.5, 150)
    expect(shownHex()).toBe(hex(QUADRANTS.topLeft))
    tap(450 + 112.5, 450)
    expect(shownHex()).toBe(hex(QUADRANTS.bottomRight))
  })
})
