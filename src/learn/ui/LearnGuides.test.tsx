import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import appSource from '../../App.tsx?raw'
import { getPalette } from '../../domain/personalColor/palettes'
import { seasonDefinitions, subtypeOrder } from '../../domain/personalColor/seasons'
import { analyzeQuiz } from '../../domain/personalColor/scoring'
import type { PaletteColor, PersonalColorResult, Subtype } from '../../domain/personalColor/types'
import { colorDisplayName, getCopy, metalDisplayNote } from '../../i18n'
import type { Language } from '../../i18n'
import { STORAGE_KEY } from '../../services/persistence'
import { generalOutfitExample, getLearnCopy, learnTopicOrder, learnTopics, lightingExample, paletteColorById, typeOrientedNote } from '..'
import type { LearnTopicId, LearnVisualKind } from '..'
import type { LearnEntry } from './LearnView'
import { LearnView } from './LearnView'

// V1.4 Slice 4: the practical guides (palette placement, More Considered placement, Color Checker
// lighting, lucky colour flow), the Palette and Checker contextual entries, direct topic entry, and the
// metal-note wording on browsed types. Every expectation is computed from canonical data and copy.

const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const resultFor = (subtype: Subtype): PersonalColorResult => ({ ...analyzeQuiz(answers), subtype, season: seasonDefinitions[subtype].season })
const storeProfile = (subtype: Subtype) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, answers, result: { ...analyzeQuiz(answers), subtype }, quizStep: 10 }))
const languages = ['en', 'th'] as const
const all12 = subtypeOrder.flatMap((subtype) => languages.map((language) => [subtype, language] as const))

function renderLearn({ language = 'en' as Language, result = null as PersonalColorResult | null, entry = undefined as LearnEntry | undefined } = {}) {
  const element = (lang: Language, next: PersonalColorResult | null) => <LearnView copy={getCopy(lang)} language={lang} result={next} entry={entry} onQuiz={vi.fn()} onPalette={vi.fn()} />
  const view = render(element(language, result))
  let state = { language, result }
  const rerender = (next: { language?: Language; result?: PersonalColorResult | null }) => {
    state = { language: next.language ?? state.language, result: next.result === undefined ? state.result : next.result }
    view.rerender(element(state.language, state.result))
  }
  return { ...view, rerender }
}
const openTopic = (topic: LearnTopicId, options: { language?: Language; result?: PersonalColorResult | null } = {}) => renderLearn({ ...options, entry: { kind: 'topic', topic } })

const page = () => document.querySelector<HTMLElement>('.learn-page')!
const figure = (kind: LearnVisualKind) => document.querySelector<HTMLElement>(`figure[data-learn-visual="${kind}"]`)!
const cssColor = (value: string) => { const probe = document.createElement('i'); probe.style.color = value; return probe.style.color }
const fills = (root: ParentNode, selector: string) => [...root.querySelectorAll<SVGElement>(selector)].map((piece) => cssColor(piece.style.fill))
const roles = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('.learn-roles li')].map((item) => ({
  color: cssColor(item.querySelector<HTMLElement>('i')!.style.background),
  role: item.querySelector('span')!.textContent,
  name: item.querySelector('strong')!.textContent,
}))
const role = (color: Pick<PaletteColor, 'hex'> & Parameters<typeof colorDisplayName>[1], label: string, language: Language) => ({ color: cssColor(color.hex), role: label, name: colorDisplayName(language, color) })

