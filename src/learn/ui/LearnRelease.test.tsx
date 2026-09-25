import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import appSource from '../../App.tsx?raw'
import { seasonDefinitions, subtypeOrder } from '../../domain/personalColor/seasons'
import { analyzeQuiz } from '../../domain/personalColor/scoring'
import type { PersonalColorResult, Subtype } from '../../domain/personalColor/types'
import { getCopy } from '../../i18n'
import type { Language } from '../../i18n'
import { STORAGE_KEY } from '../../services/persistence'
import css from '../../styles.css?raw'
import { getLearnCopy } from '..'
import type { LearnEntry } from './LearnView'
import { LearnView } from './LearnView'

// V1.4 Slice 5: release invariants for the polish pass — the app shell's reflow under large text and
// zoom, focus visibility, the lucky-colour family token, Thai type-name wrapping, the Welcome link order,
// the contextual links' contrast, and Thai/English terminology. Layout itself is measured in the
// browser QA (docs/V1_4_SLICE_5_RELEASE_POLISH.md); these tests pin the CSS and markup contracts.

const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const resultFor = (subtype: Subtype): PersonalColorResult => ({ ...analyzeQuiz(answers), subtype, season: seasonDefinitions[subtype].season })
const storeProfile = (subtype: Subtype) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, answers, result: { ...analyzeQuiz(answers), subtype }, quizStep: 10 }))
const languages = ['en', 'th'] as const
const renderLearn = (language: Language, result: PersonalColorResult | null, entry?: LearnEntry) =>
  render(<LearnView copy={getCopy(language)} language={language} result={result} entry={entry} onQuiz={vi.fn()} onPalette={vi.fn()} />)

// The CSS, without comments, and the declarations of every rule whose selector list includes `selector`
// (inside any at-rule).
const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
function rules(selector: string) {
  const found: string[] = []
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].split(',').map((part) => part.trim()).includes(selector)) found.push(match[2])
  }
  return found
}
function block(prelude: RegExp) {
  const start = source.search(prelude)
  expect(start, String(prelude)).toBeGreaterThan(-1)
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  throw new Error('unclosed block')
}

afterEach(cleanup)
beforeEach(() => localStorage.clear())

