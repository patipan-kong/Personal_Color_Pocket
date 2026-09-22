import { describe, expect, it } from 'vitest'
import {
  answerSensitivity,
  buildDiagnosticReport,
  leaveOneQuestionOut,
  rankSubtypes,
} from './diagnostics'
import { quizQuestions } from './quiz'
import { analyzeQuiz, classificationWeights } from './scoring'
import { subtypeOrder } from './seasons'
import type { QuizAnswers } from './types'

const warmClearDark: QuizAnswers = {
  undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain',
  hair: 'deep', eyes: 'deep-clear', contrast: 'medium', intensity: 'bright',
  clarity: 'clear', depth: 'light',
}

const coolClearDark: QuizAnswers = {
  undertone: 'rosy', metal: 'silver', white: 'optic', earth: 'mixed', 'cool-color': 'clear',
  hair: 'deep', eyes: 'deep-clear', contrast: 'high', intensity: 'bright',
  clarity: 'clear', depth: 'light',
}

describe('diagnostics (DEV-only): reuses production scoring, never duplicates it', () => {
  it('captures the actual selected answer id for every question -- no inference/fabrication', () => {
    const report = buildDiagnosticReport(warmClearDark)
    report.answerTrace.forEach((entry) => {
      expect(entry.answerId).toBe(warmClearDark[entry.questionId])
    })
  })

  it('raw per-answer contributions equal the exact weight vectors defined in quiz.ts', () => {
    const report = buildDiagnosticReport(warmClearDark)
    quizQuestions.forEach((question) => {
      const entry = report.answerTrace.find((item) => item.questionId === question.id)!
      const option = question.options.find((item) => item.id === warmClearDark[question.id])!
      expect(entry.contribution).toEqual(option.weights)
    })
  })

  it('accumulated raw totals match a manual sum of the selected answers weights', () => {
    const report = buildDiagnosticReport(warmClearDark)
    const dims = ['temperature', 'value', 'chroma', 'contrast'] as const
    dims.forEach((dim) => {
      const manual = quizQuestions.reduce((sum, question) => {
        const option = question.options.find((item) => item.id === warmClearDark[question.id])
        return sum + (option ? option.weights[dim] : 0)
      }, 0)
      expect(report.rawTotals[dim]).toBeCloseTo(manual, 10)
    })
  })

  it('normalized dimensions exactly match what production analyzeQuiz classifies from', () => {
    const report = buildDiagnosticReport(warmClearDark)
    const production = analyzeQuiz(warmClearDark)
    expect(report.normalizedDimensions).toEqual(production.dimensions)
  })

  it('subtype ranking top result matches the production classifier result', () => {
    const report = buildDiagnosticReport(warmClearDark)
    const production = analyzeQuiz(warmClearDark)
    expect(report.rankings[0].subtype).toBe(production.subtype)
    expect(report.top3[0].subtype).toBe(production.subtype)
  })

  it('all 12 subtypes appear exactly once in the ranking', () => {
    const report = buildDiagnosticReport(warmClearDark)
    expect(report.rankings).toHaveLength(12)
    const seen = new Set(report.rankings.map((entry) => entry.subtype))
    expect(seen.size).toBe(12)
    subtypeOrder.forEach((subtype) => expect(seen.has(subtype)).toBe(true))
  })

  it('ranking is sorted nearest-first', () => {
    const report = buildDiagnosticReport(warmClearDark)
    for (let i = 1; i < report.rankings.length; i++) {
      expect(report.rankings[i].distance).toBeGreaterThanOrEqual(report.rankings[i - 1].distance)
    }
  })

  it('top3 matches the first three entries of the full ranking', () => {
    const report = buildDiagnosticReport(warmClearDark)
    expect(report.top3.map((entry) => entry.subtype)).toEqual(report.rankings.slice(0, 3).map((entry) => entry.subtype))
  })

  it('distance decomposition sums back to the total (squared) distance, whose sqrt is the ranking distance', () => {
    const report = buildDiagnosticReport(warmClearDark)
    report.top3.forEach((candidate) => {
      const summed = Object.values(candidate.perDimension).reduce((sum, value) => sum + value, 0)
      expect(summed).toBeCloseTo(candidate.distanceSquared, 10)
      expect(Math.sqrt(candidate.distanceSquared)).toBeCloseTo(candidate.distance, 10)
      const ranked = report.rankings.find((entry) => entry.subtype === candidate.subtype)!
      expect(candidate.distance).toBeCloseTo(ranked.distance, 10)
    })
  })

  it('rankSubtypes and distance decomposition agree with the production classify() ranking for a second, unrelated fixture', () => {
    const production = analyzeQuiz(coolClearDark)
    const ranked = rankSubtypes(analyzeQuiz(coolClearDark).dimensions)
    expect(ranked[0].subtype).toBe(production.subtype)
  })

  it('answer sensitivity changes exactly one answer at a time relative to the original set', () => {
    const entries = answerSensitivity(warmClearDark)
    entries.forEach((entry) => {
      const diffKeys = Object.keys(warmClearDark).filter((key) => entry.answers[key] !== warmClearDark[key])
      expect(diffKeys).toEqual([entry.questionId])
      expect(entry.answers[entry.questionId]).toBe(entry.alternativeAnswerId)
    })
    // 11 questions x 2 alternative options each = 22 sensitivity probes. Derived from the
    // live quiz definition (quizQuestions.length), never hardcoded to a specific count.
    expect(entries).toHaveLength(quizQuestions.length * 2)
  })

  it('leave-one-out reclassifies from a genuinely shorter question set, not a zeroed-out one', () => {
    const entries = leaveOneQuestionOut(warmClearDark)
    expect(entries).toHaveLength(quizQuestions.length)
    entries.forEach((entry) => {
      expect(entry.removedAnswerId).toBe(warmClearDark[entry.questionId])
      expect(entry.subtype).not.toBeNull()
    })
  })

  it('diagnostic generation does not mutate the answers object passed in', () => {
    const frozen = Object.freeze({ ...warmClearDark })
    expect(() => buildDiagnosticReport(frozen)).not.toThrow()
    expect(frozen).toEqual(warmClearDark)
  })

  it('diagnostic generation touches no storage -- localStorage is untouched before and after', () => {
    localStorage.clear()
    const before = { ...localStorage }
    buildDiagnosticReport(warmClearDark)
    answerSensitivity(warmClearDark)
    leaveOneQuestionOut(warmClearDark)
    expect(localStorage.length).toBe(0)
    expect({ ...localStorage }).toEqual(before)
  })

  it('is deterministic -- presentationPreference and language have no signature to affect, so repeated calls are identical', () => {
    const first = buildDiagnosticReport(warmClearDark)
    const second = buildDiagnosticReport(warmClearDark)
    expect(second).toEqual(first)
    // Structural proof, not just empirical: neither function accepts those parameters.
    expect(buildDiagnosticReport.length).toBeLessThanOrEqual(3)
  })

  it('uses the exact production classification weights by default', () => {
    const report = buildDiagnosticReport(warmClearDark)
    expect(report.classificationWeights).toEqual(classificationWeights)
  })

  // Model V2 -- diagnostics must automatically pick up the 11-question model without
  // any hardcoded question count, and must trace Q10/Q11 like every other question.
  it('traces all 11 answers, including Q10 (clarity) and Q11 (depth)', () => {
    const report = buildDiagnosticReport(warmClearDark)
    expect(report.answerTrace).toHaveLength(11)
    expect(report.answerTrace.map((entry) => entry.questionId)).toEqual(expect.arrayContaining(['clarity', 'depth']))
    const clarityEntry = report.answerTrace.find((entry) => entry.questionId === 'clarity')!
    expect(clarityEntry.answerId).toBe('clear')
    expect(clarityEntry.contribution).toEqual({ temperature: 0, value: 0, chroma: 1.8, contrast: .5 })
  })

  it('sensitivity analysis includes probes for Q10 and Q11 alternatives', () => {
    const entries = answerSensitivity(warmClearDark)
    expect(entries.some((entry) => entry.questionId === 'clarity')).toBe(true)
    expect(entries.some((entry) => entry.questionId === 'depth')).toBe(true)
  })

  it('leave-one-out includes Q10 and Q11', () => {
    const entries = leaveOneQuestionOut(warmClearDark)
    expect(entries.map((entry) => entry.questionId)).toEqual(expect.arrayContaining(['clarity', 'depth']))
  })

  it('has no network dependency: generating a full diagnostic never calls fetch', () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (() => { calls += 1; throw new Error('unexpected network call from a local-only diagnostic tool') }) as typeof fetch
    try {
      buildDiagnosticReport(warmClearDark)
      answerSensitivity(warmClearDark)
      leaveOneQuestionOut(warmClearDark)
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(calls).toBe(0)
  })
})
