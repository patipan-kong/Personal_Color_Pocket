import { Profiler } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLuckyColorForDate, getLuckyColorRule } from '../domain/luckyColor/luckyColor'
import { recommendLuckyGoalsOutfit } from '../domain/luckyColor/outfit'
import type { LuckyGoalsOutfitRecommendation } from '../domain/luckyColor/outfit'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import { LUCKY_GOALS, LUCKY_WEEKDAYS } from '../domain/luckyColor/types'
import type { LuckyGoal, LuckyWeekday } from '../domain/luckyColor/types'
import { getCopy } from '../i18n'
import { DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY } from '../services/dailyLuckyColorGoal'
import css from '../styles.css?raw'
import { DailyView } from './DailyView'

// V1.3 Slice 6: edge cases, lifecycle and accessibility of the Daily view. The recommendation is the
// real domain output except in the one test that proves an inconsistent recommendation is refused.
vi.mock('../domain/luckyColor/outfit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/luckyColor/outfit')>()
  return { ...actual, recommendLuckyGoalsOutfit: vi.fn(actual.recommendLuckyGoalsOutfit) }
})

const dateFor = (weekday: LuckyWeekday, hour = 10) => new Date(2026, 8, 20 + LUCKY_WEEKDAYS.indexOf(weekday), hour, 0, 0)
const monday = dateFor('mon')
const profile = (subtype: Subtype): PersonalColorResult => ({ season: subtype.split('-')[1] as PersonalColorResult['season'], subtype, dimensions: { temperature: 0, value: 0, chroma: 0, contrast: 0 }, confidence: .8, confidenceLabel: 'Likely match', reasons: [], alternatives: [] })
const en = getCopy('en')
const th = getCopy('th')

const pressed = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-daily-goal][aria-pressed="true"]')].map((button) => button.dataset.dailyGoal)
const summaryFamilies = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.daily-family-claim')].map((claim) => claim.dataset.luckyFamily).sort()
const boardFamilies = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.daily-piece.is-lucky')].map((piece) => piece.dataset.luckyFamily).sort()
const expectedFamilies = (date: Date, goals: readonly LuckyGoal[]) => [...new Set(goals.map((goal) => getLuckyColorForDate(date, goal).colorFamilies[0]))].sort()
// What assistive technology reads for an element: its text without aria-hidden decoration.
function spokenText(element: Element) {
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
  return clone.textContent!.replace(/\s+/g, ' ').trim()
}
function mediaBlock(query: string) {
  const start = css.indexOf(query)
  expect(start).toBeGreaterThan(-1)
  let depth = 0
  for (let index = css.indexOf('{', start); index < css.length; index++) {
    if (css[index] === '{') depth++
    if (css[index] === '}' && --depth === 0) return css.slice(start, index + 1)
  }
  throw new Error('unclosed block')
}

describe('V1.3 Slice 6 Daily copy', () => {
  it('has complete, non-empty Thai and English Daily copy with the same keys', () => {
    const flatten = (value: unknown, path = ''): [string, unknown][] => typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, item]) => flatten(item, `${path}.${key}`))
      : [[path, value]]
    const thai = flatten(th.daily)
    const english = flatten(en.daily)
    expect(thai.map(([key]) => key)).toEqual(english.map(([key]) => key))
    for (const [key, value] of [...thai, ...english]) {
      const text = typeof value === 'function' ? (value as (arg: unknown) => string)(key.includes('Eyebrow') ? 2 : 'Soft Autumn') : value
      // The Thai sentence end is intentionally empty; everything else is real copy.
      if (key === '.sourceEnd') continue
      expect(typeof text === 'string' && text.trim().length > 0, key).toBe(true)
    }
    expect(Object.keys(th.daily.goals)).toEqual([...LUCKY_GOALS])
    expect(en.daily.resultEyebrow(1)).toBe("Today's color")
    expect(en.daily.resultEyebrow(2)).toBe("Today's colors")
  })

  it('keeps Thai copy Thai: no full stops, no stray English beyond the product terms', () => {
    const allowedLatin = /Personal Color|KTC/g
    const thaiStrings = [
      ...Object.values(th.daily.placementNotes), th.daily.framing, th.daily.generalNote, th.daily.aboutBody, th.daily.storyFamily, th.daily.storyShade,
      th.daily.dateError, th.daily.resultError, th.daily.personalSupport, th.daily.neutralSupport, ...Object.values(th.daily.goals), ...Object.values(th.daily.pieceLabels),
    ]
    for (const text of thaiStrings) {
      expect(text, text).not.toMatch(/\.$/)
      expect(text.replace(allowedLatin, ''), text).not.toMatch(/[A-Za-z]/)
    }
  })
})

