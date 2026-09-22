import { quizQuestions as defaultQuestions } from './quiz'
import { analyzeQuiz } from './scoring'
import { seasonDefinitions, subtypeOrder } from './seasons'
import type { DimensionVector, QuizAnswers, QuizQuestion, Subtype } from './types'

export const UNWEIGHTED: DimensionVector = { temperature: 1, value: 1, chroma: 1, contrast: 1 }

export function enumerateAnswers(questions: QuizQuestion[] = defaultQuestions): QuizAnswers[] {
  let combos: QuizAnswers[] = [{}]
  questions.forEach((question) => {
    const next: QuizAnswers[] = []
    combos.forEach((combo) => {
      question.options.forEach((option) => {
        next.push({ ...combo, [question.id]: option.id })
      })
    })
    combos = next
  })
  return combos
}

export interface AuditSummary {
  total: number
  bySubtype: Record<Subtype, number>
  bySeason: Record<string, number>
  confidence: { min: number; max: number; mean: number }
  confidenceLabel: Record<string, number>
  unreachable: Subtype[]
}

export function summarizeAudit(questions: QuizQuestion[] = defaultQuestions, weights?: DimensionVector): AuditSummary {
  const combos = enumerateAnswers(questions)
  const bySubtype = Object.fromEntries(subtypeOrder.map((s) => [s, 0])) as Record<Subtype, number>
  const bySeason: Record<string, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 }
  const confidenceLabel: Record<string, number> = { 'Strong match': 0, 'Likely match': 0, 'Possible match': 0 }
  let sum = 0
  let min = Infinity
  let max = -Infinity

  combos.forEach((answers) => {
    const result = weights ? analyzeQuiz(answers, questions, weights) : analyzeQuiz(answers, questions)
    bySubtype[result.subtype] += 1
    bySeason[result.season] += 1
    confidenceLabel[result.confidenceLabel] += 1
    sum += result.confidence
    min = Math.min(min, result.confidence)
    max = Math.max(max, result.confidence)
  })

  return {
    total: combos.length,
    bySubtype,
    bySeason,
    confidence: { min, max, mean: sum / combos.length },
    confidenceLabel,
    unreachable: subtypeOrder.filter((s) => bySubtype[s] === 0),
  }
}

export function resultFor(answers: QuizAnswers, questions: QuizQuestion[] = defaultQuestions, weights?: DimensionVector) {
  return weights ? analyzeQuiz(answers, questions, weights) : analyzeQuiz(answers, questions)
}

export { seasonDefinitions }
