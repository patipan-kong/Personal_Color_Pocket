import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { hexToRgb } from '../domain/personalColor/colorUtils'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import { inspectPhotoTap } from '../domain/photoColor/inspect'
import type { PixelSource } from '../domain/photoColor/types'
import { openPhoto } from '../services/photoImage'
import { saveState, STORAGE_KEY } from '../services/persistence'

vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))
vi.mock('../domain/photoColor/inspect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/photoColor/inspect')>()
  return { inspectPhotoTap: vi.fn(actual.inspectPhotoTap), inspectPhotoPoint: vi.fn(actual.inspectPhotoPoint) }
})

const openPhotoMock = vi.mocked(openPhoto)
const tapSpy = vi.mocked(inspectPhotoTap)
const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const result = analyzeQuiz(answers)

class FakePointerEvent extends MouseEvent {
  pointerType: string
  isPrimary: boolean
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? 'mouse'
    this.isPrimary = init.isPrimary ?? false
  }
}

function solid(width: number, height: number, hex: string): PixelSource {
  const { r, g, b } = hexToRgb(hex)!
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set([r, g, b, 255], index)
  return { width, height, data }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('personal-color-pocket:language', 'en')
  saveState({ answers, result, quizStep: 10 })
  openPhotoMock.mockReset()
  tapSpy.mockClear()
  vi.stubGlobal('PointerEvent', FakePointerEvent)
  vi.stubGlobal('ImageData', class { constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({ putImageData: vi.fn() })) as never)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('photo-stage') ? new DOMRect(0, 0, 400, 300) : new DOMRect(0, 0, 0, 0)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openChecker() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /color checker/i }))
  return user
}

const manualTab = () => screen.getByRole('tab', { name: 'Manual' })
const photoTab = () => screen.getByRole('tab', { name: 'Photo' })

describe('Color Checker modes', () => {
  it('opens in Manual mode with the unchanged manual checker', async () => {
    await openChecker()
    expect(screen.getByRole('tablist', { name: 'How to check a color' })).toBeInTheDocument()
    expect(manualTab()).toHaveAttribute('aria-selected', 'true')
    expect(photoTab()).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'checker-tabpanel-manual')
    expect(screen.getByRole('heading', { name: /does this color suit me/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/or enter a hex value/i)).toBeInTheDocument()
    expect(screen.getByText(/palette fit/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Try it with' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Choose a photo')).toBeNull()
  })

  it('keeps the manual interaction working as before', async () => {
    const user = await openChecker()
    const input = screen.getByLabelText(/or enter a hex value/i)
    await user.clear(input)
    await user.type(input, 'D98463')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText('#D98463')).toBeInTheDocument()
    expect(screen.getByText(/palette fit/i)).toBeInTheDocument()
  })

  it('switches to Photo and back without touching the manual color', async () => {
    const user = await openChecker()
    const input = screen.getByLabelText(/or enter a hex value/i)
    await user.clear(input)
    await user.type(input, 'D98463')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    await user.click(photoTab())
    expect(photoTab()).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'checker-tabpanel-photo')
    expect(screen.getByLabelText('Choose a photo')).toBeInTheDocument()
    expect(screen.getByText('Your photo stays on this device.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/or enter a hex value/i)).toBeNull()
    await user.click(manualTab())
    expect(screen.getByLabelText(/or enter a hex value/i)).toHaveValue('D98463')
    expect(screen.getByText('#D98463')).toBeInTheDocument()
  })

  it('Photo → Manual discards the photo session and aborts pending preparation', async () => {
    const user = await openChecker()
    await user.click(photoTab())
    openPhotoMock.mockReturnValueOnce(new Promise(() => {}))
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    const signal = openPhotoMock.mock.calls[0][1]!.signal!
    await user.click(manualTab())
    expect(signal.aborted).toBe(true)
    await user.click(photoTab())
    expect(document.querySelector('.photo-placeholder')).toBeNull()
    expect(document.querySelector('.photo-stage')).toBeNull()
    expect(screen.getByLabelText('Choose a photo')).toBeInTheDocument()
  })

  it('returns to Manual whenever the checker is reopened', async () => {
    const user = await openChecker()
    await user.click(photoTab())
    await user.click(screen.getByRole('button', { name: /^palette$/i }))
    await user.click(screen.getByRole('button', { name: /color checker/i }))
    expect(manualTab()).toHaveAttribute('aria-selected', 'true')
  })

  it("uses the saved subtype and leaves the saved profile untouched", async () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const user = await openChecker()
    await user.click(photoTab())
    openPhotoMock.mockResolvedValueOnce(solid(400, 300, '#B7410E'))
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await act(async () => {})
    fireEvent.pointerUp(document.querySelector('.photo-stage')!, { clientX: 200, clientY: 150, isPrimary: true, pointerType: 'touch' })
    expect(tapSpy).toHaveBeenCalledTimes(1)
    expect(tapSpy.mock.calls[0][2]).toBe(result.subtype)
    expect(screen.getByText('#B7410E')).toBeInTheDocument()
    await user.click(manualTab())
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved)
    expect(Object.keys(localStorage).sort()).toEqual([STORAGE_KEY, 'personal-color-pocket:language'].sort())
  })
})
