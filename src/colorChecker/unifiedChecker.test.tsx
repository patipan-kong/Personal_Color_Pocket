import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { checkColor } from '../domain/personalColor/colorMatch'
import { hexToRgb } from '../domain/personalColor/colorUtils'
import { getPalette } from '../domain/personalColor/palettes'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import type { MatchRating } from '../domain/personalColor/types'
import { matchPhotoColor } from '../domain/photoColor/photoMatch'
import { samplePhotoRegion } from '../domain/photoColor/sampling'
import { getSuitability } from '../domain/photoColor/suitability'
import type { PixelSource } from '../domain/photoColor/types'
import { colorDisplayName } from '../i18n'
import type { Language, LocaleCopy } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import enSource from '../i18n/en.ts?raw'
import thSource from '../i18n/th.ts?raw'
import { openPhoto } from '../services/photoImage'
import { saveState } from '../services/persistence'
import { getManualSuitability } from './manualResult'

vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))

const openPhotoMock = vi.mocked(openPhoto)
const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const result = analyzeQuiz(answers)
const subtype = result.subtype
const palette = getPalette(subtype)
const locales = { en, th } as const

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
  saveState({ answers, result, quizStep: 10 })
  openPhotoMock.mockReset()
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

async function openChecker(language: Language = 'en') {
  localStorage.setItem('personal-color-pocket:language', language)
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: language === 'en' ? /color checker/i : /เช็กสี/ }))
  return user
}

async function checkManual(user: ReturnType<typeof userEvent.setup>, hex: string) {
  const input = screen.getByLabelText(new RegExp(`${en.checker.hexLabel}|${th.checker.hexLabel}`, 'i'))
  await user.clear(input)
  await user.type(input, hex.replace('#', ''))
  // The form's submit button (in Thai the bottom nav item has the same name).
  await user.click(document.querySelector<HTMLButtonElement>('.hex-field button[type="submit"]')!)
}

async function checkPhoto(user: ReturnType<typeof userEvent.setup>, hex: string, copy: LocaleCopy) {
  await user.click(screen.getByRole('tab', { name: copy.photoChecker.modes.photo }))
  openPhotoMock.mockResolvedValueOnce(solid(400, 300, hex))
  await user.upload(screen.getByLabelText(copy.photoChecker.choose), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
  await act(async () => {})
  fireEvent.pointerUp(document.querySelector('.photo-stage')!, { clientX: 200, clientY: 150, isPrimary: true, pointerType: 'touch' })
}

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)
const text = (selector: string) => $(selector)?.textContent ?? ''
const chips = (selector: string) => [...document.querySelectorAll(`${selector} .color-chip`)].map((chip) => chip.textContent)
// The visible structure of a result: which shared sections appear, in order.
const SECTIONS = ['check-sample', 'check-verdict', 'check-category', 'check-reason', 'check-action', 'check-reference', 'check-note', 'check-placement', 'check-pairing', 'check-details', 'check-warnings', 'check-caveat']
const structure = () => [...document.querySelectorAll(SECTIONS.map((name) => `.${name}`).join(','))].map((node) => SECTIONS.find((name) => node.classList.contains(name)))

// One HEX per existing manual rating for the saved subtype, found by asking the unchanged engine.
const candidates = [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder].map((color) => color.hex)
  .concat(['#2E86AB', '#D98463', '#808080', '#FFFFFF', '#6A7FA8', '#1F7A8C', '#7B3F61'])
const hexFor = (rating: MatchRating) => {
  const hex = candidates.find((candidate) => checkColor(candidate, subtype)!.rating === rating)
  if (!hex) throw new Error(`no ${rating} candidate for ${subtype}`)
  return hex.toUpperCase()
}
const RATINGS: MatchRating[] = ['Great Match', 'Good Match', 'Wearable', 'Tricky']

