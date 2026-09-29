import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { quizQuestions } from './domain/personalColor/quiz'
import { analyzeQuiz } from './domain/personalColor/scoring'
import { STORAGE_KEY } from './services/persistence'
import { LANGUAGE_STORAGE_KEY, colorDisplayName } from './i18n'
import { getPalette } from './domain/personalColor/palettes'
import { requestInspirationOutfitRecommendation } from './services/inspirationOutfitRecommendation'
import { requestOwnedOutfitRecommendation } from './services/ownedOutfitRecommendation'
import { requestOutfitPreview } from './services/outfitPreview'
import { saveWardrobe } from './services/wardrobePersistence'

vi.mock('./services/inspirationOutfitRecommendation', () => ({ requestInspirationOutfitRecommendation: vi.fn() }))
vi.mock('./services/ownedOutfitRecommendation', () => ({ requestOwnedOutfitRecommendation: vi.fn() }))
vi.mock('./services/outfitPreview', () => ({ requestOutfitPreview: vi.fn() }))

const inspirationResult = { outfit: { kind: 'separates' as const, top: { garmentType: 't-shirt' as const, color: { kind: 'generic' as const, colorId: 'beige' as const } }, bottom: { garmentType: 'jeans' as const, color: { kind: 'generic' as const, colorId: 'navy' as const } }, outerwear: null, shoes: { garmentType: 'sneakers' as const, color: { kind: 'generic' as const, colorId: 'white' as const } } } }