describe('V1.3 Slice 6 Daily robustness', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

  it('stays usable when reading the saved goals throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    const { container } = render(<DailyView copy={en} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    expect(pressed(container)).toEqual(['work'])
    expect(container.querySelector('.daily-board')).toBeTruthy()
    expect(container.textContent).not.toMatch(/SecurityError|blocked/)
  })

  it('keeps the in-memory selection when saving fails, without reverting or a blocking message', () => {
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    const { container } = render(<DailyView copy={en} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    fireEvent.click(screen.getByRole('button', { name: 'Money' }))
    expect(save).toHaveBeenCalled()
    expect(pressed(container)).toEqual(['work', 'money'])
    expect(boardFamilies(container)).toEqual(expectedFamilies(monday, ['work', 'money']))
    fireEvent.click(screen.getByRole('button', { name: 'Mentor support' }))
    expect(pressed(container)).toEqual(['money', 'mentor-support'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/QuotaExceeded|full/)
  })

  it('sanitizes malformed and legacy saved goals before rendering', () => {
    const cases: [string, LuckyGoal[]][] = [['{not json', ['work']], ['luck', ['luck']], ['"money"', ['money']], ['42', ['work']], ['null', ['work']], ['{"goal":"luck"}', ['work']], ['["love","luck","luck"]', ['luck']], ['[]', ['work']]]
    for (const [raw, goals] of cases) {
      localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, raw)
      const { container, unmount } = render(<DailyView copy={en} result={null} onQuiz={vi.fn()} clock={() => monday} />)
      expect(pressed(container), raw).toEqual(goals)
      expect(boardFamilies(container), raw).toEqual(expectedFamilies(monday, goals))
      unmount()
    }
  })

  it('shows honest general mode for a missing, partial or stale profile, and drops a removed profile at once', () => {
    const partial = { ...profile('warm-spring'), subtype: undefined } as unknown as PersonalColorResult
    for (const result of [null, partial, { ...profile('warm-spring'), subtype: 'spring-classic' as Subtype }]) {
      const { container, unmount } = render(<DailyView copy={en} result={result} onQuiz={vi.fn()} clock={() => monday} />)
      expect(container.querySelector('[data-daily-mode="general"]')).toBeTruthy()
      expect(screen.queryByText('Your shade')).not.toBeInTheDocument()
      unmount()
    }
    const rendered = render(<DailyView copy={en} result={profile('warm-spring')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(rendered.container.querySelector('[data-daily-mode="personalized"]')).toBeTruthy()
    rendered.rerender(<DailyView copy={en} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    expect(rendered.container.querySelector('[data-daily-mode="general"]')).toBeTruthy()
    expect(rendered.container.querySelector('[data-fill-kind="exact"]')).toBeNull()
    expect(rendered.container.textContent).not.toMatch(/Your shade|From your Personal Color|Warm Spring/)
  })

  it('refuses an inconsistent recommendation honestly instead of fabricating a piece', async () => {
    const actual = await vi.importActual<typeof import('../domain/luckyColor/outfit')>('../domain/luckyColor/outfit')
    vi.mocked(recommendLuckyGoalsOutfit).mockImplementation((input) => {
      const real = actual.recommendLuckyGoalsOutfit(input)
      return { ...real, luckyClaims: [] } as LuckyGoalsOutfitRecommendation
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<DailyView copy={en} result={profile('warm-spring')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(screen.getByRole('alert')).toHaveTextContent(en.daily.resultError)
    expect(screen.queryByText(en.daily.dateError)).not.toBeInTheDocument()
    expect(container.querySelector('.daily-board, .daily-piece, .daily-family-claim')).toBeNull()
    vi.mocked(recommendLuckyGoalsOutfit).mockImplementation(actual.recommendLuckyGoalsOutfit)
  })

  it('recovers from an unreadable date without guessing a weekday', () => {
    let now = new Date(Number.NaN)
    const { container } = render(<DailyView copy={th} result={null} onQuiz={vi.fn()} clock={() => now} />)
    expect(screen.getByRole('alert')).toHaveTextContent(th.daily.dateError)
    expect(container.querySelector('.daily-board')).toBeNull()
    expect(container.textContent).not.toMatch(new RegExp(Object.values(th.daily.weekdays).join('|')))
    now = monday
    fireEvent.click(screen.getByRole('button', { name: th.daily.retry }))
    expect(container.querySelector('.daily-weekday')).toHaveTextContent(th.daily.weekdays.mon)
  })
})

// Pending clock timers (the Daily view's are at least a second); React's own scheduling is ignored.
const clockTimers = new Set<number>()
function trackClockTimers() {
  clockTimers.clear()
  const set = window.setTimeout.bind(window)
  const clear = window.clearTimeout.bind(window)
  vi.spyOn(window, 'setTimeout').mockImplementation(((handler: () => void, delay?: number) => {
    if ((delay ?? 0) < 1_000) return set(handler, delay)
    const id: number = set(() => { clockTimers.delete(id); handler() }, delay)
    clockTimers.add(id)
    return id
  }) as typeof window.setTimeout)
  vi.spyOn(window, 'clearTimeout').mockImplementation((id?: number) => { clockTimers.delete(id!); clear(id) })
}

describe('V1.3 Slice 6 Daily date lifecycle', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }); trackClockTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('rolls over at local midnight with both goals, the profile and the language kept, and one timer throughout', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 23, 59, 30))
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(['work', 'money']))
    const { container, unmount } = render(<DailyView copy={th} result={profile('soft-autumn')} onQuiz={vi.fn()} />)
    expect(container.querySelector('.daily-weekday')).toHaveTextContent(th.daily.weekdays.mon)
    expect(clockTimers.size).toBe(1)
    act(() => { vi.advanceTimersByTime(31_000) })
    const tuesday = dateFor('tue')
    expect(container.querySelector('.daily-weekday')).toHaveTextContent(th.daily.weekdays.tue)
    expect(pressed(container)).toEqual(['work', 'money'])
    expect(summaryFamilies(container)).toEqual(expectedFamilies(tuesday, ['work', 'money']))
    expect(boardFamilies(container)).toEqual(summaryFamilies(container))
    expect(container.querySelector('[data-daily-mode="personalized"]')).toBeTruthy()
    expect(container.querySelector('.daily-kicker')).toHaveTextContent(th.daily.resultEyebrow(2))
    expect(clockTimers.size).toBe(1)
    unmount()
    expect(clockTimers.size).toBe(0)
  })

  it('does not re-render or add timers when focus returns on the same day, but catches a day change', () => {
    vi.setSystemTime(monday)
    let commits = 0
    const { container } = render(<Profiler id="daily" onRender={() => { commits++ }}><DailyView copy={en} result={null} onQuiz={vi.fn()} /></Profiler>)
    const board = container.querySelector('.daily-board')
    commits = 0
    for (let index = 0; index < 5; index++) { fireEvent.focus(window); fireEvent(document, new Event('visibilitychange')) }
    expect(commits).toBe(0)
    expect(clockTimers.size).toBe(1)
    expect(container.querySelector('.daily-board')).toBe(board)
    vi.setSystemTime(dateFor('wed', 8))
    fireEvent.focus(window)
    expect(container.querySelector('.daily-weekday')).toHaveTextContent('Wednesday')
    expect(clockTimers.size).toBe(1)
  })

  it('keeps one timer across goal, language and profile changes', () => {
    vi.setSystemTime(monday)
    const rendered = render(<DailyView copy={en} result={null} onQuiz={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Money' }))
    rendered.rerender(<DailyView copy={th} result={profile('warm-spring')} onQuiz={vi.fn()} />)
    rendered.rerender(<DailyView copy={en} result={null} onQuiz={vi.fn()} />)
    expect(clockTimers.size).toBe(1)
  })
})

