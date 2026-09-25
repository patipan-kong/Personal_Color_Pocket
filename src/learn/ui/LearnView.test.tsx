import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { getPalette } from '../../domain/personalColor/palettes'
import { subtypeOrder } from '../../domain/personalColor/seasons'
import { analyzeQuiz } from '../../domain/personalColor/scoring'
import type { PersonalColorResult, Subtype } from '../../domain/personalColor/types'
import { getCopy } from '../../i18n'
import type { Language } from '../../i18n'
import { STORAGE_KEY } from '../../services/persistence'
import { getLearnCopy, learnClaims, learnGroups, learnHomeFeatured, learnTopicOrder } from '..'
import { LearnView } from './LearnView'

// V1.4 Slice 2: the Learn home, the generic reader, the minimal type page, and how the app reaches
// them. Behaviour is checked through roles and data attributes, not snapshots.

const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const resultFor = (subtype: Subtype): PersonalColorResult => ({ ...analyzeQuiz(answers), subtype, season: subtype.split('-')[1] as PersonalColorResult['season'] })
const storeProfile = (subtype: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, answers, result: { ...analyzeQuiz(answers), subtype }, quizStep: 10 }))

function renderLearn({ language = 'en' as Language, result = null as PersonalColorResult | null } = {}) {
  const onQuiz = vi.fn()
  const onPalette = vi.fn()
  const view = render(<LearnView copy={getCopy(language)} language={language} result={result} onQuiz={onQuiz} onPalette={onPalette} />)
  const rerender = (next: { language?: Language; result?: PersonalColorResult | null }) => {
    const lang = next.language ?? language
    view.rerender(<LearnView copy={getCopy(lang)} language={lang} result={next.result === undefined ? result : next.result} onQuiz={onQuiz} onPalette={onPalette} />)
  }
  return { ...view, onQuiz, onPalette, rerender }
}

const page = () => document.querySelector<HTMLElement>('.learn-page')!
const opens = () => [...document.querySelectorAll<HTMLElement>('[data-learn-open]')].map((element) => element.dataset.learnOpen)

// Text and every non-style attribute a user or assistive technology can meet.
function exposed(root: HTMLElement) {
  const attributes = [...root.querySelectorAll('*')].flatMap((element) => [...element.attributes].filter((attribute) => attribute.name !== 'style' && attribute.name !== 'class').map((attribute) => attribute.value))
  return [root.textContent ?? '', ...attributes].join(' ')
}

function headingLevels(root: HTMLElement) {
  const levels = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) => Number(heading.tagName[1]))
  expect(levels.filter((level) => level === 1)).toHaveLength(1)
  expect(levels[0]).toBe(1)
  // Never skips a level on the way down.
  for (let index = 1; index < levels.length; index += 1) expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1)
}

afterEach(cleanup)
beforeEach(() => localStorage.clear())

