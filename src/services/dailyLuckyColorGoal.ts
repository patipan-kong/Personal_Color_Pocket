import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyGoal } from '../domain/luckyColor/types'

// This is intentionally independent from the quiz/profile record. A blocked storage API or an
// old/invalid value simply gives the user the deterministic first-time default.
export const DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY = 'personal-color-pocket:daily-lucky-color-goal:v1'
// The key intentionally stays stable so an existing single-goal value can be migrated in place.
export const DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY = DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY
export const DEFAULT_DAILY_LUCKY_COLOR_GOAL: LuckyGoal = 'work'
export const DEFAULT_DAILY_LUCKY_COLOR_GOALS: readonly [LuckyGoal] = ['work']

export function isLuckyGoal(value: unknown): value is LuckyGoal {
  return typeof value === 'string' && LUCKY_GOALS.includes(value as LuckyGoal)
}

function sanitizeGoals(value: unknown): LuckyGoal[] {
  const source = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
  const goals: LuckyGoal[] = []
  for (const item of source) {
    if (isLuckyGoal(item) && !goals.includes(item)) goals.push(item)
    if (goals.length === 2) break
  }
  return goals.length > 0 ? goals : [DEFAULT_DAILY_LUCKY_COLOR_GOAL]
}

export function loadDailyLuckyColorGoals(): LuckyGoal[] {
  try {
    const raw = localStorage.getItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_DAILY_LUCKY_COLOR_GOALS]
    if (isLuckyGoal(raw)) return [raw]
    try {
      return sanitizeGoals(JSON.parse(raw))
    } catch {
      return [...DEFAULT_DAILY_LUCKY_COLOR_GOALS]
    }
  } catch {
    return [...DEFAULT_DAILY_LUCKY_COLOR_GOALS]
  }
}

export function saveDailyLuckyColorGoals(goals: readonly LuckyGoal[]) {
  const sanitized = sanitizeGoals(goals)
  try { localStorage.setItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY, JSON.stringify(sanitized)) } catch { /* session state still works */ }
}

// Backward-compatible single-goal helpers remain available to callers from Slice 4. They use the
// migrated array format when writing, while old scalar values remain readable through the plural
// loader above.
export function loadDailyLuckyColorGoal(): LuckyGoal {
  return loadDailyLuckyColorGoals()[0]
}

export function saveDailyLuckyColorGoal(goal: LuckyGoal) {
  saveDailyLuckyColorGoals([goal])
}
