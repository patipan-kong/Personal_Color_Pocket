import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { quizQuestions } from './domain/personalColor/quiz'

describe('primary product flow', () => {
  beforeEach(() => localStorage.clear())
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
