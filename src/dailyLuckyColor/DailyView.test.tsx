import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import { adaptLuckyColorToSubtype } from '../domain/luckyColor/adaptation'
import { getLuckyColorForDate } from '../domain/luckyColor/luckyColor'
import { getCopy } from '../i18n'
import { DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY } from '../services/dailyLuckyColorGoal'
import { DailyView } from './DailyView'
import { LUCKY_FAMILY_DISPLAY_SWATCHES } from './presentation'

const monday = new Date(2026, 8, 21, 10, 0, 0)
const profile = (subtype: Subtype): PersonalColorResult => ({ season: subtype.split('-')[1] as PersonalColorResult['season'], subtype, dimensions: { temperature: 0, value: 0, chroma: 0, contrast: 0 }, confidence: .8, confidenceLabel: 'Likely match', reasons: [], alternatives: [] })

describe('Daily lucky color UI', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('has exactly four multi-select goals, defaults to Work, and recomputes immediately', async () => {
    const user = userEvent.setup()
    const { container } = render(<DailyView copy={getCopy('en')} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    const goals = container.querySelectorAll('[data-daily-goal]')
    expect(goals).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Green' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Money' }))
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Money' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Orange' })).toBeInTheDocument()
    expect(localStorage.getItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY)).toBe('["work","money"]')
  })

  it('keeps the last goal selected, deselects from two to one, and replaces the oldest on a third click', async () => {
    const user = userEvent.setup()
    render(<DailyView copy={getCopy('en')} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    const work = screen.getByRole('button', { name: 'Work' })
    const money = screen.getByRole('button', { name: 'Money' })
    const luck = screen.getByRole('button', { name: 'Luck & opportunity' })
    await user.click(work)
    expect(work).toHaveAttribute('aria-pressed', 'true')
    await user.click(money)
    await user.click(luck)
    expect(work).toHaveAttribute('aria-pressed', 'false')
    expect(money).toHaveAttribute('aria-pressed', 'true')
    expect(luck).toHaveAttribute('aria-pressed', 'true')
    await user.click(money)
    expect(money).toHaveAttribute('aria-pressed', 'false')
    expect(luck).toHaveAttribute('aria-pressed', 'true')
    await user.click(luck)
    expect(luck).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows two equal lucky claims and two localized goal badges in general mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<DailyView copy={getCopy('en')} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    await user.click(screen.getByRole('button', { name: 'Money' }))
    expect(container.querySelector('[data-lucky-claim-count="2"]')).toBeTruthy()
    expect(container.querySelectorAll('.daily-family-claim')).toHaveLength(2)
    expect(container.querySelectorAll('.daily-piece.is-lucky')).toHaveLength(2)
    expect(screen.getByText('Work', { selector: '.daily-goal-provenance' })).toBeInTheDocument()
    expect(screen.getByText('Money', { selector: '.daily-goal-provenance' })).toBeInTheDocument()
    expect(screen.getByText(/Lucky color · Work/i)).toBeInTheDocument()
    expect(screen.getByText(/Lucky color · Money/i)).toBeInTheDocument()
    expect(container.querySelectorAll('.daily-goal-grid button.selected')).toHaveLength(2)
  })

  it('keeps both families personalized and retains semantic accessory fallback', () => {
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(['work', 'luck']))
    const { container } = render(<DailyView copy={getCopy('en')} result={profile('soft-autumn')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(container.querySelector('[data-daily-mode="personalized"]')).toBeTruthy()
    expect(container.querySelectorAll('.daily-family-claim')).toHaveLength(2)
    expect(container.querySelectorAll('.daily-piece.is-lucky')).toHaveLength(2)
    expect(container.querySelector('.daily-piece.is-lucky[data-color-kind="semantic"]')).toBeTruthy()
    expect(screen.getByText(/Lucky color · Work/i)).toBeInTheDocument()
    expect(screen.getByText(/Lucky color · Luck & opportunity/i)).toBeInTheDocument()
    expect(screen.getAllByText('Personalized expression')).toHaveLength(1)
  })

  it('preserves two canonical goals and both families across locale and profile changes', () => {
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(['work', 'money']))
    const rendered = render(<DailyView copy={getCopy('en')} result={profile('warm-spring')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(rendered.container.querySelector('[data-lucky-claim-count="2"]')).toBeTruthy()
    rendered.rerender(<DailyView copy={getCopy('th')} result={profile('soft-autumn')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(rendered.container.querySelector('[data-lucky-claim-count="2"]')).toBeTruthy()
    expect(rendered.container.querySelectorAll('.daily-goal-grid button[aria-pressed="true"]')).toHaveLength(2)
    expect(rendered.container.querySelectorAll('.daily-family-claim')).toHaveLength(2)
    expect(rendered.container.querySelector('.daily-weekday')).toHaveTextContent('วันนี้')
    expect(rendered.container.querySelector('.daily-family-heading h2')).toHaveTextContent(/เขียว|เหลือง/)
  })

  it('renders useful general guidance with a non-blocking quiz CTA and no fabricated palette shade', async () => {
    const onQuiz = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<DailyView copy={getCopy('en')} result={null} onQuiz={onQuiz} clock={() => monday} />)
    expect(container.querySelector('[data-daily-mode="general"]')).toBeTruthy()
    expect(screen.getByText(/personalization is not available/i)).toBeInTheDocument()
    expect(screen.getByText(/Thai lucky-color tradition/i)).toBeInTheDocument()
    expect(screen.queryByText('Personalized expression')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /find your personal color/i }))
    expect(onQuiz).toHaveBeenCalledOnce()
  })

  it('uses Slice 2’s structured name for a valid profile and visibly marks one lucky piece', () => {
    const rule = getLuckyColorForDate(monday, 'work')
    const expected = adaptLuckyColorToSubtype(rule.colorFamilies[0], 'warm-spring').selectedColor!
    const { container } = render(<DailyView copy={getCopy('en')} result={profile('warm-spring')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(container.querySelector('[data-daily-mode="personalized"]')).toBeTruthy()
    expect(container.querySelector('.daily-shade strong')).toHaveTextContent(expected.name.en)
    expect(container.querySelector('.daily-lucky-badge')).toHaveTextContent('Lucky color')
    expect(screen.queryByRole('button', { name: /find your personal color/i })).not.toBeInTheDocument()
  })

  it('represents an accessory fallback semantically without a fabricated personalized shade', () => {
    // Monday luck is purple; Soft Autumn has no honest curated purple candidate.
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, 'luck')
    render(<DailyView copy={getCopy('en')} result={profile('soft-autumn')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(screen.getByText(/small accessory/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Purple' })).toBeInTheDocument()
    expect(screen.queryByText('Personalized expression')).not.toBeInTheDocument()
    expect(document.querySelector('.daily-piece.is-lucky')).toHaveAttribute('data-color-kind', 'semantic')
  })

  it('falls back to general mode for an invalid persisted subtype', () => {
    render(<DailyView copy={getCopy('en')} result={{ ...profile('warm-spring'), subtype: 'not-a-subtype' as Subtype }} onQuiz={vi.fn()} clock={() => monday} />)
    expect(screen.getByText(/personalization is not available/i)).toBeInTheDocument()
  })

  it('recomputes from the current profile rather than retaining a stale subtype', () => {
    const clock = () => monday
    const rendered = render(<DailyView copy={getCopy('en')} result={profile('warm-spring')} onQuiz={vi.fn()} clock={clock} />)
    expect(rendered.container.querySelector('.daily-shade')).toHaveTextContent('Green')
    rendered.rerender(<DailyView copy={getCopy('en')} result={profile('soft-autumn')} onQuiz={vi.fn()} clock={clock} />)
    expect(rendered.container.querySelector('.daily-shade')).toHaveTextContent('Olive')
  })

  it('changes only copy across locales, preserves the canonical recommendation, and localizes Thai text', () => {
    const rendered = render(<DailyView copy={getCopy('en')} result={profile('warm-spring')} onQuiz={vi.fn()} clock={() => monday} />)
    const en = rendered.container.querySelector('.daily-family-heading h2')!.textContent
    rendered.rerender(<DailyView copy={getCopy('th')} result={profile('warm-spring')} onQuiz={vi.fn()} clock={() => monday} />)
    expect(en).toBe('Green')
    expect(rendered.container.querySelector('.daily-family-heading h2')).toHaveTextContent('เขียว')
    expect(rendered.container.querySelector('.daily-weekday')).toHaveTextContent('วันนี้')
  })

  it('refreshes a local day on focus while preserving the selected goal', async () => {
    const user = userEvent.setup()
    let now = monday
    render(<DailyView copy={getCopy('en')} result={null} onQuiz={vi.fn()} clock={() => now} />)
    await user.click(screen.getByRole('button', { name: 'Money' }))
    now = new Date(2026, 8, 22, 0, 2, 0)
    fireEvent.focus(window)
    expect(screen.getByRole('button', { name: 'Money' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Gray' })).toBeInTheDocument()
  })

  it('supports arrow-key goal navigation and exposes its source disclosure', async () => {
    const user = userEvent.setup()
    render(<DailyView copy={getCopy('en')} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    screen.getByRole('button', { name: 'Work' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Money' })).toHaveFocus()
    expect(screen.getByText(/about today's lucky colors/i)).toBeInTheDocument()
    await user.click(screen.getByText(/about today's lucky colors/i))
    expect(screen.getByRole('link', { name: 'Thai Rath' })).toHaveAttribute('href', expect.stringContaining('thairath.co.th'))
  })

  it('has a deterministic display swatch for every broad family', () => {
    expect(Object.keys(LUCKY_FAMILY_DISPLAY_SWATCHES)).toHaveLength(10)
    expect(LUCKY_FAMILY_DISPLAY_SWATCHES.green).toBe('#43845A')
  })
})
