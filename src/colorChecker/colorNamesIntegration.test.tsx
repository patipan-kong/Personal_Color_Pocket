import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { describeColor } from '../domain/colorNames/colorNames'
import { checkColor } from '../domain/personalColor/colorMatch'
import { hexToRgb } from '../domain/personalColor/colorUtils'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import { matchPhotoColor } from '../domain/photoColor/photoMatch'
import { samplePhotoRegion } from '../domain/photoColor/sampling'
import { getSuitability } from '../domain/photoColor/suitability'
import type { PixelSource } from '../domain/photoColor/types'
import type { Language, LocaleCopy } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { openPhoto } from '../services/photoImage'
import { saveState } from '../services/persistence'
import cardSource from './ColorResultCard.tsx?raw'
import stylesSource from '../styles.css?raw'
import { getManualSuitability } from './manualResult'

// V1.2 Slice 7: the human-readable colour name in the shared Color Checker result, for Manual and
// Photo alike. The name is presentation only: every verdict, warning and note is the engines' own.

vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))

const openPhotoMock = vi.mocked(openPhoto)
const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const result = analyzeQuiz(answers)
const subtype = result.subtype
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
  const user = userEvent.setup({ delay: null })
  render(<App />)
  await user.click(screen.getByRole('button', { name: language === 'en' ? /color checker/i : /เช็กสี/ }))
  return user
}

async function checkManual(user: ReturnType<typeof userEvent.setup>, copy: LocaleCopy, hex: string) {
  await user.click(screen.getByRole('tab', { name: copy.photoChecker.modes.manual }))
  const input = screen.getByLabelText(new RegExp(`${en.checker.hexLabel}|${th.checker.hexLabel}`, 'i'))
  await user.clear(input)
  await user.type(input, hex.replace('#', ''))
  await user.click(document.querySelector<HTMLButtonElement>('.hex-field button[type="submit"]')!)
}

async function checkPhoto(user: ReturnType<typeof userEvent.setup>, copy: LocaleCopy, hex: string) {
  await user.click(screen.getByRole('tab', { name: copy.photoChecker.modes.photo }))
  openPhotoMock.mockResolvedValueOnce(solid(400, 300, hex))
  await user.upload(screen.getByLabelText(new RegExp(`^(${copy.photoChecker.choose}|${copy.photoChecker.change})$`)), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
  await act(async () => {})
  fireEvent.pointerUp(document.querySelector('.photo-stage')!, { clientX: 200, clientY: 150, isPrimary: true, pointerType: 'touch' })
}

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)
const text = (selector: string) => $(selector)?.textContent ?? ''
const identity = () => ({ name: text('.check-name'), primary: text('.check-name strong'), hex: text('.check-hex') })

describe('O. Manual shows the bilingual name, with HEX secondary', () => {
  it.each(['en', 'th'] as const)('%s: page language first, the other language second, then the HEX', async (language) => {
    const user = await openChecker(language)
    await checkManual(user, locales[language], '#D0D1D5')
    const name = describeColor('#D0D1D5')!
    const [primary, secondary] = language === 'en' ? [name.en, name.th] : [name.th, name.en]
    expect(identity()).toEqual({ name: `${primary} · ${secondary}`, primary, hex: '#D0D1D5' })
    expect($('.check-name-alt')).toHaveAttribute('lang', language === 'en' ? 'th' : 'en')
    expect($('.check-hex')!.tagName).toBe('SPAN')
    expect(text('.check-sample small')).toBe(locales[language].checker.sampleLabel)
    // Manual never gets photo wording or guidance.
    expect($('.check-caveat')).toBeNull()
    expect($('.check-info')).toBeNull()
  })
})

describe('P. Photo shows the same name, as the colour seen in this photo', () => {
  it.each(['en', 'th'] as const)('%s', async (language) => {
    const user = await openChecker(language)
    await checkPhoto(user, locales[language], '#C6CACF')
    const name = describeColor('#C6CACF')!
    expect(identity().primary).toBe(language === 'en' ? 'Light Gray' : 'เทาอ่อน')
    expect(identity().name).toBe(language === 'en' ? `${name.en} · ${name.th}` : `${name.th} · ${name.en}`)
    expect(identity().hex).toBe('#C6CACF')
    expect(text('.check-sample small')).toBe(locales[language].photoChecker.sampleLabel)
    expect(locales[language].photoChecker.sampleLabel).toBe(language === 'en' ? 'Color seen in this photo' : 'สีที่เห็นในรูปนี้')
  })
})

