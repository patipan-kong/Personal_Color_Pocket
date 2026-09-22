import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { getCopy, LANGUAGE_STORAGE_KEY } from '../../i18n'
import { saveState } from '../../services/persistence'
import { quizQuestions } from './quiz'
import { getQuizVisualSwatches, quizVisuals } from './quizVisuals'

const requiredVisuals = {
  white: 'white-comparison',
  earth: 'warm-earthy',
  'cool-color': 'cool-colors',
  intensity: 'chroma-comparison',
  clarity: 'clarity-comparison',
  depth: 'value-comparison',
} as const

const saturation = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1))
}

describe('quiz visual references', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('attaches the four required visual aids without replacing quiz answers', () => {
    Object.entries(requiredVisuals).forEach(([questionId, visualId]) => {
      expect(quizQuestions.find((question) => question.id === questionId)?.visualId).toBe(visualId)
    })
    expect(quizQuestions).toHaveLength(11)
    quizQuestions.forEach((question) => expect(question.options).toHaveLength(3))
  })

  it('uses unique IDs, valid deterministic HEX colors, and complete English and Thai labels', () => {
    const swatches = Object.values(quizVisuals).flatMap(getQuizVisualSwatches)
    expect(new Set(swatches.map((swatch) => swatch.id)).size).toBe(swatches.length)
    swatches.forEach((swatch) => {
      expect(swatch.hex).toMatch(/^#[0-9A-F]{6}$/)
      expect(getCopy('en').quizVisualLabels[swatch.labelKey]).toBeTruthy()
      expect(getCopy('th').quizVisualLabels[swatch.labelKey]).toMatch(/[ก-๙]/)
    })
  })

  it('keeps the white references visibly distinct and covers the intended warm and cool categories', () => {
    const whites = getQuizVisualSwatches(quizVisuals['white-comparison'])
    expect(new Set(whites.map((swatch) => swatch.hex)).size).toBe(3)
    expect(whites.map((swatch) => swatch.labelKey)).toEqual(['ivory', 'softWhite', 'pureWhite'])
    expect(getQuizVisualSwatches(quizVisuals['warm-earthy']).map((swatch) => swatch.labelKey)).toEqual(['camel', 'terracotta', 'olive', 'warmBrown'])
    expect(getQuizVisualSwatches(quizVisuals['cool-colors']).map((swatch) => swatch.labelKey)).toEqual(['coolBlue', 'berryPink', 'blueRed', 'coolNavy'])
  })

  it('shows muted, medium, and clear progression within two consistent hue families', () => {
    const visual = quizVisuals['chroma-comparison']
    expect(visual.type).toBe('chroma-scale')
    if (visual.type !== 'chroma-scale') return
    visual.rows.forEach((row) => {
      const saturations = row.items.map((swatch) => saturation(swatch.hex))
      expect(saturations[0]).toBeLessThan(saturations[1])
      expect(saturations[1]).toBeLessThan(saturations[2])
      expect(row.items.map((swatch) => swatch.labelKey)).toEqual(expect.arrayContaining([
        expect.stringMatching(/^muted/), expect.stringMatching(/^medium/), expect.stringMatching(/^clear/),
      ]))
    })
  })

  it('Q10 shows a direct muted-vs-clear pair (no medium step), visually distinct from Q9\'s three-step scale', () => {
    const visual = quizVisuals['clarity-comparison']
    expect(visual.type).toBe('clarity-pair')
    if (visual.type !== 'clarity-pair') return
    visual.rows.forEach((row) => {
      expect(row.items).toHaveLength(2)
      const saturations = row.items.map((swatch) => saturation(swatch.hex))
      expect(saturations[0]).toBeLessThan(saturations[1])
    })
    // Distinct hex references from Q9's chroma-comparison -- not a copy-pasted question.
    const q9Hex = new Set(getQuizVisualSwatches(quizVisuals['chroma-comparison']).map((s) => s.hex))
    getQuizVisualSwatches(visual).forEach((swatch) => expect(q9Hex.has(swatch.hex)).toBe(false))
  })

  it('Q11 shows a light/medium/deep progression across two hue families with controlled chroma', () => {
    const visual = quizVisuals['value-comparison']
    expect(visual.type).toBe('value-scale')
    if (visual.type !== 'value-scale') return
    const lightness = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
    }
    visual.rows.forEach((row) => {
      expect(row.items).toHaveLength(3)
      const values = row.items.map((swatch) => lightness(swatch.hex))
      expect(values[0]).toBeGreaterThan(values[1])
      expect(values[1]).toBeGreaterThan(values[2])
    })
  })

  it('switches localized labels while preserving the rendered HEX references', async () => {
    const user = userEvent.setup()
    saveState({ answers: {}, result: null, quizStep: 2 })
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    await user.click(screen.getByRole('button', { name: 'Women' }))
    const englishHex = Array.from(container.querySelectorAll('[data-quiz-visual-hex]')).map((element) => element.getAttribute('data-quiz-visual-hex'))
    expect(screen.getByText('Ivory')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    const thaiHex = Array.from(container.querySelectorAll('[data-quiz-visual-hex]')).map((element) => element.getAttribute('data-quiz-visual-hex'))
    expect(screen.getByText('ไอวอรี่')).toBeInTheDocument()
    expect(thaiHex).toEqual(englishHex)
  })

  it('exposes visual names as non-interactive list items', async () => {
    const user = userEvent.setup()
    saveState({ answers: {}, result: null, quizStep: 3 })
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    await user.click(screen.getByRole('button', { name: 'Women' }))
    expect(screen.getByRole('list', { name: 'Color examples for this question' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByLabelText('Camel').tagName).toBe('DIV')
  })
})
