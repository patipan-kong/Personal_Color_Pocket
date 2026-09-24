import { beforeEach, describe, expect, it } from 'vitest'
import { DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, DEFAULT_DAILY_LUCKY_COLOR_GOAL, loadDailyLuckyColorGoal, loadDailyLuckyColorGoals, saveDailyLuckyColorGoal, saveDailyLuckyColorGoals } from './dailyLuckyColorGoal'

describe('daily lucky-color goal preference', () => {
  beforeEach(() => localStorage.clear())

  it('defaults safely to Work and migrates the single-goal helper to an array value', () => {
    expect(loadDailyLuckyColorGoal()).toBe(DEFAULT_DAILY_LUCKY_COLOR_GOAL)
    saveDailyLuckyColorGoal('mentor-support')
    expect(localStorage.getItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY)).toBe('["mentor-support"]')
    expect(loadDailyLuckyColorGoal()).toBe('mentor-support')
    expect(loadDailyLuckyColorGoals()).toEqual(['mentor-support'])
  })

  it('sanitizes old scalars, malformed values, duplicates, and more than two goals', () => {
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, 'money')
    expect(loadDailyLuckyColorGoals()).toEqual(['money'])
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, 'Love')
    expect(loadDailyLuckyColorGoals()).toEqual(['work'])
    localStorage.setItem(DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, JSON.stringify(['money', 'money', 'luck', 'mentor-support']))
    expect(loadDailyLuckyColorGoals()).toEqual(['money', 'luck'])
    saveDailyLuckyColorGoals([])
    expect(loadDailyLuckyColorGoals()).toEqual(['work'])
  })
})
