import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyGoal } from '../domain/luckyColor/types'

// V1 auto-selected Work, so none of its values can prove explicit user intent. V2 deliberately
// starts from an empty selection and leaves the old key untouched.
export const LEGACY_DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY = 'personal-color-pocket:daily-lucky-color-goal:v1'
export const DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY = 'personal-color-pocket:daily-lucky-color-goals:v2'
export const DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY = DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY
export const DAILY_LUCKY_COLOR_GOALS_STORAGE_VERSION = 2
export const DEFAULT_DAILY_LUCKY_COLOR_GOALS: readonly LuckyGoal[] = []

export function isLuckyGoal(value: unknown): value is LuckyGoal {
  return typeof value === 'string' && LUCKY_GOALS.includes(value as LuckyGoal)
}

function sanitizeGoals(value: unknown): LuckyGoal[] {
  const source = Array.isArray(value) ? value : []
  const goals: LuckyGoal[] = []
  for (const item of source) {
    if (isLuckyGoal(item) && !goals.includes(item)) goals.push(item)
    if (goals.length === 2) break
  }
  return goals
}

export function loadDailyLuckyColorGoals(): LuckyGoal[] {
  try {
    const raw = localStorage.getItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return []
      const envelope = parsed as Record<string, unknown>
      if (envelope.version !== DAILY_LUCKY_COLOR_GOALS_STORAGE_VERSION) return []
      return sanitizeGoals(envelope.goals)
    } catch {
      return []
    }
  } catch {
    return []
  }
}

export function saveDailyLuckyColorGoals(goals: readonly LuckyGoal[]) {
  const sanitized = sanitizeGoals(goals)
  try {
    localStorage.setItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY, JSON.stringify({ version: DAILY_LUCKY_COLOR_GOALS_STORAGE_VERSION, goals: sanitized }))
  } catch { /* session state still works */ }
}

// Backward-compatible single-goal helpers remain available to callers from Slice 4. They read and
// write only the new explicit-intent schema; the legacy key is deliberately never consulted.
export function loadDailyLuckyColorGoal(): LuckyGoal | null {
  return loadDailyLuckyColorGoals()[0] ?? null
}

export function saveDailyLuckyColorGoal(goal: LuckyGoal) {
  saveDailyLuckyColorGoals([goal])
}
