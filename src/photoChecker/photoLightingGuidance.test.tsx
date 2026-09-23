import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { toManualResultView } from '../colorChecker/manualResult'
import { checkColor } from '../domain/personalColor/colorMatch'
import { hexToOklab, hexToRgb, oklabChroma } from '../domain/personalColor/colorUtils'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import { subtypeOrder } from '../domain/personalColor/seasons'
import { getPhotoLightingGuidance, isLightNearNeutral } from '../domain/photoColor/lightingGuidance'
import { LIGHT_VALUE_MIN, matchPhotoColor, NEUTRAL_CHROMA_MAX } from '../domain/photoColor/photoMatch'
import { inspectHex } from '../domain/photoColor/realMatchFixtures'
import { samplePhotoRegion } from '../domain/photoColor/sampling'
import { getSuitability } from '../domain/photoColor/suitability'
import type { PhotoPointMatched, PixelSource, SampleFlag } from '../domain/photoColor/types'
import type { Language, LocaleCopy } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { openPhoto } from '../services/photoImage'
import { saveState } from '../services/persistence'
import { PhotoFeedback } from './PhotoResultCard'
import { toPhotoResultView } from './photoResult'
import helperSource from '../domain/photoColor/lightingGuidance.ts?raw'
import adapterSource from './photoResult.ts?raw'
import sharedCardSource from '../colorChecker/ColorResultCard.tsx?raw'

// V1.2 Slice 5f: photo lighting guidance. Presentation only: the sample, match and verdict are
// the unchanged engine's; these tests check when the lighting note appears and what it says.

vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))

const locales = { en, th } as const
const FLAGS: SampleFlag[] = ['mixed', 'highlight', 'shadow']
// Slice 5e's reported sample. Photographically it can be a shaded white OR a real blue-grey; the
// app cannot tell which, and nothing here assumes either.
const REPORTED = '#9FABB4'
// Pure #FFFFFF is included for the rule; as a photo sample it is clipped, so the sampler flags it
// `highlight` and the card shows that warning instead (see the priority tests).
const LIGHT_NEUTRALS = { white: '#FFFFFF', 'white fabric': '#F4F4F2', 'off-white': '#FAF9F6', cream: '#F5F0E6', 'light grey': '#D3D3D3', 'silver grey': '#C0C0C0', reported: REPORTED }
const DARK = { 'near-black': '#111412', black: '#000000', navy: '#1F2A44', 'navy (saturated)': '#000080', 'dark brown': '#4B3621', charcoal: '#36454F' }
// Light but clearly chromatic: above the near-neutral chroma boundary.
const LIGHT_CHROMATIC = { 'bright yellow': '#FFE600', 'light cyan': '#AEEEEE', pink: '#FFC0CB', 'baby blue': '#B3CDE6', 'saturated red': '#CC0000', 'strong green': '#1FA84A', 'saturated blue': '#1F5FD1' }

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)
const text = (selector: string) => $(selector)?.textContent ?? ''
const before = (first: string, second: string) => Boolean($(first)!.compareDocumentPosition($(second)!) & Node.DOCUMENT_POSITION_FOLLOWING)
const selected = (matched: PhotoPointMatched) => ({ point: matched.point, inspection: matched })
const withWarnings = (matched: PhotoPointMatched, warnings: SampleFlag[]): PhotoPointMatched => ({ ...matched, match: { ...matched.match, warnings } })

