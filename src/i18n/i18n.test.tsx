import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { palettes } from '../domain/personalColor/palettes'
import { quizQuestions } from '../domain/personalColor/quiz'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import { subtypeOrder } from '../domain/personalColor/seasons'
import { saveState, STORAGE_KEY } from '../services/persistence'
import { hasCompleteThaiColorName, thaiCanonicalColorNames, translateColorNameThai } from './colors'
import { colorDisplayName, detectLanguage, getCopy, LANGUAGE_STORAGE_KEY, persistLanguage, translations } from './index'

const warmAnswers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }

const paletteGroups = ['best', 'neutrals', 'accents', 'harder', 'metals'] as const
const canonicalColors = subtypeOrder.flatMap((subtype) => paletteGroups.flatMap((group) =>
  palettes[subtype][group].map((color) => ({ subtype, group, color })),
))
const canonicalNames = [...new Set(canonicalColors.map(({ color }) => color.name))].sort()

describe('Thai and English localization', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('offers both languages, defaults Thai browsers to Thai, and persists an explicit choice', () => {
    expect(translations.en.languageName).toBe('English')
    expect(translations.th.languageName).toBe('ไทย')
    expect(detectLanguage('th-TH')).toBe('th')
    expect(detectLanguage('en-US')).toBe('en')
    persistLanguage('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    expect(detectLanguage('th-TH')).toBe('en')
  })

  it('covers every quiz question and existing answer ID in both languages', () => {
    quizQuestions.forEach((question) => {
      ;(['en', 'th'] as const).forEach((language) => {
        const localized = getCopy(language).quizQuestions[question.id] as { prompt: string; helper: string; options: Record<string, { label: string; hint: string }> }
        expect(localized.prompt).toBeTruthy()
        expect(localized.helper).toBeTruthy()
        question.options.forEach((option) => {
          expect(localized.options[option.id]?.label).toBeTruthy()
          expect(localized.options[option.id]?.hint).toBeTruthy()
        })
      })
    })
  })

  it('localizes all subtype names, palette categories, and displayed palette colors', () => {
    subtypeOrder.forEach((subtype) => {
      expect(translations.en.subtypes[subtype].name).toBeTruthy()
      expect(translations.th.subtypes[subtype].name).toMatch(/[ก-๙]/)
      const palette = palettes[subtype]
      ;[...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder, ...palette.metals].forEach((color) => {
        expect(hasCompleteThaiColorName(color.name), color.name).toBe(true)
        expect(translateColorNameThai(color.name), color.name).toMatch(/[ก-๙]/)
      })
    })
    Object.values(translations.th.palette.sections).forEach((section) => {
      expect(section.title).toMatch(/[ก-๙]/)
      expect(section.description).toMatch(/[ก-๙]/)
    })
  })

  it('has an exhaustive explicit Thai table for all 240 canonical names and no compositional fallback', () => {
    expect(canonicalNames).toHaveLength(240)
    expect(Object.keys(thaiCanonicalColorNames).sort()).toEqual(canonicalNames)

    canonicalNames.forEach((name) => {
      expect(hasCompleteThaiColorName(name), name).toBe(true)
      expect(translateColorNameThai(name), name).toBe(thaiCanonicalColorNames[name as keyof typeof thaiCanonicalColorNames])
      expect(translateColorNameThai(name), name).toMatch(/[ก-๙]/)
    })

    expect(hasCompleteThaiColorName('Future Tomato Purple')).toBe(false)
    expect(translateColorNameThai('Future Tomato Purple')).toBe('Future Tomato Purple')
  })

  it('pins the reported regressions and final product-owner decisions', () => {
    expect({
      'Tomato Red': translateColorNameThai('Tomato Red'),
      'Cool Taupe': translateColorNameThai('Cool Taupe'),
      'True Lavender': translateColorNameThai('True Lavender'),
    }).toEqual({
      'Tomato Red': 'แดงอมส้มสด',
      'Cool Taupe': 'น้ำตาลเทาโทนเย็น',
      'True Lavender': 'ม่วงลาเวนเดอร์',
    })

    expect(Object.fromEntries([
      'Blue Sage', 'Cool Emerald', 'Golden Rose', 'Heather', 'Mulberry',
      'Ochre', 'Oyster', 'Rose Silver', 'True Navy', 'Warm Navy',
    ].map((name) => [name, translateColorNameThai(name)]))).toEqual({
      'Blue Sage': 'เขียวเซจอมฟ้าหม่น',
      'Cool Emerald': 'เขียวมรกตโทนเย็น',
      'Golden Rose': 'ชมพูกุหลาบโทนอุ่น',
      Heather: 'ม่วงเฮเทอร์หม่น',
      Mulberry: 'ม่วงมัลเบอร์รีหม่น',
      Ochre: 'เหลืองโอเคอร์',
      Oyster: 'เทาเบจอ่อน',
      'Rose Silver': 'เงินอมชมพู',
      'True Navy': 'กรมท่า',
      'Warm Navy': 'กรมท่าโทนอุ่น',
    })
  })

  it('keeps the two mauve labels distinct and has no unintended exact Thai collisions', () => {
    expect(translateColorNameThai('Dusty Mauve')).toBe('ชมพูอมม่วงหม่น')
    expect(translateColorNameThai('Muted Mauve')).toBe('ม่วงอมชมพูหม่น')

    const namesByThai = new Map<string, string[]>()
    Object.entries(thaiCanonicalColorNames).forEach(([english, thai]) => {
      namesByThai.set(thai, [...(namesByThai.get(thai) ?? []), english])
    })
    const collisions = [...namesByThai.values()].filter((names) => names.length > 1).map((names) => names.sort())
    expect(collisions).toEqual([['Navy', 'True Navy']])
  })

  it('localizes presentation without mutating palette identity, membership, or English display names', () => {
    const before = canonicalColors.map(({ subtype, group, color }) => ({ subtype, group, id: color.id, name: color.name, hex: color.hex }))

    canonicalColors.forEach(({ color }) => {
      expect(colorDisplayName('en', color)).toBe(color.name)
      expect(colorDisplayName('th', color)).toBe(thaiCanonicalColorNames[color.name as keyof typeof thaiCanonicalColorNames])
    })

    const after = canonicalColors.map(({ subtype, group, color }) => ({ subtype, group, id: color.id, name: color.name, hex: color.hex }))
    expect(after).toEqual(before)
  })

  it('switches quiz language without changing the selected answer', async () => {
    const user = userEvent.setup()
    saveState({ answers: { undertone: 'golden' }, result: null, quizStep: 0 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    await user.click(screen.getByRole('button', { name: 'Women' }))
    expect(screen.getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(screen.getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).answers).toEqual({ undertone: 'golden' })
  })

  it('renders result reasons and Color Checker in both languages without changing the profile', async () => {
    const user = userEvent.setup()
    const result = analyzeQuiz(warmAnswers)
    saveState({ answers: warmAnswers, result, quizStep: 8 })
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'th')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'วอร์มสปริง' })).toBeInTheDocument()
    expect(screen.getByText(translations.th.reasonText.temperature.high.strong)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'เช็กสี' }))
    expect(screen.getByRole('heading', { name: 'สีนี้เหมาะกับฉันไหม?' })).toBeInTheDocument()
    expect(screen.getByText('เข้ากันมาก')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { name: 'Does this color suit me?' })).toBeInTheDocument()
    expect(screen.getByText('Great Match')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).result.subtype).toBe(result.subtype)
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    const textNodes = Array.from(document.querySelectorAll('*')).flatMap((element) =>
      Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent?.trim() ?? ''),
    )
    expect(textNodes.some((text) => /^(?:welcome|quiz|result|palette|checker)\.[a-z.]+$/i.test(text))).toBe(false)
  })
})