describe('A. Learn home', () => {
  it.each(['en', 'th'] as const)('profile mode (%s): the hero is the user’s type, from existing app copy', (language) => {
    const { onPalette } = renderLearn({ language, result: resultFor('soft-summer') })
    const learn = getLearnCopy(language)
    const subtype = getCopy(language).subtypes['soft-summer']
    expect(page()).toHaveAttribute('data-learn-mode', 'profile')
    expect(screen.getByRole('heading', { level: 1, name: learn.home.title })).toBeInTheDocument()
    const hero = document.querySelector<HTMLElement>('.learn-hero')!
    // By text: jsdom gives spans no display, so its name algorithm spaces the two parts of a Thai type
    // name; Chrome's accessible name is exact (Slice 5 browser QA).
    expect(within(hero).getByRole('heading', { level: 2 }).textContent).toBe(subtype.name)
    expect(hero).toHaveTextContent(subtype.summary)
    expect(hero).toHaveTextContent(`${learn.home.profileHero.eyebrow} · ${learn.seasons.summer.name}`)
    expect(within(hero).getByRole('button', { name: learn.home.profileHero.cta })).toBeInTheDocument()
    expect(onPalette).not.toHaveBeenCalled()
  })

  it.each(['en', 'th'] as const)('general mode (%s): useful without a result, the quiz is an optional link', async (language) => {
    const { onQuiz } = renderLearn({ language })
    const learn = getLearnCopy(language)
    expect(page()).toHaveAttribute('data-learn-mode', 'general')
    expect(screen.getByRole('heading', { level: 2, name: learn.home.generalHero.title })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: learn.home.generalHero.cta }))
    expect(onQuiz).toHaveBeenCalledTimes(1)
    // Nothing is gated: every topic is still open to read.
    expect(opens().filter((id) => id !== 'type').sort()).toEqual([...learnTopicOrder].sort())
  })

  it('an invalid result falls back to general mode instead of guessing a type', () => {
    renderLearn({ result: { ...resultFor('soft-summer'), subtype: 'bogus-subtype' as Subtype } })
    expect(page()).toHaveAttribute('data-learn-mode', 'general')
    expect(document.querySelector('[data-learn-subtype]')).toBeNull()
  })

  it.each([['with', resultFor('deep-autumn')], ['without', null]] as const)('%s a profile: the registry’s two featured topics, then the rest as rows', (mode, result) => {
    renderLearn({ result })
    const featured = [...document.querySelectorAll<HTMLElement>('.learn-feature')].map((card) => card.dataset.learnTopic)
    expect(featured).toEqual(result ? learnHomeFeatured.withProfile : learnHomeFeatured.withoutProfile)
    const rows = [...document.querySelectorAll<HTMLElement>('.learn-row')].map((row) => row.dataset.learnTopic)
    expect(rows).toEqual(learnTopicOrder.filter((topic) => !featured.includes(topic)))
    expect(mode).toBeTruthy()
  })

  it.each(['en', 'th'] as const)('exposes exactly the 7 P0 topics under the 3 groups (%s)', (language) => {
    for (const result of [resultFor('light-spring'), null]) {
      cleanup()
      renderLearn({ language, result })
      const learn = getLearnCopy(language)
      const topics = opens().filter((id) => id !== 'type')
      expect(topics).toHaveLength(7)
      expect([...topics].sort()).toEqual([...learnTopicOrder].sort())
      expect(opens().filter((id) => id === 'type')).toHaveLength(result ? 1 : 0)
      for (const topic of learnTopicOrder) expect(screen.getByRole('button', { name: learn.topics[topic].title })).toBeInTheDocument()
      // Every group is named on the page: as a section heading, or on its featured cards.
      for (const group of learnGroups) expect(page().textContent).toContain(learn.home.groups[group.id])
      expect(page().textContent).not.toMatch(/Everyday Neutrals|Same name|Nearby types/i)
    }
  })

  it('shows no HEX, raw ids, scores or confidence', () => {
    for (const subtype of subtypeOrder) {
      cleanup()
      renderLearn({ result: resultFor(subtype) })
      const text = exposed(page())
      expect(text).not.toMatch(/#[0-9a-f]{3,6}\b/i)
      expect(text).not.toMatch(/\d[.,]\d|%/)
      expect(text).not.toMatch(/Likely match|Strong match|Possible match/)
      for (const id of [...subtypeOrder, ...learnTopicOrder, ...Object.keys(learnClaims).filter((claim) => claim.includes('-'))]) {
        expect(page().textContent).not.toContain(id)
      }
    }
  })

  it('shows the user’s own Best colours in the hero as decoration only', () => {
    renderLearn({ result: resultFor('clear-winter') })
    const swatches = document.querySelector<HTMLElement>('.learn-hero .learn-swatches')!
    expect(swatches).toHaveAttribute('aria-hidden', 'true')
    const best = getPalette('clear-winter').best.slice(0, 5)
    const rendered = [...swatches.querySelectorAll('i')].map((swatch) => swatch.style.background)
    const expected = best.map((color) => { const probe = document.createElement('i'); probe.style.background = color.hex; return probe.style.background })
    expect(rendered).toEqual(expected)
    for (const decoration of document.querySelectorAll('.learn-swatches')) expect(decoration).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('B/D. Learn reader, type page and Back', () => {
  it.each([['with', resultFor('cool-summer')], ['without', null]] as const)('%s a profile: every topic opens a real page with an h1, three levels and a Back', async (_mode, result) => {
    const user = userEvent.setup()
    renderLearn({ result })
    const learn = getLearnCopy('en')
    for (const topic of learnTopicOrder) {
      await user.click(screen.getByRole('button', { name: learn.topics[topic].title }))
      expect(page()).toHaveAttribute('data-learn-page', 'topic')
      const heading = screen.getByRole('heading', { level: 1, name: learn.topics[topic].title })
      expect(heading).toHaveFocus()
      expect(screen.getByText(learn.topics[topic].answer)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: learn.reader.why })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: learn.reader.takeaway })).toBeInTheDocument()
      const more = document.querySelector('details.learn-more')
      if (learn.topics[topic].more.length > 0) expect(more).not.toHaveAttribute('open')
      else expect(more).toBeNull()
      headingLevels(page())
      expect(exposed(page())).not.toMatch(/#[0-9a-f]{6}\b/i)
      await user.click(screen.getByRole('button', { name: learn.reader.back }))
      expect(page()).toHaveAttribute('data-learn-page', 'home')
      // Back returns focus to the row the user came from.
      expect(screen.getByRole('button', { name: learn.topics[topic].title })).toHaveFocus()
    }
  })

  it('renders reused app wording from the app copy, not a Learn copy of it', async () => {
    const user = userEvent.setup()
    renderLearn({ result: resultFor('soft-autumn') })
    const copy = getCopy('en')
    await user.click(screen.getByRole('button', { name: getLearnCopy('en').topics['wear.harder'].title }))
    for (const tip of copy.palette.harderTips) expect(screen.getByText(tip)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: copy.palette.sections.harder.title })).toBeInTheDocument()
    // With a result, the group shows a glimpse of the user's own More Considered colours.
    expect(document.querySelectorAll('[data-learn-group="harder"] .learn-swatches i')).toHaveLength(Math.min(6, getPalette('soft-autumn').harder.length))
  })

  it('opens the user’s type page from the hero (the Slice 3 template)', async () => {
    const user = userEvent.setup()
    const { onPalette } = renderLearn({ result: resultFor('deep-winter') })
    const learn = getLearnCopy('en')
    const copy = getCopy('en')
    await user.click(screen.getByRole('button', { name: learn.home.profileHero.cta }))
    expect(page()).toHaveAttribute('data-learn-page', 'type')
    expect(screen.getByRole('heading', { level: 1, name: copy.subtypes['deep-winter'].name })).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: learn.typeDetail.positionHeading })).toBeInTheDocument()
    // Bands as words, four of them; no numbers.
    expect(document.querySelectorAll('.learn-type-position .learn-scale-head span')).toHaveLength(4)
    expect(page().textContent).not.toMatch(/\d/)
    const palette = getPalette('deep-winter')
    const formula = [...document.querySelectorAll('.learn-formula strong')].map((name) => name.textContent)
    expect(formula).toEqual([palette.best[0], palette.neutrals[0], palette.accents[0]].map((color) => color.name))
    headingLevels(page())
    await user.click(screen.getByRole('button', { name: copy.result.paletteCta }))
    expect(onPalette).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: learn.reader.back }))
    expect(screen.getByRole('button', { name: learn.home.profileHero.cta })).toHaveFocus()
  })

  it('has one h1 and ordered headings on the home page in both modes', () => {
    for (const result of [resultFor('warm-autumn'), null]) {
      cleanup()
      renderLearn({ result })
      headingLevels(page())
    }
  })

  it('opens topics from the keyboard, and Back is a named button', async () => {
    const user = userEvent.setup()
    renderLearn()
    const learn = getLearnCopy('en')
    const target = screen.getByRole('button', { name: learn.topics['app.lucky'].title })
    for (let index = 0; index < 30 && document.activeElement !== target; index += 1) await user.tab()
    expect(target).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 1, name: learn.topics['app.lucky'].title })).toHaveFocus()
    const back = screen.getByRole('button', { name: learn.reader.back })
    expect(back.tagName).toBe('BUTTON')
    back.focus()
    await user.keyboard('{Enter}')
    expect(target.isConnected ? target : screen.getByRole('button', { name: learn.topics['app.lucky'].title })).toHaveFocus()
  })
})

