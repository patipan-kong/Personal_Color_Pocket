import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { getPalette } from '../../domain/personalColor/palettes'
import { seasonDefinitions, subtypeOrder } from '../../domain/personalColor/seasons'
import { analyzeQuiz } from '../../domain/personalColor/scoring'
import type { PersonalColorResult, Subtype } from '../../domain/personalColor/types'
import { colorDisplayName, getCopy, metalDisplayNote } from '../../i18n'
import type { Language } from '../../i18n'
import { STORAGE_KEY } from '../../services/persistence'
import { dimensionBand, dimensionBandOrder, dimensionExamples, dimensionOrder, getLearnCopy, paletteColorById, seasonGroups, typeDetailSections } from '..'
import type { LearnEntry } from './LearnView'
import { LearnView } from './LearnView'

// V1.4 Slice 3: the 12-type overview, the one type template for all 12 types, the dimension scales,
// and the Result → your type entry. Every expectation is computed from canonical data, never copied.

const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const resultFor = (subtype: Subtype): PersonalColorResult => ({ ...analyzeQuiz(answers), subtype, season: seasonDefinitions[subtype].season })
const storeProfile = (subtype: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, answers, result: { ...analyzeQuiz(answers), subtype }, quizStep: 10 }))
const languages = ['en', 'th'] as const

function renderLearn({ language = 'en' as Language, result = null as PersonalColorResult | null, entry = undefined as LearnEntry | undefined } = {}) {
  const onQuiz = vi.fn()
  const onPalette = vi.fn()
  const element = (lang: Language, next: PersonalColorResult | null) => <LearnView copy={getCopy(lang)} language={lang} result={next} entry={entry} onQuiz={onQuiz} onPalette={onPalette} />
  const view = render(element(language, result))
  let state = { language, result }
  const rerender = (next: { language?: Language; result?: PersonalColorResult | null }) => {
    state = { language: next.language ?? state.language, result: next.result === undefined ? state.result : next.result }
    view.rerender(element(state.language, state.result))
  }
  return { ...view, onQuiz, onPalette, rerender }
}

const page = () => document.querySelector<HTMLElement>('.learn-page')!
const typePage = () => document.querySelector<HTMLElement>('.learn-type')
const cards = () => [...document.querySelectorAll<HTMLElement>('.learn-type-card')]
// The CSS colour a swatch must show, normalised the way the DOM reports it.
// jsdom keeps SVG fills as written, so both sides go through the same normaliser.
const cssColor = (value: string) => { const probe = document.createElement('i'); probe.style.color = value; return probe.style.color }
const swatchColors = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement | SVGElement>(selector)].map((swatch) => cssColor(swatch.style.background || swatch.style.fill))

// Text and every attribute a user or assistive technology can meet (not styles, classes or data-*).
function exposed(root: HTMLElement) {
  const attributes = [...root.querySelectorAll('*')].flatMap((element) => [...element.attributes].filter((attribute) => !['style', 'class', 'd', 'viewBox'].includes(attribute.name) && !attribute.name.startsWith('data-')).map((attribute) => attribute.value))
  return [root.textContent ?? '', ...attributes].join(' ')
}

function headingLevels(root: HTMLElement) {
  const levels = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) => Number(heading.tagName[1]))
  expect(levels.filter((level) => level === 1)).toHaveLength(1)
  expect(levels[0]).toBe(1)
  for (let index = 1; index < levels.length; index += 1) expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1)
}

async function openOverview(user: ReturnType<typeof userEvent.setup>, language: Language = 'en') {
  await user.click(screen.getByRole('button', { name: getLearnCopy(language).topics['types.overview'].title }))
  expect(document.querySelector('[data-learn-visual="subtype-grid"]')).not.toBeNull()
}

afterEach(cleanup)
beforeEach(() => localStorage.clear())

