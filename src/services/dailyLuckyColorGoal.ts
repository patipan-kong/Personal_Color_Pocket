import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyGoal } from '../domain/luckyColor/types'

// This is intentionally independent from the quiz/profile record. A blocked storage API or an
// old/invalid value simply gives the user the deterministic first-time default.
export const DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY = 'personal-color-pocket:daily-lucky-color-goal:v1'
export const DEFAULT_DAILY_LUCKY_COLOR_GOAL: LuckyGoal = 'work'

export function isLuckyGoal(value: unknown): value is LuckyGoal {
  return typeof value === 'string' && LUCKY_GOALS.includes(value as LuckyGoal)
}

export function loadDailyLuckyColorGoal(): LuckyGoal {
  try {
    const value = localStorage.getItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY)
    return isLuckyGoal(value) ? value : DEFAULT_DAILY_LUCKY_COLOR_GOAL
  } catch {
    return DEFAULT_DAILY_LUCKY_COLOR_GOAL
  }
}

export function saveDailyLuckyColorGoal(goal: LuckyGoal) {
  try { localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, goal) } catch { /* session state still works */ }
}