describe('C. Reactivity: Learn follows the app state on every render', () => {
  it('re-renders an open topic in the new language', async () => {
    const user = userEvent.setup()
    const { rerender } = renderLearn({ result: resultFor('light-summer') })
    await user.click(screen.getByRole('button', { name: getLearnCopy('en').topics['basics.dimensions'].title }))
    rerender({ language: 'th' })
    expect(page()).toHaveAttribute('data-learn-page', 'topic')
    expect(screen.getByRole('heading', { level: 1, name: getLearnCopy('th').topics['basics.dimensions'].title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: getLearnCopy('th').reader.back })).toBeInTheDocument()
  })

  it('drops the personal hero and the type page when the result is removed', async () => {
    const user = userEvent.setup()
    const { rerender } = renderLearn({ result: resultFor('clear-spring') })
    await user.click(screen.getByRole('button', { name: getLearnCopy('en').home.profileHero.cta }))
    expect(page()).toHaveAttribute('data-learn-page', 'type')
    rerender({ result: null })
    expect(page()).toHaveAttribute('data-learn-page', 'home')
    expect(page()).toHaveAttribute('data-learn-mode', 'general')
    expect(page().textContent).not.toContain(getCopy('en').subtypes['clear-spring'].name)
  })

  it('shows the new type as soon as the result changes', async () => {
    const user = userEvent.setup()
    const { rerender } = renderLearn({ result: resultFor('clear-spring') })
    rerender({ result: resultFor('soft-summer') })
    expect(document.querySelector('.learn-hero')).toHaveAttribute('data-learn-subtype', 'soft-summer')
    expect(page().textContent).not.toContain(getCopy('en').subtypes['clear-spring'].name)
    await user.click(screen.getByRole('button', { name: getLearnCopy('en').home.profileHero.cta }))
    rerender({ result: resultFor('deep-autumn') })
    expect(screen.getByRole('heading', { level: 1, name: getCopy('en').subtypes['deep-autumn'].name })).toBeInTheDocument()
  })
})