describe('A. The 12-type overview', () => {
  it.each(languages)('shows 4 seasons of 3 canonical types, in canonical order, with localized names (%s)', async (language) => {
    const user = userEvent.setup()
    renderLearn({ language })
    await openOverview(user, language)
    const learn = getLearnCopy(language)
    const seasons = [...document.querySelectorAll<HTMLElement>('.learn-season')]
    expect(seasons.map((season) => season.dataset.season)).toEqual(seasonGroups().map((group) => group.season))
    expect(seasons).toHaveLength(4)
    for (const [index, group] of seasonGroups().entries()) {
      const section = seasons[index]
      expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(learn.seasons[group.season].name)
      const types = [...section.querySelectorAll<HTMLElement>('.learn-type-card')]
      expect(types.map((card) => card.dataset.learnSubtype)).toEqual(group.subtypes)
      expect(types).toHaveLength(3)
      for (const [position, subtype] of group.subtypes.entries()) {
        expect(within(types[position]).getByRole('button')).toHaveTextContent(getCopy(language).subtypes[subtype].name)
        // The cue is the type's own first Best colours: no season palette, no invented colour.
        expect(swatchColors(types[position], '.learn-swatches i')).toEqual(getPalette(subtype).best.slice(0, 4).map((color) => cssColor(color.hex)))
      }
    }
    expect(cards().map((card) => card.dataset.learnSubtype)).toEqual([...subtypeOrder])
  })

  it('marks the user’s type with text, on exactly one card, and ranks nothing', async () => {
    const user = userEvent.setup()
    renderLearn({ result: resultFor('soft-summer') })
    await openOverview(user)
    const learn = getLearnCopy('en')
    const marked = cards().filter((card) => card.textContent!.includes(learn.typeDetail.yourType))
    expect(marked.map((card) => card.dataset.learnSubtype)).toEqual(['soft-summer'])
    // Not colour-only: the marker is part of the button's accessible name.
    expect(within(marked[0]).getByRole('button')).toHaveAccessibleName(new RegExp(`^${getCopy('en').subtypes['soft-summer'].name}\\s*,\\s*${learn.typeDetail.yourType}$`))
    const grid = document.querySelector<HTMLElement>('[data-learn-visual="subtype-grid"]')!
    expect(grid.textContent).not.toMatch(/\d|%|closest|second|similar|match|score|rank|best type/i)
  })

  it('without a result nothing is marked', async () => {
    const user = userEvent.setup()
    renderLearn()
    await openOverview(user)
    expect(document.querySelector('.learn-type-grid .learn-your-type')).toBeNull()
    expect(document.querySelector('.learn-type-card.is-mine')).toBeNull()
  })

  it('opens every type, and Back returns to the overview focused on the card', async () => {
    const user = userEvent.setup()
    renderLearn({ result: resultFor('light-spring') })
    await openOverview(user)
    const learn = getLearnCopy('en')
    for (const subtype of subtypeOrder) {
      await user.click(document.querySelector<HTMLButtonElement>(`[data-learn-open="type-${subtype}"]`)!)
      expect(typePage()).toHaveAttribute('data-learn-subtype', subtype)
      expect(screen.getByRole('heading', { level: 1, name: getCopy('en').subtypes[subtype].name })).toHaveFocus()
      await user.click(screen.getByRole('button', { name: `${learn.reader.backTo} ${learn.topics['types.overview'].title}` }))
      expect(document.querySelector('[data-learn-visual="subtype-grid"]')).not.toBeNull()
      expect(document.querySelector(`[data-learn-open="type-${subtype}"]`)).toHaveFocus()
    }
    // …and the overview's own Back returns to the Learn home, on the row it came from.
    await user.click(screen.getByRole('button', { name: learn.reader.back }))
    expect(page()).toHaveAttribute('data-learn-page', 'home')
    expect(screen.getByRole('button', { name: learn.topics['types.overview'].title })).toHaveFocus()
  })
})

