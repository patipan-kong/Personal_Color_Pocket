import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getPalette } from '../domain/personalColor/palettes'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { Subtype } from '../domain/personalColor/types'
import { getColorPlacement } from '../domain/photoColor/placement'
import { getSuitability } from '../domain/photoColor/suitability'
import { realMatchFor } from '../domain/photoColor/realMatchFixtures'
import type { PhotoMatchCategory, PhotoPointMatched, SampleFlag } from '../domain/photoColor/types'
import { colorDisplayName } from '../i18n'
import type { Language } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import type { PresentationPreference } from '../services/presentationPreference'
import { PhotoFeedback } from './PhotoResultCard'
import type { PhotoSelection } from './photoPanelState'
import sharedCardSource from '../colorChecker/ColorResultCard.tsx?raw'
import cardSource from './PhotoResultCard.tsx?raw'
import adapterSource from './photoResult.ts?raw'

afterEach(cleanup)

const CATEGORIES: PhotoMatchCategory[] = ['near-face', 'neutral-base', 'related', 'away-from-face', 'outside']
const locales = { en, th } as const

function renderCard(selection: PhotoSelection | null, { language = 'en', presentation = 'women' }: { language?: Language; presentation?: PresentationPreference } = {}) {
  const locale = locales[language]
  return render(<PhotoFeedback copy={locale.photoChecker} resultCopy={locale.colorResult} garments={locale.styleExamples.garments} language={language} presentation={presentation} selection={selection} />)
}

const real = (subtype: Subtype, category: PhotoMatchCategory, where?: (matched: PhotoPointMatched) => boolean) => realMatchFor(subtype, category, where)!
const selected = (matched: PhotoPointMatched): PhotoSelection => ({ point: matched.point, inspection: matched })
const withWarnings = (matched: PhotoPointMatched, warnings: SampleFlag[]): PhotoPointMatched => ({ ...matched, match: { ...matched.match, warnings } })

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)
const text = (selector: string) => $(selector)?.textContent ?? ''
const chipNames = (selector: string) => [...document.querySelectorAll(`${selector} .color-chip`)].map((chip) => chip.textContent)
const before = (first: string, second: string) => Boolean($(first)!.compareDocumentPosition($(second)!) & Node.DOCUMENT_POSITION_FOLLOWING)
const verdictText = () => text('.check-verdict > span:last-child')
// A real match of this category that also resembles a Harder colour, from any subtype.
const realWithResemblance = (category: PhotoMatchCategory) => {
  for (const subtype of subtypeOrder) {
    const matched = realMatchFor(subtype, category, (candidate) => candidate.match.resembles !== null)
    if (matched) return matched
  }
  throw new Error(`no ${category} match resembles a Harder colour`)
}

