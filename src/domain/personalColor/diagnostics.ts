// DEV-only diagnostic tooling for the personal-color scoring engine.
// Every function here reads from the production scoring module (scoring.ts) -- it does
// not re-implement normalization, distance, or confidence. See App.tsx for how this is
// gated so it never reaches a production build (import.meta.env.DEV + ?debug=color).
import { quizQuestions } from './quiz'
import { seasonDefinitions, subtypeOrder } from './seasons'
import { classificationWeights, classify, dimensionTrace, distanceBreakdown } from './scoring'
import type { DimensionKey, DimensionVector, QuizAnswers, Subtype } from './types'

const dimensions: DimensionKey[] = ['temperature', 'value', 'chroma', 'contrast']

export interface AnswerTraceEntry {
  questionId: string
  answerId: string | undefined
  contribution: DimensionVector | null
}

export function answerTrace(answers: QuizAnswers, questions: typeof quizQuestions = quizQuestions): AnswerTraceEntry[] {
  return questions.map((question) => {
    const answerId = answers[question.id]
    const option = question.options.find((item) => item.id === answerId)
    return { questionId: question.id, answerId, contribution: option ? option.weights : null }
  })
}

export interface RankingEntry {
  subtype: Subtype
  season: string
  distance: number
  target: DimensionVector
}

export function rankSubtypes(values: DimensionVector, weights: DimensionVector = classificationWeights): RankingEntry[] {
  return subtypeOrder
    .map((subtype) => ({
      subtype,
      season: seasonDefinitions[subtype].season,
      distance: distanceBreakdown(values, seasonDefinitions[subtype].target, weights).total,
      target: seasonDefinitions[subtype].target,
    }))
    .sort((a, b) => a.distance - b.distance)
}

export interface DecomposedCandidate {
  subtype: Subtype
  target: DimensionVector
  // Weighted, squared per-dimension term -- these sum exactly to distanceSquared.
  // (Linear "distance" is the square root of that sum, per the production formula,
  // so it is reported separately rather than as a sum of the per-dimension terms.)
  perDimension: DimensionVector
  distanceSquared: number
  distance: number
}

export function decomposeCandidate(values: DimensionVector, subtype: Subtype, weights: DimensionVector = classificationWeights): DecomposedCandidate {
  const target = seasonDefinitions[subtype].target
  const { perDimension, total } = distanceBreakdown(values, target, weights)
  const distanceSquared = dimensions.reduce((sum, key) => sum + perDimension[key], 0)
  return { subtype, target, perDimension, distanceSquared, distance: total }
}

export interface WarmSpringVsWarmAutumn {
  user: DimensionVector
  spring: DecomposedCandidate
  autumn: DecomposedCandidate
  // Which of the two targets each dimension's (weighted, squared) term favors -- the
  // smaller per-dimension term is the one pulling the user closer to that subtype.
  favors: Record<DimensionKey, 'spring' | 'autumn' | 'tie'>
}

export function warmSpringVsWarmAutumn(values: DimensionVector, weights: DimensionVector = classificationWeights): WarmSpringVsWarmAutumn {
  const spring = decomposeCandidate(values, 'warm-spring', weights)
  const autumn = decomposeCandidate(values, 'warm-autumn', weights)
  const favors = dimensions.reduce((result, key) => {
    result[key] = spring.perDimension[key] < autumn.perDimension[key] ? 'spring' : spring.perDimension[key] > autumn.perDimension[key] ? 'autumn' : 'tie'
    return result
  }, {} as Record<DimensionKey, 'spring' | 'autumn' | 'tie'>)
  return { user: values, spring, autumn, favors }
}

export interface SensitivityEntry {
  questionId: string
  currentAnswerId: string | undefined
  alternativeAnswerId: string
  answers: QuizAnswers
  subtype: Subtype
  season: string
  confidence: number
  topDistance: number
}

