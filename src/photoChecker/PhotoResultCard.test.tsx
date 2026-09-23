import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getPalette } from '../domain/personalColor/palettes'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { Subtype } from '../domain/personalColor/types'
import { getColorPlacement } from '../domain/photoColor/placement'
import { realMatchFor } from '../domain/photoColor/realMatchFixtures'
import type { PhotoMatchCategory, PhotoPointMatched, SampleFlag } from '../domain/photoColor/types'
import { colorDisplayName } from '../i18n'
import type { Language } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import type { PresentationPreference } from '../services/presentationPreference'
import { PhotoFeedback } from './PhotoResultCard'
import type { PhotoSelection } from './photoPanelState'
import cardSource from './PhotoResultCard.tsx?raw'

afterEach(cleanup)

const CATEGORIES: PhotoMatchCategory[] = ['near-face', 'neutral-base', 'related', 'away-from-face', 'outside']
const locales = { en, th } as const

function renderCard(selection: PhotoSelection | null, { language = 'en', presentation = 'women' }: { language?: Language; presentation?: PresentationPreference } = {}) {
  const locale = locales[language]
  return render(<PhotoFeedback copy={locale.photoChecker} garments={locale.styleExamples.garments} language={language} presentation={presentation} selection={selection} />)
}

const real = (subtype: Subtype, category: PhotoMatchCategory, where?: (matched: PhotoPointMatched) => boolean) => realMatchFor(subtype, category, where)!
const selected = (matched: PhotoPointMatched): PhotoSelection => ({ point: matched.point, inspection: matched })
const withWarnings = (matched: PhotoPointMatched, warnings: SampleFlag[]): PhotoPointMatched => ({ ...matched, match: { ...matched.match, warnings } })

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)
const text = (selector: string) => $(selector)?.textContent ?? ''
const chipNames = (selector: string) => [...document.querySelectorAll(`${selector} .color-chip`)].map((chip) => chip.textContent)
const before = (first: string, second: string) => Boolean($(first)!.compareDocumentPosition($(second)!) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('result card hierarchy', () => {
  it('orders swatch/HEX → category → nearest → placement → pairings → details → caveat', () => {
    const matched = real('warm-autumn', 'away-from-face')
    renderCard(selected(matched))
    expect(text('.photo-summary')).toBe(`${en.photoChecker.sampleLabel}${matched.sample.hex}${en.photoChecker.categories['away-from-face']}`)
    const order = ['.photo-hex', '.photo-category', '.photo-reference', '.photo-placement', '.photo-pairing', '.photo-details', '.photo-caveat']
    order.slice(1).forEach((selector, index) => expect(before(order[index], selector), `${order[index]} before ${selector}`).toBe(true))
  })

  it('the category is the strong label and HEX is not the headline', () => {
    const matched = real('cool-summer', 'near-face')
    renderCard(selected(matched))
    expect($('.photo-category')).toHaveClass('rating')
    expect($('.photo-hex')!.tagName).toBe('STRONG')
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([en.photoChecker.placementHeading, en.photoChecker.pairing.around.heading])
  })

  it('always shows the photo caveat', () => {
    for (const category of CATEGORIES) {
      renderCard(selected(real('soft-autumn', category)))
      expect(text('.photo-caveat')).toBe('Based on how the color appears in this photo.')
      cleanup()
      renderCard(selected(real('soft-autumn', category)), { language: 'th' })
      expect(text('.photo-caveat')).toBe('คำแนะนำนี้อ้างอิงจากสีที่เห็นในภาพนี้')
      cleanup()
    }
  })

  it('shows no percentage, score or confidence', () => {
    for (const category of CATEGORIES) {
      for (const language of ['en', 'th'] as const) {
        renderCard(selected(real('deep-winter', category)), { language })
        expect(document.body.textContent).not.toMatch(/%|score|confidence|คะแนน|เปอร์เซ็นต์/i)
        cleanup()
      }
    }
  })
})

describe('placement guidance in the card', () => {
  it.each(CATEGORIES)('%s renders every placement row from getColorPlacement', (category) => {
    const matched = real('light-spring', category)
    renderCard(selected(matched))
    const placement = getColorPlacement(matched.match, 'women')
    const rows = [...document.querySelectorAll('.photo-place')]
    expect(rows).toHaveLength(placement.rows.length)
    placement.rows.forEach((row, index) => {
      expect(rows[index]).toHaveClass(`photo-place-${row.tier}`)
      expect(rows[index].querySelector('strong')!.textContent).toBe(en.photoChecker.tiers[row.tier])
      expect(rows[index].querySelector('span')!.textContent).toBe(row.areas.map((area) => en.photoChecker.areas[area]).join(' · '))
      expect(rows[index].querySelector('small')!.textContent).toBe(row.examples.map((example) => en.styleExamples.garments[example]).join(' · '))
    })
  })

  it('Better away from your face: easiest below the face, with care near the face and pairings to move closer', () => {
    renderCard(selected(real('warm-autumn', 'away-from-face')))
    expect(text('.photo-place-easiest')).toContain('Below the face')
    expect(text('.photo-place-care')).toContain('Near your face')
    expect(text('.photo-pairing')).toContain('Wear one of these closer to your face.')
    expect(document.body.textContent).not.toMatch(/don't wear|avoid|unsuitable|bad color/i)
  })

  it('Outside your palette is guidance, not a prohibition', () => {
    renderCard(selected(real('clear-spring', 'outside')))
    expect(text('.photo-place-easiest')).toContain('Accessories and small accents')
    expect(text('.photo-pairing')).toContain('Pair it with')
    expect(document.body.textContent).not.toMatch(/don't wear|avoid|unsuitable|bad color/i)
  })

  it('Women and Men see the same guidance with different example pieces', () => {
    const matched = real('deep-autumn', 'neutral-base')
    renderCard(selected(matched), { presentation: 'women' })
    const women = { tiers: text('.photo-placement ul').replace(/·/g, ''), examples: [...document.querySelectorAll('.photo-place small')].map((node) => node.textContent) }
    const womenAreas = [...document.querySelectorAll('.photo-place span')].map((node) => node.textContent)
    cleanup()
    renderCard(selected(matched), { presentation: 'men' })
    const menAreas = [...document.querySelectorAll('.photo-place span')].map((node) => node.textContent)
    const menExamples = [...document.querySelectorAll('.photo-place small')].map((node) => node.textContent)
    expect(menAreas).toEqual(womenAreas)
    expect(menExamples).not.toEqual(women.examples)
    expect(text('.photo-category')).toBe(en.photoChecker.categories['neutral-base'])
  })

  it('Men never see dress or skirt examples in any category', () => {
    for (const category of CATEGORIES) {
      renderCard(selected(real('cool-winter', category)), { presentation: 'men' })
      expect(text('.photo-placement')).not.toMatch(/Dress|Skirt|Blouse/)
      cleanup()
    }
  })
})

describe('nearest colour, resemblance, direction and descriptors', () => {
  it('names the nearest palette colour with the canonical display name, group and swatch, never its id', () => {
    const matched = real('soft-summer', 'related')
    const { color, group } = matched.match.nearest
    for (const language of ['en', 'th'] as const) {
      renderCard(selected(matched), { language })
      expect(chipNames('.photo-reference')).toEqual([colorDisplayName(language, color)])
      expect(text('.photo-reference')).toContain(locales[language].photoChecker.groups[group])
      expect($('.photo-reference .color-chip i')!.style.background).not.toBe('')
      expect(document.body.textContent).not.toContain(color.id)
      cleanup()
    }
  })

  it('says the photo colour is "also close to" a Harder colour, never that it is one', () => {
    const matched = real('warm-autumn', 'away-from-face')
    const harder = matched.match.resembles!.color
    renderCard(selected(matched))
    const sentence = text('.photo-resembles')
    expect(sentence).toBe(`In this photo it is also close to ${harder.name}, one of your more considered colors.`)
    expect(sentence).not.toMatch(new RegExp(`\\bis ${harder.name}`))
    expect(document.body.textContent).not.toContain(harder.id)
    cleanup()
    renderCard(selected(matched), { language: 'th' })
    expect(text('.photo-resembles')).toContain(colorDisplayName('th', harder))
    expect(text('.photo-resembles')).toContain('ใกล้กับ')
  })

  it('omits the resemblance line when the match has none', () => {
    const matched = real('light-spring', 'near-face', (candidate) => candidate.match.resembles === null)
    renderCard(selected(matched))
    expect($('.photo-resembles')).toBeNull()
  })

  it('translates match.direction without recomputing it, and hides it when empty', () => {
    const withDirection = real('light-spring', 'related', (candidate) => candidate.match.direction.length > 0)
    renderCard(selected(withDirection))
    const nearest = withDirection.match.nearest.color.name
    const parts = withDirection.match.direction.map((direction) => en.photoChecker.directions[direction])
    expect(text('.photo-details')).toContain(`A little ${parts.join(' and ')} than ${nearest}.`)
    expect(withDirection.match.direction.length).toBeLessThanOrEqual(2)
    cleanup()
    const close = real('light-spring', 'near-face')
    expect(close.match.direction).toEqual([])
    renderCard(selected(close))
    expect(text('.photo-details')).not.toMatch(/A little/)
  })

  it('shows the engine descriptors as supporting text', () => {
    const matched = real('deep-autumn', 'near-face')
    renderCard(selected(matched))
    const { value, clarity } = matched.match.descriptors
    expect(text('.photo-details')).toContain(`Color character: ${en.photoChecker.descriptors.value[value]} · ${en.photoChecker.descriptors.clarity[clarity]}`)
  })
})

describe('pairings', () => {
  it('renders match.pairWith exactly, in order, with display names and swatches', () => {
    for (const subtype of subtypeOrder) {
      for (const category of CATEGORIES) {
        const matched = real(subtype, category)
        renderCard(selected(matched), { language: 'th' })
        expect(chipNames('.photo-pairs')).toEqual(matched.match.pairWith.map((color) => colorDisplayName('th', color)))
        document.querySelectorAll('.photo-pairs .color-chip').forEach((chip, index) => expect(chip.getAttribute('title')).toContain(matched.match.pairWith[index].hex))
        matched.match.pairWith.forEach((color) => expect(document.body.textContent).not.toContain(color.id))
        cleanup()
      }
    }
  })

  it('frames pairings generally for strong categories and as "closer to your face" for weaker ones', () => {
    const framing: Record<PhotoMatchCategory, string> = { 'near-face': 'around', 'neutral-base': 'around', related: 'near-face', 'away-from-face': 'near-face', outside: 'near-face' }
    for (const category of CATEGORIES) {
      renderCard(selected(real('clear-winter', category)))
      const advice = en.photoChecker.pairing[framing[category] as 'around' | 'near-face']
      expect(text('.photo-pairing h2')).toBe(advice.heading)
      expect(text('.photo-pairing p')).toBe(advice.body)
      cleanup()
    }
  })

  it('the card does not compute pairings itself', () => {
    const code = cardSource.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    for (const forbidden of ['pairingSuggestions', 'getPalette', 'matchPhotoColor', 'samplePhotoRegion', 'hexToOklab', 'rgbToOklab', 'Distance', 'localStorage', 'fetch', 'XMLHttpRequest', 'console']) {
      expect(code, forbidden).not.toMatch(new RegExp(`\\b${forbidden}`))
    }
    expect(code).toMatch(/match\.pairWith\.map/)
  })

  it('palette chip names come from colorDisplayName (TH differs from the English data name)', () => {
    const matched = real('warm-autumn', 'near-face')
    renderCard(selected(matched), { language: 'th' })
    expect(chipNames('.photo-reference')[0]).toBe(colorDisplayName('th', matched.match.nearest.color))
    expect(chipNames('.photo-reference')[0]).toMatch(/[ก-๙]/)
  })
})

describe('warnings stay advisory', () => {
  it.each(['mixed', 'highlight', 'shadow'] as SampleFlag[])('%s keeps category, placement and pairings', (flag) => {
    const matched = withWarnings(real('soft-autumn', 'related'), [flag])
    renderCard(selected(matched))
    expect(text('.photo-category')).toBe(en.photoChecker.categories.related)
    expect(document.querySelectorAll('.photo-place').length).toBeGreaterThan(0)
    expect(chipNames('.photo-pairs').length).toBe(matched.match.pairWith.length)
    expect(text('.photo-warnings')).toBe(en.photoChecker.warnings[flag])
    expect(before('.photo-placement', '.photo-warnings')).toBe(true)
    // Announced once, with the summary; the visible list is not read a second time.
    expect(text('.photo-summary')).toContain(en.photoChecker.warnings[flag])
    expect($('.photo-warnings')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows all three together without dropping the guidance', () => {
    renderCard(selected(withWarnings(real('cool-summer', 'outside'), ['mixed', 'highlight', 'shadow'])))
    expect(document.querySelectorAll('.photo-warnings li')).toHaveLength(3)
    expect($('.photo-placement')).not.toBeNull()
    expect($('.photo-pairing')).not.toBeNull()
  })

  it('uses the concise, non-certain warning copy', () => {
    expect(en.photoChecker.warnings).toEqual({
      mixed: 'This spot mixes several colors. Try a more even area.',
      highlight: 'Strong light may make this color look lighter than it is.',
      shadow: 'Shadow may make this color look darker than it is.',
    })
    Object.values(th.photoChecker.warnings).forEach((warning) => expect(warning).toMatch(/[ก-๙]/))
  })
})

describe('states without a colour', () => {
  it('shows the instruction, then "press Enter" for a moved marker, with no guidance', () => {
    renderCard(null)
    expect(text('.photo-summary')).toBe(en.photoChecker.instruction)
    expect($('.photo-guidance')).toBeNull()
    cleanup()
    renderCard({ point: { x: 3, y: 3 }, inspection: null })
    expect(text('.photo-summary')).toBe(en.photoChecker.pending)
    expect($('.photo-guidance')).toBeNull()
  })

  it.each(['transparent', 'insufficient-pixels', 'outside-image'] as const)('unavailable (%s) shows its reason and no manufactured match', (reason) => {
    renderCard({ point: { x: 1, y: 1 }, inspection: { kind: 'unavailable', point: { x: 1, y: 1 }, radius: 3, reason } })
    expect(text('.photo-summary')).toBe(en.photoChecker.unavailable[reason])
    for (const selector of ['.photo-guidance', '.photo-category', '.photo-placement', '.photo-pairing', '.photo-caveat', '.photo-hex']) expect($(selector)).toBeNull()
  })
})

describe('accessibility', () => {
  it('only the short summary is a live region; the guidance is not re-announced as a whole', () => {
    renderCard(selected(real('light-summer', 'related')))
    const live = [...document.querySelectorAll('[role="status"], [aria-live]')]
    expect(live).toEqual([$('.photo-summary')])
    expect($('.photo-guidance')!.closest('[role="status"]')).toBeNull()
  })

  it('never relies on colour alone: every swatch has an adjacent name or the HEX', () => {
    renderCard(selected(real('warm-spring', 'away-from-face')))
    document.querySelectorAll('.color-chip').forEach((chip) => expect(chip.textContent!.trim().length).toBeGreaterThan(0))
    expect(text('.photo-sample')).toContain(real('warm-spring', 'away-from-face').sample.hex)
    expect(text('.photo-resembles').length).toBeGreaterThan(0)
    document.querySelectorAll('.photo-place').forEach((row) => expect(row.querySelector('strong')!.textContent!.length).toBeGreaterThan(0))
  })

  it('headings name the placement and pairing sections', () => {
    renderCard(selected(real('clear-spring', 'related')))
    expect(screen.getByRole('region', { name: en.photoChecker.placementHeading })).toBe($('.photo-placement'))
    expect(screen.getByRole('region', { name: en.photoChecker.pairing['near-face'].heading })).toBe($('.photo-pairing'))
  })
})

describe('localization', () => {
  it('has complete, parallel EN/TH copy for the card', () => {
    for (const locale of [en, th]) {
      const copy = locale.photoChecker
      const strings = [copy.nearestLabel, copy.placementHeading, copy.descriptorsLabel, copy.caveat, copy.resembles('X'), copy.direction('X', ['a', 'b']),
        ...Object.values(copy.groups), ...Object.values(copy.tiers), ...Object.values(copy.areas), ...Object.values(copy.directions),
        ...Object.values(copy.pairing).flatMap((advice) => [advice.heading, advice.body]),
        ...Object.values(copy.descriptors.value), ...Object.values(copy.descriptors.clarity)]
      strings.forEach((value) => expect(value.trim().length).toBeGreaterThan(0))
      expect(Object.keys(copy.tiers).sort()).toEqual(['best', 'care', 'easiest', 'good'])
      expect(Object.keys(copy.directions).sort()).toEqual(['brighter', 'cooler', 'deeper', 'lighter', 'muted', 'warmer'])
    }
    ;[th.photoChecker.caveat, th.photoChecker.placementHeading, ...Object.values(th.photoChecker.tiers), ...Object.values(th.photoChecker.areas)].forEach((value) => expect(value).toMatch(/[ก-๙]/))
  })

  it('uses the agreed Thai category wording', () => {
    expect(th.photoChecker.categories).toEqual({
      'near-face': 'เหมาะมากเมื่ออยู่ใกล้ใบหน้า', 'neutral-base': 'สีกลางที่ใช้ง่าย', related: 'ใช้ได้ ถ้าจัดคู่สีให้เหมาะ',
      'away-from-face': 'เหมาะกว่าเมื่ออยู่ห่างจากใบหน้า', outside: 'อยู่นอกพาเลตต์หลักของคุณ',
    })
  })

  it('renders the whole card in Thai', () => {
    const matched = real('soft-summer', 'away-from-face')
    renderCard(selected(matched), { language: 'th' })
    expect(text('.photo-category')).toBe(th.photoChecker.categories['away-from-face'])
    expect(text('.photo-placement h2')).toBe(th.photoChecker.placementHeading)
    expect(text('.photo-pairing h2')).toBe(th.photoChecker.pairing['near-face'].heading)
    expect(text('.photo-place-easiest small')).toMatch(/[ก-๙]/)
    expect(getPalette('soft-summer').harder.some((color) => color.id === matched.match.resembles?.color.id)).toBe(true)
  })
})
