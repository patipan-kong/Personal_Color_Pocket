import { cleanup, render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adaptLuckyColorToSubtype } from '../domain/luckyColor/adaptation'
import { getLuckyColorRule } from '../domain/luckyColor/luckyColor'
import { recommendLuckyGoalsOutfit } from '../domain/luckyColor/outfit'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import { LUCKY_GOALS, LUCKY_WEEKDAYS } from '../domain/luckyColor/types'
import type { LuckyGoal, LuckyWeekday } from '../domain/luckyColor/types'
import { getCopy } from '../i18n'
import { DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY } from '../services/dailyLuckyColorGoal'
import { DailyView } from './DailyView'
import { LUCKY_FAMILY_DISPLAY_SWATCHES } from './presentation'

// Sunday 20 Sep 2026 plus the weekday index gives a local date on that weekday.
const dateFor = (weekday: LuckyWeekday) => new Date(2026, 8, 20 + LUCKY_WEEKDAYS.indexOf(weekday), 10, 0, 0)
const profile = (subtype: Subtype): PersonalColorResult => ({ season: subtype.split('-')[1] as PersonalColorResult['season'], subtype, dimensions: { temperature: 0, value: 0, chroma: 0, contrast: 0 }, confidence: .8, confidenceLabel: 'Likely match', reasons: [], alternatives: [] })
const pairs = <T,>(items: readonly T[]) => items.flatMap((item, index) => items.slice(index + 1).map((other) => [item, other] as const))

function show(weekday: LuckyWeekday, goals: readonly LuckyGoal[], subtype?: Subtype, language: 'en' | 'th' = 'en') {
  localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(goals))
  const rendered = render(<DailyView copy={getCopy(language)} result={subtype ? profile(subtype) : null} onQuiz={vi.fn()} clock={() => dateFor(weekday)} />)
  const board = rendered.container.querySelector<HTMLElement>('.daily-board')!
  const items = [...board.querySelectorAll<HTMLElement>(':scope > li')]
  const fillOf = (key: string) => board.querySelector(`[data-piece-key="${key}"] svg path`)!.getAttribute('fill')
  return { ...rendered, board, items, fillOf }
}

