import { quizQuestions } from './quiz'
import { seasonDefinitions, subtypeOrder } from './seasons'
import type { ConfidenceLabel, DimensionKey, DimensionVector, PersonalColorResult, QuizAnswers, ResultReason, Subtype } from './types'

const dimensions: DimensionKey[] = ['temperature', 'value', 'chroma', 'contrast']
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

// Classification authority per dimension. Temperature and chroma are driven almost
// entirely by direct answers about how colors look on the person (undertone, metal,
// muted-vs-clear response), so they get full authority in the season/subtype match.
// Value is partly informed by natural hair/eye depth, which is supporting evidence for
// a person's flattering depth, not a reliable stand-in for it -- so it carries reduced
// authority here to avoid naturally dark-haired/eyed people being pulled toward deeper
// results by pigmentation alone. Contrast is real evidence but should not out-weigh the
// primary temperature/chroma signals either.
export const classificationWeights: DimensionVector = { temperature: 1, value: .5, chroma: 1.05, contrast: .85 }

// Extracted so the DEV-only diagnostic tooling (see diagnostics.ts) can read the exact
// raw totals / normalization range production uses, without re-implementing the formula.
export function dimensionTrace(answers: QuizAnswers, questions: typeof quizQuestions) {
  const totals: DimensionVector = { temperature: 0, value: 0, chroma: 0, contrast: 0 }
  const maximums: DimensionVector = { temperature: 0, value: 0, chroma: 0, contrast: 0 }

  questions.forEach((question) => {
    const option = question.options.find((item) => item.id === answers[question.id])
    dimensions.forEach((dimension) => {
      maximums[dimension] += Math.max(...question.options.map((item) => Math.abs(item.weights[dimension])))
      if (option) totals[dimension] += option.weights[dimension]
    })
  })

  const normalized = dimensions.reduce((result, dimension) => {
    const scale = maximums[dimension] || 1
    result[dimension] = clamp(.5 + totals[dimension] / (scale * 2))
    return result
  }, {} as DimensionVector)

  return { totals, maximums, normalized }
}

function normalizedDimensions(answers: QuizAnswers, questions: typeof quizQuestions): DimensionVector {
  return dimensionTrace(answers, questions).normalized
}

// Extracted so diagnostics can show, per dimension, exactly how much of the total
// (weighted, squared) distance each dimension contributed -- same formula production uses.
export function distanceBreakdown(a: DimensionVector, b: DimensionVector, weights: DimensionVector) {
  const perDimension = dimensions.reduce((result, key) => {
    result[key] = weights[key] * ((a[key] - b[key]) ** 2)
    return result
  }, {} as DimensionVector)
  const total = Math.sqrt(dimensions.reduce((sum, key) => sum + perDimension[key], 0))
  return { perDimension, total }
}

function distance(a: DimensionVector, b: DimensionVector, weights: DimensionVector) {
  return distanceBreakdown(a, b, weights).total
}

function contradictionScore(answers: QuizAnswers, questions: typeof quizQuestions) {
  const contributions: Record<DimensionKey, number[]> = { temperature: [], value: [], chroma: [], contrast: [] }
  questions.forEach((question) => {
    const option = question.options.find((item) => item.id === answers[question.id])
    if (!option) return
    dimensions.forEach((dimension) => {
      const value = option.weights[dimension]
      if (Math.abs(value) >= .7) contributions[dimension].push(value)
    })
  })
  const conflicts = dimensions.map((dimension) => {
    const values = contributions[dimension]
    const positive = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0)
    const negative = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0))
    return Math.min(positive, negative) / Math.max(positive, negative, 1)
  })
  return conflicts.reduce((sum, value) => sum + value, 0) / conflicts.length
}

export function createReasons(values: DimensionVector): ResultReason[] {
  return dimensions
    .map((dimension) => ({
      dimension,
      tendency: values[dimension] >= .5 ? 'high' as const : 'low' as const,
      strengthValue: Math.abs(values[dimension] - .5),
      strength: Math.abs(values[dimension] - .5) >= .22 ? 'strong' as const : 'moderate' as const,
    }))
    .sort((a, b) => b.strengthValue - a.strengthValue)
    .slice(0, 3)
    .map(({ dimension, tendency, strength }) => ({ dimension, tendency, strength }))
}

// The full classification step, with every intermediate value intact. analyzeQuiz (the
// production result) and diagnostics.ts (the DEV-only trace) both consume this, so there
// is exactly one place the ranking/confidence math lives.
export function classify(
  answers: QuizAnswers,
  questions: typeof quizQuestions = quizQuestions,
  weights: DimensionVector = classificationWeights,
) {
  const values = normalizedDimensions(answers, questions)
  const ranked = subtypeOrder
    .map((subtype) => ({ subtype: subtype as Subtype, distance: distance(values, seasonDefinitions[subtype].target, weights) }))
    .sort((a, b) => a.distance - b.distance)

  const top = ranked[0]
  const runnerUp = ranked[1]
  const signalStrength = dimensions.reduce((sum, key) => sum + Math.abs(values[key] - .5) * 2, 0) / dimensions.length
  const separation = clamp((runnerUp.distance - top.distance) / .28)
  const consistency = 1 - contradictionScore(answers, questions)
  const answeredRatio = Object.keys(answers).length / questions.length
  const confidence = clamp(.38 + signalStrength * .22 + separation * .18 + consistency * .12 + answeredRatio * .06, .42, .91)
  const confidenceLabel: ConfidenceLabel = confidence >= .75 ? 'Strong match' : confidence >= .58 ? 'Likely match' : 'Possible match'

  return { values, ranked, top, runnerUp, signalStrength, separation, consistency, answeredRatio, confidence, confidenceLabel }
}

export function analyzeQuiz(
  answers: QuizAnswers,
  questions: typeof quizQuestions = quizQuestions,
  weights: DimensionVector = classificationWeights,
): PersonalColorResult {
  const result = classify(answers, questions, weights)
  const definition = seasonDefinitions[result.top.subtype]

  return {
    season: definition.season,
    subtype: result.top.subtype,
    dimensions: result.values,
    confidence: result.confidence,
    confidenceLabel: result.confidenceLabel,
    reasons: createReasons(result.values),
    alternatives: result.ranked.slice(1, 3).map(({ subtype }) => subtype),
  }
}