describe('X. same HEX + same language → same name, whichever input supplied it', () => {
  const HEXES = ['#D0D1D5', '#E9785D', '#1E2C4D', '#8E8278', '#F4F4F2', '#737B38']
  it.each(['en', 'th'] as const)('%s', async (language) => {
    const user = await openChecker(language)
    for (const hex of HEXES) {
      await checkManual(user, locales[language], hex)
      const manual = identity()
      await checkPhoto(user, locales[language], hex)
      const photo = identity()
      expect(photo, hex).toEqual(manual)
      expect(photo.hex).toBe(hex)
    }
  })

  it('the name is derived in the shared card only: no adapter or input method names a colour', () => {
    const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const users = Object.entries(sources).filter(([, source]) => /from '[./]*domain\/colorNames\/colorNames'|from '\.\/colorNames'/.test(source)).map(([path]) => path).sort()
    // V2.0 AI Color Lab (Slice 0): aiLabDeterministic.ts is a deliberate, independent, dev-only
    // consumer of describeColor() for its own baseline display -- it is not a Color Checker
    // input method or adapter, so it does not violate what THIS invariant actually guards
    // (Manual/Photo naming staying single-sourced through the shared card).
    expect(users).toEqual(['../aiLab/aiLabDeterministic.ts', '../domain/colorNames/colorNamesAudit.ts', './ColorResultCard.tsx'])
    // And inside it, one call, from the HEX alone.
    expect(cardSource.match(/describeColor\(/g)).toHaveLength(1)
    expect(cardSource).toContain('describeColor(hex)')
  })
})

describe('R. verdicts are unchanged: the name never feeds the decision', () => {
  it.each(['#D0D1D5', '#E9785D', '#2E86AB', '#9B738A', '#FFFFFF'])('%s: Manual and Photo verdicts are still their own engines’', async (hex) => {
    const user = await openChecker('en')
    await checkManual(user, en, hex)
    expect(text('.check-verdict')).toContain(en.colorResult.verdicts[getManualSuitability(checkColor(hex, subtype)!.rating)])
    await checkPhoto(user, en, hex)
    const sample = samplePhotoRegion(solid(400, 300, hex), { x: 200, y: 150 })
    expect('reason' in sample).toBe(false)
    const expected = getSuitability(matchPhotoColor(sample as never, subtype).category)
    expect(text('.check-verdict')).toContain(en.colorResult.verdicts[expected])
  })
})

describe('S. lighting guidance is unchanged', () => {
  it('a light near-neutral photo colour still gets the Slice 5f note, with the name above it', async () => {
    const user = await openChecker('en')
    await checkPhoto(user, en, '#F4F4F2')
    expect(identity().primary).toBe('Off-White')
    expect(text('.check-info')).toBe(en.photoChecker.lightingNote)
    expect(text('.check-caveat')).toBe(en.photoChecker.caveat)
  })

  it('highlight and shadow warnings are still shown and announced, whatever the name', async () => {
    const user = await openChecker('en')
    await checkPhoto(user, en, '#FFFFFF')
    expect(identity().primary).toBe('White')
    expect(text('.check-warnings')).toContain(en.photoChecker.warnings.highlight)
    expect($('.check-info')).toBeNull()
    await checkPhoto(user, en, '#050505')
    expect(identity().primary).toBe('Black')
    expect(text('.check-warnings')).toContain(en.photoChecker.warnings.shadow)
  })
})

describe('U. accessibility', () => {
  it('the name is text, announced once in the page language; the second language and swatch are hidden from speech', async () => {
    const user = await openChecker('th')
    await checkManual(user, th, '#D0D1D5')
    const summary = $('.check-summary')!
    expect(summary).toHaveAttribute('role', 'status')
    expect(summary.contains($('.check-name'))).toBe(true)
    expect($('.check-name-alt')).toHaveAttribute('aria-hidden', 'true')
    expect($('.check-swatch')).toHaveAttribute('aria-hidden', 'true')
    // What a screen reader hears: label, name, HEX, verdict, category. The name once.
    const spoken = [...summary.querySelectorAll('*')].filter((node) => !node.closest('[aria-hidden="true"]') && node.children.length === 0).map((node) => node.textContent).join('|')
    expect(spoken.split('เทาอ่อน').length - 1).toBe(1)
    expect(spoken).not.toContain('Light Gray')
    // No new heading or landmark: the result's heading structure is unchanged.
    expect([...document.querySelectorAll('.check-card h1, .check-card h2, .check-card h3')].map((node) => node.className)).not.toContain('check-name')
  })
})

describe('T. responsive rules for the name and HEX', () => {
  const rule = (selector: string) => stylesSource.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm'))?.[1] ?? ''
  const size = (selector: string) => Number(rule(selector).match(/font-size: ([\d.]+)rem/)?.[1])

  it('long names wrap instead of overflowing, and the identity column can shrink', () => {
    expect(rule('.check-name')).toContain('overflow-wrap: anywhere')
    expect(rule('.check-identity')).toContain('min-width: 0')
  })

  it('the verdict stays the largest text; the name is below it and the HEX is smaller still', () => {
    const verdictMin = Number(rule('.check-verdict').match(/clamp\(([\d.]+)rem/)?.[1])
    expect(size('.check-name')).toBeLessThan(verdictMin)
    expect(size('.check-hex')).toBeLessThan(size('.check-name'))
    expect(rule('.check-hex')).toContain('color: var(--muted)')
  })
})