// Text and every attribute a reader or assistive technology can meet (not styles, classes, data-* or SVG geometry).
function exposed(root: HTMLElement) {
  const attributes = [...root.querySelectorAll('*')].flatMap((element) => [...element.attributes].filter((attribute) => !['style', 'class', 'd', 'viewBox', 'x', 'y', 'width', 'height', 'rx', 'cx', 'cy', 'r'].includes(attribute.name) && !attribute.name.startsWith('data-')).map((attribute) => attribute.value))
  return [root.textContent ?? '', ...attributes].join(' ')
}
function headingLevels(root: HTMLElement) {
  const levels = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) => Number(heading.tagName[1]))
  expect(levels.filter((level) => level === 1)).toHaveLength(1)
  expect(levels[0]).toBe(1)
  for (let index = 1; index < levels.length; index += 1) expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1)
}
function noInternals(root: HTMLElement) {
  const text = exposed(root)
  expect(text).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  expect(text).not.toMatch(/-(best|neutral|accent|harder|metal)-\d|\bharder\b/)
  for (const id of [...subtypeOrder, ...learnTopicOrder]) expect(text).not.toContain(id)
}
// Drawings are decoration: every SVG is hidden, and the text beside it carries the lesson.
function decorative(root: HTMLElement) {
  for (const svg of root.querySelectorAll('svg')) expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
  for (const swatch of root.querySelectorAll('i')) expect(swatch.closest('[aria-hidden="true"]')).not.toBeNull()
}

afterEach(cleanup)
beforeEach(() => localStorage.clear())

describe('A. Topic visuals come from registry metadata', () => {
  it.each(learnTopicOrder.flatMap((topic) => languages.map((language) => [topic, language] as const)))('%s (%s) draws its registry kind', (topic, language) => {
    openTopic(topic, { language, result: resultFor('soft-summer') })
    const drawn = [...page().querySelectorAll<HTMLElement>('.learn-article > [data-learn-visual], .learn-article > figure > [data-learn-visual]')].map((node) => node.dataset.learnVisual)
    const kind = learnTopics[topic].visual
    const withDrawing: LearnVisualKind[] = ['dimension-scales', 'subtype-grid', 'garment-placement', 'placement-shift', 'lighting-comparison', 'lucky-flow']
    expect(drawn).toEqual(kind && withDrawing.includes(kind) ? [kind] : [])
  })

  it('every practical topic has its own visual kind', () => {
    const practical = (['wear.palette', 'wear.harder', 'app.color-checker', 'app.lucky'] as const).map((topic) => learnTopics[topic].visual)
    expect(practical).toEqual(['garment-placement', 'placement-shift', 'lighting-comparison', 'lucky-flow'])
  })

  it('changing a topic’s registry kind changes its drawing: nothing is chosen by topic id', () => {
    const meta = learnTopics['app.lucky'] as { visual: LearnVisualKind | null }
    const original = meta.visual
    meta.visual = 'lighting-comparison'
    try {
      openTopic('app.lucky')
      expect(figure('lighting-comparison')).not.toBeNull()
      expect(document.querySelector('[data-learn-visual="lucky-flow"]')).toBeNull()
    } finally { meta.visual = original }
  })
})