describe('A. App shell reflow: header and bottom nav under large text and zoom', () => {
  it('the header wraps instead of overflowing, and never clips', () => {
    expect(rules('.brand-bar').join(';')).toMatch(/flex-wrap:\s*wrap/)
    expect(rules('.header-actions').join(';')).toMatch(/flex-wrap:\s*wrap/)
    // The brand only takes the space left over (up to its natural width), so normal text keeps one row.
    expect(rules('.brand-button').join(';')).toMatch(/flex:\s*1 1 0;.*max-width:\s*max-content/)
    for (const selector of ['.brand-bar', '.header-actions', '.bottom-nav', '.app-shell']) {
      expect(rules(selector).join(';'), selector).not.toMatch(/overflow(-x)?:\s*(hidden|scroll|auto|clip)/)
    }
  })

  it('the phone nav wraps onto rows (a container query in label ems), never scrolls, and keeps five items', () => {
    const phone = block(/@media \(max-width: 760px\) \{\s*\.app-shell/)
    expect(phone).toMatch(/\.bottom-nav \{[^}]*container:\s*bottom-nav \/ inline-size;[^}]*flex-wrap:\s*wrap/)
    // Normal text: five across. Larger text: two per row, icon beside the label when there is room.
    expect(block(/@container bottom-nav \(min-width: 23em\)/)).toMatch(/\.bottom-nav button \{\s*flex-basis:\s*0/)
    expect(block(/@container bottom-nav \(width < 23em\) and \(min-width: 200px\)/)).toMatch(/flex-direction:\s*row/)
    expect(phone).toMatch(/\.bottom-nav button \{[^}]*flex:\s*1 1 34%/)
    // No nav rule hides an item or its label.
    for (const match of source.matchAll(/([^{}]*\.bottom-nav[^{}]*)\{([^{}]*)\}/g)) {
      expect(match[2], match[1]).not.toMatch(/display:\s*none|visibility:\s*hidden|text-overflow|overflow/)
    }
  })

  it('every nav target stays at least 44 × 44 px', () => {
    const sizes = [...source.matchAll(/\.bottom-nav button \{([^}]*)\}/g)].map((match) => match[1])
    expect(sizes.length).toBeGreaterThan(2)
    for (const declarations of sizes) {
      for (const [, property, value] of declarations.matchAll(/(min-(?:width|height)):\s*(\d+)px/g)) expect(Number(value), property).toBeGreaterThanOrEqual(44)
    }
    expect(block(/@media \(max-width: 760px\) \{\s*\.app-shell/)).toMatch(/\.bottom-nav button \{[^}]*min-width:\s*44px/)
  })

  it('below 250 CSS px (about 150 % zoom and more) the nav joins the page flow instead of covering it', () => {
    const zoomed = block(/@media \(max-width: 250px\)/)
    expect(zoomed).toMatch(/\.bottom-nav \{[^}]*position:\s*static/)
    expect(zoomed).not.toMatch(/display:\s*none/)
  })

  it('the page keeps room for the nav’s measured height, and the space is released with the nav', () => {
    expect(rules('.app-shell').join(';')).toMatch(/var\(--bottom-nav-height, 0px\)/)
    let callback: ResizeObserverCallback = () => undefined
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class { constructor(next: ResizeObserverCallback) { callback = next } observe() {} unobserve() {} disconnect() { disconnect() } })
    try {
      storeProfile('soft-summer')
      const view = render(<App />)
      const shell = document.querySelector<HTMLElement>('.app-shell')!
      const nav = document.querySelector<HTMLElement>('.bottom-nav')!
      nav.getBoundingClientRect = () => ({ height: 187.4 } as DOMRect)
      act(() => callback([], {} as ResizeObserver))
      expect(shell.style.getPropertyValue('--bottom-nav-height')).toBe('188px')
      view.unmount()
      expect(disconnect).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('the Welcome badge is sized in em, so its text stays inside it under large text', () => {
    for (const declarations of [...source.matchAll(/\.welcome-art figcaption \{([^}]*)\}/g)].map((match) => match[1])) {
      expect(declarations).not.toMatch(/(width|height):\s*\d+px/)
    }
  })
})

describe('B. Focus stays visible', () => {
  it('the global focus ring exists, and every place that removes an outline draws one on its card', () => {
    expect(source).toMatch(/button:focus-visible, a:focus-visible, input:focus-visible \{ outline: 3px solid #197a78/)
    expect(rules('.learn-open:focus-visible').join(';')).toMatch(/outline:\s*none/)
    for (const card of ['.learn-feature', '.learn-row', '.learn-type-card']) {
      expect(source, card).toMatch(new RegExp(`${card.replace('.', '\\.')}:has\\(\\.learn-open:focus-visible\\)[^{]*\\{[^}]*outline:\\s*3px solid`))
    }
    // Only these rules remove an outline, and each has its replacement: the card ring above, the HEX
    // field's ring, pointer-only focus on the photo, and the programmatic focus of a page title.
    const removed = [...source.matchAll(/([^{}]+)\{[^{}]*outline:\s*(none|0)[;\s}]/g)].map((match) => match[1].trim())
    expect(removed.sort()).toEqual(['.hex-field input', '.learn-open:focus-visible', '.learn-page h1:focus', '.photo-stage[data-input="pointer"]:focus-visible'])
    expect(rules('.hex-field > div:has(input:focus-visible)').join(';')).toMatch(/outline:\s*3px solid #197a78/)
  })
})

describe('C. Lucky colors: the family step favours no hue', () => {
  it.each(languages)('%s: the family step is a decorative multi-hue token, named in words; shades follow', (language) => {
    renderLearn(language, resultFor('clear-spring'), { kind: 'topic', topic: 'app.lucky' })
    const lucky = getLearnCopy(language).visuals.lucky
    const family = document.querySelector<HTMLElement>('.learn-flow > li[data-step="family"]')!
    expect(family.querySelector('.learn-family')!.getAttribute('aria-hidden')).toBe('true')
    // No shade chip, no tone class and no inline colour: the step shows no particular family.
    expect(family.querySelector('.learn-tones, [class*="is-tone-"]')).toBeNull()
    for (const element of family.querySelectorAll('*')) expect(element.getAttribute('style') ?? '').toBe('')
    expect(family.querySelector('p')).toHaveTextContent(`${lucky.family} ${lucky.familyBody}`)
    // The shade step still shows how a family becomes one wearable shade.
    expect(document.querySelectorAll('.learn-flow > li[data-step="shade"] .learn-tones i')).toHaveLength(5)
  })

  it('the token is split evenly between at least six different hues', () => {
    const background = rules('.learn-family i').join(';').match(/conic-gradient\(([^;]*)\)/)![1]
    const hues = background.match(/#[0-9a-f]{6}/gi)!
    expect(new Set(hues.map((hue) => hue.toLowerCase())).size).toBeGreaterThanOrEqual(6)
    const stops = [...background.matchAll(/0 (\d+)deg/g)].map((match) => Number(match[1]))
    const spans = stops.map((stop, index) => stop - (stops[index - 1] ?? 0))
    expect(new Set(spans).size).toBe(1)
  })

  it('the family label is Daily’s own term, in both languages', () => {
    for (const language of languages) expect(getLearnCopy(language).visuals.lucky.family).toBe(getCopy(language).daily.familyLabel)
  })
})

describe('D. Thai type names wrap between their two parts only', () => {
  it.each(subtypeOrder)('%s: the card and page title keep each part whole, so they wrap only between the parts; text and name unchanged', (subtype) => {
    const copy = getCopy('th')
    const learn = getLearnCopy('th')
    const name = copy.subtypes[subtype].name
    const season = learn.seasons[seasonDefinitions[subtype].season].name
    renderLearn('th', resultFor(subtype), { kind: 'topic', topic: 'types.overview' })
    const card = document.querySelector<HTMLElement>(`.learn-type-card[data-learn-subtype="${subtype}"] h3 button`)!
    expect([...card.querySelectorAll('.learn-nobreak')].map((part) => part.textContent)).toEqual([name.slice(0, -season.length), season])
    expect(card.querySelectorAll('wbr')).toHaveLength(0)
    expect(card.textContent!.startsWith(name)).toBe(true)
    cleanup()
    renderLearn('th', resultFor(subtype), { kind: 'type', subtype })
    const title = document.querySelector('h1')!
    expect(title.textContent).toBe(name)
    expect(title.querySelectorAll('.learn-nobreak')).toHaveLength(2)
  })

  it('English names, which have a space, render untouched', () => {
    renderLearn('en', null, { kind: 'topic', topic: 'types.overview' })
    expect(document.querySelectorAll('.learn-type-grid wbr, .learn-type-grid .learn-nobreak')).toHaveLength(0)
  })

  it('in a card the "Your type" marker wraps as text instead of widening the card', () => {
    expect(rules('.learn-type-card .learn-your-type').join(';')).toMatch(/white-space:\s*normal/)
    expect(rules('.learn-nobreak').join(';')).toMatch(/white-space:\s*nowrap/)
  })
})

describe('E. Welcome and contextual links', () => {
  it('on phones the Daily and Guide links follow the quiz button in DOM order, not above the title', () => {
    const phone = block(/@media \(max-width: 760px\) \{\s*\.app-shell/)
    const order = (selector: string) => Number(phone.match(new RegExp(`${selector.replace(/\./g, '\\.')} \\{[^}]*order:\\s*(\\d+)`))![1])
    expect(order('.welcome .welcome-daily-link')).toBe(order('.welcome .primary-button'))
    expect(order('.welcome .welcome-learn-link')).toBe(order('.welcome .primary-button'))
    expect(appSource.indexOf('welcome-daily-link')).toBeLessThan(appSource.indexOf('welcome-learn-link'))
    expect(appSource.indexOf('className="primary-button" type="button" onClick={onStart}')).toBeLessThan(appSource.indexOf('welcome-daily-link'))
  })

  it('the three links into Learn use the season’s darker ink (4.5:1 on the page in every season)', () => {
    expect(rules('.result-learn-link').join(';') + rules('.palette-learn-link').join(';') + rules('.checker-learn-link').join(';')).toMatch(/color:\s*var\(--accent-ink\)/)
  })
})

describe('F. Terminology stays the same across Learn and the app', () => {
  it.each(languages)('%s: Guide, Your type and the palette groups use one wording everywhere', (language) => {
    const copy = getCopy(language)
    const learn = getLearnCopy(language)
    expect(learn.home.profileHero.eyebrow).toBe(learn.typeDetail.yourType)
    expect(learn.reader.back).toContain(learn.home.title)
    expect(learn.visuals.placement.nearFace).toBe(learn.visuals.shift.nearFace)
    expect(copy.palette.learnCta).toContain(copy.palette.sections.harder.title)
    // Placement words match Daily's own story line.
    const shadeWord = language === 'en' ? 'shade' : 'เฉด'
    expect(copy.daily.storyShade.toLowerCase()).toContain(shadeWord)
    expect(learn.visuals.lucky.shade.toLowerCase()).toContain(shadeWord)
    if (language === 'th') {
      expect(copy.nav.learn).toBe('คู่มือ')
      expect(learn.home.title.startsWith(copy.nav.learn)).toBe(true)
      expect(copy.welcome.learnCta).toContain(learn.home.title)
      expect(copy.result.learnCta).toContain(learn.typeDetail.yourType)
      expect(copy.daily.storyShade).toContain(learn.visuals.lucky.place)
      expect(learn.typeDetail.qualitiesLabel).toBe('ลักษณะสี')
      expect(learn.typeDetail.formula.nearFace).toContain(copy.palette.sections.best.title)
      expect(learn.typeDetail.formula.base).toContain(copy.palette.sections.neutrals.title)
      expect(learn.typeDetail.formula.accent).toContain(copy.palette.sections.accents.title)
    }
  })

  it('Thai Learn copy uses colour words for colour (อ่อน/เข้ม), never light-level words (สว่าง/มืด)', () => {
    const th = getLearnCopy('th')
    const list = th.topics['basics.dimensions'].why.find((entry) => entry.kind === 'list')
    expect(list && list.kind === 'list' ? list.items.join(' ') : '').not.toMatch(/สว่าง|มืด/)
  })
})