describe('Manual result uses the shared result card', () => {
  it.each(RATINGS)('%s: verdict, reason, action, reference, placement and pairings, with no percentage', async (rating) => {
    const hex = hexFor(rating)
    const match = checkColor(hex, subtype)!
    const suitability = getManualSuitability(rating)
    const user = await openChecker()
    await checkManual(user, hex)
    expect(text('.check-hex')).toBe(match.normalizedHex)
    expect(text('.check-verdict > span:last-child')).toBe(en.colorResult.verdicts[suitability])
    expect(text('.check-category')).toBe(en.ratings[rating])
    expect(text('.check-reason')).toBe(en.checker.why[rating])
    expect(text('.check-action').length).toBeGreaterThan(20)
    expect(text('.check-reference')).toContain(en.colorResult.reference.nearestBest)
    expect(chips('.check-reference')).toEqual([colorDisplayName('en', match.closestColors[0])])
    expect(document.querySelectorAll('.check-place').length).toBeGreaterThan(0)
    expect(chips('.check-pairs')).toEqual(match.pairWith.map((color) => colorDisplayName('en', color)))
    expect(document.body.textContent).not.toMatch(/\d+ ?%|palette fit|scientific probability|score/i)
  })

  it('the percentage is gone from the whole Manual tab, in Thai too, along with its disclaimer', async () => {
    const user = await openChecker('th')
    await checkManual(user, '#FFFFFF')
    expect(text('.check-verdict > span:last-child')).toBe('สีนี้ไม่ค่อยเหมาะเมื่ออยู่ใกล้ใบหน้า')
    expect(text('.check-sample small')).toBe('สีที่เลือก')
    expect(text('.check-reference')).toContain('สีเด่นในพาเลตต์ที่ใกล้ที่สุด')
    expect(text('.check-reference')).toContain('ไว้เปรียบเทียบเท่านั้น')
    expect(document.body.textContent).not.toMatch(/%|เข้ากับพาเลตต์ \d|ความน่าจะเป็นทางวิทยาศาสตร์/)
    expect(text('.check-action')).toMatch(/^ถ้าชอบสีนี้ /)
  })

  it('shows no photo caveat, warning or photo details on a manual result', async () => {
    const user = await openChecker()
    await checkManual(user, hexFor('Wearable'))
    for (const selector of ['.check-caveat', '.check-warnings', '.check-details', '.check-note']) expect($(selector), selector).toBeNull()
    expect(document.body.textContent).not.toContain(en.photoChecker.caveat)
  })

  it('announces only the short summary, once per check', async () => {
    const user = await openChecker()
    await checkManual(user, hexFor('Tricky'))
    const live = [...document.querySelectorAll('[role="status"], [aria-live]')]
    expect(live).toEqual([$('.check-summary')])
    expect(text('.check-summary')).toContain(en.colorResult.verdicts.weak)
    expect($('.check-reason')!.closest('[role="status"]')).toBeNull()
  })

  it('follows the saved presentation for example pieces', async () => {
    localStorage.setItem('personal-color-pocket:presentation:v1', 'men')
    const user = await openChecker()
    await checkManual(user, hexFor('Good Match'))
    expect(text('.check-placement') + text('.check-action')).not.toMatch(/dress|skirt|blouse/i)
  })

  it('a new check replaces the verdict', async () => {
    const user = await openChecker()
    await checkManual(user, hexFor('Great Match'))
    expect(text('.check-verdict')).toContain(en.colorResult.verdicts.strong)
    await checkManual(user, hexFor('Tricky'))
    expect(document.querySelectorAll('.check-verdict')).toHaveLength(1)
    expect(text('.check-verdict')).toContain(en.colorResult.verdicts.weak)
  })
})