describe('B. Using your palette: placement with canonical colours', () => {
  it.each(all12)('profile %s (%s): the reader’s own palette in each role', (subtype, language) => {
    openTopic('wear.palette', { language, result: resultFor(subtype) })
    const learn = getLearnCopy(language)
    const palette = getPalette(subtype)
    const root = figure('garment-placement')
    expect(root.querySelector('.learn-illus-tag')).toHaveTextContent(`${learn.visuals.yourColors} · ${getCopy(language).subtypes[subtype].name}`)
    expect(roles(root)).toEqual([
      role(palette.best[0], learn.typeDetail.formula.nearFace, language),
      role(palette.metals[0], learn.visuals.placement.metal, language),
      role(palette.neutrals[0], learn.typeDetail.formula.base, language),
      role(palette.accents[0], learn.typeDetail.formula.accent, language),
      role(palette.harder[0], learn.visuals.placement.moreConsidered, language),
    ])
    // Near the face: the Best top and the metal; below it: the Neutral base and the Accent bag.
    const near = root.querySelector<HTMLElement>('[data-zone="near-face"]')!
    const below = root.querySelector<HTMLElement>('[data-zone="below-face"]')!
    expect(near.querySelector('.learn-zone-label')).toHaveTextContent(learn.visuals.placement.nearFace)
    expect(below.querySelector('.learn-zone-label')).toHaveTextContent(learn.visuals.placement.belowFace)
    expect(fills(near, '.learn-flatlay-piece')).toEqual([cssColor(palette.best[0].hex)])
    expect(fills(near, '.learn-flatlay-pendant')).toEqual([cssColor(palette.metals[0].hex)])
    expect(fills(below, '.learn-flatlay-piece')).toEqual([palette.neutrals[0], palette.accents[0]].map((color) => cssColor(color.hex)))
    for (const item of roles(root)) expect(item.name).toBeTruthy()
    noInternals(root)
    decorative(root)
  })

  it.each(languages)('no profile (%s): the Slice 1 example, named as an example type, never as the reader’s', (language) => {
    openTopic('wear.palette', { language })
    const learn = getLearnCopy(language)
    const root = figure('garment-placement')
    const example = (id: string) => paletteColorById(id)!
    const exampleType = subtypeOrder.find((subtype) => generalOutfitExample.nearFace.startsWith(`${subtype}-`))!
    expect(root.querySelector('.learn-illus-tag')).toHaveTextContent(`${learn.visuals.exampleColors} · ${getCopy(language).subtypes[exampleType].name}`)
    expect(root).not.toHaveTextContent(learn.visuals.yourColors)
    expect(root).not.toHaveTextContent(learn.typeDetail.yourType)
    expect(roles(root)).toEqual([
      role(example(generalOutfitExample.nearFace), learn.typeDetail.formula.nearFace, language),
      role(getPalette(exampleType).metals[0], learn.visuals.placement.metal, language),
      role(example(generalOutfitExample.base), learn.typeDetail.formula.base, language),
      role(example(generalOutfitExample.accent), learn.typeDetail.formula.accent, language),
      role(example(generalOutfitExample.moreConsidered), learn.visuals.placement.moreConsidered, language),
    ])
    expect(page().dataset.learnMode).toBe('general')
  })
})

describe('C. More Considered: the same listed colour, placed differently', () => {
  it.each(all12)('profile %s (%s): one listed More Considered colour, with Best and Neutral support', (subtype, language) => {
    openTopic('wear.harder', { language, result: resultFor(subtype) })
    const copy = getCopy(language)
    const learn = getLearnCopy(language)
    const palette = getPalette(subtype)
    const root = figure('placement-shift')
    const [considered, best, neutral] = [palette.harder[0], palette.best[0], palette.neutrals[0]]
    // The colour really is listed as More Considered for this type, and the support is Best / Neutral.
    expect(palette.harder).toContain(considered)
    expect([...palette.best, ...palette.neutrals, ...palette.accents]).not.toContain(considered)
    expect(fills(root.querySelector('[data-outfit="near-face"]')!, '.learn-flatlay-piece')).toEqual([considered, neutral].map((color) => cssColor(color.hex)))
    expect(fills(root.querySelector('[data-outfit="moved"]')!, '.learn-flatlay-piece')).toEqual([best, neutral, considered].map((color) => cssColor(color.hex)))
    expect(roles(root)).toEqual([
      role(considered, copy.palette.sections.harder.title, language),
      role(best, copy.palette.sections.best.title, language),
      role(neutral, copy.palette.sections.neutrals.title, language),
    ])
    // The words: two placements of the same colour; nothing is re-graded or called wrong.
    expect(root.querySelector('[data-outfit="near-face"] p')).toHaveTextContent(learn.visuals.shift.nearFace)
    expect(root.querySelector('[data-outfit="moved"] p')).toHaveTextContent(learn.visuals.shift.moved)
    expect(root.querySelector('figcaption')).toHaveTextContent(learn.visuals.shift.same)
    noInternals(root)
    decorative(root)
  })

  it.each(languages)('no profile (%s): the Slice 1 More Considered example', (language) => {
    openTopic('wear.harder', { language })
    const root = figure('placement-shift')
    const considered = paletteColorById(generalOutfitExample.moreConsidered)!
    expect(fills(root.querySelector('[data-outfit="near-face"]')!, '.learn-flatlay-piece')[0]).toBe(cssColor(considered.hex))
    expect(root.querySelector('.learn-illus-tag')).toHaveTextContent(getLearnCopy(language).visuals.exampleColors)
  })

  it('the visual never frames a colour as forbidden, wrong or re-graded', () => {
    for (const language of languages) {
      openTopic('wear.harder', { language, result: resultFor('soft-summer') })
      const text = figure('placement-shift').textContent!
      expect(text).not.toMatch(/avoid|forbidden|off-limits|wrong|bad|never|now a best|becomes/i)
      expect(text).not.toMatch(/ห้าม|เลี่ยง|ผิด|ไม่ควร|กลายเป็น/)
      expect(figure('placement-shift').querySelector('[aria-label], [title]')).toBeNull()
      cleanup()
    }
  })
})

