import { beforeEach, describe, expect, it } from 'vitest'
import {
  DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY,
  LEGACY_DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY,
  loadDailyLuckyColorGoals,
  saveDailyLuckyColorGoals,
} from './dailyLuckyColorGoal'

describe('daily lucky-color goal preference v2', () => {
  beforeEach(() => localStorage.clear())

  it('starts fresh users with no inferred intent', () => {
    expect(loadDailyLuckyColorGoals()).toEqual([])
  })

  it.each([
    JSON.stringify(['work']),
    JSON.stringify(['money', 'luck']),
    'work',
  ])('ignores old v1 data instead of treating it as explicit intent: %s', (legacy) => {
    localStorage.setItem(LEGACY_DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY, legacy)
    expect(loadDailyLuckyColorGoals()).toEqual([])
    expect(localStorage.getItem(LEGACY_DAILY_LUCKY_COLOR_GOAL_STORAGE_KEY)).toBe(legacy)
  })

  it.each([
    { goals: [] },
    { goals: ['money'] },
    { goals: ['luck', 'mentor-support'] },
  ] as const)('persists and reloads a valid new-schema selection: $goals', ({ goals }) => {
    saveDailyLuckyColorGoals(goals)
    expect(loadDailyLuckyColorGoals()).toEqual(goals)
  })

  it('fails safely for malformed, unsupported, and structurally corrupt new-schema data', () => {
    for (const raw of ['{', JSON.stringify({ version: 1, goals: ['money'] }), JSON.stringify(['money']), JSON.stringify({ version: 2, goals: 'money' })]) {
      localStorage.setItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY, raw)
      expect(loadDailyLuckyColorGoals()).toEqual([])
    }
  })

  it('sanitizes invalid, duplicate, and excess goals in stable input order', () => {
    localStorage.setItem(DAILY_LUCKY_COLOR_GOALS_STORAGE_KEY, JSON.stringify({ version: 2, goals: ['money', 'bad', 'money', 'luck', 'work'] }))
    expect(loadDailyLuckyColorGoals()).toEqual(['money', 'luck'])

    saveDailyLuckyColorGoals(['mentor-support', 'work', 'luck'])
    expect(loadDailyLuckyColorGoals()).toEqual(['mentor-support', 'work'])
  })
})
