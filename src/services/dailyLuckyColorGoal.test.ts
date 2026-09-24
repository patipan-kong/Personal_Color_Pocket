import { beforeEach, describe, expect, it } from 'vitest'
import { DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, DEFAULT_DAILY_LUCKY_COLOR_GOAL, loadDailyLuckyColorGoal, saveDailyLuckyColorGoal } from './dailyLuckyColorGoal'

describe('daily lucky-color goal preference', () => {
  beforeEach(() => localStorage.clear())

  it('defaults safely to Work and persists only canonical goal IDs', () => {
    expect(loadDailyLuckyColorGoal()).toBe(DEFAULT_DAILY_LUCKY_COLOR_GOAL)
    saveDailyLuckyColorGoal('mentor-support')
    expect(localStorage.getItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY)).toBe('mentor-support')
    expect(loadDailyLuckyColorGoal()).toBe('mentor-support')
  })

  it('ignores malformed persisted values', () => {
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, 'Love')
    expect(loadDailyLuckyColorGoal()).toBe('work')
  })
})