describe('D. Color Checker: modes and lighting, honestly', () => {
  it.each(languages)('%s: Manual vs Photo, then one garment as four photos, with no true-colour claim', (language) => {
    openTopic('app.color-checker', { language, result: resultFor('deep-winter') })
    const copy = getCopy(language)
    const learn = getLearnCopy(language)
    const root = figure('lighting-comparison')
    expect(root.querySelector('[data-mode="manual"] p')).toHaveTextContent(`${copy.photoChecker.modes.manual} ${learn.visuals.lighting.manual}`)
    expect(root.querySelector('[data-mode="photo"] p')).toHaveTextContent(`${copy.photoChecker.modes.photo} ${learn.visuals.lighting.photo}`)
    const tiles = [...root.querySelectorAll<HTMLElement>('.learn-casts li')]
    expect(tiles.map((tile) => tile.dataset.cast)).toEqual(['warm', 'cool', 'shade', 'context'])
    expect(tiles.map((tile) => tile.textContent)).toEqual([learn.visuals.lighting.warm, learn.visuals.lighting.cool, learn.visuals.lighting.shade, learn.visuals.lighting.context])
    // The same canonical garment in every tile; the shift is an overlay on the photo, not a new colour.
    const garment = cssColor(paletteColorById(lightingExample)!.hex)
    for (const tile of tiles) expect(fills(tile, '.learn-flatlay-piece')).toEqual([garment])
    // Every tile is a shifted photo: none presents the garment as its "real" colour.
    expect(tiles.filter((tile) => tile.querySelector('.learn-cast'))).toHaveLength(4)
    expect(root.querySelector('.learn-illus-tag')).toHaveTextContent(`${learn.visuals.illustration} · ${learn.visuals.lighting.garment}`)
    expect(root.querySelector('figcaption')).toHaveTextContent(learn.visuals.lighting.note)
    // The Slice 1 honesty contract still holds on the page, next to the visual.
    expect(page()).toHaveTextContent(copy.photoChecker.lightingNote)
    noInternals(root)
    decorative(root)
  })

  it('claims no true colour, correction, calibration, measurement or AI', () => {
    const text = { en: Object.values(getLearnCopy('en').visuals.lighting).join(' '), th: Object.values(getLearnCopy('th').visuals.lighting).join(' ') }
    expect(text.en).not.toMatch(/\b(recover\w*|restor\w*|correct\w*|calibrat\w*|measur\w*|accura\w*|detect\w*|AI|artificial|true colou?r|real colou?r|actual colou?r)\b/i)
    expect(text.th).not.toMatch(/AI|แก้สี|ปรับแก้|สอบเทียบ|ตรวจจับ|วัดสี|แม่นยำ|สีจริง/)
    expect(getLearnCopy('en').visuals.lighting.note).toMatch(/only the photo/)
  })
})