function renderCard(matched: PhotoPointMatched, language: Language = 'en') {
  const locale = locales[language]
  return render(<PhotoFeedback copy={locale.photoChecker} resultCopy={locale.colorResult} garments={locale.styleExamples.garments} language={language} presentation="women" selection={selected(matched)} />)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('light near-neutral rule', () => {
  it('reuses the existing photo-match boundaries, with no new number', () => {
    expect(helperSource).toMatch(/import \{ LIGHT_VALUE_MIN, NEUTRAL_CHROMA_MAX \} from '\.\/photoMatch'/)
    const code = helperSource.replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\d*\.\d+|\b\d+\b/)
    expect(LIGHT_VALUE_MIN).toBe(.72)
    expect(NEUTRAL_CHROMA_MAX).toBe(.04)
  })

  it('boundaries: L ≥ LIGHT_VALUE_MIN (inclusive) and chroma < NEUTRAL_CHROMA_MAX (exclusive)', () => {
    expect(isLightNearNeutral({ l: LIGHT_VALUE_MIN, a: 0, b: 0 })).toBe(true)
    expect(isLightNearNeutral({ l: LIGHT_VALUE_MIN - 1e-6, a: 0, b: 0 })).toBe(false)
    expect(isLightNearNeutral({ l: .9, a: NEUTRAL_CHROMA_MAX - 1e-6, b: 0 })).toBe(true)
    expect(isLightNearNeutral({ l: .9, a: NEUTRAL_CHROMA_MAX, b: 0 })).toBe(false)
    expect(isLightNearNeutral({ l: .9, a: 0, b: -(NEUTRAL_CHROMA_MAX + 1e-6) })).toBe(false)
  })

  it.each(Object.entries(LIGHT_NEUTRALS))('%s (%s) is light and near-neutral', (_, hex) => {
    expect(isLightNearNeutral(hexToOklab(hex)!)).toBe(true)
  })

  it.each(Object.entries(DARK))('%s (%s) is not: low chroma alone never triggers it', (_, hex) => {
    expect(isLightNearNeutral(hexToOklab(hex)!)).toBe(false)
  })

  it.each(Object.entries(LIGHT_CHROMATIC))('%s (%s) is not: its chroma is above the near-neutral boundary', (_, hex) => {
    expect(oklabChroma(hexToOklab(hex)!)).toBeGreaterThanOrEqual(NEUTRAL_CHROMA_MAX)
    expect(isLightNearNeutral(hexToOklab(hex)!)).toBe(false)
  })

  it('a mid grey below the light boundary is not included', () => {
    expect(hexToOklab('#9E9E9E')!.l).toBeLessThan(LIGHT_VALUE_MIN)
    expect(isLightNearNeutral(hexToOklab('#9E9E9E')!)).toBe(false)
  })

  it('returns a semantic key only: no colour, match, category or confidence', () => {
    const guidance = getPhotoLightingGuidance(inspectHex(REPORTED, 'deep-winter').match)
    expect(guidance).toEqual({ kind: 'light-near-neutral' })
    const code = helperSource.replace(/\/\/.*$/gm, '')
    for (const forbidden of ['hex', 'rgb', 'category', 'confidence', 'score', 'probability', 'matchPhotoColor', 'samplePhotoRegion', 'getPalette']) {
      expect(code, forbidden).not.toMatch(new RegExp(forbidden, 'i'))
    }
  })

  it('an explicit sampler warning takes priority over the lighting note', () => {
    const { match } = inspectHex('#F4F4F2', 'cool-summer')
    expect(match.warnings).toEqual([])
    expect(getPhotoLightingGuidance(match)).not.toBeNull()
    for (const flag of FLAGS) expect(getPhotoLightingGuidance({ ...match, warnings: [flag] }), flag).toBeNull()
    expect(getPhotoLightingGuidance({ ...match, warnings: [...FLAGS] })).toBeNull()
  })

  it('the rule is never encoded as "this is white"', () => {
    for (const source of [helperSource, adapterSource, sharedCardSource]) expect(source.toUpperCase()).not.toContain('9FABB4')
    for (const locale of [en, th]) expect(JSON.stringify(locale).toUpperCase()).not.toContain('9FABB4')
  })
})

