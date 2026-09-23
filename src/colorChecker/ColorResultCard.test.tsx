import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getPalette } from '../domain/personalColor/palettes'
import { getPlacementGuide } from '../domain/photoColor/placement'
import type { PlacementIntent } from '../domain/photoColor/placement'
import type { Suitability } from '../domain/photoColor/suitability'
import { colorDisplayName } from '../i18n'
import type { Language } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { ColorResultCard } from './ColorResultCard'
import cardSource from './ColorResultCard.tsx?raw'
import type { ColorResultView } from './resultView'

afterEach(cleanup)

// Synthetic views: the shared card is tested without either engine.
const palette = getPalette('soft-autumn')
const LEVELS: Suitability[] = ['strong', 'good', 'conditional', 'weak', 'outside']
const INTENT: Record<Suitability, PlacementIntent> = { strong: 'face', good: 'base', conditional: 'second-color', weak: 'below-face', outside: 'accents' }
const locales = { en, th } as const

function view(suitability: Suitability, overrides: Partial<ColorResultView> = {}): ColorResultView {
  return {
    hex: '#A1B2C3',
    sampleLabel: 'Checked color',
    suitability,
    category: { key: 'some-label', label: 'Engine label' },
    why: 'A short reason from the engine.',
    reference: { kind: 'similar', color: palette.best[0], group: 'best' },
    note: null,
    placement: getPlacementGuide(INTENT[suitability], 'women'),
    pairWith: [palette.neutrals[0], palette.best[1], palette.accents[0]],
    details: [],
    warnings: [],
    caveat: null,
    ...overrides,
  }
}