describe('V1.3 Slice 6 Daily interaction and accessibility', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('keeps summary, board and notes on one recommendation through rapid goal and language changes', () => {
    const rendered = render(<DailyView copy={en} result={profile('soft-summer')} onQuiz={vi.fn()} clock={() => monday} />)
    const history: LuckyGoal[] = ['work']
    const sequence: LuckyGoal[] = ['money', 'luck', 'mentor-support', 'work', 'luck', 'money', 'mentor-support', 'luck', 'work', 'money']
    sequence.forEach((goal, index) => {
      const copy = index % 3 === 0 ? th : en
      rendered.rerender(<DailyView copy={copy} result={profile('soft-summer')} onQuiz={vi.fn()} clock={() => monday} />)
      fireEvent.click(rendered.container.querySelector(`[data-daily-goal="${goal}"]`)!)
      if (history.includes(goal)) { if (history.length === 2) history.splice(history.indexOf(goal), 1) } else { history.push(goal); if (history.length > 2) history.shift() }
      const { container } = rendered
      expect(pressed(container).sort()).toEqual([...history].sort())
      expect(summaryFamilies(container)).toEqual(expectedFamilies(monday, history))
      expect(boardFamilies(container)).toEqual(summaryFamilies(container))
      const claimed = [...container.querySelectorAll('.daily-piece.is-lucky')].map((piece) => piece.getAttribute('data-lucky-family'))
      expect(new Set(claimed).size).toBe(claimed.length)
    })
  })

  it('renders the same recommendation in both languages', () => {
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(['luck', 'money']))
    const shape = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.daily-piece')].map((piece) => `${piece.dataset.pieceKey}:${piece.dataset.luckyFamily ?? '-'}:${piece.querySelector('svg path')!.getAttribute('fill')}`)
    const rendered = render(<DailyView copy={en} result={profile('soft-autumn')} onQuiz={vi.fn()} clock={() => monday} />)
    const english = shape(rendered.container)
    rendered.rerender(<DailyView copy={th} result={profile('soft-autumn')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(shape(rendered.container)).toEqual(english)
  })

  it('reads each dual lucky piece with its own goal, and never announces a supporting piece as lucky', () => {
    for (const subtype of [undefined, ...subtypeOrder]) {
      localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(['work', 'money']))
      const { container, unmount } = render(<DailyView copy={en} result={subtype ? profile(subtype) : null} onQuiz={vi.fn()} clock={() => dateFor('sun')} />)
      const board = container.querySelector('.daily-board')!
      expect(board).toHaveAttribute('aria-label', en.daily.boardLabel)
      const spoken = [...board.querySelectorAll(':scope > li')].map(spokenText)
      const lucky = [...board.querySelectorAll(':scope > li.is-lucky')].map(spokenText)
      const supporting = [...board.querySelectorAll(':scope > li.is-support')].map(spokenText)
      expect(lucky.length + supporting.length).toBe(spoken.length)
      for (const text of lucky) expect(text).toContain(en.daily.luckyBadge)
      expect(lucky.some((text) => /Work/.test(text)) && lucky.some((text) => /Money/.test(text)), subtype).toBe(true)
      for (const text of supporting) {
        expect(text).not.toContain(en.daily.luckyBadge)
        expect(text).toMatch(new RegExp(`${en.daily.personalSupport}|${en.daily.neutralSupport}`))
      }
      expect(spoken.join(' ')).not.toMatch(/✦|#[0-9a-f]{6}|near-face|main-piece|below-face|mentor-support|\bnull\b|undefined/i)
      unmount()
    }
  })

  it('keeps visible and accessible Daily text free of raw identifiers and HEX, in both languages and error states', () => {
    const raw = /#[0-9a-f]{3,6}\b|\b(?:work|money|luck|mentor-support|near-face|main-piece|below-face|light-neutral|lucky-family|supporting-personal-color|palette|semantic|exact|family-token|neutral-token)\b|undefined|null|NaN|\[object/
    for (const copy of [en, th]) for (const weekday of LUCKY_WEEKDAYS) {
      localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(['luck', 'mentor-support']))
      const { container, unmount } = render(<DailyView copy={copy} result={profile('soft-autumn')} onQuiz={vi.fn()} clock={() => dateFor(weekday)} />)
      const labels = [...container.querySelectorAll('[aria-label], [title], [alt]')].map((node) => `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''} ${node.getAttribute('alt') ?? ''}`)
      expect(`${container.textContent} ${labels.join(' ')}`.replace(copy.daily.goals.work, '').replace(copy.daily.goals.money, '')).not.toMatch(raw)
      unmount()
    }
    const { container } = render(<DailyView copy={en} result={null} onQuiz={vi.fn()} clock={() => new Date('nope')} />)
    expect(container.textContent).not.toMatch(/Invalid Date|RangeError|NaN/)
  })

  it('moves arrow focus through the 2 × 2 goal grid without changing selection, and keeps focus on a replaced goal', () => {
    const { container } = render(<DailyView copy={en} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    const button = (goal: LuckyGoal) => container.querySelector<HTMLButtonElement>(`[data-daily-goal="${goal}"]`)!
    button('work').focus()
    fireEvent.keyDown(button('work'), { key: 'ArrowDown' })
    expect(button('luck')).toHaveFocus()
    fireEvent.keyDown(button('luck'), { key: 'ArrowRight' })
    expect(button('mentor-support')).toHaveFocus()
    fireEvent.keyDown(button('mentor-support'), { key: 'ArrowUp' })
    expect(button('money')).toHaveFocus()
    fireEvent.keyDown(button('money'), { key: 'Tab' })
    expect(pressed(container)).toEqual(['work'])
    fireEvent.click(button('money'))
    button('luck').focus()
    fireEvent.click(button('luck'))
    expect(button('luck')).toHaveFocus()
    expect(pressed(container)).toEqual(['money', 'luck'])
    for (const goal of LUCKY_GOALS) expect(button(goal).tagName).toBe('BUTTON')
  })

  it('uses a native disclosure whose source links say where they go and that they open a new tab', () => {
    const { container } = render(<DailyView copy={th} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    const details = container.querySelector('details.daily-sources')!
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(within(details as HTMLElement).getByText(th.daily.aboutHeading))
    const links = within(details as HTMLElement).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([`ไทยรัฐ ${th.daily.newTab}`, `KTC ${th.daily.newTab}`])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://www.thairath.co.th/horoscope/belief/2897832', 'https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable'])
    for (const link of links) { expect(link).toHaveAttribute('target', '_blank'); expect(link).toHaveAttribute('rel', 'noreferrer') }
    expect(details.textContent).not.toMatch(/https?:/)
  })
})

describe('V1.3 Slice 6 Daily styles', () => {
  it('turns off the board settle animation under reduced motion', () => {
    expect(mediaBlock('@media (prefers-reduced-motion: reduce)')).toMatch(/\.daily-board\s*\{\s*animation:\s*none;?\s*\}/)
  })

  it('re-flows the notes when text is large for the board instead of letting them float', () => {
    const flow = mediaBlock('@container daily-outfit ((width < 19em) or ((width >= 540px) and (width < 34em)))')
    expect(flow).toMatch(/\.daily-board\s*\{[^}]*height:\s*auto/)
    expect(flow).toMatch(/\.daily-garment-caption\s*\{[^}]*position:\s*static/)
    expect(css).not.toMatch(/\.daily-[a-z-]+[^{}]*\{[^}]*text-overflow:\s*ellipsis/)
  })

  it('gives light garments a firmer outline and dark garments light seams, without touching the fill', () => {
    const alpha = (selector: string, variable: string) => Number(new RegExp(`${selector.replace(/[[\]"]/g, '\\$&')} \\{[^}]*${variable}: rgba\\([^)]*,\\s*([.\\d]+)\\)`).exec(css)![1])
    expect(alpha('.daily-piece[data-tone="light"]', '--garment-line')).toBeGreaterThanOrEqual(.5)
    expect(css).toMatch(/\.daily-piece\[data-tone="dark"\] \{[^}]*--garment-seam: rgba\(255,255,255/)
    expect(css).not.toMatch(/\.daily-piece[^{]*\{[^}]*\bfill:/)
    expect(getLuckyColorRule('mon', 'work').colorFamilies).toEqual(['green'])
  })
})