describe('primary product flow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(requestInspirationOutfitRecommendation).mockReset()
    vi.mocked(requestOwnedOutfitRecommendation).mockReset()
    vi.mocked(requestOutfitPreview).mockReset()
  })
  afterEach(cleanup)
  it('moves from welcome through result, palette, and checker', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    await user.click(screen.getByRole('button', { name: 'Women' }))
    for (let step = 0; step < quizQuestions.length; step += 1) {
      const answers = screen.getAllByRole('radio')
      await user.click(answers[0])
      await user.click(screen.getByRole('button', { name: step === quizQuestions.length - 1 ? /see my colors/i : /next/i }))
    }
    expect(await screen.findByText(/match$/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /explore my palette/i }))
    expect(screen.getByRole('heading', { name: 'My Palette' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /color checker/i }))
    expect(screen.getByRole('heading', { name: /does this color suit me/i })).toBeInTheDocument()
    const input = screen.getByLabelText(/or enter a hex value/i)
    await user.clear(input)
    await user.type(input, 'D98463')
    await user.click(screen.getByRole('button', { name: 'Check' }))
    // Slice 5d: the verdict, not a percentage, answers the question.
    expect(screen.getByRole('status')).toHaveTextContent('#D98463')
    expect(document.querySelector('.check-verdict')!.textContent!.length).toBeGreaterThan(10)
    expect(document.body.textContent).not.toMatch(/palette fit|\d+%/)
  }, 10_000)

  it('offers the Daily lucky-color experience from welcome without requiring a quiz profile', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /today's lucky color/i }))
    expect(screen.getByRole('heading', { name: /what should i wear today/i })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-daily-goal]')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('.daily-empty-result, .daily-board')).toBeNull()
    expect(screen.getByRole('button', { name: "Create Today's Look ✨" })).toBeEnabled()
  })

  it('keeps a user-selected Inspiration result across a Wardrobe mutation and return', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    vi.mocked(requestOutfitPreview).mockResolvedValue({ ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,aGVsbG8=' } })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /today's lucky color/i }))
    await user.click(screen.getByRole('radio', { name: /new look ideas/i }))
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findByRole('img')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /manage my wardrobe/i }))
    expect(screen.getByRole('heading', { name: 'My Wardrobe' })).toBeInTheDocument()
    saveWardrobe([{ id: 'new-top', garmentType: 't-shirt', color: { hex: '#111111' }, formality: 'casual' }])
    await user.click(screen.getByRole('button', { name: /back to today/i }))
    expect(await screen.findByRole('heading', { name: 'Try this combination' })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=')
    expect(requestInspirationOutfitRecommendation).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
  })

  it('clears an Owned recommendation and its Preview after a relevant Wardrobe mutation', async () => {
    const original = [
      { id: 'top', garmentType: 't-shirt' as const, color: { hex: '#112233' }, formality: 'casual' as const },
      { id: 'bottom', garmentType: 'jeans' as const, color: { hex: '#334455' }, formality: 'casual' as const },
      { id: 'shoes', garmentType: 'sneakers' as const, color: { hex: '#FFFFFF' }, formality: 'casual' as const },
    ]
    saveWardrobe(original)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: { selection: { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' }, reasoning: { occasion: 'safe', personalColor: null, luckyColor: null } } })
    vi.mocked(requestOutfitPreview).mockResolvedValue({ ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,aGVsbG8=' } })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /today's lucky color/i }))
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await user.click(await screen.findByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findByRole('img')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /manage my wardrobe/i }))
    saveWardrobe(original.map((item) => item.id === 'top' ? { ...item, color: { hex: '#445566' } } : item))
    await user.click(screen.getByRole('button', { name: /back to today/i }))
    expect(screen.queryByRole('heading', { name: 'Wear this today' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
  })

  it('settles a Preview under StrictMode at the App boundary', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    vi.mocked(requestOutfitPreview).mockResolvedValue({ ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,aGVsbG8=' } })
    const user = userEvent.setup()
    render(<StrictMode><App /></StrictMode>)
    await user.click(screen.getByRole('button', { name: /today's lucky color/i }))
    await user.click(screen.getByRole('radio', { name: /new look ideas/i }))
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await user.click(await screen.findByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=')
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
  })

  it('aborts a loading Preview on navigation and returns to an explicit idle action', async () => {
    vi.mocked(requestInspirationOutfitRecommendation).mockResolvedValue({ ok: true, result: inspirationResult })
    vi.mocked(requestOutfitPreview).mockImplementation((_input, signal) => new Promise((resolve) => {
      signal?.addEventListener('abort', () => resolve({ ok: false, error: { kind: 'network', message: 'safe' } }))
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /today's lucky color/i }))
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await user.click(await screen.findByRole('button', { name: '✨ Preview This Look' }))
    expect(screen.getByRole('status')).toHaveTextContent('Creating preview…')
    await user.click(screen.getByRole('button', { name: /manage my wardrobe/i }))
    await user.click(screen.getByRole('button', { name: /back to today/i }))
    expect(screen.getByRole('button', { name: '✨ Preview This Look' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
  })

  it('uses the bilingual canonical hierarchy for Thai palette cards and the selected summary', async () => {
    const user = userEvent.setup()
    const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
    const result = { ...analyzeQuiz(answers), subtype: 'warm-spring' as const, season: 'spring' as const }
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'th')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, answers, result, quizStep: 10 }))
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: /ดูพาเลตต์ของฉัน/ }))

    const color = getPalette('warm-spring').best[0]
    const selected = container.querySelector('.selected-color')!
    expect(selected.querySelector('.canonical-color-primary')).toHaveTextContent(colorDisplayName('th', color))
    expect(selected.querySelector('.canonical-color-secondary')).toHaveTextContent(color.name)
    expect(selected.querySelector('.canonical-color-hex')).toHaveTextContent(color.hex)

    const card = container.querySelector('.swatch')!
    expect(card.querySelector('.canonical-color-primary')).toHaveTextContent(colorDisplayName('th', color))
    expect(card.querySelector('.canonical-color-secondary')).toHaveTextContent(color.name)
    expect(card.querySelector('.canonical-color-hex')).toHaveTextContent(color.hex)
  })

  it('can complete all eleven quiz questions with keyboard controls', async () => {
    // No timer between key events (hundreds of Tab presses). With the default delay this ran at
    // ~11 s of its 15 s budget under full-suite load (Slice 6). The behaviour tested is identical.
    const user = userEvent.setup({ delay: null })
    render(<App />)

    const tabTo = async (target: HTMLElement) => {
      for (let index = 0; index < 20 && document.activeElement !== target; index += 1) await user.tab()
      expect(document.activeElement).toBe(target)
    }

    await tabTo(screen.getByRole('button', { name: /find my colors/i }))
    await user.keyboard('{Enter}')

    await tabTo(screen.getByRole('button', { name: 'Women' }))
    await user.keyboard('{Enter}')

    for (let step = 0; step < quizQuestions.length; step += 1) {
      const firstAnswer = screen.getAllByRole('radio')[0]
      await tabTo(firstAnswer)
      await user.keyboard(' ')
      const advance = screen.getByRole('button', { name: step === quizQuestions.length - 1 ? /see my colors/i : /next/i })
      await tabTo(advance)
      await user.keyboard('{Enter}')
    }

    expect(await screen.findByText(/match$/i)).toBeInTheDocument()
  }, 15_000)
})

// Pre-V1.4 maintenance: a corrupted stored subtype must not blank the app at start-up.
describe('corrupted persisted profile', () => {
  const answers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
  const store = (subtype: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, answers, result: { ...analyzeQuiz(answers), subtype }, quizStep: 10 }))
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it.each(['bogus-subtype', '', 'constructor'])('starts without a result for subtype %j, and Daily falls back to general mode', async (subtype) => {
    const user = userEvent.setup()
    store(subtype)
    const { container } = render(<App />)
    // No result: the welcome page offers to continue the saved answers; nothing is guessed.
    expect(screen.getByRole('button', { name: /continue my quiz/i })).toBeInTheDocument()
    expect(container.querySelector('.bottom-nav')).toBeNull()
    await user.click(screen.getByRole('button', { name: /see today's lucky color/i }))
    expect(container.querySelector('.daily-page')).toHaveAttribute('data-daily-mode', 'neutral')
  })

  it('still opens a valid stored profile on its result', () => {
    store(analyzeQuiz(answers).subtype)
    const { container } = render(<App />)
    expect(container.querySelector('.result-page')).toBeInTheDocument()
  })
})
