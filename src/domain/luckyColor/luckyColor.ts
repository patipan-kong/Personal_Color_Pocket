import { LUCKY_COLOR_KNOWLEDGE } from './knowledge'
import type { LuckyColorRule, LuckyGoal, LuckyWeekday } from './types'
import { LUCKY_GOALS, LUCKY_WEEKDAYS } from './types'

function invalidInput(kind: string, value: unknown): never {
  throw new RangeError(`Unknown lucky-color ${kind}: ${String(value)}`)
}

function assertWeekday(weekday: LuckyWeekday): void {
  if (!LUCKY_WEEKDAYS.includes(weekday)) invalidInput('weekday', weekday)
}

function assertGoal(goal: LuckyGoal): void {
  if (!LUCKY_GOALS.includes(goal)) invalidInput('goal', goal)
}

// The supplied Date determines the civil weekday in the user's device timezone. There is no
// hidden clock, UTC conversion, timezone override, or browser state in this domain function.
export function luckyWeekdayForDate(date: Date): LuckyWeekday {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new RangeError('Invalid lucky-color date')
  return LUCKY_WEEKDAYS[date.getDay()]
}

// Returns only the four positive-goal rules. Kalakini remains in the knowledge set for
// provenance, but cannot be selected through this API.
export function getLuckyColorRule(weekday: LuckyWeekday, goal: LuckyGoal): LuckyColorRule {
  assertWeekday(weekday)
  assertGoal(goal)
  const rule = LUCKY_COLOR_KNOWLEDGE.rules.find((candidate) => candidate.weekday === weekday && candidate.goal === goal)
  if (!rule) throw new RangeError(`Missing lucky-color rule for ${weekday}:${goal}`)
  return rule
}

export function getLuckyColorForDate(date: Date, goal: LuckyGoal): LuckyColorRule {
  return getLuckyColorRule(luckyWeekdayForDate(date), goal)
}