describe('B/C. One template renders every type from canonical data', () => {
  it.each(subtypeOrder.flatMap((subtype) => languages.map((language) => [subtype, language] as const)))('%s (%s)', (subtype, language) => {
    renderLearn({ language, entry: { kind: 'type', subtype } })
    const copy = getCopy(language)
    const learn = getLearnCopy(language)
    const palette = getPalette(subtype)
    const root = typePage()!
    expect(root).toHaveAttribute('data-learn-subtype', subtype)
    // Sections in the registry's template order.
    expect([...root.querySelectorAll<HTMLElement>('.learn-type-section')].map((section) => section.dataset.section)).toEqual([...typeDetailSections])

    // Identity: existing app copy, the canonical season, the characteristic words labelled as colour qualities.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.subtypes[subtype].name)
    const head = root.querySelector<HTMLElement>('.learn-type-head')!
    expect(head).toHaveTextContent(`${learn.typeDetail.seasonLabel} · ${learn.seasons[seasonDefinitions[subtype].season].name}`)
    expect(head).toHaveTextContent(copy.subtypes[subtype].summary)
    expect(head.querySelector('.learn-qualities')).toHaveTextContent(`${learn.typeDetail.qualitiesLabel} ${copy.subtypes[subtype].characteristics.join(' · ')}`)
    if (language === 'th') expect(head.querySelector('[lang="en"]')).toHaveTextContent(copy.subtypes[subtype].secondaryName)
    // Browsed without a result: not the user's type.
    expect(root.querySelector('.learn-your-type')).toBeNull()

    // Four scales, each band derived from the canonical target through the Slice 1 contract.
    const scales = [...root.querySelectorAll<HTMLElement>('.learn-type-position .learn-scale')]
    expect(scales.map((scale) => scale.dataset.dimension)).toEqual([...dimensionOrder])
    for (const [index, dimension] of dimensionOrder.entries()) {
      const band = dimensionBand(seasonDefinitions[subtype].target[dimension])
      expect(scales[index].querySelector('.learn-scale-head')).toHaveTextContent(`${learn.dimensions[dimension].name}${learn.dimensions[dimension].bands[band]}`)
      const segments = [...scales[index].querySelectorAll('.learn-scale-track i')]
      expect(segments.map((segment) => segment.classList.contains('is-on'))).toEqual(dimensionBandOrder.map((entry) => entry === band))
      expect(scales[index].querySelector('.learn-scale-row')).toHaveAttribute('aria-hidden', 'true')
    }

    // The canonical palette groups: counts, colours and localized names exactly as palettes.ts.
    for (const group of ['best', 'neutrals', 'accents', 'harder'] as const) {
      const section = root.querySelector<HTMLElement>(`[data-learn-group="${group}"]`)!
      expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(copy.palette.sections[group].title)
      const items = [...section.querySelectorAll<HTMLElement>('.learn-chips li')]
      expect(items).toHaveLength(palette[group].length)
      expect(items.map((item) => item.textContent)).toEqual(palette[group].map((color) => colorDisplayName(language, color)))
      expect(swatchColors(section, '.learn-chips i')).toEqual(palette[group].map((color) => cssColor(color.hex)))
      for (const swatch of section.querySelectorAll('.learn-chips i')) expect(swatch).toHaveAttribute('aria-hidden', 'true')
    }
    expect([palette.best.length, palette.neutrals.length, palette.accents.length, palette.harder.length, palette.metals.length]).toEqual([8, 5, 5, 4, 2])

    // More Considered: exactly the app's own title, description, listed colours and tips — nothing added.
    const harder = root.querySelector<HTMLElement>('[data-learn-group="harder"]')!
    expect(harder.textContent).toBe([copy.palette.sections.harder.title, copy.palette.sections.harder.description, ...palette.harder.map((color) => colorDisplayName(language, color)), ...copy.palette.harderTips].join(''))

    // Metals: the canonical two, with their existing notes.
    const metals = [...root.querySelectorAll<HTMLElement>('[data-learn-group="metals"] li')]
    expect(metals.map((metal) => metal.textContent)).toEqual(palette.metals.map((metal) => `${colorDisplayName(language, metal)} ${metalDisplayNote(language, metal)}`))
    expect(swatchColors(root, '[data-learn-group="metals"] li i')).toEqual(palette.metals.map((metal) => cssColor(metal.hex)))

    // Formula: the first Best, Neutral and Accent, named, with a decorative flat-lay in the same colours.
    const formula = [palette.best[0], palette.neutrals[0], palette.accents[0]]
    expect([...root.querySelectorAll('.learn-formula strong')].map((name) => name.textContent)).toEqual(formula.map((color) => colorDisplayName(language, color)))
    expect(root.querySelector('.learn-flatlay')).toHaveAttribute('aria-hidden', 'true')
    expect(swatchColors(root, '.learn-flatlay-piece')).toEqual(formula.map((color) => cssColor(color.hex)))

    // Nothing internal or numeric reaches the reader.
    const text = exposed(page())
    expect(text).not.toMatch(/#[0-9a-f]{3,6}\b/i)
    expect(text).not.toMatch(/-(best|neutral|accent|harder|metal)-\d|\bharder\b|\bneutrals\b|\baccents\b/)
    for (const id of subtypeOrder) expect(text).not.toContain(id)
    expect(page().textContent).not.toMatch(/\d|%/)
    headingLevels(page())
  })

  it('the dimensions topic draws its endpoint examples from the Slice 1 palette ids', async () => {
    const user = userEvent.setup()
    renderLearn()
    await user.click(screen.getByRole('button', { name: getLearnCopy('en').topics['basics.dimensions'].title }))
    const scales = [...document.querySelectorAll<HTMLElement>('[data-learn-visual="dimension-scales"] .learn-scale')]
    expect(scales.map((scale) => scale.dataset.dimension)).toEqual([...dimensionOrder])
    for (const [index, dimension] of dimensionOrder.entries()) {
      const ends = scales[index].querySelectorAll<HTMLElement>('.learn-scale-end')
      for (const [side, end] of (['low', 'high'] as const).entries()) {
        expect(swatchColors(ends[side], 'i')).toEqual(dimensionExamples[dimension][end].map((id) => cssColor(paletteColorById(id)!.hex)))
      }
      expect(scales[index].querySelector('.learn-scale-ends')).toHaveTextContent(`${getLearnCopy('en').dimensions[dimension].ends.low}${getLearnCopy('en').dimensions[dimension].ends.high}`)
      // Without a result there is no position: no marker, no band.
      expect(scales[index].querySelector('.is-on')).toBeNull()
    }
  })

  it.each(languages)('with a result, the dimensions topic marks the user’s type in words and position (%s)', async (language) => {
    const user = userEvent.setup()
    renderLearn({ language, result: resultFor('clear-winter') })
    const learn = getLearnCopy(language)
    await user.click(screen.getByRole('button', { name: learn.topics['basics.dimensions'].title }))
    const figure = document.querySelector<HTMLElement>('.learn-figure')!
    expect(figure.querySelector('.learn-scale-legend')).toHaveTextContent(`${learn.typeDetail.yourType} ${getCopy(language).subtypes['clear-winter'].name}`)
    expect(figure).toHaveTextContent(learn.typeDetail.positionNote)
    for (const dimension of dimensionOrder) {
      const band = dimensionBand(seasonDefinitions['clear-winter'].target[dimension])
      const scale = figure.querySelector<HTMLElement>(`[data-dimension="${dimension}"]`)!
      expect(scale.querySelector('.learn-scale-head span')).toHaveTextContent(learn.dimensions[dimension].bands[band])
      expect(dimensionBandOrder.indexOf(band)).toBe([...scale.querySelectorAll('.learn-scale-track i')].findIndex((segment) => segment.classList.contains('is-on')))
    }
    headingLevels(page())
  })
})

describe('D. Navigation, entries and state changes', () => {
  it('Result → Learn opens the user’s own type page; Back goes to the Learn home', async () => {
    const user = userEvent.setup()
    storeProfile('deep-autumn')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Deep Autumn' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Learn about your type' }))
    expect(typePage()).toHaveAttribute('data-learn-subtype', 'deep-autumn')
    expect(typePage()).toHaveAttribute('data-learn-own', 'true')
    expect(screen.getByRole('heading', { level: 1, name: 'Deep Autumn' })).toHaveFocus()
    expect(within(typePage()!).getByText(getLearnCopy('en').typeDetail.yourType)).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Guide' })).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('button', { name: 'Back to Color Guide' }))
    expect(page()).toHaveAttribute('data-learn-page', 'home')
    // The nav's Guide item opens the Learn home, not the last entry.
    await user.click(screen.getByRole('button', { name: 'My Colors' }))
    await user.click(screen.getByRole('button', { name: 'Guide' }))
    expect(page()).toHaveAttribute('data-learn-page', 'home')
  })

  it('the Result link is Thai in Thai', async () => {
    const user = userEvent.setup()
    storeProfile('soft-summer')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    await user.click(screen.getByRole('button', { name: getCopy('th').result.learnCta }))
    expect(screen.getByRole('heading', { level: 1, name: getCopy('th').subtypes['soft-summer'].name })).toBeInTheDocument()
  })

  it('an unknown requested type opens the Learn home, without guessing', () => {
    renderLearn({ result: resultFor('soft-summer'), entry: { kind: 'type', subtype: 'bogus-type' as Subtype } })
    expect(page()).toHaveAttribute('data-learn-page', 'home')
    expect(typePage()).toBeNull()
  })

  it('switching language keeps the same page: overview, dimensions topic and type page', async () => {
    const user = userEvent.setup()
    const { rerender } = renderLearn({ result: resultFor('cool-summer') })
    await user.click(screen.getByRole('button', { name: getLearnCopy('en').topics['basics.dimensions'].title }))
    rerender({ language: 'th' })
    expect(screen.getByRole('heading', { level: 1, name: getLearnCopy('th').topics['basics.dimensions'].title })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: getLearnCopy('th').reader.back }))
    await openOverview(user, 'th')
    rerender({ language: 'en' })
    expect(document.querySelector('[data-learn-visual="subtype-grid"]')).toHaveTextContent(getLearnCopy('en').seasons.spring.name)
    await user.click(document.querySelector<HTMLButtonElement>('[data-learn-open="type-warm-autumn"]')!)
    rerender({ language: 'th' })
    expect(typePage()).toHaveAttribute('data-learn-subtype', 'warm-autumn')
    expect(screen.getByRole('heading', { level: 1, name: getCopy('th').subtypes['warm-autumn'].name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${getLearnCopy('th').reader.backTo} ${getLearnCopy('th').topics['types.overview'].title}` })).toBeInTheDocument()
  })

  it('a browsed type stays put when the result changes; only the marker follows the result', async () => {
    const user = userEvent.setup()
    const { rerender } = renderLearn({ result: resultFor('soft-summer') })
    await openOverview(user)
    await user.click(document.querySelector<HTMLButtonElement>('[data-learn-open="type-soft-summer"]')!)
    expect(typePage()).toHaveAttribute('data-learn-own', 'true')
    rerender({ result: resultFor('deep-winter') })
    expect(typePage()).toHaveAttribute('data-learn-subtype', 'soft-summer')
    expect(typePage()).toHaveAttribute('data-learn-own', 'false')
    expect(typePage()!.querySelector('.learn-your-type')).toBeNull()
    rerender({ result: null })
    expect(typePage()).toHaveAttribute('data-learn-subtype', 'soft-summer')
  })

  it('the home hero’s “your type” page follows the result, and leaves when it is removed', async () => {
    const user = userEvent.setup()
    const { rerender } = renderLearn({ result: resultFor('clear-spring') })
    await user.click(screen.getByRole('button', { name: getLearnCopy('en').home.profileHero.cta }))
    expect(typePage()).toHaveAttribute('data-learn-subtype', 'clear-spring')
    rerender({ result: resultFor('light-summer') })
    expect(typePage()).toHaveAttribute('data-learn-subtype', 'light-summer')
    expect(typePage()).toHaveAttribute('data-learn-own', 'true')
    rerender({ result: null })
    expect(page()).toHaveAttribute('data-learn-page', 'home')
  })

  it('offers My Palette only on the user’s own type, the quiz only without a result', async () => {
    const user = userEvent.setup()
    const copy = getCopy('en')
    const own = renderLearn({ result: resultFor('warm-spring'), entry: { kind: 'type', subtype: 'warm-spring' } })
    await user.click(screen.getByRole('button', { name: new RegExp(copy.result.paletteCta) }))
    expect(own.onPalette).toHaveBeenCalledTimes(1)
    cleanup()
    renderLearn({ result: resultFor('warm-spring'), entry: { kind: 'type', subtype: 'cool-winter' } })
    expect(screen.queryByRole('button', { name: new RegExp(copy.result.paletteCta) })).toBeNull()
    expect(screen.queryByRole('button', { name: new RegExp(getLearnCopy('en').typeDetail.quizCta) })).toBeNull()
    cleanup()
    const general = renderLearn({ entry: { kind: 'type', subtype: 'cool-winter' } })
    await user.click(screen.getByRole('button', { name: new RegExp(getLearnCopy('en').typeDetail.quizCta) }))
    expect(general.onQuiz).toHaveBeenCalledTimes(1)
  })
})

describe('E. Accessibility', () => {
  it('opens a type from the keyboard and lands on its title', async () => {
    const user = userEvent.setup()
    renderLearn()
    await openOverview(user)
    const target = document.querySelector<HTMLButtonElement>('[data-learn-open="type-deep-winter"]')!
    for (let index = 0; index < 40 && document.activeElement !== target; index += 1) await user.tab()
    expect(target).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 1, name: getCopy('en').subtypes['deep-winter'].name })).toHaveFocus()
  })

  it.each(languages)('headings are ordered on the overview and on a type page with a result (%s)', async (language) => {
    const user = userEvent.setup()
    renderLearn({ language, result: resultFor('deep-winter') })
    await openOverview(user, language)
    headingLevels(page())
    await user.click(document.querySelector<HTMLButtonElement>('[data-learn-open="type-deep-winter"]')!)
    headingLevels(page())
    // The user's own type: a text marker, not colour alone.
    expect(typePage()!.querySelector('.learn-type-head')).toHaveTextContent(getLearnCopy(language).typeDetail.yourType)
  })

  it('palette colours are a named list: a screen reader meets group names and colour names only', () => {
    renderLearn({ entry: { kind: 'type', subtype: 'light-spring' } })
    const best = typePage()!.querySelector<HTMLElement>('[data-learn-group="best"]')!
    const list = within(best).getByRole('list')
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(getPalette('light-spring').best.map((color) => color.name))
    for (const decoration of typePage()!.querySelectorAll('.learn-swatches, .learn-chips i, .learn-metals i, .learn-formula i, .learn-scale-row, .learn-flatlay')) {
      expect(decoration.closest('[aria-hidden="true"]')).not.toBeNull()
    }
  })
})
