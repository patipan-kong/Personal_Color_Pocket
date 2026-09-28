import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import { getCopy } from '../i18n'
import { DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY, saveDailyLuckyColorGoals } from '../services/dailyLuckyColorGoal'
import { requestOwnedOutfitRecommendation } from '../services/ownedOutfitRecommendation'
import { requestInspirationOutfitRecommendation } from '../services/inspirationOutfitRecommendation'
import { saveWardrobe } from '../services/wardrobePersistence'
import * as fallbackDomain from '../domain/todayOutfitProduction/fallback'
import * as inspirationFallbackDomain from '../domain/todayOutfitProduction/inspirationFallback'
import { DailyView } from './DailyView'

vi.mock('../services/ownedOutfitRecommendation', () => ({ requestOwnedOutfitRecommendation: vi.fn() }))
vi.mock('../services/inspirationOutfitRecommendation', () => ({ requestInspirationOutfitRecommendation: vi.fn() }))

const monday = new Date(2026, 8, 21, 10)
const item = (id: string, garmentType: WardrobeRecordV1['garmentType'], hex: string, customName?: string): WardrobeRecordV1 => ({ id, garmentType, color: { hex }, formality: 'casual', ...(customName ? { customName } : {}) })
const separates = [item('top', 't-shirt', '#112233', 'My favorite top'), item('bottom', 'jeans', '#334455'), item('shoes', 'sneakers', '#FFFFFF')]
const aiResult = {
  selection: { kind: 'separates' as const, topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' },
  reasoning: { occasion: 'Works for a casual day.', personalColor: null, luckyColor: null },
}
const technicalResult = {
  ...aiResult,
  reasoning: {
    occasion: 'formality: smart-casual with formal-shoes',
    personalColor: 'warm-spring 0.92 (Great Match) (near-face)',
    luckyColor: 'priority = soft from family green',
  },
}
const inspirationResult = {
  outfit: {
    kind: 'separates' as const,
    top: { garmentType: 'shirt' as const, color: { kind: 'generic' as const, colorId: 'beige' as const } },
    bottom: { garmentType: 'chinos' as const, color: { kind: 'generic' as const, colorId: 'navy' as const } },
    outerwear: null,
    shoes: { garmentType: 'loafers' as const, color: { kind: 'generic' as const, colorId: 'brown' as const } },
  },
}
const profile = (subtype: Subtype): PersonalColorResult => ({ season: subtype.split('-')[1] as PersonalColorResult['season'], subtype, dimensions: { temperature: 0, value: 0, chroma: 0, contrast: 0 }, confidence: .8, confidenceLabel: 'Likely match', reasons: [], alternatives: [] })
const renderToday = (language: 'en' | 'th' = 'en', result: PersonalColorResult | null = null) => render(<DailyView copy={getCopy(language)} result={result} onQuiz={vi.fn()} onWardrobe={vi.fn()} clock={() => monday} />)
const expectNoLegacyLuckyAnswer = (container: HTMLElement) => {
  expect(container.querySelector('.daily-board')).toBeNull()
  expect(container.querySelector('.daily-empty-result')).toBeNull()
  expect(container.querySelector('.daily-family-claim')).toBeNull()
}

describe('Today owned-wardrobe recommendation UI', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(requestOwnedOutfitRecommendation).mockReset()
    vi.mocked(requestInspirationOutfitRecommendation).mockReset()
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: false, error: { kind: 'provider-error', message: 'safe' } })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('shows the real CTA, allows Lucky zero, and calls production only after the explicit click', async () => {
    saveWardrobe(separates)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: aiResult })
    const user = userEvent.setup()
    renderToday()
    const build = screen.getByRole('button', { name: "Build Today's Look ✨" })
    expect(build).toBeEnabled()
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
    await user.click(screen.getByRole('radio', { name: 'Date' }))
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
    await user.click(build)
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
    expect(vi.mocked(requestOwnedOutfitRecommendation).mock.calls[0][0].luckyPreferences).toEqual([])
  })

  it('keeps inputs and the CTA stable through Lucky 0 → 1 → 2 → 1 → 0 without an automatic answer or provider call', async () => {
    const user = userEvent.setup()
    const { container } = renderToday()
    const build = screen.getByRole('button', { name: "Build Today's Look ✨" })
    const work = screen.getByRole('button', { name: 'Work' })
    const money = screen.getByRole('button', { name: 'Money' })
    const assertReady = () => {
      expectNoLegacyLuckyAnswer(container)
      expect(build).toBeEnabled()
      expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
      expect(requestInspirationOutfitRecommendation).not.toHaveBeenCalled()
    }

    assertReady()
    await user.click(work)
    assertReady()
    await user.click(money)
    assertReady()
    await waitFor(() => expect(localStorage.getItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY)).toContain('"money"'))
    await user.click(money)
    assertReady()
    await user.click(work)
    assertReady()
    await waitFor(() => expect(localStorage.getItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY)).toBe('{"version":2,"goals":[]}'))
  })

  it('disables incomplete Wardrobe with a specific missing-shoes explanation', async () => {
    saveWardrobe(separates.slice(0, 2))
    const user = userEvent.setup()
    renderToday()
    await user.click(screen.getByRole('radio', { name: /my wardrobe.*still needs shoes/i }))
    expect(screen.getByText(/add one pair of shoes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Build Today's Look ✨" })).toBeDisabled()
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
  })

  it('enables Inspiration with an empty or incomplete wardrobe and never calls the owned endpoint', async () => {
    const user = userEvent.setup()
    renderToday()
    expect(screen.getByRole('radio', { name: /new look ideas/i })).toBeChecked()
    const build = screen.getByRole('button', { name: "Build Today's Look ✨" })
    expect(build).toBeEnabled()
    await user.click(build)
    expect(requestInspirationOutfitRecommendation).toHaveBeenCalledOnce()
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()

    cleanup()
    saveWardrobe(separates.slice(0, 2))
    renderToday()
    await user.click(screen.getByRole('radio', { name: /new look ideas/i }))
    expect(screen.getByRole('button', { name: "Build Today's Look ✨" })).toBeEnabled()
  })

  it('prevents duplicate submit while loading', async () => {
    saveWardrobe(separates)
    let resolve!: (value: { ok: true; result: typeof aiResult }) => void
    vi.mocked(requestOwnedOutfitRecommendation).mockImplementation(() => new Promise((done) => { resolve = done }))
    const user = userEvent.setup()
    renderToday()
    const build = screen.getByRole('button', { name: "Build Today's Look ✨" })
    await user.dblClick(build)
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /building your look/i })).toBeDisabled()
    resolve({ ok: true, result: aiResult })
    expect(await screen.findByRole('heading', { name: /wear this today/i })).toBeInTheDocument()
  })

  it('renders app-owned names and HEX locally without internal IDs/provider metadata', async () => {
    saveWardrobe(separates)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: aiResult })
    const user = userEvent.setup()
    const { container } = renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByText('My favorite top')).toBeInTheDocument()
    expect(screen.getByText('#112233')).toBeInTheDocument()
    expect(screen.queryByText('top', { exact: true })).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent(/groq|qwen|provider|confidence|debug/i)
  })

  it('owns English AI reasoning presentation and suppresses provider debug vocabulary', async () => {
    saveWardrobe(separates)
    saveDailyLuckyColorGoals(['work'])
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: technicalResult })
    const user = userEvent.setup()
    const { container } = renderToday('en', profile('warm-spring'))
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(vi.mocked(requestOwnedOutfitRecommendation).mock.calls[0][0].subtype).toBe('warm-spring')
    const reasons = container.querySelector('.owned-outfit-reasons')
    expect(reasons).toHaveTextContent('For the occasion')
    expect(reasons).toHaveTextContent('Personal Color')
    expect(reasons).toHaveTextContent('Warm Spring')
    expect(reasons).toHaveTextContent('Lucky Color')
    expect(reasons).not.toHaveTextContent(/smart-casual|formal-shoes|warm-spring|0\.92|Great Match|\(near-face\)|priority = soft/i)
  })

  it('localizes Thai reasoning in the app and never renders provider prose verbatim', async () => {
    saveWardrobe(separates)
    saveDailyLuckyColorGoals(['work'])
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: technicalResult })
    const user = userEvent.setup()
    const { container } = renderToday('th', profile('warm-spring'))
    await user.click(screen.getByRole('button', { name: 'จัดลุควันนี้ ✨' }))
    const reasons = container.querySelector('.owned-outfit-reasons')
    expect(reasons).toHaveTextContent('เหมาะกับโอกาส')
    expect(reasons).toHaveTextContent('เหมาะกับวันสบาย ๆ')
    expect(reasons).toHaveTextContent('Warm Spring')
    expect(reasons).toHaveTextContent('สีมงคล')
    expect(reasons).not.toHaveTextContent(/smart-casual|formal-shoes|warm-spring|0\.92|Great Match|\(near-face\)|priority = soft/i)
  })

  it('omits Lucky and Personal Color sections when neither input exists', async () => {
    saveWardrobe(separates)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: technicalResult })
    const user = userEvent.setup()
    const { container } = renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    const reasons = container.querySelector('.owned-outfit-reasons')
    expect(reasons).toHaveTextContent('For the occasion')
    expect(reasons).not.toHaveTextContent('Personal Color')
    expect(reasons).not.toHaveTextContent('Lucky Color')
  })

  it('keeps an existing result and relocalizes it without another provider call', async () => {
    saveWardrobe(separates)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: technicalResult })
    const user = userEvent.setup()
    const view = renderToday('en', profile('warm-spring'))
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByRole('heading', { name: 'Wear this today' })).toBeInTheDocument()
    view.rerender(<DailyView copy={getCopy('th')} result={profile('warm-spring')} onQuiz={vi.fn()} onWardrobe={vi.fn()} clock={() => monday} />)
    expect(await screen.findByRole('heading', { name: 'วันนี้ใส่ชุดนี้ได้เลย' })).toBeInTheDocument()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
  })

  it('shows a useful deterministic fallback and hides the old competing outfit board', async () => {
    saveWardrobe(separates)
    saveDailyLuckyColorGoals(['work'])
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: false, error: { kind: 'provider-error', message: 'safe' } })
    const user = userEvent.setup()
    const { container } = renderToday()
    expectNoLegacyLuckyAnswer(container)
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByText(/reliable basic match/i)).toBeInTheDocument()
    expectNoLegacyLuckyAnswer(container)
  })

  it('clears an Owned result immediately on Lucky change, returns the CTA to ready, and sends Lucky facts only after explicit Generate', async () => {
    saveWardrobe(separates)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: aiResult })
    const user = userEvent.setup()
    const { container } = renderToday()
    const build = screen.getByRole('button', { name: "Build Today's Look ✨" })
    await user.click(build)
    expect(await screen.findByRole('heading', { name: /wear this today/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Work' }))
    expect(screen.queryByRole('heading', { name: /wear this today/i })).not.toBeInTheDocument()
    expectNoLegacyLuckyAnswer(container)
    expect(build).toBeEnabled()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()

    await user.click(build)
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledTimes(2)
    expect(vi.mocked(requestOwnedOutfitRecommendation).mock.calls[1][0].luckyPreferences).toHaveLength(1)
    expect(vi.mocked(requestOwnedOutfitRecommendation).mock.calls[1][0].luckyPreferences[0].priority).toBe('soft')
  })

  it('uses the same app-owned natural reasoning for deterministic fallback', async () => {
    saveWardrobe(separates)
    saveDailyLuckyColorGoals(['work'])
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: false, error: { kind: 'provider-error', message: 'safe' } })
    vi.spyOn(fallbackDomain, 'recommendOwnedOutfitFallback').mockReturnValueOnce(technicalResult)
    const user = userEvent.setup()
    const { container } = renderToday('en', profile('warm-spring'))
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByText(/reliable basic match/i)).toBeInTheDocument()
    const reasons = container.querySelector('.owned-outfit-reasons')
    expect(reasons).toHaveTextContent('Warm Spring')
    expect(reasons).toHaveTextContent('Lucky Color')
    expect(reasons).not.toHaveTextContent(/smart-casual|formal-shoes|warm-spring|0\.92|Great Match|\(near-face\)|priority = soft/i)
  })

  it('shows a Retry action only when both provider and safe fallback cannot produce a result', async () => {
    saveWardrobe(separates)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: false, error: { kind: 'provider-error', message: 'safe' } })
    vi.spyOn(fallbackDomain, 'recommendOwnedOutfitFallback').mockReturnValueOnce(null)
    const user = userEvent.setup()
    renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't build a complete outfit/i)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('clears a stale result after Lucky, occasion, or source changes', async () => {
    saveWardrobe(separates)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: aiResult })
    const user = userEvent.setup()
    renderToday()
    const generate = async () => {
      await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
      expect(await screen.findByRole('heading', { name: /wear this today/i })).toBeInTheDocument()
    }
    await generate()
    await user.click(screen.getByRole('radio', { name: 'Date' }))
    expect(screen.queryByRole('heading', { name: /wear this today/i })).not.toBeInTheDocument()
    await generate()
    await user.click(screen.getByRole('button', { name: 'Work' }))
    expect(screen.queryByRole('heading', { name: /wear this today/i })).not.toBeInTheDocument()
    await generate()
    await user.click(screen.getByRole('radio', { name: /new look ideas/i }))
    expect(screen.queryByRole('heading', { name: /wear this today/i })).not.toBeInTheDocument()
  })

  it('supports the one-piece-ready path and localizes the Thai CTA', async () => {
    saveWardrobe([item('dress', 'dress', '#884466'), item('shoes', 'heels', '#222222')])
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: { ...aiResult, selection: { kind: 'one-piece', onePieceId: 'dress', outerwearId: null, shoesId: 'shoes' } } })
    const user = userEvent.setup()
    renderToday('th')
    const build = screen.getByRole('button', { name: 'จัดลุควันนี้ ✨' })
    expect(build).toBeEnabled()
    await user.click(build)
    expect(await screen.findByRole('heading', { name: /วันนี้ใส่ชุดนี้ได้เลย/ })).toBeInTheDocument()
  })

  it('renders Inspiration as conceptual app-owned garment/color facts without ownership claims', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    const user = userEvent.setup()
    const { container } = renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
    expect(screen.getByText('Look idea')).toBeInTheDocument()
    expect(screen.getByText('shirt')).toBeInTheDocument()
    expect(screen.getByText('#D8BA91')).toBeInTheDocument()
    expect(screen.getByText(/not items from your saved wardrobe/i)).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/wardrobe-|groq|qwen|provider|colorId/i)
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
  })

  it('clears an Inspiration result immediately on Lucky change, returns the CTA to ready, and sends Lucky facts only after explicit Generate', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    const user = userEvent.setup()
    const { container } = renderToday()
    const build = screen.getByRole('button', { name: "Build Today's Look ✨" })
    await user.click(build)
    expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Work' }))
    expect(screen.queryByRole('heading', { name: 'Try this combination' })).not.toBeInTheDocument()
    expectNoLegacyLuckyAnswer(container)
    expect(build).toBeEnabled()
    expect(requestInspirationOutfitRecommendation).toHaveBeenCalledOnce()

    await user.click(build)
    expect(requestInspirationOutfitRecommendation).toHaveBeenCalledTimes(2)
    expect(vi.mocked(requestInspirationOutfitRecommendation).mock.calls[1][0].luckyPreferences).toHaveLength(1)
    expect(vi.mocked(requestInspirationOutfitRecommendation).mock.calls[1][0].luckyPreferences[0].priority).toBe('soft')
  })

  it('omits Lucky and Personal Color reasoning when Inspiration has neither input', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    const user = userEvent.setup()
    const { container } = renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    const reasons = container.querySelector('.owned-outfit-reasons')
    expect(reasons).toHaveTextContent('For the occasion')
    expect(reasons).not.toHaveTextContent('Personal Color')
    expect(reasons).not.toHaveTextContent('Lucky Color')
  })

  it('renders provider failure as a normal Inspiration fallback and total failure as Retry', async () => {
    const user = userEvent.setup()
    renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
    expect(screen.getByText(/reliable starting point/i)).toBeInTheDocument()

    cleanup()
    vi.spyOn(inspirationFallbackDomain, 'recommendInspirationOutfitFallback').mockReturnValueOnce(null)
    renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't build a complete outfit/i)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('prevents duplicate Inspiration submission while loading', async () => {
    let resolve!: (value: { ok: true; result: typeof inspirationResult }) => void
    vi.mocked(requestInspirationOutfitRecommendation).mockImplementation(() => new Promise((done) => { resolve = done }))
    const user = userEvent.setup()
    renderToday()
    const build = screen.getByRole('button', { name: "Build Today's Look ✨" })
    await user.dblClick(build)
    expect(requestInspirationOutfitRecommendation).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /building your look/i })).toBeDisabled()
    resolve({ ok: true, result: inspirationResult })
    expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
  })

  it('discards an in-flight Inspiration response after inputs change', async () => {
    let resolve!: (value: { ok: true; result: typeof inspirationResult }) => void
    vi.mocked(requestInspirationOutfitRecommendation).mockImplementation(() => new Promise((done) => { resolve = done }))
    const user = userEvent.setup()
    renderToday()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    await user.click(screen.getByRole('radio', { name: 'Date' }))
    resolve({ ok: true, result: inspirationResult })
    await waitFor(() => expect(screen.getByRole('button', { name: "Build Today's Look ✨" })).toBeEnabled())
    expect(screen.queryByRole('heading', { name: 'Try this combination' })).not.toBeInTheDocument()
  })

  it('clears Inspiration for relevant input changes but not a wardrobe mutation', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    const user = userEvent.setup()
    const view = renderToday()
    const generate = async () => {
      await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
      expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
    }
    await generate()
    saveWardrobe(separates)
    view.rerender(<DailyView copy={getCopy('en')} result={null} onQuiz={vi.fn()} onWardrobe={vi.fn()} clock={() => monday} />)
    expect(screen.getByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Date' }))
    expect(screen.queryByRole('heading', { name: 'Try this combination' })).not.toBeInTheDocument()
    await generate()
    await user.click(screen.getByRole('button', { name: 'Work' }))
    expect(screen.queryByRole('heading', { name: 'Try this combination' })).not.toBeInTheDocument()
    await generate()
    await user.click(screen.getByRole('radio', { name: /my wardrobe/i }))
    expect(screen.queryByRole('heading', { name: 'Try this combination' })).not.toBeInTheDocument()
  })

  it('relocalizes an Inspiration result without another provider call', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    const user = userEvent.setup()
    const view = renderToday('en', profile('warm-spring'))
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
    view.rerender(<DailyView copy={getCopy('th')} result={profile('warm-spring')} onQuiz={vi.fn()} onWardrobe={vi.fn()} clock={() => monday} />)
    expect(await screen.findByRole('heading', { name: 'ลองแต่งแบบนี้' })).toBeInTheDocument()
    expect(requestInspirationOutfitRecommendation).toHaveBeenCalledOnce()
  })
})
