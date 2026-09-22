import { beforeEach, describe, expect, it } from 'vitest'
import { quizQuestions } from '../domain/personalColor/quiz'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import { STORAGE_KEY, emptyStoredState, loadState, saveState } from './persistence'

const nineAnswers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced' }

describe('local persistence', () => {
  beforeEach(() => localStorage.clear())
  it('restores a valid saved profile', () => {
    const answers = { undertone: 'golden' }
    const result = analyzeQuiz(answers)
    saveState({ answers, result, quizStep: 2 })
    expect(loadState()).toMatchObject({ version: 2, answers, result, quizStep: 2 })
  })
  it('fails safely for malformed JSON', () => { localStorage.setItem(STORAGE_KEY, '{no'); expect(loadState()).toEqual(emptyStoredState()) })
  it('fails safely for unsupported versions', () => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 9, answers: {} })); expect(loadState()).toEqual(emptyStoredState()) })
  it('restores legacy V1 results that stored completed English reason sentences', () => {
    const answers = { undertone: 'golden' }
    const result = analyzeQuiz(answers)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      answers,
      result: { ...result, reasons: ['Your answers leaned toward golden, warm undertones.'] },
      quizStep: 1,
    }))
    const restored = loadState()
    expect(restored.result?.subtype).toBe(result.subtype)
    expect(restored.result?.confidence).toBe(result.confidence)
    expect(restored.result?.reasons[0]).toMatchObject({ dimension: expect.any(String), tendency: expect.any(String) })
  })

  // --- Model V2 migration: a v1 profile that finished all 9 original questions must not
  // be presented as a finished 11-question result, and must not have Q10/Q11 silently
  // filled in as neutral answers. It should route back into the quiz at the first new
  // question, keeping every original answer intact. ---
  describe('v1 -> v2 (9 -> 11 question) migration', () => {
    it('clears a completed v1 result and resumes at the first new question (index 9, "clarity"), preserving all 9 original answers', () => {
      const result = analyzeQuiz(nineAnswers)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, answers: nineAnswers, result, quizStep: 8 }))
      const restored = loadState()
      expect(restored.version).toBe(2)
      expect(restored.answers).toEqual(nineAnswers)
      expect(restored.result).toBeNull()
      expect(restored.quizStep).toBe(9)
      expect(quizQuestions[restored.quizStep].id).toBe('clarity')
    })

    it('does not silently neutralize the missing clarity/depth answers -- they stay entirely absent, not defaulted to "balanced"/"medium"', () => {
      const result = analyzeQuiz(nineAnswers)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, answers: nineAnswers, result, quizStep: 8 }))
      const restored = loadState()
      expect('clarity' in restored.answers).toBe(false)
      expect('depth' in restored.answers).toBe(false)
    })

    it('leaves a v1 profile that was only mid-quiz (never completed) alone -- no result to clear, step just carries forward clamped to the new question count', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, answers: { undertone: 'golden' }, result: null, quizStep: 0 }))
      const restored = loadState()
      expect(restored.version).toBe(2)
      expect(restored.answers).toEqual({ undertone: 'golden' })
      expect(restored.result).toBeNull()
      expect(restored.quizStep).toBe(0)
    })

    it('a v2 profile that already answered all 11 questions is left untouched (no migration needed)', () => {
      const elevenAnswers = { ...nineAnswers, clarity: 'clear', depth: 'light' }
      const result = analyzeQuiz(elevenAnswers)
      saveState({ answers: elevenAnswers, result, quizStep: 10 })
      const restored = loadState()
      expect(restored.result?.subtype).toBe(result.subtype)
      expect(restored.answers).toEqual(elevenAnswers)
    })

    it('clamps quizStep to the new 11-question range', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, answers: {}, result: null, quizStep: 999 }))
      const restored = loadState()
      expect(restored.quizStep).toBeLessThanOrEqual(quizQuestions.length - 1)
    })
  })
})
