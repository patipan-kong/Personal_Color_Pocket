import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import { getCopy } from '../i18n'
import { saveDailyLuckyColorGoals } from '../services/dailyLuckyColorGoal'
import { requestOwnedOutfitRecommendation } from '../services/ownedOutfitRecommendation'
import { saveWardrobe } from '../services/wardrobePersistence'
import * as fallbackDomain from '../domain/todayOutfitProduction/fallback'
import { DailyView } from './DailyView'

vi.mock('../services/ownedOutfitRecommendation', () => ({ requestOwnedOutfitRecommendation: vi.fn() }))

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
const profile = (subtype: Subtype): PersonalColorResult => ({ season: subtype.split('-')[1] as PersonalColorResult['season'], subtype, dimensions: { temperature: 0, value: 0, chroma: 0, contrast: 0 }, confidence: .8, confidenceLabel: 'Likely match', reasons: [], alternatives: [] })
const renderToday = (language: 'en' | 'th' = 'en', result: PersonalColorResult | null = null) => render(<DailyView copy={getCopy(language)} result={result} onQuiz={vi.fn()} onWardrobe={vi.fn()} clock={() => monday} />)

describe('Today owned-wardrobe recommendation UI', () => {
  beforeEach(() => { localStorage.clear(); vi.mocked(requestOwnedOutfitRecommendation).mockReset() })
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

  it('disables incomplete Wardrobe with a specific missing-shoes explanation', async () => {
    saveWardrobe(separates.slice(0, 2))
    const user = userEvent.setup()
    renderToday()
    await user.click(screen.getByRole('radio', { name: /my wardrobe.*still needs shoes/i }))
    expect(screen.getByText(/add one pair of shoes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Build Today's Look ✨" })).toBeDisabled()
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
  })

  it('keeps Inspiration transitional and never calls the owned endpoint', async () => {
    saveWardrobe(separates)
    const user = userEvent.setup()
    renderToday()
    await user.click(screen.getByRole('radio', { name: /new look ideas/i }))
    expect(screen.getByText(/new look ideas are coming soon/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Build Today's Look ✨" })).toBeDisabled()
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
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
    expect(container.querySelector('.daily-board')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: "Build Today's Look ✨" }))
    expect(await screen.findByText(/reliable basic match/i)).toBeInTheDocument()
    expect(container.querySelector('.daily-board')).toBeNull()
    expect(container.querySelector('.daily-lucky-support .daily-family-claim')).toBeTruthy()
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
})