// Keeps the other 8 answers fixed and swaps in each alternative option for one question
// at a time, reclassifying with the real production classify() each time.
export function answerSensitivity(answers: QuizAnswers, questions: typeof quizQuestions = quizQuestions, weights: DimensionVector = classificationWeights): SensitivityEntry[] {
  const entries: SensitivityEntry[] = []
  questions.forEach((question) => {
    const currentAnswerId = answers[question.id]
    question.options.forEach((option) => {
      if (option.id === currentAnswerId) return
      const altAnswers = { ...answers, [question.id]: option.id }
      const result = classify(altAnswers, questions, weights)
      entries.push({
        questionId: question.id,
        currentAnswerId,
        alternativeAnswerId: option.id,
        answers: altAnswers,
        subtype: result.top.subtype,
        season: seasonDefinitions[result.top.subtype].season,
        confidence: result.confidence,
        topDistance: result.top.distance,
      })
    })
  })
  return entries
}

export interface LeaveOneOutEntry {
  questionId: string
  removedAnswerId: string | undefined
  subtype: Subtype | null
  season: string | null
  confidence: number | null
  note?: string
}

// "Leave this question out" is only mathematically valid if BOTH the totals and the
// normalization range (maximums) drop that question together -- otherwise the remaining
// dimensions would be normalized against a range that assumes a question was answered
// when it wasn't. classify() recomputes both from whatever `questions` array it is given
// (see dimensionTrace in scoring.ts), so passing a question list with one entry removed
// -- and removing that question's key from `answers` -- reproduces exactly what
// production would compute for a genuinely shorter quiz. That is what this simulates.
export function leaveOneQuestionOut(answers: QuizAnswers, questions: typeof quizQuestions = quizQuestions, weights: DimensionVector = classificationWeights): LeaveOneOutEntry[] {
  return questions.map((question) => {
    const removedAnswerId = answers[question.id]
    const reducedQuestions = questions.filter((item) => item.id !== question.id)
    const reducedAnswers = { ...answers }
    delete reducedAnswers[question.id]
    if (reducedQuestions.length === 0) {
      return { questionId: question.id, removedAnswerId, subtype: null, season: null, confidence: null, note: 'no remaining questions to classify from' }
    }
    const result = classify(reducedAnswers, reducedQuestions, weights)
    return { questionId: question.id, removedAnswerId, subtype: result.top.subtype, season: seasonDefinitions[result.top.subtype].season, confidence: result.confidence }
  })
}

export interface ConfidenceTrace {
  signalStrength: number
  separation: number
  consistency: number
  answeredRatio: number
  final: number
  label: string
}

export interface DiagnosticReport {
  answers: QuizAnswers
  answerTrace: AnswerTraceEntry[]
  rawTotals: DimensionVector
  maximums: DimensionVector
  normalizedDimensions: DimensionVector
  classificationWeights: DimensionVector
  rankings: RankingEntry[]
  top3: DecomposedCandidate[]
  warmSpringVsWarmAutumn: WarmSpringVsWarmAutumn
  answerSensitivity: SensitivityEntry[]
  leaveOneOut: LeaveOneOutEntry[]
  confidence: ConfidenceTrace
}

export function buildDiagnosticReport(
  answers: QuizAnswers,
  questions: typeof quizQuestions = quizQuestions,
  weights: DimensionVector = classificationWeights,
): DiagnosticReport {
  const trace = dimensionTrace(answers, questions)
  const result = classify(answers, questions, weights)
  const rankings = rankSubtypes(result.values, weights)
  const top3 = rankings.slice(0, 3).map((entry) => decomposeCandidate(result.values, entry.subtype, weights))

  return {
    answers,
    answerTrace: answerTrace(answers, questions),
    rawTotals: trace.totals,
    maximums: trace.maximums,
    normalizedDimensions: trace.normalized,
    classificationWeights: weights,
    rankings,
    top3,
    warmSpringVsWarmAutumn: warmSpringVsWarmAutumn(result.values, weights),
    answerSensitivity: answerSensitivity(answers, questions, weights),
    leaveOneOut: leaveOneQuestionOut(answers, questions, weights),
    confidence: {
      signalStrength: result.signalStrength,
      separation: result.separation,
      consistency: result.consistency,
      answeredRatio: result.answeredRatio,
      final: result.confidence,
      label: result.confidenceLabel,
    },
  }
}
