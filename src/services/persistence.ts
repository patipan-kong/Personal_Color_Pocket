import { quizQuestions } from '../domain/personalColor/quiz'
import type { PersonalColorResult, QuizAnswers } from '../domain/personalColor/types'
import { createReasons } from '../domain/personalColor/scoring'

export const STORAGE_KEY = 'personal-color-pocket:v1'
// v1 = 9-question model. v2 = Model V2 (11 questions: adds 'clarity' and 'depth').
// The physical localStorage key intentionally does not change -- only the internal
// `version` field does -- so v2 code can still find and migrate existing v1 data.
export const STORAGE_VERSION = 2
const SUPPORTED_VERSIONS = [1, 2]

// The original 9 question IDs, frozen here (not derived from quizQuestions) so migration
// logic keeps working correctly even if quizQuestions is reordered or extended again later.
const V1_QUESTION_IDS = ['undertone', 'metal', 'white', 'earth', 'cool-color', 'hair', 'eyes', 'contrast', 'intensity']

export interface StoredState {
  version: typeof STORAGE_VERSION
  answers: QuizAnswers
  result: PersonalColorResult | null
  quizStep: number
}

export const emptyStoredState = (): StoredState => ({ version: STORAGE_VERSION, answers: {}, result: null, quizStep: 0 })

export function saveState(state: Omit<StoredState, 'version'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...state }))
  } catch {
    // The app remains usable when storage is blocked or full.
  }
}

export function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStoredState()
    const parsed = JSON.parse(raw) as Partial<Omit<StoredState, 'version'>> & { version?: number }
    if (typeof parsed.version !== 'number' || !SUPPORTED_VERSIONS.includes(parsed.version)) return emptyStoredState()
    if (typeof parsed.answers !== 'object' || parsed.answers === null) return emptyStoredState()

    const answers = parsed.answers as QuizAnswers
    // A v1 profile that had answered all 9 original questions was "complete" under the
    // old model, but its result (if any) says nothing about the two new direct chroma/
    // value observations. Do NOT surface it as a finished 11-question result, and do NOT
    // treat the missing answers as neutral -- route the user back into the quiz at the
    // first newly-added question instead. Answers are preserved untouched either way.
    const isLegacyComplete = parsed.version === 1 && V1_QUESTION_IDS.every((id) => id in answers)

    const storedResult = parsed.result && typeof parsed.result.subtype === 'string' ? parsed.result as PersonalColorResult : null
    const result = isLegacyComplete ? null : (storedResult ? {
      ...storedResult,
      reasons: !Array.isArray(storedResult.reasons) || storedResult.reasons.some((reason) => typeof reason === 'string')
        ? createReasons(storedResult.dimensions)
        : storedResult.reasons,
    } : null)

    const maxStep = quizQuestions.length - 1
    const requestedStep = isLegacyComplete
      ? V1_QUESTION_IDS.length // first newly-added question (index 9: 'clarity')
      : (typeof parsed.quizStep === 'number' ? parsed.quizStep : 0)

    return {
      version: STORAGE_VERSION,
      answers,
      result,
      quizStep: Math.max(0, Math.min(maxStep, requestedStep)),
    }
  } catch {
    return emptyStoredState()
  }
}

export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* no-op */ }
}