describe('B. Reaching Learn from the app', () => {
  it('with a profile: Guide is the fifth bottom-nav item, marked as the current page', async () => {
    const user = userEvent.setup()
    storeProfile('soft-summer')
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const items = within(nav).getAllByRole('button')
    expect(items.map((item) => item.textContent)).toEqual(['Daily', 'My Colors', 'Palette', 'Color Checker', 'Guide'])
    await user.click(within(nav).getByRole('button', { name: 'Guide' }))
    expect(page()).toHaveAttribute('data-learn-mode', 'profile')
    expect(within(nav).getByRole('button', { name: 'Guide' })).toHaveAttribute('aria-current', 'page')
    expect(items.filter((item) => item.getAttribute('aria-current') === 'page')).toHaveLength(1)
    // Learn -> an existing screen, through the same nav.
    await user.click(within(nav).getByRole('button', { name: 'Palette' }))
    expect(screen.getByRole('heading', { level: 1, name: 'My Palette' })).toBeInTheDocument()
    expect(document.querySelector('.learn-page')).toBeNull()
  })

  it('from the type page, the palette button opens the real Palette screen', async () => {
    const user = userEvent.setup()
    storeProfile('soft-summer')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Guide' }))
    await user.click(screen.getByRole('button', { name: 'Learn about your type' }))
    await user.click(screen.getByRole('button', { name: /explore my palette/i }))
    expect(screen.getByRole('heading', { level: 1, name: 'My Palette' })).toBeInTheDocument()
  })

  it('without a profile: Welcome has a secondary Learn link that opens the general guide', async () => {
    const user = userEvent.setup()
    render(<App />)
    const start = screen.getByRole('button', { name: /find my colors/i })
    const link = screen.getByRole('button', { name: 'Read the color guide' })
    // Secondary to the quiz: a text link placed after the primary button.
    expect(link).toHaveClass('text-button')
    expect(start.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(link)
    expect(page()).toHaveAttribute('data-learn-mode', 'general')
    expect(document.querySelector('.bottom-nav')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Find your Personal Color' }))
    expect(screen.getByRole('button', { name: 'Women' })).toBeInTheDocument()
  })

  it('a corrupted stored profile opens Learn in general mode', async () => {
    const user = userEvent.setup()
    storeProfile('bogus-subtype')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Read the color guide' }))
    expect(page()).toHaveAttribute('data-learn-mode', 'general')
  })

  it('switching language in the header re-renders the open Learn page', async () => {
    const user = userEvent.setup()
    storeProfile('soft-summer')
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Guide' }))
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(screen.getByRole('heading', { level: 1, name: getLearnCopy('th').home.title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'คู่มือ' })).toHaveAttribute('aria-current', 'page')
    expect(document.querySelector('.learn-hero')).toHaveTextContent(getCopy('th').subtypes['soft-summer'].name)
  })

  it('Learn reads no storage itself: its view renders with storage unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage read') })
    try {
      renderLearn({ result: resultFor('soft-summer') })
      expect(page()).toHaveAttribute('data-learn-mode', 'profile')
      expect(getItem).not.toHaveBeenCalled()
    } finally { getItem.mockRestore() }
  })
})