describe('the reported #9FABB4 sample', () => {
  it('matches exactly as the unchanged matcher decides, for every subtype', () => {
    for (const subtype of subtypeOrder) {
      const matched = inspectHex(REPORTED, subtype)
      const direct = matchPhotoColor(samplePhotoRegion({ width: 24, height: 24, data: solidData(REPORTED) }, { x: 12, y: 12 }) as never, subtype)
      expect(matched.match).toEqual(direct)
      const view = toPhotoResultView(matched, en.photoChecker, 'en', 'women')
      expect(view.hex).toBe(REPORTED)
      expect(view.category.key).toBe(direct.category)
      expect(view.suitability).toBe(getSuitability(direct.category))
      expect(view.reference.color).toBe(direct.nearest.color)
      expect(view.pairWith).toBe(matched.match.pairWith)
      expect(view.pairWith).toEqual(direct.pairWith)
      expect(view.info).toBe(en.photoChecker.lightingNote)
    }
  })

  it('shows the lighting note, which talks about the photo and suggests another evenly lit spot', () => {
    renderCard(inspectHex(REPORTED, 'soft-summer'))
    expect(text('.check-info')).toBe(en.photoChecker.lightingNote)
    expect(en.photoChecker.lightingNote).toMatch(/in a photo/)
    expect(en.photoChecker.lightingNote).toMatch(/try another evenly lit spot/)
    cleanup()
    renderCard(inspectHex(REPORTED, 'soft-summer'), 'th')
    expect(text('.check-info')).toBe(th.photoChecker.lightingNote)
    expect(th.photoChecker.lightingNote).toMatch(/แสงในภาพ/)
    expect(th.photoChecker.lightingNote).toMatch(/ลองแตะอีกจุด/)
  })

  it('stays valid if the item really is blue-grey: conditional, never a diagnosis', () => {
    // The same pixels could be a genuine blue-grey fabric, so the note may only say "if".
    expect(en.photoChecker.lightingNote).toMatch(/If this doesn't look like the real color/)
    expect(th.photoChecker.lightingNote).toMatch(/ถ้าสีนี้ดูไม่ตรงกับของจริง/)
    for (const note of [en.photoChecker.lightingNote, th.photoChecker.lightingNote]) {
      expect(note).not.toMatch(/shade|shadow|is white|actually|camera|detected|wrong|ตรวจพบ|เงา|กล้อง|คือสีขาว/i)
    }
  })

  it('a "not ideal near your face" verdict stays exactly that, first, with the note after the guidance', () => {
    const matched = inspectHex(REPORTED, 'deep-winter')
    expect(matched.match.category).toBe('away-from-face')
    renderCard(matched)
    expect(text('.check-verdict > span:last-child')).toBe(en.colorResult.verdicts.weak)
    expect(text('.check-verdict-mark')).toBe('△')
    expect(text('.check-category')).toBe(en.photoChecker.categories['away-from-face'])
    for (const earlier of ['.check-verdict', '.check-reason', '.check-action', '.check-placement', '.check-pairing']) expect(before(earlier, '.check-info'), earlier).toBe(true)
    expect(before('.check-info', '.check-caveat')).toBe(true)
  })

  it('an "outside" (✕) verdict is not softened by the note', () => {
    const matched = subtypeOrder.flatMap((subtype) => Object.values(LIGHT_NEUTRALS).map((hex) => inspectHex(hex, subtype)))
      .find((candidate) => candidate.match.category === 'outside' && candidate.match.warnings.length === 0)
    expect(matched).toBeDefined()
    renderCard(matched!)
    expect(text('.check-verdict-mark')).toBe('✕')
    expect(text('.check-verdict > span:last-child')).toBe(en.colorResult.verdicts.outside)
    expect(text('.check-info')).toBe(en.photoChecker.lightingNote)
  })
})

function solidData(hex: string, size = 24) {
  const { r, g, b } = hexToRgb(hex)!
  const data = new Uint8ClampedArray(size * size * 4)
  for (let index = 0; index < data.length; index += 4) data.set([r, g, b, 255], index)
  return data
}

describe('where the note appears', () => {
  it.each(Object.entries(LIGHT_NEUTRALS).filter(([name]) => name !== 'white'))('%s: note shown, verdict and caveat kept', (_, hex) => {
    renderCard(inspectHex(hex, 'light-spring'))
    expect(text('.check-info')).toBe(en.photoChecker.lightingNote)
    expect($('.check-verdict')).not.toBeNull()
    expect(text('.check-caveat')).toBe(en.photoChecker.caveat)
  })

  it.each(Object.entries({ ...DARK, ...LIGHT_CHROMATIC }))('%s: no lighting note, only the usual caveat', (_, hex) => {
    for (const subtype of subtypeOrder) {
      const matched = inspectHex(hex, subtype)
      expect(toPhotoResultView(matched, en.photoChecker, 'en', 'women').info, subtype).toBeNull()
    }
    renderCard(inspectHex(hex, 'deep-autumn'))
    expect($('.check-info')).toBeNull()
    expect(text('.check-caveat')).toBe(en.photoChecker.caveat)
  })
})

describe('guidance priority: explicit warning > lighting note > caveat', () => {
  it.each(FLAGS)('%s on a light near-neutral sample: the warning only, no repeated note', (flag) => {
    renderCard(withWarnings(inspectHex('#F4F4F2', 'cool-winter'), [flag]))
    expect(text('.check-warnings')).toBe(en.photoChecker.warnings[flag])
    expect($('.check-info')).toBeNull()
    expect(document.body.textContent).not.toContain(en.photoChecker.lightingNote)
    expect($('.check-verdict')).not.toBeNull()
    expect(text('.check-caveat')).toBe(en.photoChecker.caveat)
  })

  it('all three warnings together: three warnings, no note, verdict and caveat kept', () => {
    renderCard(withWarnings(inspectHex(REPORTED, 'deep-winter'), [...FLAGS]))
    expect(document.querySelectorAll('.check-warnings li')).toHaveLength(3)
    expect($('.check-info')).toBeNull()
    expect(text('.check-verdict > span:last-child')).toBe(en.colorResult.verdicts.weak)
    expect(text('.check-caveat')).toBe(en.photoChecker.caveat)
  })

  it('a real highlight sample (blown white) shows the highlight warning instead of the note', () => {
    const image: PixelSource = { width: 24, height: 24, data: solidData('#FFFFFF') }
    const sample = samplePhotoRegion(image, { x: 12, y: 12 })
    expect(sample.kind === 'color' && sample.diagnostics.flags).toEqual(['highlight'])
    const matched = inspectHex('#FFFFFF', 'soft-summer')
    renderCard(matched)
    expect(text('.check-warnings')).toBe(en.photoChecker.warnings.highlight)
    expect($('.check-info')).toBeNull()
  })

  it('light near-neutral only: the note, and no warning list', () => {
    renderCard(inspectHex('#D3D3D3', 'soft-summer'))
    expect($('.check-warnings')).toBeNull()
    expect(text('.check-info')).toBe(en.photoChecker.lightingNote)
  })

  it('the shared renderer has no mode switch; Manual supplies no note', () => {
    expect(sharedCardSource).not.toMatch(/mode ?===|'photo'|"photo"|lightingNote/)
    for (const hex of ['#FFFFFF', '#D3D3D3', REPORTED, '#1F2A44']) {
      for (const subtype of subtypeOrder) expect(toManualResultView(checkColor(hex, subtype)!, en, 'women').info).toBeNull()
    }
  })
})

describe('accessibility', () => {
  it('the note is ordinary readable text, outside the live region and not hidden', () => {
    renderCard(inspectHex(REPORTED, 'cool-summer'))
    const note = $('.check-info')!
    expect(note.tagName).toBe('P')
    expect(note.closest('[role="status"]')).toBeNull()
    expect(note.closest('[aria-hidden="true"]')).toBeNull()
    expect(text('.photo-summary')).not.toContain(en.photoChecker.lightingNote)
  })

  it('warnings keep their announcement: in the summary once, the visible list hidden', () => {
    renderCard(withWarnings(inspectHex(REPORTED, 'cool-summer'), ['shadow']))
    expect(text('.photo-summary')).toContain(en.photoChecker.warnings.shadow)
    expect($('.check-warnings')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('honest warning copy', () => {
  it('shadow says "very dark pixels", never ordinary shade detection (EN + TH)', () => {
    expect(en.photoChecker.warnings.shadow).toMatch(/very dark pixels/)
    expect(en.photoChecker.warnings.shadow).not.toMatch(/shadow|shade|detected/i)
    expect(th.photoChecker.warnings.shadow).toMatch(/มีส่วนที่มืดจัด/)
    expect(th.photoChecker.warnings.shadow).not.toMatch(/เงา|ตรวจพบ/)
  })

  it('highlight says "very bright pixels", never general bright-light detection (EN + TH)', () => {
    expect(en.photoChecker.warnings.highlight).toMatch(/very bright pixels/)
    expect(en.photoChecker.warnings.highlight).not.toMatch(/strong light|lighting|glare|detected/i)
    expect(th.photoChecker.warnings.highlight).toMatch(/มีส่วนที่สว่างจัด/)
    expect(th.photoChecker.warnings.highlight).not.toMatch(/แสงจ้า|ตรวจพบ/)
  })

  it('mixed keeps its meaning: several colors, try a more even area of the same color', () => {
    expect(en.photoChecker.warnings.mixed).toMatch(/several colors/)
    expect(en.photoChecker.warnings.mixed).toMatch(/more even area of the same color/)
    expect(th.photoChecker.warnings.mixed).toMatch(/หลายสีปนกัน/)
    expect(th.photoChecker.warnings.mixed).toMatch(/สีเดียวกัน/)
  })

  it('every warning suggests another spot, and none of the new copy claims detection', () => {
    for (const warning of Object.values(en.photoChecker.warnings)) expect(warning).toMatch(/Try an? /)
    for (const warning of Object.values(th.photoChecker.warnings)) expect(warning).toMatch(/ลองแตะ/)
    const all = [en, th].flatMap(({ photoChecker: copy }) => [...Object.values(copy.warnings), copy.captureTip, copy.lightingNote, copy.instruction])
    for (const line of all) expect(line).not.toMatch(/detected|bad lighting|ตรวจพบ/i)
  })
})

describe('capture and tap guidance', () => {
  it('capture tip: even lighting, avoid deep shade, glare and strong reflections (EN + TH)', () => {
    expect(en.photoChecker.captureTip).toMatch(/even lighting/)
    expect(en.photoChecker.captureTip).toMatch(/deep shade/)
    expect(en.photoChecker.captureTip).toMatch(/glare/)
    expect(en.photoChecker.captureTip).toMatch(/strong reflections/)
    for (const phrase of ['แสงสม่ำเสมอ', 'ไม่มืดหรือสว่างจัด', 'เงา', 'แสงสะท้อน']) expect(th.photoChecker.captureTip).toContain(phrase)
  })

  it('tap guidance asks for an evenly lit area, never the brightest one', () => {
    expect(en.photoChecker.instruction).toMatch(/Tap an evenly lit area/)
    expect(th.photoChecker.instruction).toMatch(/แสงสว่างและสม่ำเสมอ/)
    for (const line of [en.photoChecker.instruction, en.photoChecker.lightingNote, en.photoChecker.captureTip]) expect(line).not.toMatch(/brightest|lightest/i)
    for (const line of [th.photoChecker.instruction, th.photoChecker.lightingNote, th.photoChecker.captureTip]) expect(line).not.toMatch(/สว่างที่สุด|อ่อนที่สุด/)
  })

  it('stays short: no tutorial', () => {
    for (const locale of [en, th]) {
      expect(locale.photoChecker.captureTip.length).toBeLessThan(130)
      expect(locale.photoChecker.lightingNote.length).toBeLessThan(170)
    }
  })
})

// App level: Photo shows the tip and the note; Manual shows neither.
const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const result = analyzeQuiz(answers)
const openPhotoMock = vi.mocked(openPhoto)

class FakePointerEvent extends MouseEvent {
  pointerType: string
  isPrimary: boolean
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? 'mouse'
    this.isPrimary = init.isPrimary ?? false
  }
}

describe('in the app', () => {
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

  async function openChecker(language: Language) {
    localStorage.setItem('personal-color-pocket:language', language)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: language === 'en' ? /color checker/i : /เช็กสี/ }))
    return user
  }

  async function checkPhoto(user: ReturnType<typeof userEvent.setup>, hex: string, copy: LocaleCopy) {
    await user.click(screen.getByRole('tab', { name: copy.photoChecker.modes.photo }))
    expect(text('.photo-tip')).toBe(copy.photoChecker.captureTip)
    openPhotoMock.mockResolvedValueOnce({ width: 400, height: 300, data: solidData400(hex) })
    await user.upload(screen.getByLabelText(copy.photoChecker.choose), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await act(async () => {})
    expect(text('.photo-summary')).toBe(copy.photoChecker.instruction)
    fireEvent.pointerUp(document.querySelector('.photo-stage')!, { clientX: 200, clientY: 150, isPrimary: true, pointerType: 'touch' })
  }

  it.each(['en', 'th'] as const)('%s: Photo shows the capture tip and, for the reported sample, the note', async (language) => {
    const copy = locales[language]
    const user = await openChecker(language)
    await checkPhoto(user, REPORTED, copy)
    expect(text('.check-hex')).toBe(REPORTED)
    expect(text('.check-info')).toBe(copy.photoChecker.lightingNote)
    expect(text('.photo-summary')).not.toContain(copy.photoChecker.lightingNote)
  })

  it('Photo: a navy sample gets no note', async () => {
    const user = await openChecker('en')
    await checkPhoto(user, '#1F2A44', en)
    expect($('.check-info')).toBeNull()
    expect(text('.check-caveat')).toBe(en.photoChecker.caveat)
  })

  it('Manual: no tips, no note, no caveat, no photo warnings, even for white', async () => {
    const user = await openChecker('en')
    const input = screen.getByLabelText(new RegExp(en.checker.hexLabel, 'i'))
    await user.clear(input)
    await user.type(input, 'FFFFFF')
    await user.click(document.querySelector<HTMLButtonElement>('.hex-field button[type="submit"]')!)
    expect(text('.check-hex')).toBe('#FFFFFF')
    for (const selector of ['.photo-tip', '.check-info', '.check-caveat', '.check-warnings']) expect($(selector), selector).toBeNull()
    const body = document.body.textContent ?? ''
    for (const line of [en.photoChecker.captureTip, en.photoChecker.lightingNote, en.photoChecker.caveat, ...Object.values(en.photoChecker.warnings)]) expect(body).not.toContain(line)
  })
})

function solidData400(hex: string) {
  const { r, g, b } = hexToRgb(hex)!
  const data = new Uint8ClampedArray(400 * 300 * 4)
  for (let index = 0; index < data.length; index += 4) data.set([r, g, b, 255], index)
  return data
}