describe('V1.3 Slice 5 garment board rendering', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('renders every recommendation piece in reading order, marking only lucky pieces', () => {
    const recommendation = recommendLuckyGoalsOutfit({ rules: [getLuckyColorRule('sun', 'work'), getLuckyColorRule('sun', 'money')], subtype: 'warm-spring' })
    const { items } = show('sun', ['work', 'money'], 'warm-spring')
    expect(items.map((item) => item.dataset.pieceKey)).toEqual(recommendation.pieces.map((piece) => piece.slot ? `${piece.role}-${piece.slot}` : piece.role))
    for (const [index, piece] of recommendation.pieces.entries()) {
      const item = items[index]
      const lucky = piece.colorRole === 'lucky'
      expect(item.classList.contains('is-lucky')).toBe(lucky)
      expect(item.querySelector('.daily-lucky-badge') !== null).toBe(lucky)
      expect(item.querySelector('.daily-garment-mark') !== null).toBe(lucky)
      expect(item.querySelector('.daily-supporting-label') !== null).toBe(!lucky)
    }
    expect(within(items[0]).getByText('Personal Color')).toBeInTheDocument()
    expect(within(items[1]).getByText(/Lucky color · Work/)).toBeInTheDocument()
    expect(within(items[3]).getByText(/Lucky color · Money/)).toBeInTheDocument()
  })

  it('paints the exact personalized and supporting HEX, and never prints a HEX', () => {
    const recommendation = recommendLuckyGoalsOutfit({ rules: [getLuckyColorRule('mon', 'work')], subtype: 'warm-spring' })
    const { fillOf, container } = show('mon', ['work'], 'warm-spring')
    expect(fillOf('top')).toBe(adaptLuckyColorToSubtype('green', 'warm-spring').selectedColor!.hex)
    for (const piece of recommendation.pieces) if (piece.color.kind === 'palette') expect(fillOf(piece.role)).toBe(piece.color.hex)
    expect(container.querySelector('.daily-family-dot')).toHaveStyle({ background: adaptLuckyColorToSubtype('green', 'warm-spring').selectedColor!.hex })
    expect(container.querySelector('.daily-page')!.textContent).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })

  it('shows an accessory fallback as the broad family, honestly, with the accent message', () => {
    const { fillOf, container, items } = show('mon', ['luck'], 'soft-autumn')
    const accessory = items.find((item) => item.dataset.pieceKey === 'accessory')!
    expect(accessory).toHaveAttribute('data-fill-kind', 'family-token')
    expect(fillOf('accessory')).toBe(LUCKY_FAMILY_DISPLAY_SWATCHES.purple)
    expect(within(accessory).getByText('Purple', { selector: '.daily-piece-color' })).toBeInTheDocument()
    expect(container.querySelector('.daily-family-claim')).toHaveAttribute('data-exact', 'false')
    expect(container.querySelector('.daily-family-dot.is-broad')).toBeTruthy()
    expect(within(container).getByText('Lucky color family')).toBeInTheDocument()
    expect(within(container).queryByText('Your shade')).not.toBeInTheDocument()
    expect(container.querySelector('.daily-placement-note')).toHaveTextContent(/Purple.*small accessory/)
  })

  it('shows two lucky claims equally, with no goal priority', () => {
    const { items, container } = show('mon', ['money', 'luck'], 'soft-autumn')
    const lucky = items.filter((item) => item.classList.contains('is-lucky'))
    expect(lucky.map((item) => item.dataset.pieceKey)).toEqual(['accessory-1', 'accessory-2'])
    expect(lucky.map((item) => item.className)).toEqual(['daily-piece is-accessory is-lucky', 'daily-piece is-accessory is-lucky'])
    expect(lucky.map((item) => item.querySelector('.daily-lucky-badge')!.textContent)).toEqual(['✦ Lucky color · Luck & opportunity', '✦ Lucky color · Money'])
    expect(container.querySelector('.daily-board')).toHaveAttribute('data-accessory-count', '2')
    expect(container.textContent).not.toMatch(/primary|secondary|#\s?1|#\s?2|first goal|second goal/i)
  })

  it('changes only labels when the locale changes', () => {
    const { board, rerender, container } = show('mon', ['work', 'money'], 'warm-spring')
    const snapshot = () => [...board.querySelectorAll<HTMLElement>(':scope > li')].map((item) => [item.dataset.pieceKey, item.className, item.dataset.fillKind, item.dataset.luckyFamily, item.querySelector('path')!.getAttribute('fill')])
    const english = snapshot()
    expect(within(board).getAllByText('Top')).toHaveLength(1)
    rerender(<DailyView copy={getCopy('th')} result={profile('warm-spring')} onQuiz={vi.fn()} clock={() => dateFor('mon')} />)
    const thaiBoard = container.querySelector<HTMLElement>('.daily-board')!
    expect([...thaiBoard.querySelectorAll<HTMLElement>(':scope > li')].map((item) => [item.dataset.pieceKey, item.className, item.dataset.fillKind, item.dataset.luckyFamily, item.querySelector('path')!.getAttribute('fill')])).toEqual(english)
    expect(within(thaiBoard).getByText('เสื้อท่อนบน')).toBeInTheDocument()
    expect(within(thaiBoard).getByText(/สีมงคล · งาน/)).toBeInTheDocument()
    expect(within(container).getByText('Personal Color ช่วยเลือก “เฉดและตำแหน่ง”')).toBeInTheDocument()
  })

  it('shows general mode with tokens only and a non-blocking quiz CTA after the board', () => {
    const { items, container } = show('thu', ['work', 'money'])
    expect(items.map((item) => item.dataset.fillKind)).toEqual(['family-token', 'family-token', 'neutral-token'])
    expect(container.querySelectorAll('.daily-family-dot.is-broad')).toHaveLength(2)
    expect(container.querySelector('.daily-story')).toBeNull()
    expect(container.querySelector('.daily-outfit .daily-general button')).toHaveTextContent('Find your Personal Color')
  })

  it('draws each role with its own silhouette in its own board area', () => {
    const silhouettes = { top: '0 0 160 150', bottom: '0 0 120 170', shoes: '0 0 150 72', accessory: '0 0 110 110' }
    const { items } = show('sun', ['work', 'money'], 'warm-spring')
    expect(items.map((item) => [item.dataset.pieceKey, item.querySelector('svg')!.getAttribute('viewBox'), item.style.gridArea])).toEqual([
      ['top', silhouettes.top, 'top'], ['bottom', silhouettes.bottom, 'bottom'], ['shoes', silhouettes.shoes, 'shoes'], ['accessory-1', silhouettes.accessory, 'acc1'],
    ])
  })

  it('marks light and dark garments for outline treatment', () => {
    expect(show('thu', ['money'], 'light-spring').items[0]).toHaveAttribute('data-tone', 'light')
    cleanup()
    const dark = show('sat', ['money'], 'deep-winter')
    expect(dark.items[0]).toHaveAttribute('data-tone', 'dark')
    expect(dark.items.find((item) => item.dataset.pieceKey === 'shoes')).toHaveAttribute('data-tone', 'light')
  })

  it('keeps the board decorative art out of the accessibility tree and the tab order', () => {
    const { board, container } = show('mon', ['money', 'luck'], 'soft-autumn')
    expect(board.tagName).toBe('UL')
    expect(board).toHaveAttribute('aria-label', 'Outfit pieces')
    for (const svg of board.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('focusable', 'false')
    }
    for (const mark of board.querySelectorAll('.daily-garment-mark')) expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(board.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0)
    expect(container.querySelectorAll('.daily-goal-grid button[aria-pressed]')).toHaveLength(4)
    expect(within(board).getAllByRole('listitem')).toHaveLength(5)
    expect(within(board).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Top', 'Bottom', 'Shoes', 'Accessory', 'Accessory'])
  })

  it('never leaks raw domain identifiers into visible copy for any recommendation shape', () => {
    const representatives = new Map<string, [LuckyWeekday, readonly LuckyGoal[], Subtype | undefined]>()
    const selections = [...LUCKY_GOALS.map((goal) => [goal] as const), ...pairs(LUCKY_GOALS)]
    for (const weekday of LUCKY_WEEKDAYS) for (const goals of selections) for (const subtype of [undefined, ...subtypeOrder] as const) {
      const recommendation = recommendLuckyGoalsOutfit({ rules: goals.map((goal) => getLuckyColorRule(weekday, goal)), subtype })
      const shape = recommendation.pieces.map((piece) => `${piece.role}${piece.slot ?? ''}:${piece.colorRole}:${piece.color.kind}`).join(' ') + recommendation.luckyClaims.map((claim) => claim.placement).join()
      if (!representatives.has(shape)) representatives.set(shape, [weekday, goals, subtype])
    }
    expect(representatives.size).toBeGreaterThanOrEqual(12)
    const raw = /near-face|main-piece|below-face|supporting-|lucky-family|light-neutral|family-token|neutral-token|mentor-support|lucky-(top|main|bottom|accessory)|accessory-\d|\bundefined\b|\bnull\b|NaN|#[0-9a-f]{6}/i
    for (const [weekday, goals, subtype] of representatives.values()) for (const language of ['en', 'th'] as const) {
      const { container } = show(weekday, goals, subtype, language)
      expect(container.querySelector('.daily-page')!.textContent).not.toMatch(raw)
      cleanup()
      localStorage.clear()
    }
  })
})