describe('E. Lucky colors: family from tradition, shade and placement from Personal Color', () => {
  it.each(languages)('%s: three steps, in order, as a concept', (language) => {
    openTopic('app.lucky', { language, result: resultFor('warm-autumn') })
    const lucky = getLearnCopy(language).visuals.lucky
    const root = figure('lucky-flow')
    const steps = [...root.querySelectorAll<HTMLElement>('.learn-flow > li')]
    expect(steps.map((step) => step.dataset.step)).toEqual(['family', 'shade', 'placement'])
    expect(steps.map((step) => step.querySelector('p')!.textContent)).toEqual([`${lucky.family} ${lucky.familyBody}`, `${lucky.shade} ${lucky.shadeBody}`, `${lucky.place} ${lucky.placeBody}`])
    expect(root.querySelector('figcaption')).toHaveTextContent(lucky.note)
    expect(root.querySelector('.learn-illus-tag')).toHaveTextContent(getLearnCopy(language).visuals.illustration)
    // No palette colour, date, weekday or goal: an illustration, not today's recommendation.
    for (const element of root.querySelectorAll<HTMLElement | SVGElement>('*')) expect(element.getAttribute('style') ?? '').toBe('')
    expect(root.textContent).not.toMatch(/\d|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today’s lucky color is|วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัส|วันศุกร์|วันเสาร์|วันอาทิตย์/i)
    decorative(root)
  })

  it('the tradition step names the family only; the shade and placement steps name Personal Color', () => {
    const en = getLearnCopy('en').visuals.lucky
    const th = getLearnCopy('th').visuals.lucky
    expect(en.familyBody).toMatch(/tradition/i)
    expect(`${en.family} ${en.familyBody}`).not.toMatch(/shade|where|wear|personal color/i)
    expect(`${th.family} ${th.familyBody}`).not.toMatch(/เฉด|ตำแหน่ง|ใส่|Personal Color/)
    expect(en.shadeBody).toMatch(/Personal Color/)
    expect(en.placeBody).toMatch(/Personal Color/)
    expect(en.shadeBody).not.toMatch(/tradition/i)
    expect(th.shadeBody).toMatch(/Personal Color/)
    expect(th.placeBody).toMatch(/Personal Color/)
    expect(th.shadeBody).not.toMatch(/ความเชื่อ/)
    // Two goals stay in text, as the app's own behaviour: the visual never mentions combining.
    for (const text of [...Object.values(en), ...Object.values(th)]) expect(text).not.toMatch(/combin|two goals|รวม|2 เรื่อง/i)
  })
})

describe('F. Metal notes on browsed types', () => {
  const metalTexts = () => [...document.querySelectorAll<HTMLElement>('[data-learn-group="metals"] li span')].map((item) => item.textContent!)
  const speaksToReader = { en: /\byour?\b/i, th: /คุณ/ }
  const reworded: Record<Language, Subtype[]> = { en: [], th: [] }

  it.each(all12)('%s (%s): own type keeps its note; a browsed type is worded about the type', (subtype, language) => {
    const palette = getPalette(subtype)
    const canonical = palette.metals.map((metal) => metalDisplayNote(language, metal))
    const expected = (notes: string[]) => palette.metals.map((metal, index) => `${colorDisplayName(language, metal)} ${notes[index]}`)
    // A. The reader's own type: the canonical note, word for word.
    renderLearn({ language, result: resultFor(subtype), entry: { kind: 'type', subtype } })
    expect(metalTexts()).toEqual(expected(canonical))
    cleanup()
    // B. Browsed with another type as the reader's result, and C. browsed without a result.
    const other = subtypeOrder.find((candidate) => candidate !== subtype)!
    for (const result of [resultFor(other), null]) {
      renderLearn({ language, result, entry: { kind: 'type', subtype } })
      const neutral = canonical.map((note) => typeOrientedNote(note, language))
      expect(metalTexts()).toEqual(expected(neutral))
      for (const note of neutral) expect(note).not.toMatch(speaksToReader[language])
      cleanup()
    }
  })

  it('exactly the three English notes that say "your" are re-worded; Thai needs none; canonical data is untouched', () => {
    for (const language of languages) {
      reworded[language] = subtypeOrder.filter((subtype) => getPalette(subtype).metals.some((metal) => typeOrientedNote(metalDisplayNote(language, metal), language) !== metalDisplayNote(language, metal)))
    }
    expect(reworded.en).toEqual(['warm-spring', 'soft-summer', 'clear-winter'])
    expect(reworded.th).toEqual([])
    const notes = subtypeOrder.flatMap((subtype) => getPalette(subtype).metals)
    expect(notes).toHaveLength(24)
    expect(notes.filter((metal) => typeOrientedNote(metal.note, 'en') !== metal.note)).toHaveLength(3)
    expect(getPalette('warm-spring').metals[0].note).toBe('Rich gold echoes your natural warmth')
    expect(typeOrientedNote(getPalette('warm-spring').metals[0].note, 'en')).toBe('Rich gold echoes this type’s natural warmth')
    expect(typeOrientedNote(getPalette('soft-summer').metals[0].note, 'en')).toBe('Soft sheen suits this type’s blended quality')
    expect(typeOrientedNote(getPalette('clear-winter').metals[0].note, 'en')).toBe('High shine mirrors this type’s clarity')
  })
})