describe('result card hierarchy', () => {
  it('orders swatch/HEX → verdict → category → why → action → nearest → placement → pairings → details → caveat', () => {
    const matched = real('warm-autumn', 'away-from-face')
    renderCard(selected(matched))
    expect(text('.photo-summary')).toBe(`${en.photoChecker.sampleLabel}${matched.sample.hex}△${en.colorResult.verdicts.weak}${en.photoChecker.categories['away-from-face']}`)
    const order = ['.check-hex', '.check-verdict', '.check-category', '.check-reason', '.check-action', '.check-reference', '.check-placement', '.check-pairing', '.check-details', '.check-caveat']
    order.slice(1).forEach((selector, index) => expect(before(order[index], selector), `${order[index]} before ${selector}`).toBe(true))
  })

  it('the verdict is the headline; the category is a smaller secondary label', () => {
    const matched = real('cool-summer', 'near-face')
    renderCard(selected(matched))
    expect(verdictText()).toBe(en.colorResult.verdicts.strong)
    expect($('.check-category')).toHaveClass('rating')
    expect($('.check-verdict')!.contains($('.check-category'))).toBe(false)
    expect($('.check-hex')!.tagName).toBe('STRONG')
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([en.colorResult.placementHeading.positive, en.colorResult.pairing.around.heading])
  })

  it('always shows the photo caveat', () => {
    for (const category of CATEGORIES) {
      renderCard(selected(real('soft-autumn', category)))
      expect(text('.check-caveat')).toBe('Based on how the color appears in this photo.')
      cleanup()
      renderCard(selected(real('soft-autumn', category)), { language: 'th' })
      expect(text('.check-caveat')).toBe('คำแนะนำนี้อ้างอิงจากสีที่เห็นในภาพนี้')
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
    const rows = [...document.querySelectorAll('.check-place')]
    expect(rows).toHaveLength(placement.rows.length)
    placement.rows.forEach((row, index) => {
      expect(rows[index]).toHaveClass(`check-place-${row.tier}`)
      expect(rows[index].querySelector('strong')!.textContent).toBe(en.colorResult.tiers[row.tier])
      expect(rows[index].querySelector('span')!.textContent).toBe(row.areas.map((area) => en.colorResult.areas[area]).join(' · '))
      expect(rows[index].querySelector('small')!.textContent).toBe(row.examples.map((example) => en.styleExamples.garments[example]).join(' · '))
    })
  })

  // Slice 5c replaced the 5b "never sound negative" rule: the verdict says clearly when a colour
  // is not ideal or not recommended, and placement becomes "how can I still use it?".
  it('Not ideal near your face: says so first, then easiest below the face and palette colours to move closer', () => {
    renderCard(selected(real('warm-autumn', 'away-from-face')))
    expect(verdictText()).toBe('Not ideal near your face')
    expect(text('.check-placement h2')).toBe('If you still want to wear it')
    expect(text('.check-place-easiest')).toContain('Below the face')
    expect(text('.check-place-care')).toContain('Less ideal')
    expect(text('.check-place-care')).toContain('Near your face')
    expect(text('.check-pairing h2')).toBe('If you like it, keep one of these near your face')
    expect(before('.check-verdict', '.check-placement')).toBe(true)
  })

  it('Outside your palette: a clear "not recommended", then how to still use it', () => {
    renderCard(selected(real('clear-spring', 'outside')))
    expect(verdictText()).toBe('This color is not recommended for your Personal Color')
    expect(text('.check-action')).toMatch(/^If you still love it, use it away from your face: /)
    expect(text('.check-place-easiest')).toContain('Accessories and small accents')
    expect(text('.check-pairing h2')).toBe('If you like it, keep one of these near your face')
  })

  it('negative verdicts stay clear but never harsh', () => {
    for (const category of CATEGORIES) {
      for (const language of ['en', 'th'] as const) {
        renderCard(selected(real('soft-summer', category)), { language })
        expect(document.body.textContent).not.toMatch(/never wear|don't wear|looks bad|bad on you|wrong colou?r|terrible|ugly|ห้ามใส่|ไม่สวย|สีผิด/i)
        cleanup()
      }
    }
  })

  it('Women and Men see the same guidance with different example pieces', () => {
    const matched = real('deep-autumn', 'neutral-base')
    renderCard(selected(matched), { presentation: 'women' })
    const women = { tiers: text('.check-placement ul').replace(/·/g, ''), examples: [...document.querySelectorAll('.check-place small')].map((node) => node.textContent) }
    const womenAreas = [...document.querySelectorAll('.check-place span')].map((node) => node.textContent)
    cleanup()
    renderCard(selected(matched), { presentation: 'men' })
    const menAreas = [...document.querySelectorAll('.check-place span')].map((node) => node.textContent)
    const menExamples = [...document.querySelectorAll('.check-place small')].map((node) => node.textContent)
    expect(menAreas).toEqual(womenAreas)
    expect(menExamples).not.toEqual(women.examples)
    expect(text('.check-category')).toBe(en.photoChecker.categories['neutral-base'])
  })

  it('Men never see dress or skirt examples in any category', () => {
    for (const category of CATEGORIES) {
      renderCard(selected(real('cool-winter', category)), { presentation: 'men' })
      expect(text('.check-placement')).not.toMatch(/Dress|Skirt|Blouse/)
      cleanup()
    }
  })
})

describe('nearest colour, resemblance, direction and descriptors', () => {
  it('names the nearest palette colour with the canonical display name, group and swatch, never its id', () => {
    const matched = real('soft-summer', 'near-face')
    const { color, group } = matched.match.nearest
    for (const language of ['en', 'th'] as const) {
      renderCard(selected(matched), { language })
      expect(chipNames('.check-reference')).toEqual([colorDisplayName(language, color)])
      expect(text('.check-reference')).toContain(locales[language].colorResult.reference.similar)
      expect(text('.check-reference')).toContain(locales[language].colorResult.groups[group])
      expect(text('.check-reference')).not.toContain(locales[language].colorResult.reference.compare)
      expect($('.check-reference .color-chip i')!.style.background).not.toBe('')
      expect(document.body.textContent).not.toContain(color.id)
      cleanup()
    }
  })

  it('says the photo colour is "also close to" a Harder colour, never that it is one', () => {
    const matched = realWithResemblance('related')
    const harder = matched.match.resembles!.color
    renderCard(selected(matched))
    const sentence = text('.check-note')
    expect(sentence).toBe(`In this photo it is also close to ${harder.name}, a color that suits you better away from your face.`)
    expect(sentence).not.toMatch(new RegExp(`\\bis ${harder.name}`))
    expect(document.body.textContent).not.toContain(harder.id)
    cleanup()
    renderCard(selected(matched), { language: 'th' })
    expect(text('.check-note')).toContain(colorDisplayName('th', harder))
    expect(text('.check-note')).toContain('ใกล้กับ')
  })

  it('for "not ideal near your face" the reason names the Harder colour instead of a separate line', () => {
    const matched = real('warm-autumn', 'away-from-face')
    const harder = matched.match.resembles!.color
    renderCard(selected(matched))
    expect(text('.check-reason')).toBe(`It is closer to ${harder.name}, a color that suits you better away from your face.`)
    expect($('.check-note')).toBeNull()
    expect(document.body.textContent).not.toMatch(new RegExp(`\\bis ${harder.name}`))
  })

  it('omits the resemblance line when the match has none', () => {
    const matched = real('light-spring', 'near-face', (candidate) => candidate.match.resembles === null)
    renderCard(selected(matched))
    expect($('.check-note')).toBeNull()
  })

  it('translates match.direction without recomputing it, and hides it when empty', () => {
    const withDirection = real('light-spring', 'related', (candidate) => candidate.match.direction.length > 0)
    renderCard(selected(withDirection))
    const nearest = withDirection.match.nearest.color.name
    const parts = withDirection.match.direction.map((direction) => en.photoChecker.directions[direction])
    expect(text('.check-details')).toContain(`A little ${parts.join(' and ')} than ${nearest}.`)
    expect(withDirection.match.direction.length).toBeLessThanOrEqual(2)
    cleanup()
    const close = real('light-spring', 'near-face')
    expect(close.match.direction).toEqual([])
    renderCard(selected(close))
    expect(text('.check-details')).not.toMatch(/A little/)
  })

  it('shows the engine descriptors as supporting text', () => {
    const matched = real('deep-autumn', 'near-face')
    renderCard(selected(matched))
    const { value, clarity } = matched.match.descriptors
    expect(text('.check-details')).toContain(`Color character: ${en.photoChecker.descriptors.value[value]} · ${en.photoChecker.descriptors.clarity[clarity]}`)
  })
})

describe('pairings', () => {
  it('renders match.pairWith exactly, in order, with display names and swatches', () => {
    for (const subtype of subtypeOrder) {
      for (const category of CATEGORIES) {
        const matched = real(subtype, category)
        renderCard(selected(matched), { language: 'th' })
        expect(chipNames('.check-pairs')).toEqual(matched.match.pairWith.map((color) => colorDisplayName('th', color)))
        document.querySelectorAll('.check-pairs .color-chip').forEach((chip, index) => expect(chip.getAttribute('title')).toContain(matched.match.pairWith[index].hex))
        matched.match.pairWith.forEach((color) => expect(document.body.textContent).not.toContain(color.id))
        cleanup()
      }
    }
  })

  it('frames pairings generally for strong categories and as "closer to your face" for weaker ones', () => {
    const framing: Record<PhotoMatchCategory, string> = { 'near-face': 'around', 'neutral-base': 'around', related: 'near-face', 'away-from-face': 'near-face', outside: 'near-face' }
    for (const category of CATEGORIES) {
      renderCard(selected(real('clear-winter', category)))
      const advice = en.colorResult.pairing[framing[category] as 'around' | 'near-face']
      expect(text('.check-pairing h2')).toBe(advice.heading)
      expect(text('.check-pairing p')).toBe(advice.body)
      cleanup()
    }
  })

  it('the card does not compute pairings itself', () => {
    const code = [cardSource, adapterSource, sharedCardSource].join('\n').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    for (const forbidden of ['pairingSuggestions', 'getPalette', 'matchPhotoColor', 'samplePhotoRegion', 'hexToOklab', 'rgbToOklab', 'Distance', 'localStorage', 'fetch', 'XMLHttpRequest', 'console']) {
      expect(code, forbidden).not.toMatch(new RegExp(`\\b${forbidden}`))
    }
    // The adapter passes pairWith through untouched; the shared card only turns it into chips.
    expect(adapterSource).toMatch(/pairWith: match\.pairWith,/)
    expect(sharedCardSource).toMatch(/view\.pairWith\.map/)
  })

  it('palette chip names come from colorDisplayName (TH differs from the English data name)', () => {
    const matched = real('warm-autumn', 'near-face')
    renderCard(selected(matched), { language: 'th' })
    expect(chipNames('.check-reference')[0]).toBe(colorDisplayName('th', matched.match.nearest.color))
    expect(chipNames('.check-reference')[0]).toMatch(/[ก-๙]/)
  })
})

describe('warnings stay advisory', () => {
  it.each(['mixed', 'highlight', 'shadow'] as SampleFlag[])('%s keeps category, placement and pairings', (flag) => {
    const matched = withWarnings(real('soft-autumn', 'related'), [flag])
    renderCard(selected(matched))
    expect(text('.check-category')).toBe(en.photoChecker.categories.related)
    expect(document.querySelectorAll('.check-place').length).toBeGreaterThan(0)
    expect(chipNames('.check-pairs').length).toBe(matched.match.pairWith.length)
    expect(text('.check-warnings')).toBe(en.photoChecker.warnings[flag])
    expect(before('.check-placement', '.check-warnings')).toBe(true)
    // Announced once, with the summary; the visible list is not read a second time.
    expect(text('.photo-summary')).toContain(en.photoChecker.warnings[flag])
    expect($('.check-warnings')).toHaveAttribute('aria-hidden', 'true')
    // The verdict is never replaced by uncertainty.
    expect(verdictText()).toBe(en.colorResult.verdicts.conditional)
    expect(before('.check-verdict', '.check-warnings')).toBe(true)
  })

  it('shows all three together without dropping the guidance', () => {
    renderCard(selected(withWarnings(real('cool-summer', 'outside'), ['mixed', 'highlight', 'shadow'])))
    expect(document.querySelectorAll('.check-warnings li')).toHaveLength(3)
    expect($('.check-placement')).not.toBeNull()
    expect($('.check-pairing')).not.toBeNull()
  })

  it('warning copy says the photo may affect the result and how to double-check', () => {
    expect(en.photoChecker.warnings).toEqual({
      mixed: 'This spot mixes several colors, so this result may be less reliable. Try a more even area.',
      highlight: 'Strong light may make this color look lighter. Try another spot if you want to double-check.',
      shadow: 'Shadow may make this color look darker. Try another spot if you want to double-check.',
    })
    Object.values(th.photoChecker.warnings).forEach((warning) => expect(warning).toMatch(/ลองแตะ/))
  })
})

describe('states without a colour', () => {
  it('shows the instruction, then "press Enter" for a moved marker, with no guidance', () => {
    renderCard(null)
    expect(text('.photo-summary')).toBe(en.photoChecker.instruction)
    expect($('.check-guidance')).toBeNull()
    cleanup()
    renderCard({ point: { x: 3, y: 3 }, inspection: null })
    expect(text('.photo-summary')).toBe(en.photoChecker.pending)
    expect($('.check-guidance')).toBeNull()
  })

  it.each(['transparent', 'insufficient-pixels', 'outside-image'] as const)('unavailable (%s) shows its reason and no manufactured match', (reason) => {
    renderCard({ point: { x: 1, y: 1 }, inspection: { kind: 'unavailable', point: { x: 1, y: 1 }, radius: 3, reason } })
    expect(text('.photo-summary')).toBe(en.photoChecker.unavailable[reason])
    for (const selector of ['.check-guidance', '.check-category', '.check-placement', '.check-pairing', '.check-caveat', '.check-hex']) expect($(selector)).toBeNull()
  })
})

describe('accessibility', () => {
  it('only the short summary is a live region; the guidance is not re-announced as a whole', () => {
    renderCard(selected(real('light-summer', 'related')))
    const live = [...document.querySelectorAll('[role="status"], [aria-live]')]
    expect(live).toEqual([$('.photo-summary')])
    expect($('.check-guidance')!.closest('[role="status"]')).toBeNull()
  })

  it('never relies on colour alone: every swatch has an adjacent name or the HEX', () => {
    renderCard(selected(real('warm-spring', 'away-from-face')))
    document.querySelectorAll('.color-chip').forEach((chip) => expect(chip.textContent!.trim().length).toBeGreaterThan(0))
    expect(text('.check-sample')).toContain(real('warm-spring', 'away-from-face').sample.hex)
    expect(text('.check-reason').length).toBeGreaterThan(0)
    document.querySelectorAll('.check-place').forEach((row) => expect(row.querySelector('strong')!.textContent!.length).toBeGreaterThan(0))
  })

  it('headings name the placement and pairing sections', () => {
    renderCard(selected(real('clear-spring', 'related')))
    expect(screen.getByRole('region', { name: en.colorResult.placementHeading.middle })).toBe($('.check-placement'))
    expect(screen.getByRole('region', { name: en.colorResult.pairing['near-face'].heading })).toBe($('.check-pairing'))
  })
})

describe('localization', () => {
  it('has complete, parallel EN/TH copy for the card', () => {
    for (const locale of [en, th]) {
      const copy = locale.photoChecker
      const shared = locale.colorResult
      const strings = [shared.reference.similar, shared.reference.nearestBest, shared.reference.compare, ...Object.values(shared.placementHeading), copy.descriptorsLabel, copy.caveat, copy.resembles('X'), copy.direction('X', ['a', 'b']),
        ...Object.values(shared.groups), ...Object.values(shared.tiers), ...Object.values(shared.areas), ...Object.values(copy.directions),
        ...Object.values(shared.pairing).flatMap((advice) => [advice.heading, advice.body]),
        ...Object.values(copy.descriptors.value), ...Object.values(copy.descriptors.clarity)]
      strings.forEach((value) => expect(value.trim().length).toBeGreaterThan(0))
      expect(Object.keys(shared.tiers).sort()).toEqual(['best', 'care', 'easiest', 'good'])
      expect(Object.keys(copy.directions).sort()).toEqual(['brighter', 'cooler', 'deeper', 'lighter', 'muted', 'warmer'])
    }
    ;[th.photoChecker.caveat, ...Object.values(th.colorResult.placementHeading), ...Object.values(th.colorResult.tiers), ...Object.values(th.colorResult.areas)].forEach((value) => expect(value).toMatch(/[ก-๙]/))
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
    expect(text('.check-category')).toBe(th.photoChecker.categories['away-from-face'])
    expect(text('.check-placement h2')).toBe(th.colorResult.placementHeading.negative)
    expect(text('.check-pairing h2')).toBe(th.colorResult.pairing['near-face'].heading)
    expect(text('.check-place-easiest small')).toMatch(/[ก-๙]/)
    expect(getPalette('soft-summer').harder.some((color) => color.id === matched.match.resembles?.color.id)).toBe(true)
  })
})

describe('Slice 5c: verdict first', () => {
  const VERDICTS = {
    en: {
      'near-face': 'Yes! Excellent for your Personal Color',
      'neutral-base': 'This color works well for your Personal Color',
      related: 'Wearable, but not one of your strongest colors',
      'away-from-face': 'Not ideal near your face',
      outside: 'This color is not recommended for your Personal Color',
    },
    th: {
      'near-face': 'ใช่เลย! สีนี้เหมาะกับ Personal Color ของคุณมาก',
      'neutral-base': 'สีนี้เข้ากับ Personal Color ของคุณดีเลย',
      related: 'สีนี้ใส่ได้ แต่ยังไม่ใช่สีเด่นของคุณ',
      'away-from-face': 'สีนี้ไม่ค่อยเหมาะเมื่ออยู่ใกล้ใบหน้า',
      outside: 'สีนี้ไม่ใช่สีที่แนะนำสำหรับ Personal Color ของคุณ',
    },
  } satisfies Record<Language, Record<PhotoMatchCategory, string>>

  it.each(CATEGORIES)('%s renders its own verdict in EN and TH', (category) => {
    for (const language of ['en', 'th'] as const) {
      renderCard(selected(real('light-summer', category)), { language })
      expect(verdictText()).toBe(VERDICTS[language][category])
      cleanup()
    }
  })

  it('the five verdicts are all different, including each neighbouring pair', () => {
    for (const language of ['en', 'th'] as const) {
      const verdicts = CATEGORIES.map((category) => VERDICTS[language][category])
      expect(new Set(verdicts).size).toBe(5)
      for (let index = 1; index < verdicts.length; index++) expect(verdicts[index], `${CATEGORIES[index - 1]} vs ${CATEGORIES[index]}`).not.toBe(verdicts[index - 1])
      const marks = CATEGORIES.map((category) => { renderCard(selected(real('light-summer', category)), { language }); const mark = text('.check-verdict-mark'); cleanup(); return mark })
      expect(marks).toEqual(['✨', '✓', '△', '△', '✕'])
    }
  })

  it('reads as positive / middle / negative from the words, not the styling', () => {
    // Positive
    expect(VERDICTS.en['near-face']).toMatch(/Excellent/)
    expect(VERDICTS.th['near-face']).toContain('เหมาะกับ Personal Color ของคุณมาก')
    expect(VERDICTS.en['neutral-base']).toMatch(/works well/)
    expect(VERDICTS.th['neutral-base']).toContain('เข้ากับ Personal Color ของคุณ')
    // Middle: usable, but not among the strongest
    expect(VERDICTS.en.related).toMatch(/^Wearable, but not one of your strongest/)
    expect(VERDICTS.th.related).toMatch(/ใส่ได้ แต่ยังไม่ใช่สีเด่น/)
    // Negative near the face, and negative overall
    expect(VERDICTS.en['away-from-face']).toMatch(/Not ideal near your face/)
    expect(VERDICTS.th['away-from-face']).toMatch(/ไม่ค่อยเหมาะ.*ใกล้ใบหน้า/)
    expect(VERDICTS.en.outside).toMatch(/not recommended/)
    expect(VERDICTS.th.outside).toContain('ไม่ใช่สีที่แนะนำ')
    // Positive wording never appears in a weaker verdict, and negative wording never in a positive one.
    for (const language of ['en', 'th'] as const) {
      for (const category of ['related', 'away-from-face', 'outside'] as const) expect(VERDICTS[language][category]).not.toMatch(/Excellent|works well|เหมาะกับ Personal Color ของคุณมาก|เข้ากับ Personal Color ของคุณดี/)
      for (const category of ['near-face', 'neutral-base'] as const) expect(VERDICTS[language][category]).not.toMatch(/not|ไม่/i)
    }
    expect(VERDICTS.en.related).not.toMatch(/not recommended|not ideal/)
  })

  it('the tone class follows the suitability, and every tone has its own words', () => {
    const tones: Record<PhotoMatchCategory, string> = { 'near-face': 'positive', 'neutral-base': 'positive', related: 'middle', 'away-from-face': 'negative', outside: 'negative' }
    for (const category of CATEGORIES) {
      renderCard(selected(real('deep-winter', category)))
      expect($('.check-result')).toHaveClass(`check-tone-${tones[category]}`)
      expect($('.check-verdict')).toHaveClass(`check-verdict-${getSuitability(category)}`)
      expect(verdictText().length).toBeGreaterThan(10)
      cleanup()
    }
  })

  it.each(subtypeOrder)('%s: real engine matches render the verdict of their own category', (subtype) => {
    for (const category of CATEGORIES) {
      const matched = real(subtype, category)
      expect(matched.match.category).toBe(category)
      renderCard(selected(matched), { language: 'th' })
      expect(verdictText()).toBe(th.colorResult.verdicts[getSuitability(matched.match.category)])
      cleanup()
    }
  })

  it('representative real matches: Best, Neutral, Accent, Harder and outside colours', () => {
    const palette = getPalette('warm-spring')
    const cases: [PhotoMatchCategory, (matched: PhotoPointMatched) => boolean][] = [
      ['near-face', (m) => palette.best.some((color) => color.hex === m.sample.hex)],
      ['neutral-base', (m) => palette.neutrals.some((color) => color.hex === m.sample.hex)],
      ['near-face', (m) => palette.accents.some((color) => color.hex === m.sample.hex)],
      ['away-from-face', (m) => palette.harder.some((color) => color.hex === m.sample.hex)],
      ['related', () => true],
      ['outside', () => true],
    ]
    for (const [category, where] of cases) {
      const matched = realMatchFor('warm-spring', category, where)
      expect(matched, category).not.toBeNull()
      renderCard(selected(matched!))
      expect(verdictText()).toBe(VERDICTS.en[category])
      cleanup()
    }
  })

  it('near-face is a strong recommendation, not generic placement advice', () => {
    const matched = real('warm-autumn', 'near-face')
    const nearest = matched.match.nearest.color
    renderCard(selected(matched))
    expect(verdictText()).toMatch(/Excellent/)
    expect(text('.check-reason')).toBe(`This photo color is very close to ${nearest.name} in your palette, so it works beautifully near your face.`)
    expect(text('.check-reason')).not.toMatch(/exactly|\bis ${nearest.name}/)
    expect(text('.check-action')).toBe('Go ahead and wear it as a top, blouse or scarf.')
    cleanup()
    renderCard(selected(matched), { language: 'th', presentation: 'men' })
    expect(verdictText()).toContain('เหมาะกับ Personal Color ของคุณมาก')
    expect(text('.check-reason')).toContain(colorDisplayName('th', nearest))
    expect(text('.check-action')).toBe('ใส่เป็นเชิ้ต เสื้อยืด หรือโปโลได้เลย')
  })

  it('neutral-base is positive and names the neutral it is close to', () => {
    const matched = real('soft-autumn', 'neutral-base')
    renderCard(selected(matched), { language: 'th' })
    expect(text('.check-reason')).toBe(`ใกล้เคียงกับสี “${colorDisplayName('th', matched.match.nearest.color)}” ซึ่งเป็นสีกลางในพาเลตต์ของคุณ ใช้ง่ายและใส่ได้หลายแบบ`)
    expect(text('.check-action')).toMatch(/^ใช้เป็นชิ้นหลักของชุดได้สบาย เช่น /)
    expect(text('.check-reference')).toContain(th.colorResult.reference.similar)
    expect(text('.check-reference')).toContain(th.colorResult.groups.neutrals)
  })

  it('related reads as middle: usable, not strongest, with how to improve it', () => {
    const matched = real('cool-summer', 'related')
    renderCard(selected(matched))
    expect(verdictText()).toBe('Wearable, but not one of your strongest colors')
    expect(text('.check-reason')).toBe('Its tone sits near your palette, but other palette colors flatter you more.')
    expect(text('.check-action')).toContain(`Keep ${matched.match.pairWith[0].name} near your face.`)
    expect(text('.check-placement h2')).toBe('How to make it work')
    expect(text('.check-category')).not.toBe(verdictText())
  })

  it('weaker results mark the similar palette colour as a comparison, never as a recommendation', () => {
    for (const category of ['related', 'away-from-face', 'outside'] as const) {
      for (const language of ['en', 'th'] as const) {
        const matched = real('light-spring', category)
        renderCard(selected(matched), { language })
        const copy = locales[language].colorResult
        expect(text('.check-reference')).toContain(copy.reference.similar)
        expect(text('.check-reference')).toContain(copy.reference.compare)
        Object.values(copy.groups).forEach((group) => expect(text('.check-reference')).not.toContain(group))
        cleanup()
      }
    }
  })

  it('every result has an action sentence using the presentation\'s example pieces and, when weaker, a palette colour for the face', () => {
    for (const category of CATEGORIES) {
      for (const presentation of ['women', 'men'] as const) {
        for (const language of ['en', 'th'] as const) {
          const matched = real('clear-winter', category)
          renderCard(selected(matched), { language, presentation })
          const action = text('.check-action')
          const locale = locales[language]
          const firstPiece = locale.styleExamples.garments[getColorPlacement(matched.match, presentation).rows[0].examples[0]]
          expect(action.toLowerCase()).toContain(firstPiece.toLowerCase())
          if (getSuitability(category) !== 'strong' && getSuitability(category) !== 'good') expect(action).toContain(colorDisplayName(language, matched.match.pairWith[0]))
          if (presentation === 'men') expect(action).not.toMatch(/dress|skirt|blouse|เดรส|กระโปรง|เบลาส์/i)
          cleanup()
        }
      }
    }
  })

  it('away-from-face rescue moves the colour below the face and a palette colour to the face', () => {
    const matched = real('deep-autumn', 'away-from-face')
    renderCard(selected(matched), { language: 'th', presentation: 'men' })
    expect(text('.check-action')).toBe(`ถ้าชอบสีนี้ ยังใช้ได้ ลองย้ายไปไว้กับกางเกงขายาว เข็มขัด หรือรองเท้าแทน แล้วใช้สี “${colorDisplayName('th', matched.match.pairWith[0])}” ใกล้ใบหน้า จะเข้ากับคุณมากกว่า`)
    expect(text('.check-pairing h2')).toBe('ถ้าชอบสีนี้ ลองให้สีเหล่านี้อยู่ใกล้ใบหน้า')
  })

  it('outside rescue in Thai keeps the colour away from the face and balances it', () => {
    const matched = real('deep-autumn', 'outside')
    renderCard(selected(matched), { language: 'th' })
    expect(verdictText()).toContain('ไม่ใช่สีที่แนะนำ')
    expect(text('.check-reason')).toBe('สีนี้อยู่นอกกลุ่มสีหลักที่แนะนำสำหรับคุณ')
    expect(text('.check-action')).toMatch(/^ถ้าชอบสีนี้ ไม่ต้องเลิกใช้ ลองใช้กับชิ้นที่อยู่ห่างจากใบหน้า เช่น กระเป๋า รองเท้า หรือเครื่องประดับ ถ้าใส่เป็นเสื้อ ลองมีสี “/)
  })

  it('uses one small cue per result, hidden from screen readers, with the verdict in text', () => {
    for (const category of CATEGORIES) {
      renderCard(selected(real('warm-spring', category)))
      expect(document.querySelectorAll('.check-verdict-mark')).toHaveLength(1)
      expect($('.check-verdict-mark')).toHaveAttribute('aria-hidden', 'true')
      expect(document.body.textContent!.match(/\p{Extended_Pictographic}/gu) ?? []).toHaveLength(category === 'near-face' ? 1 : 0)
      expect(text('.photo-summary')).toContain(verdictText())
      cleanup()
    }
  })

  it('the verdict is announced with the summary, the reason is not', () => {
    renderCard(selected(real('light-summer', 'outside')))
    expect($('.check-verdict')!.closest('[role="status"]')).toBe($('.photo-summary'))
    expect($('.check-reason')!.closest('[role="status"]')).toBeNull()
  })

  it('the card only relabels the engine category; the verdict layer calculates nothing', () => {
    const code = [cardSource, adapterSource, sharedCardSource].join('\n').replace(/\/\/.*$/gm, '')
    expect(adapterSource).toMatch(/const suitability = getSuitability\(match\.category\)/)
    expect(code).not.toMatch(/\.distance|PHOTO_CLOSE|PHOTO_RELATED|\.score\b/)
  })
})
