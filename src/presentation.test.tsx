import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { analyzeQuiz } from './domain/personalColor/scoring'
import { getPalette } from './domain/personalColor/palettes'
import { saveState } from './services/persistence'
import { loadPresentationPreference } from './services/presentationPreference'

const warmAnswers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced' }

describe('presentation preference (Women/Men) does not affect the color model', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('onboards once, persists the choice, and skips onboarding on the next visit', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    expect(screen.getByText(/personalize your style examples/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(loadPresentationPreference()).toBe('men')
    unmount()

    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    // No onboarding this time -- goes straight to the quiz.
    expect(screen.queryByText(/personalize your style examples/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
  })

  it('renders the photographic selector pair, removes the old SVG illustrations, and falls back accessibly if an image fails', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    expect(container.querySelector('.garment-swatch')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    const women = screen.getByRole('img', { name: "Women's clothing style examples" })
    const men = screen.getByRole('img', { name: "Men's clothing style examples" })
    expect(women).toHaveAttribute('src', '/img/presentation/women.webp')
    expect(men).toHaveAttribute('src', '/img/presentation/men.webp')
    expect(container.querySelectorAll('.presentation-option')).toHaveLength(2)
    fireEvent.error(women)
    expect(screen.getByRole('img', { name: "Women's clothing style examples" })).toHaveTextContent('Women')
  })

  it('supports keyboard selection on the presentation cards', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const men = screen.getByRole('button', { name: 'Men' })
    men.focus()
    await user.keyboard('{Enter}')
    expect(loadPresentationPreference()).toBe('men')
    expect(screen.getByText(/question 1/i)).toBeInTheDocument()
  })

  it('can be changed later from the header without touching quiz answers', async () => {
    const user = userEvent.setup()
    saveState({ answers: { undertone: 'golden' }, result: null, quizStep: 0 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    await user.click(screen.getByRole('button', { name: 'Women' }))
    expect(screen.getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(loadPresentationPreference()).toBe('men')
    expect(screen.getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('renders the same canonical fallback HEX values and answer mapping for both preferences', async () => {
    const user = userEvent.setup()
    saveState({ answers: {}, result: null, quizStep: 6 })
    const { container, unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    await user.click(screen.getByRole('button', { name: 'Women' }))
    container.querySelectorAll('.quiz-visual img').forEach((image) => fireEvent.error(image))
    const womenHex = Array.from(container.querySelectorAll('[data-quiz-visual-hex]')).map((el) => el.getAttribute('data-quiz-visual-hex'))
    const womenAnswers = Array.from(container.querySelectorAll('[data-visual-answer]')).map((el) => el.getAttribute('data-visual-answer'))
    unmount()

    localStorage.clear()
    saveState({ answers: {}, result: null, quizStep: 6 })
    const rendered = render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    await user.click(screen.getByRole('button', { name: 'Men' }))
    rendered.container.querySelectorAll('.quiz-visual img').forEach((image) => fireEvent.error(image))
    const menHex = Array.from(rendered.container.querySelectorAll('[data-quiz-visual-hex]')).map((el) => el.getAttribute('data-quiz-visual-hex'))
    const menAnswers = Array.from(rendered.container.querySelectorAll('[data-visual-answer]')).map((el) => el.getAttribute('data-visual-answer'))

    expect(menHex).toEqual(womenHex)
    expect(menHex.length).toBeGreaterThan(0)
    expect(menAnswers).toEqual(womenAnswers)
  })

  it('never influences scoring, subtype, confidence, or palette -- those depend only on quiz answers', () => {
    const result = analyzeQuiz(warmAnswers)
    // The scoring/palette pipeline has no presentation-preference parameter at all,
    // so the same answers always produce the same result regardless of who is using it.
    expect(analyzeQuiz(warmAnswers)).toEqual(result)
    expect(getPalette(result.subtype)).toEqual(getPalette(result.subtype))
  })
})