function renderView(result: ColorResultView, language: Language = 'en') {
  const locale = locales[language]
  return render(<ColorResultCard copy={locale.colorResult} garments={locale.styleExamples.garments} language={language} view={result} />)
}

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)
const text = (selector: string) => $(selector)?.textContent ?? ''
const before = (first: string, second: string) => Boolean($(first)!.compareDocumentPosition($(second)!) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('shared Color Checker result card', () => {
  it('orders swatch/HEX → verdict → label → why → action → reference → placement → pairing → details → warnings → caveat', () => {
    renderView(view('conditional', { details: ['A detail'], warnings: ['A warning'], caveat: 'A caveat' }))
    const order = ['.check-hex', '.check-verdict', '.check-category', '.check-reason', '.check-action', '.check-reference', '.check-placement', '.check-pairing', '.check-details', '.check-warnings', '.check-caveat']
    order.slice(1).forEach((selector, index) => expect(before(order[index], selector), `${order[index]} before ${selector}`).toBe(true))
  })

  it.each(LEVELS)('%s: its own verdict, cue and tone', (suitability) => {
    const marks = { strong: '✨', good: '✓', conditional: '△', weak: '△', outside: '✕' }
    const tones = { strong: 'positive', good: 'positive', conditional: 'middle', weak: 'negative', outside: 'negative' }
    for (const language of ['en', 'th'] as const) {
      renderView(view(suitability), language)
      expect(text('.check-verdict > span:last-child')).toBe(locales[language].colorResult.verdicts[suitability])
      expect(text('.check-verdict-mark')).toBe(marks[suitability])
      expect($('.check-verdict-mark')).toHaveAttribute('aria-hidden', 'true')
      expect($('.check-result')).toHaveClass(`check-tone-${tones[suitability]}`)
      expect(text('.check-placement h2')).toBe(locales[language].colorResult.placementHeading[tones[suitability] as 'positive'])
      cleanup()
    }
  })

  it('shows the engine label small and separate from the verdict', () => {
    renderView(view('good', { category: { key: 'good-match', label: 'Good Match' } }))
    expect($('.check-category')).toHaveClass('rating', 'check-category-good-match')
    expect(text('.check-category')).toBe('Good Match')
    expect($('.check-verdict')!.contains($('.check-category'))).toBe(false)
  })

  it('renders the reason as given and builds the action from the first placement row and first pairing', () => {
    renderView(view('weak'))
    expect(text('.check-reason')).toBe('A short reason from the engine.')
    const pieces = getPlacementGuide('below-face', 'women').rows[0].examples.slice(0, 3).map((key) => en.styleExamples.garments[key])
    expect(text('.check-action')).toBe(en.colorResult.action.weak(pieces, colorDisplayName('en', palette.neutrals[0])))
  })

  it('palette reference: labelled by kind, with the group only for a positive verdict', () => {
    for (const language of ['en', 'th'] as const) {
      const copy = locales[language].colorResult
      renderView(view('strong'), language)
      expect(text('.check-reference')).toBe(`${copy.reference.similar}${colorDisplayName(language, palette.best[0])}${copy.groups.best}`)
      cleanup()
      // Manual: "nearest of your Best colours", and no group (the engine does not report one).
      renderView(view('strong', { reference: { kind: 'nearestBest', color: palette.best[0], group: null } }), language)
      expect(text('.check-reference')).toBe(`${copy.reference.nearestBest}${colorDisplayName(language, palette.best[0])}`)
      cleanup()
      for (const suitability of ['conditional', 'weak', 'outside'] as const) {
        renderView(view(suitability), language)
        expect(text('.check-reference')).toBe(`${copy.reference.similar}${colorDisplayName(language, palette.best[0])}${copy.reference.compare}`)
        cleanup()
      }
    }
    expect(th.colorResult.reference.similar).toBe('สีใกล้เคียงในพาเลตต์ของคุณ')
    expect(en.colorResult.reference.similar).toBe('Similar color in your palette')
  })

  it('renders every placement row with tier, areas and example pieces', () => {
    renderView(view('strong'))
    const rows = [...document.querySelectorAll('.check-place')]
    const placement = getPlacementGuide('face', 'women')
    expect(rows).toHaveLength(placement.rows.length)
    placement.rows.forEach((row, index) => {
      expect(rows[index]).toHaveClass(`check-place-${row.tier}`)
      expect(rows[index].querySelector('strong')!.textContent).toBe(en.colorResult.tiers[row.tier])
      expect(rows[index].querySelector('span')!.textContent).toBe(row.areas.map((area) => en.colorResult.areas[area]).join(' · '))
    })
  })

  it('renders pairWith exactly, in order, as named chips; frames it by the placement advice', () => {
    renderView(view('outside'), 'th')
    expect([...document.querySelectorAll('.check-pairs .color-chip')].map((chip) => chip.textContent)).toEqual(view('outside').pairWith.map((color) => colorDisplayName('th', color)))
    expect(text('.check-pairing h2')).toBe(th.colorResult.pairing['near-face'].heading)
    cleanup()
    renderView(view('good', { pairWith: [] }))
    expect($('.check-pairing')).toBeNull()
  })

  it('optional slots render only when the source has them', () => {
    renderView(view('good'))
    for (const selector of ['.check-details', '.check-warnings', '.check-caveat', '.check-note', '.check-sr-only']) expect($(selector), selector).toBeNull()
    cleanup()
    renderView(view('conditional', { details: ['Detail one', 'Detail two'], note: { color: palette.harder[0], text: 'Also close to a Harder colour.' }, warnings: ['Warning one'], caveat: 'Caveat text' }))
    expect([...document.querySelectorAll('.check-details span')].map((node) => node.textContent)).toEqual(['Detail one', 'Detail two'])
    expect(text('.check-note')).toBe('Also close to a Harder colour.')
    expect(text('.check-caveat')).toBe('Caveat text')
    expect(text('.check-warnings')).toBe('Warning one')
  })

  it('long Thai text stays whole', () => {
    const long = 'สีนี้ห่างจากกลุ่มสีที่เข้ากับคุณที่สุด จึงอาจดูไม่เป็นธรรมชาติเมื่ออยู่ใกล้ใบหน้า '.repeat(4).trim()
    renderView(view('weak', { why: long, category: { key: 'tricky', label: 'ต้องจับคู่สักนิด' } }), 'th')
    expect(text('.check-reason')).toBe(long)
    expect(text('.check-verdict > span:last-child')).toBe('สีนี้ไม่ค่อยเหมาะเมื่ออยู่ใกล้ใบหน้า')
    expect(text('.check-action')).toMatch(/^ถ้าชอบสีนี้ /)
  })

  it('shows no percentage, score or confidence', () => {
    for (const suitability of LEVELS) {
      renderView(view(suitability))
      expect(document.body.textContent).not.toMatch(/%|score|confidence/i)
      cleanup()
    }
  })
})

describe('accessibility', () => {
  it('only the summary is a live region; warnings are announced there once', () => {
    renderView(view('conditional', { warnings: ['Shadow may darken this.'] }))
    expect([...document.querySelectorAll('[role="status"], [aria-live]')]).toEqual([$('.check-summary')])
    expect(text('.check-summary')).toBe('Checked color#A1B2C3△Wearable, but not one of your strongest colorsEngine labelShadow may darken this.')
    expect($('.check-guidance')!.closest('[role="status"]')).toBeNull()
    expect($('.check-warnings')).toHaveAttribute('aria-hidden', 'true')
  })

  it('never relies on colour alone: swatches carry names or the HEX', () => {
    renderView(view('strong'))
    expect($('.check-swatch')).toHaveAttribute('aria-hidden', 'true')
    expect(text('.check-sample')).toContain('#A1B2C3')
    document.querySelectorAll('.color-chip').forEach((chip) => {
      expect(chip.textContent!.trim().length).toBeGreaterThan(0)
      expect(chip.querySelector('i')).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('placement and pairing are labelled regions', () => {
    renderView(view('conditional'))
    expect(screen.getByRole('region', { name: en.colorResult.placementHeading.middle })).toBe($('.check-placement'))
    expect(screen.getByRole('region', { name: en.colorResult.pairing['near-face'].heading })).toBe($('.check-pairing'))
  })
})

describe('the shared card knows nothing about its source', () => {
  it('has no manual/photo branching, engine calls or storage', () => {
    // Imports are checked separately: the shared tone helper still lives in domain/photoColor.
    const imports = cardSource.match(/^import .*$/gm)!.map((line) => line.replace(/.* from '(.*)'$/, '$1'))
    expect(imports.sort()).toEqual(['../domain/personalColor/colorUtils', '../domain/personalColor/types', '../domain/photoColor/suitability', '../domain/photoColor/suitability', '../i18n', '../i18n', './resultView', 'react'])
    const code = cardSource.replace(/^import .*$/gm, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    for (const forbidden of ['mode', 'manual', 'photo', 'checkColor', 'matchPhotoColor', 'getSuitability', 'getColorPlacement', 'pairingSuggestions', 'getPalette', 'score', 'distance', 'localStorage', 'fetch']) {
      expect(code, forbidden).not.toMatch(new RegExp(forbidden, 'i'))
    }
  })
})