describe('same HEX, Manual vs Photo: one result experience', () => {
  // One test per language × colour (Slice 6). The ten full App flows used to run inside one test
  // at ~4.2 s of its 5 s budget, and it timed out under full-suite load.
  const cases = (['en', 'th'] as const).flatMap((language) =>
    [palette.best[0].hex, palette.neutrals[1].hex, hexFor('Wearable'), palette.harder[0].hex, '#808080'].map((hex) => [language, hex.toUpperCase()] as const))

  it.each(cases)('%s %s: both modes show the same sections in the same order; only Photo adds its details and caveat', async (language, hex) => {
    const copy = locales[language]
    const user = await openChecker(language)
    await checkManual(user, hex)
    const manual = { structure: structure(), hex: text('.check-hex'), label: text('.check-reference > span:first-child'), pairHeading: text('.check-pairing h2') !== '' }
    await checkPhoto(user, hex, copy)
    const photo = { structure: structure(), hex: text('.check-hex'), label: text('.check-reference > span:first-child'), pairHeading: text('.check-pairing h2') !== '' }
    expect(photo.hex, hex).toBe(hex)
    expect(manual.hex).toBe(hex)
    // Same reference row; the label says what each engine actually reports.
    expect(manual.label).toBe(copy.colorResult.reference.nearestBest)
    expect(photo.label).toBe(copy.colorResult.reference.similar)
    expect(manual.pairHeading && photo.pairHeading).toBe(true)
    const base = ['check-sample', 'check-verdict', 'check-category', 'check-reason', 'check-action', 'check-reference', 'check-placement', 'check-pairing']
    expect(manual.structure).toEqual(base)
    expect(photo.structure.filter((name) => name !== 'check-note')).toEqual([...base, 'check-details', 'check-caveat'])
  })

  it('when both engines reach the same level, both show the identical verdict text and cue', async () => {
    const hex = palette.best[0].hex.toUpperCase()
    const photoMatch = matchPhotoColor(samplePhotoRegion(solid(40, 40, hex), { x: 20, y: 20 }) as never, subtype)
    expect(getSuitability(photoMatch.category)).toBe(getManualSuitability(checkColor(hex, subtype)!.rating))
    const user = await openChecker('th')
    await checkManual(user, hex)
    const manual = text('.check-verdict')
    await checkPhoto(user, hex, th)
    expect(text('.check-verdict')).toBe(manual)
    expect(manual).toBe(`✨${th.colorResult.verdicts.strong}`)
  })
})

describe('copy consistency: shared result wording lives in one place', () => {
  const SHARED_KEYS = ['verdicts', 'action', 'reference', 'groups', 'placementHeading', 'tiers', 'areas', 'pairing'] as const
  const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []

  it('neither the Manual nor the Photo section keeps its own copy of the shared keys', () => {
    for (const locale of [en, th]) {
      for (const key of SHARED_KEYS) {
        expect(locale.checker, `checker.${key}`).not.toHaveProperty(key)
        expect(locale.photoChecker, `photoChecker.${key}`).not.toHaveProperty(key)
        expect(locale.colorResult).toHaveProperty(key)
      }
    }
  })

  it('no shared string is duplicated under checker or photoChecker', () => {
    for (const locale of [en, th]) {
      const shared = new Set(strings(locale.colorResult))
      for (const value of [...strings(locale.checker), ...strings(locale.photoChecker)]) expect(shared.has(value), value).toBe(false)
    }
  })

  it('the percentage copy and the old manual reason/pairing copy are removed', () => {
    for (const locale of [en, th]) {
      for (const key of ['fit', 'estimate', 'outfitLabel', 'pairHeading']) expect(locale.checker).not.toHaveProperty(key)
      expect(locale).not.toHaveProperty('matchReason')
    }
    expect(enSource).not.toMatch(/palette fit|scientific probability|Nearest palette color, for comparison/)
    expect(thSource).not.toMatch(/เข้ากับพาเลตต์ \$\{|ความน่าจะเป็นทางวิทยาศาสตร์|สีในพาเลตต์ที่ใกล้ที่สุด \(ไว้เปรียบเทียบ\)/)
  })

  it('Manual reasons are parallel in EN and TH and never mention numbers', () => {
    for (const rating of RATINGS) {
      for (const locale of [en, th]) {
        const why = locale.checker.why[rating]
        expect(why.trim().length).toBeGreaterThan(20)
        expect(why).not.toMatch(/\d|%/)
      }
      expect(th.checker.why[rating]).toMatch(/[ก-๙]/)
    }
  })
})