describe('G. Contextual entries: Palette and Checker', () => {
  it('Palette › More Considered → the More Considered topic, focused at its title; Back → Learn home', async () => {
    const user = userEvent.setup()
    storeProfile('soft-summer')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Palette' }))
    const links = await screen.findAllByRole('button', { name: /How to wear More Considered colors/ })
    expect(links).toHaveLength(1)
    // It sits in the More Considered section, after the tips.
    const section = links[0].closest('.palette-section')!
    expect(within(section as HTMLElement).getByRole('heading', { level: 2 })).toHaveTextContent('More Considered')
    await user.click(links[0])
    expect(page()).toHaveAttribute('data-learn-page', 'topic')
    expect(document.querySelector('[data-learn-topic]')).toHaveAttribute('data-learn-topic', 'wear.harder')
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getLearnCopy('en').topics['wear.harder'].title)
    // The reader's own palette, straight away.
    expect(fills(figure('placement-shift').querySelector('[data-outfit="near-face"]')!, '.learn-flatlay-piece')[0]).toBe(cssColor(getPalette('soft-summer').harder[0].hex))
    await user.click(screen.getByRole('button', { name: 'Back to Color Guide' }))
    expect(page()).toHaveAttribute('data-learn-page', 'home')
    expect(screen.getByRole('heading', { level: 1, name: 'Color Guide' })).toHaveFocus()
  })

  it('Checker › Photo → the Color Checker topic; the link is only in photo mode', async () => {
    const user = userEvent.setup()
    storeProfile('deep-autumn')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Color Checker' }))
    expect(screen.queryByRole('button', { name: /Why can photo colors shift/ })).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Photo' }))
    const link = screen.getByRole('button', { name: /Why can photo colors shift/ })
    expect(link.closest('#checker-tabpanel-photo')).not.toBeNull()
    await user.click(link)
    expect(document.querySelector('[data-learn-topic]')).toHaveAttribute('data-learn-topic', 'app.color-checker')
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(figure('lighting-comparison')).not.toBeNull()
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Guide' })).toHaveAttribute('aria-current', 'page')
  })

  it('both links are Thai in Thai', async () => {
    const user = userEvent.setup()
    storeProfile('light-spring')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    await user.click(screen.getByRole('button', { name: getCopy('th').nav.palette }))
    await user.click(await screen.findByRole('button', { name: new RegExp(getCopy('th').palette.learnCta) }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getLearnCopy('th').topics['wear.harder'].title)
    await user.click(screen.getByRole('button', { name: getCopy('th').nav.checker }))
    await user.click(screen.getByRole('tab', { name: getCopy('th').photoChecker.modes.photo }))
    await user.click(screen.getByRole('button', { name: new RegExp(getCopy('th').checker.photoLearnCta.replace('?', '\\?')) }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getLearnCopy('th').topics['app.color-checker'].title)
  })

  it('exactly three contextual Learn entries exist: Result → type, Palette → More Considered, Checker → Color Checker', () => {
    const entries = [...appSource.matchAll(/openLearn\((\{[^)]*\})?\)/g)].map((match) => match[1] ?? 'home')
    expect(entries.filter((entry) => entry !== 'home')).toEqual([
      "{ kind: 'type', subtype: result.subtype }",
      "{ kind: 'topic', topic: 'wear.harder' }",
      "{ kind: 'topic', topic: 'app.color-checker' }",
    ])
  })
})

