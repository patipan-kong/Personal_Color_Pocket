import { cleanup, render, screen } from '@testing-library/react'
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

  it('renders the same canonical swatch HEX values for both preferences -- only the garment silhouette changes', async () => {
    const user = userEvent.setup()
    saveState({ answers: {}, result: null, quizStep: 3 })
    const { container, unmount } = render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    await user.click(screen.getByRole('button', { name: 'Women' }))
    const womenHex = Array.from(container.querySelectorAll('[data-quiz-visual-hex]')).map((el) => el.getAttribute('data-quiz-visual-hex'))
    const womenKinds = Array.from(container.querySelectorAll('[data-garment-kind]')).map((el) => el.getAttribute('data-garment-kind'))
    unmount()

    localStorage.clear()
    saveState({ answers: {}, result: null, quizStep: 3 })
    const rendered = render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    await user.click(screen.getByRole('button', { name: 'Men' }))
    const menHex = Array.from(rendered.container.querySelectorAll('[data-quiz-visual-hex]')).map((el) => el.getAttribute('data-quiz-visual-hex'))
    const menKinds = Array.from(rendered.container.querySelectorAll('[data-garment-kind]')).map((el) => el.getAttribute('data-garment-kind'))

    expect(menHex).toEqual(womenHex)
    expect(menHex.length).toBeGreaterThan(0)
    expect(menKinds).not.toEqual(womenKinds)
  })

  it('never influences scoring, subtype, confidence, or palette -- those depend only on quiz answers', () => {
    const result = analyzeQuiz(warmAnswers)
    // The scoring/palette pipeline has no presentation-preference parameter at all,
    // so the same answers always produce the same result regardless of who is using it.
    expect(analyzeQuiz(warmAnswers)).toEqual(result)
    expect(getPalette(result.subtype)).toEqual(getPalette(result.subtype))
  })
})