describe('H. Direct topic entry', () => {
  it.each(learnTopicOrder)('%s opens at its own title, focused', (topic) => {
    openTopic(topic, { result: resultFor('cool-winter') })
    expect(document.querySelector('[data-learn-topic]')).toHaveAttribute('data-learn-topic', topic)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getLearnCopy('en').topics[topic].title)
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Back to Color Guide' })).toBeInTheDocument()
  })

  it.each(['wear.everyday-neutrals', 'wear.same-name', 'bogus', '', '__proto__', 'constructor'])('an unknown topic (%j) opens the Learn home, focused on its title', (topic) => {
    openTopic(topic as LearnTopicId)
    expect(page()).toHaveAttribute('data-learn-page', 'home')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getLearnCopy('en').home.title)
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })
})

describe('I. Language and profile changes keep the topic and refresh its visual', () => {
  it('switching language keeps each practical topic open, in the new language', () => {
    for (const topic of ['wear.palette', 'wear.harder', 'app.color-checker', 'app.lucky'] as const) {
      const { rerender } = openTopic(topic, { result: resultFor('soft-summer') })
      rerender({ language: 'th' })
      expect(document.querySelector('[data-learn-topic]')).toHaveAttribute('data-learn-topic', topic)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getLearnCopy('th').topics[topic].title)
      expect(figure(learnTopics[topic].visual!)).not.toBeNull()
      cleanup()
    }
  })

  it('a profile appearing, changing or disappearing updates the colours at once, with no stale palette', () => {
    const { rerender } = openTopic('wear.harder')
    const nearFace = () => fills(figure('placement-shift').querySelector('[data-outfit="near-face"]')!, '.learn-flatlay-piece')[0]
    expect(nearFace()).toBe(cssColor(paletteColorById(generalOutfitExample.moreConsidered)!.hex))
    rerender({ result: resultFor('deep-winter') })
    expect(nearFace()).toBe(cssColor(getPalette('deep-winter').harder[0].hex))
    expect(figure('placement-shift').querySelector('.learn-illus-tag')).toHaveTextContent(`Your colors · ${getCopy('en').subtypes['deep-winter'].name}`)
    rerender({ result: resultFor('light-spring') })
    expect(nearFace()).toBe(cssColor(getPalette('light-spring').harder[0].hex))
    expect(roles(figure('placement-shift'))[0].name).toBe(colorDisplayName('en', getPalette('light-spring').harder[0]))
    rerender({ result: null })
    expect(nearFace()).toBe(cssColor(paletteColorById(generalOutfitExample.moreConsidered)!.hex))
    expect(document.querySelector('[data-learn-topic]')).toHaveAttribute('data-learn-topic', 'wear.harder')
  })
})

describe('J. Accessibility of the practical topics', () => {
  it.each(languages.flatMap((language) => [true, false].map((withProfile) => [language, withProfile] as const)))('%s, profile %s: headings, decoration and text equivalents', (language, withProfile) => {
    for (const topic of ['wear.palette', 'wear.harder', 'app.color-checker', 'app.lucky'] as const) {
      openTopic(topic, { language, result: withProfile ? resultFor('clear-spring') : null })
      headingLevels(page())
      const root = figure(learnTopics[topic].visual!)
      decorative(root)
      noInternals(page())
      // Every drawing has words beside it: a named list or labelled steps, never colour alone.
      expect(root.querySelectorAll('li p, li span:not([aria-hidden]), .learn-roles li, .learn-zone-label').length).toBeGreaterThan(0)
      for (const button of page().querySelectorAll('button')) expect(button.textContent!.trim()).not.toBe('')
      cleanup()
    }
  })
})
